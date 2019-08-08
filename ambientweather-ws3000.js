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
 * F = C * 1.8 + 32
 *
 * @param c
 * @ret Fahrenheit
 */
const temperatureFahrenheit = (c) => {
	var f = c * 1.8 + 32;
	return f.toFixed(1);
};

/**
 * Calculate the NOAA Heat Index for a temperature.
 *
 * @link https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
 *
 * @param temperatureF Temperature in Fahrenheit
 * @param relativeHumidity
 * @returns {string}
 */
const heatIndex = (temperatureF, relativeHumidity) => {
	let hi;

	temperatureF = parseFloat(temperatureF);
	relativeHumidity = parseInt(relativeHumidity, 10);

	if (temperatureF >= 80) {
		hi = -42.379 + (2.04901523 * temperatureF) + (10.14333127 * relativeHumidity) -
				(0.22475541 * temperatureF * relativeHumidity) - (0.00683783 * temperatureF * temperatureF) -
				(0.05481717 * relativeHumidity * relativeHumidity) +
				(0.00122874 * temperatureF * temperatureF * relativeHumidity) +
				(0.00085282 * temperatureF * relativeHumidity * relativeHumidity) -
				(0.00000199 * temperatureF * temperatureF * relativeHumidity * relativeHumidity);

		if ((relativeHumidity < 13) && (temperatureF >= 80) && (temperatureF <= 112)) {
			hi -= ((13 - relativeHumidity) / 4) * Math.sqrt((17 - Math.abs(temperatureF - 95)) / 17)
		} else if ((relativeHumidity > 85) && (temperatureF >= 80) && (temperatureF <= 87)) {
			hi += ((relativeHumidity - 85) / 10) * ((87 - temperatureF) / 5);
		}
	} else {
		hi = 0.5 * (temperatureF + 61.0 + ((temperatureF - 68.0) * 1.2) + (relativeHumidity * 0.094));
	}

	return hi.toFixed(1);
};

/**
 * Determine the dew point for the humidity level at the current temperature.
 *
 * @link https://iridl.ldeo.columbia.edu/dochelp/QA/Basic/dewpoint.html
 * @link https://www.aprweather.com/pages/calc.htm
 *
 * @param temperatureC Current temperature in Celsius.
 * @param humidity Current relative humidity (0-100).
 * @return string Dew point temperature in Celsius.
 */
const dewPoint = (temperatureC, humidity) => {
	temperatureC = parseFloat(temperatureC);
	humidity = parseInt(humidity, 10);

	let Tdc = temperatureC - (14.55 + 0.114 * temperatureC) * (1 - (0.01 * humidity)) -
			Math.pow((2.5 + 0.007 * temperatureC) * (1 - (0.01 * humidity)), 3) -
			(15.9 + 0.117 * temperatureC) * Math.pow(1 - (0.01 * humidity), 14);

	return Tdc.toFixed(1);
};

/**
 * Break out the response section for easier testing.
 *
 * @param active boolean
 * @param temperatureC temperature in Celsius
 * @param humidity relative (0-100)
 * @returns {{dewPointF: null, temperature: null, active: *, temperatureF: *, humidity: null, dewPoint: *, heatIndexF: *}}
 */
const generateResponse = (active, temperatureC, humidity) => {
	let temperatureF = active ? temperatureFahrenheit(temperatureC) : 0;
	let dP = active ? dewPoint(temperatureC, humidity) : 0;

	// Add this sensor's data to the data we return.
	return {
		active,
		temperature: active ? temperatureC : null,
		temperatureF: active ? temperatureF : null,
		heatIndexF: active ? heatIndex(temperatureF, humidity) : null,
		dewPoint: active ? dP : null,
		dewPointF: active ? temperatureFahrenheit(dP) : null,
		humidity: active ? humidity : null,
		lastUpdateUTC: (new Date()).getUTCDate()
	};
};

/**
 * Query the WS-3000 for temperature and humidity data.
 *
 * @param debugFlag boolean Defaults to false.
 * @returns {Promise<any>}
 */
exports._generateResponse = generateResponse;
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
				let temperature = active ? temperatureCelsius(data[pos + 2], data[pos + 1]) : 0;
				let humidity = active ? data[pos + 3] : 0;

				// Add this sensor's data to the data we return.
				ret[x + 1] = generateResponse(active, temperature, humidity);
			}
			resolver(ret);
			return ret;
		}).catch((error) => {
			reject(error);
		});
	});
};
