# USB Library for the Ambient Weather WS-3000
Pull the current temperature and humidity levels for up to 8 remote sensors. Designed for Node.js.

# Usage
```shell
npm install EpicVoyage/ambientweather-ws3000
```

```javascript
async function main() {
  let ws3000 = require('ambientweather-ws3000');
  let sensors = await ws3000.query();
  for (let x = 0; x < 8; x++) {
    if (sensors[x].active) {
      console.info('Sensor', x + 1, 'Temperature:', sensors[x].temperature + '°C, Humidity:', sensors[x].humidity + '%');
    }
  }
}

main();
```

# Debugging
To enable console debug messages, pass `true` to `query()`:
```javascript
let ws3000 = require('ambientweather-ws3000');
let sensors = await ws3000.query(true);
```
This turns on debug messages for libusb and prints all data sent or received from the WS-3000.

# Installation on Raspbian (Raspberry Pi)
You will need the git, libusb-dev and libudev-dev packages.

```shell
sudo apt-get install git libusb-dev libudev-dev
```
