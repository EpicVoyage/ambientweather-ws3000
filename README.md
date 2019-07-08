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
  for (let x = 1; x <= 8; x++) {
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
You will need the build-essential, git, libusb-dev and libudev-dev packages.

```shell
sudo apt-get install build-essential git libusb-dev libudev-dev
```

To connect to the USB port as the `pi` user, create `/etc/udev/rules.d/50-stmicro.rules` [with these contents](https://raspberrypi.stackexchange.com/a/10465/103076):

```
ATTRS{idVendor}=="0483", ATTRS{idProduct}=="5750", SUBSYSTEMS=="usb", ACTION=="add", MODE="0666", GROUP="plugdev"
```
