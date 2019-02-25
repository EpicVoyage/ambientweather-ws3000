'use strict';

// USB VENDOR_ID:PRODUCT_ID
const VENDOR_ID = 0x0483;
const PRODUCT_ID = 0x5750;

const TEMP_HUMID_DATA = 0x03;
// const UNKNOWN_DATA1 = 0x04;
// const UNKNOWN_DATA2 = 0x41;
// const UNKNOWN_DATA3 = 0x06;
// const UNKNOWN_DATA4 = 0x08;
// const UNKNOWN_DATA5 = 0x09;
// const UNKNOWN_DATA6 = 0x05;

/**
 * Sensor status:
 *
 * Positive Temperature (Celsius) == 0x00
 * High Temperature (Celsius) == 0x01
 * Negative Temperature (Celsius) = 0xFF
 * Inactive = 0x7F
 */
const SENSOR_NEGATIVE = 0xFF;
const SENSOR_HIGH = 0x01;
const SENSOR_INACTIVE = 0x7F;

function logHex (label, data) {
	let str = data ? data.toString('hex').replace(/([0-9a-f]{2})/g, '$1 ').replace(/((?:[0-9a-f]{2} ){16})/g, '\n$1').toUpperCase() : '';
	console.debug(label, str);
}

/**
 * C = temp / 10
 *
 * When the WS-3000 hits a negative number, the first field value (rangeIndicator) becomes 0xFF and temp
 * counts down from 256.
 *
 * @param temp
 * @param rangeIndicator Indicates which temperature range temp is in (0-25.6C, -25.6-0C, 25.6-51.2C)
 * @returns string ##.#
 */
const temperatureCelsius = (temp, rangeIndicator) => {
	var c = temp / 10;

	if (rangeIndicator === SENSOR_NEGATIVE) {
		c = -1 * (25.6 - c);
	} else if (rangeIndicator === SENSOR_HIGH) {
		c += 25.6;
	}

	return c.toFixed(1);
};

/**
 * Query the WS-3000 for temperature and humidity data.
 *
 * @param debugFlag boolean Defaults to false.
 * @returns {Promise<any>}
 */
exports.query = (debugFlag = false) => {
	return new Promise(function (resolve, reject) {
		let usb = require('usb');

		// Attempt to include timestamps in debug logs.
		if (debugFlag) {
			try {
				require('console-stamp')(console, '[HH:MM:ss.l]');
			} catch (e) {
				// Silently fail if console-stamp is not available, but pass on other errors.
				// @link https://stackoverflow.com/a/17566436/850782
				if ((e.code !== 'MODULE_NOT_FOUND') || (e.message.indexOf('\'console-stamp\'') === -1)) {
					reject(e);
				}
			}

			// Turn on debug logging for libusb.
			usb.setDebugLevel(4);
		}

		// Look up the base station by known Vendor/Product IDs.
		let baseStation = usb.findByIds(VENDOR_ID, PRODUCT_ID);

		if (typeof baseStation === 'undefined') {
			if (debugFlag) {
				console.error('Base Station not found.');
			}
			reject(new Error('Base Station not found'));
		}

		// Open communication with the base station.
		baseStation.open(true);
		if (debugFlag) {
			console.debug('open', baseStation.interfaces[0]);
		}

		// Open in/out interfaces for the base station.
		// Out = to device
		// In = from device
		let deviceInterface = baseStation.interfaces[0];
		let endpoints = deviceInterface.endpoints;

		// If the kernelDriver might interfere with us, detach it now and reattach it when we are done.
		// @link https://stackoverflow.com/a/42812516/850782
		let kernelDriverAttached = false;
		let resolver = (data) => {
			deviceInterface.release(function () {
				if (kernelDriverAttached) {
					deviceInterface.attachKernelDriver();
				}
				// baseStation.close();
				resolve(data);
			});
		};

		if (deviceInterface.isKernelDriverActive()) {
			deviceInterface.detachKernelDriver();
			kernelDriverAttached = true;
		}

		// Prevent other software from communicating with the WS-3000 until we are done.
		deviceInterface.claim();

		if (debugFlag) {
			console.debug('endpoints[0]', deviceInterface);
		}

		let inEndpoint = endpoints[0]; // Driver showed 82
		let outEndpoint = endpoints[1];

		if (debugFlag) {
			console.debug('radioOut', outEndpoint.direction, outEndpoint.transferType, outEndpoint.descriptor.bEndpointAddress);
			console.debug('radioIn', inEndpoint.direction, inEndpoint.transferType, inEndpoint.descriptor.bEndpointAddress);
		}

		/**
		 * Send a single-byte request to the WS-3000.
		 *
		 * @param command byte
		 * @returns {Promise<any>}
		 */
		const requestInfo = (command) => {
			return new Promise(function (resolve, reject) {
				// Handle the expected response from the WS-3000.
				const onData = (data) => {
					if (debugFlag) {
						logHex('onData', data);
					}
					// We only expect one response, so stop polling for more.
					inEndpoint.stopPoll(function () {
						resolve(data);
					});
				};

				// Handle any errors.
				const onError = (error) => {
					if (debugFlag) {
						console.error('onError', error);
					}
					inEndpoint.stopPoll(function () {
						reject(error);
					});
				};

				// Remove our event listeners when we stop polling. The event listeners can't be used
				// for the next request anyway.
				const onEnd = () => {
					if (debugFlag) {
						console.debug('Stopped poll');
					}
					inEndpoint.removeListener('data', onData);
					inEndpoint.removeListener('error', onError);
					inEndpoint.removeListener('end', onEnd);
				};

				// Listen for a response.
				inEndpoint.transferType = 2;
				inEndpoint.startPoll(1, 64);
				inEndpoint.on('data', onData);
				inEndpoint.on('error', onError);
				inEndpoint.on('end', onEnd);

				// Send our request. The "command" byte appears to be the only one that changes, even though
				// several request-types are known to exist.
				const request = [0x7b, command, 0x40, 0x7d];
				outEndpoint.transferType = 2;
				if (debugFlag) {
					logHex('transfer', Buffer.from(request));
				}
				outEndpoint.transfer(request).on('error', (error) => {
					if (debugFlag) {
						console.error('transfer', error);
					}
					reject(error);
				});
			});
		};

		// Request temperature and humidity data from the WS-3000.
		requestInfo(TEMP_HUMID_DATA).then((data) => {
			// Basic response check.
			if (data[0] !== 0x7B) {
				if (debugFlag) {
					console.error('Did not understand response');
					reject(new Error('Did not understand response'));
				}
			}

			// Loop through and parse the response data so it is easier to use.
			let ret = [];
			for (let x = 0; x < 8; x++) {
				let pos = x * 3;
				// It appears that Temperature+ == 0x00, Temperature- = 0xFF, Inactive = 0x7F.
				let active = (data[pos + 1] !== SENSOR_INACTIVE);

				// Add this sensor's data to the data we return.
				ret.push({
					active,
					temperature: active ? temperatureCelsius(data[pos + 2], data[pos + 1]) : null,
					humidity: active ? data[pos + 3] : null
				});
			}
			resolver(ret);
			return ret;
		}).catch((error) => {
			reject(error);
		});
	});
};
