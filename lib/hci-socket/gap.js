const debug = require('debug')('gap');

const { EventEmitter } = require('events');
const os = require('os');

const Hci = require('./hci');

const isLinux = (os.platform() === 'linux');
const isIntelEdison = isLinux && (os.release().includes('edison'));
const isYocto = isLinux && (os.release().includes('yocto'));

class Gap extends EventEmitter {
  constructor(hci) {
    super();

    this._hci = hci;

    this._advertiseState = null;

    this._hci.on('error', this.onHciError.bind(this));

    this._hci.on('leAdvertisingParametersSet', this.onHciLeAdvertisingParametersSet.bind(this));
    this._hci.on('leAdvertisingDataSet', this.onHciLeAdvertisingDataSet.bind(this));
    this._hci.on('leScanResponseDataSet', this.onHciLeScanResponseDataSet.bind(this));
    this._hci.on('leAdvertiseEnableSet', this.onHciLeAdvertiseEnableSet.bind(this));
  }

  startAdvertising(name, serviceUuids) {
    debug('startAdvertising: name = ' + name + ', serviceUuids = ' + JSON.stringify(serviceUuids, null, 2));

    let advertisementDataLength = 3;
    let scanDataLength = 0;

    const serviceUuids16bit = [];
    const serviceUuids128bit = [];

    if (name && name.length) {
      scanDataLength += 2 + name.length;
    }

    if (serviceUuids && serviceUuids.length) {
      for (let i = 0; i < serviceUuids.length; i++) {
        const serviceUuid = Buffer.from(serviceUuids[i].match(/.{1,2}/g).reverse().join(''), 'hex');

        if (serviceUuid.length === 2) {
          serviceUuids16bit.push(serviceUuid);
        } else if (serviceUuid.length === 16) {
          serviceUuids128bit.push(serviceUuid);
        }
      }
    }

    if (serviceUuids16bit.length) {
      advertisementDataLength += 2 + 2 * serviceUuids16bit.length;
    }

    if (serviceUuids128bit.length) {
      advertisementDataLength += 2 + 16 * serviceUuids128bit.length;
    }

    const advertisementData = Buffer.alloc(advertisementDataLength);
    const scanData = Buffer.alloc(scanDataLength);

    // flags
    advertisementData.writeUInt8(2, 0);
    advertisementData.writeUInt8(0x01, 1);
    advertisementData.writeUInt8(0x06, 2);

    let advertisementDataOffset = 3;

    if (serviceUuids16bit.length) {
      advertisementData.writeUInt8(1 + 2 * serviceUuids16bit.length, advertisementDataOffset);
      advertisementDataOffset++;

      advertisementData.writeUInt8(0x03, advertisementDataOffset);
      advertisementDataOffset++;

      for (let i = 0; i < serviceUuids16bit.length; i++) {
        serviceUuids16bit[i].copy(advertisementData, advertisementDataOffset);
        advertisementDataOffset += serviceUuids16bit[i].length;
      }
    }

    if (serviceUuids128bit.length) {
      advertisementData.writeUInt8(1 + 16 * serviceUuids128bit.length, advertisementDataOffset);
      advertisementDataOffset++;

      advertisementData.writeUInt8(0x06, advertisementDataOffset);
      advertisementDataOffset++;

      for (let i = 0; i < serviceUuids128bit.length; i++) {
        serviceUuids128bit[i].copy(advertisementData, advertisementDataOffset);
        advertisementDataOffset += serviceUuids128bit[i].length;
      }
    }

    // name
    if (name && name.length) {
      const nameBuffer = Buffer.from(name);

      scanData.writeUInt8(1 + nameBuffer.length, 0);
      scanData.writeUInt8(0x08, 1);
      nameBuffer.copy(scanData, 2);
    }

    this.startAdvertisingWithEIRData(advertisementData, scanData);
  }

  startAdvertisingIBeacon(data) {
    debug('startAdvertisingIBeacon: data = ' + data.toString('hex'));

    const dataLength = data.length;
    const manufacturerDataLength = 4 + dataLength;
    const advertisementDataLength = 5 + manufacturerDataLength;
    const scanDataLength = 0;

    const advertisementData = Buffer.alloc(advertisementDataLength);
    const scanData = Buffer.alloc(0);

    // flags
    advertisementData.writeUInt8(2, 0);
    advertisementData.writeUInt8(0x01, 1);
    advertisementData.writeUInt8(0x06, 2);

    advertisementData.writeUInt8(manufacturerDataLength + 1, 3);
    advertisementData.writeUInt8(0xff, 4);
    advertisementData.writeUInt16LE(0x004c, 5); // Apple Company Identifier LE (16 bit)
    advertisementData.writeUInt8(0x02, 7); // type, 2 => iBeacon
    advertisementData.writeUInt8(dataLength, 8);

    data.copy(advertisementData, 9);

    this.startAdvertisingWithEIRData(advertisementData, scanData);
  }

  startAdvertisingWithEIRData(advertisementData, scanData) {
    advertisementData = advertisementData || Buffer.alloc(0);
    scanData = scanData || Buffer.alloc(0);

    debug('startAdvertisingWithEIRData: advertisement data = ' + advertisementData.toString('hex') + ', scan data = ' + scanData.toString('hex'));

    let error = null;

    if (advertisementData.length > 31) {
      error = new Error('Advertisement data is over maximum limit of 31 bytes');
    } else if (scanData.length > 31) {
      error = new Error('Scan data is over maximum limit of 31 bytes');
    }

    if (error) {
      this.emit('advertisingStart', error);
    } else {
      this._advertiseState = 'starting';

      if (isIntelEdison || isYocto) {
        // work around for Intel Edison
        debug('skipping first set of scan response and advertisement data');
      } else {
        this._hci.setScanResponseData(scanData);
        this._hci.setAdvertisingData(advertisementData);
      }
      this._hci.setAdvertiseEnable(true);
      this._hci.setScanResponseData(scanData);
      this._hci.setAdvertisingData(advertisementData);
    }
  }

  restartAdvertising() {
    this._advertiseState = 'restarting';

    this._hci.setAdvertiseEnable(true);
  }

  stopAdvertising() {
    this._advertiseState = 'stopping';

    this._hci.setAdvertiseEnable(false);
  }

  onHciError(error) {
  }

  onHciLeAdvertisingParametersSet(status) {
  }

  onHciLeAdvertisingDataSet(status) {
  }

  onHciLeScanResponseDataSet(status) {
  }

  onHciLeAdvertiseEnableSet(status) {
    if (this._advertiseState === 'starting') {
      this._advertiseState = 'started';

      let error = null;

      if (status) {
        error = new Error(Hci.STATUS_MAPPER[status] || ('Unknown (' + status + ')'));
      }

      this.emit('advertisingStart', error);
    } else if (this._advertiseState === 'stopping') {
      this._advertiseState = 'stopped';

      this.emit('advertisingStop');
    }
  }
}

module.exports = Gap;
