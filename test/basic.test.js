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

			for (let x = 0; x < 8; x++) {
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
});
