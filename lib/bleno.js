const debug = require('debug')('bleno');

const { EventEmitter } = require('events');
const os = require('os');

const UuidUtil = require('./uuid-util');

const PrimaryService = require('./primary-service');
const Characteristic = require('./characteristic');
const Descriptor = require('./descriptor');

let bindings = null;

const platform = os.platform();

if (platform === 'darwin') {
  bindings = require('./mac/bindings');
} else if (platform === 'linux' || platform === 'freebsd' || platform === 'win32' || platform === 'android') {
  bindings = require('./hci-socket/bindings');
} else {
  throw new Error('Unsupported platform ' + platform);
}

class Bleno extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
    this.platform = 'unknown';
    this.state = 'unknown';
    this.address = 'unknown';
    this.rssi = 0;
    this.mtu = 20;

    this._bindings = bindings;

    this._bindings.on('stateChange', this.onStateChange.bind(this));
    this._bindings.on('platform', this.onPlatform.bind(this));
    this._bindings.on('addressChange', this.onAddressChange.bind(this));
    this._bindings.on('advertisingStart', this.onAdvertisingStart.bind(this));
    this._bindings.on('advertisingStop', this.onAdvertisingStop.bind(this));
    this._bindings.on('servicesSet', this.onServicesSet.bind(this));
    this._bindings.on('accept', this.onAccept.bind(this));
    this._bindings.on('mtuChange', this.onMtuChange.bind(this));
    this._bindings.on('disconnect', this.onDisconnect.bind(this));
    this._bindings.on('rssiUpdate', this.onRssiUpdate.bind(this));

    this.on('newListener', (event) => {
      if (event === 'stateChange' && !this.initialized) {
        this._bindings.init();

        this.initialized = true;
      }
    });
  }

  onPlatform(platform) {
    debug('platform ' + platform);

    this.platform = platform;
  }

  onStateChange(state) {
    debug('stateChange ' + state);

    this.state = state;

    this.emit('stateChange', state);
  }

  onAddressChange(address) {
    debug('addressChange ' + address);

    this.address = address;
  }

  onAccept(clientAddress) {
    debug('accept ' + clientAddress);
    this.emit('accept', clientAddress);
  }

  onMtuChange(mtu) {
    debug('mtu ' + mtu);

    this.mtu = mtu;

    this.emit('mtuChange', mtu);
  }

  onDisconnect(clientAddress) {
    debug('disconnect ' + clientAddress);
    this.emit('disconnect', clientAddress);
  }

  startAdvertising(name, serviceUuids, callback) {
    if (this.state !== 'poweredOn') {
      const error = new Error('Could not start advertising, state is ' + this.state + ' (not poweredOn)');

      if (typeof callback === 'function') {
        callback(error);
      } else {
        throw error;
      }
    } else {
      if (typeof callback === 'function') {
        this.once('advertisingStart', callback);
      }

      const undashedServiceUuids = [];

      if (serviceUuids && serviceUuids.length) {
        for (let i = 0; i < serviceUuids.length; i++) {
          undashedServiceUuids[i] = UuidUtil.removeDashes(serviceUuids[i]);
        }
      }

      this._bindings.startAdvertising(name, undashedServiceUuids);
    }
  }

  startAdvertisingIBeacon(uuid, major, minor, measuredPower, callback) {
    if (this.state !== 'poweredOn') {
      const error = new Error('Could not start advertising, state is ' + this.state + ' (not poweredOn)');

      if (typeof callback === 'function') {
        callback(error);
      } else {
        throw error;
      }
    } else {
      const undashedUuid = UuidUtil.removeDashes(uuid);
      const uuidData = Buffer.from(undashedUuid, 'hex');
      const uuidDataLength = uuidData.length;
      const iBeaconData = Buffer.alloc(uuidData.length + 5);

      for (let i = 0; i < uuidDataLength; i++) {
        iBeaconData[i] = uuidData[i];
      }

      iBeaconData.writeUInt16BE(major, uuidDataLength);
      iBeaconData.writeUInt16BE(minor, uuidDataLength + 2);
      iBeaconData.writeInt8(measuredPower, uuidDataLength + 4);

      if (typeof callback === 'function') {
        this.once('advertisingStart', callback);
      }

      debug('iBeacon data = ' + iBeaconData.toString('hex'));

      this._bindings.startAdvertisingIBeacon(iBeaconData);
    }
  }

  onAdvertisingStart(error) {
    debug('advertisingStart: ' + error);

    if (error) {
      this.emit('advertisingStartError', error);
    } else {
      this.emit('advertisingStart', error);
    }
  }

  startAdvertisingWithEIRData(advertisementData, scanData, callback) {
    if (typeof scanData === 'function') {
      callback = scanData;
      scanData = null;
    }

    if (this.state !== 'poweredOn') {
      const error = new Error('Could not advertising scanning, state is ' + this.state + ' (not poweredOn)');

      if (typeof callback === 'function') {
        callback(error);
      } else {
        throw error;
      }
    } else {
      if (typeof callback === 'function') {
        this.once('advertisingStart', callback);
      }

      this._bindings.startAdvertisingWithEIRData(advertisementData, scanData);
    }
  }

  stopAdvertising(callback) {
    if (typeof callback === 'function') {
      this.once('advertisingStop', callback);
    }
    this._bindings.stopAdvertising();
  }

  onAdvertisingStop() {
    debug('advertisingStop');
    this.emit('advertisingStop');
  }

  setServices(services, callback) {
    if (typeof callback === 'function') {
      this.once('servicesSet', callback);
    }
    this._bindings.setServices(services);
  }

  onServicesSet(error) {
    debug('servicesSet');

    if (error) {
      this.emit('servicesSetError', error);
    } else {
      this.emit('servicesSet', error);
    }
  }

  disconnect() {
    debug('disconnect');
    this._bindings.disconnect();
  }

  updateRssi(callback) {
    if (typeof callback === 'function') {
      this.once('rssiUpdate', (rssi) => callback(null, rssi));
    }

    this._bindings.updateRssi();
  }

  onRssiUpdate(rssi) {
    this.emit('rssiUpdate', rssi);
  }
}

Bleno.prototype.PrimaryService = PrimaryService;
Bleno.prototype.Characteristic = Characteristic;
Bleno.prototype.Descriptor = Descriptor;

module.exports = Bleno;
