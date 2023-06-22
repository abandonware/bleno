const bleno = require('./index');

const BlenoPrimaryService = bleno.PrimaryService;
const BlenoCharacteristic = bleno.Characteristic;
const BlenoDescriptor = bleno.Descriptor;

console.log('bleno');

console.log(bleno.PrimaryService);

class StaticReadOnlyCharacteristic extends BlenoCharacteristic {
  constructor() {
    super({
      uuid: 'fffffffffffffffffffffffffffffff1',
      properties: ['read'],
      value: Buffer.from('value'),
      descriptors: [
        new BlenoDescriptor({
          uuid: '2901',
          value: 'user description'
        })
      ]
    });
  }
}

class DynamicReadOnlyCharacteristic extends BlenoCharacteristic {
  constructor() {
    super({
      uuid: 'fffffffffffffffffffffffffffffff2',
      properties: ['read']
    });
  }

  onReadRequest(offset, callback) {
    let result = this.RESULT_SUCCESS;
    let data = Buffer.from('dynamic value');

    if (offset > data.length) {
      result = this.RESULT_INVALID_OFFSET;
      data = null;
    } else {
      data = data.slice(offset);
    }

    callback(result, data);
  }
}

class LongDynamicReadOnlyCharacteristic extends BlenoCharacteristic {
  constructor() {
    super({
      uuid: 'fffffffffffffffffffffffffffffff3',
      properties: ['read']
    });
  }

  onReadRequest(offset, callback) {
    let result = this.RESULT_SUCCESS;
    let data = Buffer.alloc(512);

    for (let i = 0; i < data.length; i++) {
      data[i] = i % 256;
    }

    if (offset > data.length) {
      result = this.RESULT_INVALID_OFFSET;
      data = null;
    } else {
      data = data.slice(offset);
    }

    callback(result, data);
  }
}

class WriteOnlyCharacteristic extends BlenoCharacteristic {
  constructor() {
    super({
      uuid: 'fffffffffffffffffffffffffffffff4',
      properties: ['write', 'writeWithoutResponse']
    });
  }

  onWriteRequest(data, offset, withoutResponse, callback) {
    console.log('WriteOnlyCharacteristic write request: ' + data.toString('hex') + ' ' + offset + ' ' + withoutResponse);

    callback(this.RESULT_SUCCESS);
  }
}

class NotifyOnlyCharacteristic extends BlenoCharacteristic {
  constructor() {
    super({
      uuid: 'fffffffffffffffffffffffffffffff5',
      properties: ['notify']
    });
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    console.log('NotifyOnlyCharacteristic subscribe');

    this.counter = 0;
    this.changeInterval = setInterval(function() {
      const data = Buffer.alloc(4);
      data.writeUInt32LE(this.counter, 0);

      console.log('NotifyOnlyCharacteristic update value: ' + this.counter);
      updateValueCallback(data);
      this.counter++;
    }.bind(this), 5000);
  }

  onUnsubscribe() {
    console.log('NotifyOnlyCharacteristic unsubscribe');

    if (this.changeInterval) {
      clearInterval(this.changeInterval);
      this.changeInterval = null;
    }
  }

  onNotify() {
    console.log('NotifyOnlyCharacteristic on notify');
  }
}

class IndicateOnlyCharacteristic extends BlenoCharacteristic {
  constructor() {
    super({
      uuid: 'fffffffffffffffffffffffffffffff6',
      properties: ['indicate']
    });
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    console.log('IndicateOnlyCharacteristic subscribe');

    this.counter = 0;
    this.changeInterval = setInterval(function () {
      const data = Buffer.alloc(4);
      data.writeUInt32LE(this.counter, 0);

      console.log('IndicateOnlyCharacteristic update value: ' + this.counter);
      updateValueCallback(data);
      this.counter++;
    }.bind(this), 1000);
  }

  onUnsubscribe() {
    console.log('IndicateOnlyCharacteristic unsubscribe');

    if (this.changeInterval) {
      clearInterval(this.changeInterval);
      this.changeInterval = null;
    }
  }

  onIndicate() {
    console.log('IndicateOnlyCharacteristic on indicate');
  }
}

class SampleService extends BlenoPrimaryService {
  constructor() {
    super({
      uuid: 'fffffffffffffffffffffffffffffff0',
      characteristics: [
        new StaticReadOnlyCharacteristic(),
        new DynamicReadOnlyCharacteristic(),
        new LongDynamicReadOnlyCharacteristic(),
        new WriteOnlyCharacteristic(),
        new NotifyOnlyCharacteristic(),
        new IndicateOnlyCharacteristic()
      ]
    });
  }
}

bleno.on('stateChange', function(state) {
  console.log('on -> stateChange: ' + state + ', address = ' + bleno.address);

  if (state === 'poweredOn') {
    bleno.startAdvertising('test', ['fffffffffffffffffffffffffffffff0']);
  } else {
    bleno.stopAdvertising();
  }
});

// Linux only events /////////////////
bleno.on('accept', function(clientAddress) {
  console.log('on -> accept, client: ' + clientAddress);

  bleno.updateRssi();
});

bleno.on('disconnect', function(clientAddress) {
  console.log('on -> disconnect, client: ' + clientAddress);
});

bleno.on('rssiUpdate', function(rssi) {
  console.log('on -> rssiUpdate: ' + rssi);
});
//////////////////////////////////////

bleno.on('mtuChange', function(mtu) {
  console.log('on -> mtuChange: ' + mtu);
});

bleno.on('advertisingStart', function(error) {
  console.log('on -> advertisingStart: ' + (error ? 'error ' + error : 'success'));

  if (!error) {
    bleno.setServices([
      new SampleService()
    ]);
  }
});

bleno.on('advertisingStop', function() {
  console.log('on -> advertisingStop');
});

bleno.on('servicesSet', function(error) {
  console.log('on -> servicesSet: ' + (error ? 'error ' + error : 'success'));
});
