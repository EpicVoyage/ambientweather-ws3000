/* eslint-disable no-undef */
'use strict';

const expect = require('chai').expect;

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

describe('Basic Test', function () {
	// Increase the test timeout to 5 seconds. This cannot be contained in an arrow function.
	this.timeout(5000);

	it('Counts the Active Sensors', async () => {
		let ws3000 = require('../ambientweather-ws3000');

		try {
			let sensors = await ws3000.query();
			let total = 0;

			for (let x = 1; x <= 8; x++) {
				if (sensors[x].active) {
					console.info('Sensor', x + 1, 'Temperature:', temperatureFahrenheit(sensors[x].temperature) + '°F,', 'Humidity:', sensors[x].humidity + '%');
					total++;
				}
			}

			expect(total).to.not.be.equal(0);
		} catch (e) {
			throw e;
		}
	});

	it('Verifies output calculations (80F/50%)', async () => {
		let ws3000 = require('../ambientweather-ws3000');
		let result = await ws3000._generateResponse(true, 26, 50);

		expect(result.active).to.be.equal(true);
		expect(result.temperature).to.be.equal(26);
		expect(result.temperatureF).to.be.equal('78.8');
		expect(result.heatIndexF).to.be.equal('78.7');
		expect(result.dewPoint).to.be.equal('14.8');
		expect(result.dewPointF).to.be.equal('58.6');
		expect(result.humidity).to.be.equal(50);
	});

	it('Verifies output calculations (90F/100%)', async () => {
		let ws3000 = require('../ambientweather-ws3000');
		let result = await ws3000._generateResponse(true, 32, 100);

		expect(result.active).to.be.equal(true);
		expect(result.temperature).to.be.equal(32);
		expect(result.temperatureF).to.be.equal('89.6');
		expect(result.heatIndexF).to.be.equal('129.5');
		expect(result.dewPoint).to.be.equal('32.0');
		expect(result.dewPointF).to.be.equal('89.6');
		expect(result.humidity).to.be.equal(100);
	});

	it('Verifies output calculations (inactive)', async () => {
		let ws3000 = require('../ambientweather-ws3000');
		let result = await ws3000._generateResponse(false, 32, 100);

		expect(result.active).to.be.equal(false);
		expect(result.temperature).to.be.equal(null);
		expect(result.temperatureF).to.be.equal(null);
		expect(result.heatIndexF).to.be.equal(null);
		expect(result.dewPoint).to.be.equal(null);
		expect(result.dewPointF).to.be.equal(null);
		expect(result.humidity).to.be.equal(null);
	});
});
