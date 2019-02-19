# USB Library for the Ambient Weather WS-3000
Pull the current temperature and humidity levels for up to 8 remote sensors. Designed for Node.js.

# Usage
```javascript
let ws3000 = require('ambientweather-ws3000');
let sensors = await ws3000.query();
for (let x = 0; x < 8; x++) {
  if (sensors[x].active) {
    console.info('Sensor', x + 1, 'Temperature:', sensors[x].temperature + '°C, Humidity:', sensors[x].humidity + '%');
  }
}
```

# Debugging
To enable console debug messages, pass `true` to `query()`:
```javascript
let ws3000 = require('ambientweather-ws3000');
let sensors = await ws3000.query(true);
```
This turns on debug messages for libusb and prints all data sent or received from the WS-3000.

# Todo
* Temperatures below freezing will probably appear as really high temperatures.
