var util = require('util');

var bleno = require('./index');


var BlenoPrimaryService = bleno.PrimaryService;
var BlenoCharacteristic = bleno.Characteristic;
var BlenoDescriptor = bleno.Descriptor;

let handshakeDone = false;
let C2Callback = null;

console.log('bleno');

var C3DynamicReadOnlyCharacteristic = function() {
  C3DynamicReadOnlyCharacteristic.super_.call(this, {
    uuid: '64630238-8772-45F2-B87D-748A83218F04',
    properties: ['read']
  });
};

util.inherits(C3DynamicReadOnlyCharacteristic, BlenoCharacteristic);

C3DynamicReadOnlyCharacteristic.prototype.onReadRequest = function(offset, callback) {
  var result = this.RESULT_SUCCESS;
  var data = Buffer.from('dynamic value');

  console.log('C3DynamicReadOnlyCharacteristic read request: ' + data.toString('hex') + ' ' + offset);

  if (offset > data.length) {
    result = this.RESULT_INVALID_OFFSET;
    data = null;
  } else {
    data = data.slice(offset);
  }

  callback(result, data);
};

var C1WriteOnlyCharacteristic = function() {
  C1WriteOnlyCharacteristic.super_.call(this, {
    uuid: '18EE2EF5-263D-4559-959F-4F9C429F9D11',
    properties: ['write']
  });
};

util.inherits(C1WriteOnlyCharacteristic, BlenoCharacteristic);

C1WriteOnlyCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
  console.log('C1WriteOnlyCharacteristic write request: ' + data.toString('hex') + ' ' + offset + ' ' + withoutResponse);

  if (data[0] === 0x65 && data[1] === 0x6c) {
    handshakeDone = true;
    callback();
    return;
  }

  callback(this.RESULT_SUCCESS);
};

var C2IndicateOnlyCharacteristic = function() {
  C2IndicateOnlyCharacteristic.super_.call(this, {
    uuid: '18EE2EF5-263D-4559-959F-4F9C429F9D12',
    properties: ['indicate']
  });
};

util.inherits(C2IndicateOnlyCharacteristic, BlenoCharacteristic);

C2IndicateOnlyCharacteristic.prototype.onSubscribe = function(maxValueSize, updateValueCallback) {
  console.log('C2IndicateOnlyCharacteristic subscribe ' + maxValueSize);

  if (handshakeDone) {
    C2Callback = updateValueCallback;
    console.log('C2IndicateOnlyCharacteristic handshake response');
    updateValueCallback(Buffer.from("656c04000106", "hex"));
  }
  /*this.counter = 0;
  this.changeInterval = setInterval(function() {
    var data = Buffer.alloc(4);
    data.writeUInt32LE(this.counter, 0);

    console.log('C2IndicateOnlyCharacteristic update value: ' + this.counter);
    updateValueCallback(data);
    this.counter++;
  }.bind(this), 1000);*/
};

C2IndicateOnlyCharacteristic.prototype.onUnsubscribe = function() {
  console.log('C2IndicateOnlyCharacteristic unsubscribe');

  if (this.changeInterval) {
    clearInterval(this.changeInterval);
    this.changeInterval = null;
  }
};

C2IndicateOnlyCharacteristic.prototype.onIndicate = function() {
  console.log('C2IndicateOnlyCharacteristic on indicate');
};

function MatterService() {
  MatterService.super_.call(this, {
    uuid: 'fff6', // 0xfff6 ?!
    characteristics: [
      new C3DynamicReadOnlyCharacteristic(),
      new C1WriteOnlyCharacteristic(),
      new C2IndicateOnlyCharacteristic()
    ]
  });
}

util.inherits(MatterService, BlenoPrimaryService);

bleno.on('stateChange', function(state) {
  console.log('on -> stateChange: ' + state + ', address = ' + bleno.address);

  if (state === 'poweredOn') {
    //bleno.startAdvertising('test', ['fffffffffffffffffffffffffffffff0']);

    // Data as defined 5.4.2.5.6 Matter Spec for a hardcoded product and vendor Id
    // Theoretically use this QR Code https://project-chip.github.io/connectedhomeip/qrcode.html?data=MT:86PS0KQS02-10648G00

    const advertiseBuffer = Buffer.alloc(15);
    advertiseBuffer.writeUInt8(0x02, 0);
    advertiseBuffer.writeUInt8(0x01, 1);
    advertiseBuffer.writeUInt8(0x06, 2);
    advertiseBuffer.writeUInt8(0x0B, 3);
    advertiseBuffer.writeUInt8(0x16, 4);
    advertiseBuffer.writeUInt16LE(0xFFF6, 5);
    advertiseBuffer.writeUInt8(0x00, 7);
    advertiseBuffer.writeUInt16LE(1234, 8);
    advertiseBuffer.writeUInt16LE(65522, 10);
    advertiseBuffer.writeUInt16LE(32770, 12);
    advertiseBuffer.writeUInt8(0x00, 14);
    bleno.startAdvertisingWithEIRData(advertiseBuffer);
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
      new MatterService()
    ]);
  }
});

bleno.on('advertisingStop', function() {
  console.log('on -> advertisingStop');
});

bleno.on('servicesSet', function(error) {
  console.log('on -> servicesSet: ' + (error ? 'error ' + error : 'success'));
});
