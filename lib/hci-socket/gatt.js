/*jshint loopfunc: true */

const debug = require('debug')('gatt');

const { EventEmitter } = require('events');
const os = require('os');

const ATT_OP_ERROR                    = 0x01;
const ATT_OP_MTU_REQ                  = 0x02;
const ATT_OP_MTU_RESP                 = 0x03;
const ATT_OP_FIND_INFO_REQ            = 0x04;
const ATT_OP_FIND_INFO_RESP           = 0x05;
const ATT_OP_FIND_BY_TYPE_REQ         = 0x06;
const ATT_OP_FIND_BY_TYPE_RESP        = 0x07;
const ATT_OP_READ_BY_TYPE_REQ         = 0x08;
const ATT_OP_READ_BY_TYPE_RESP        = 0x09;
const ATT_OP_READ_REQ                 = 0x0a;
const ATT_OP_READ_RESP                = 0x0b;
const ATT_OP_READ_BLOB_REQ            = 0x0c;
const ATT_OP_READ_BLOB_RESP           = 0x0d;
const ATT_OP_READ_MULTI_REQ           = 0x0e;
const ATT_OP_READ_MULTI_RESP          = 0x0f;
const ATT_OP_READ_BY_GROUP_REQ        = 0x10;
const ATT_OP_READ_BY_GROUP_RESP       = 0x11;
const ATT_OP_WRITE_REQ                = 0x12;
const ATT_OP_WRITE_RESP               = 0x13;
const ATT_OP_WRITE_CMD                = 0x52;
const ATT_OP_PREP_WRITE_REQ           = 0x16;
const ATT_OP_PREP_WRITE_RESP          = 0x17;
const ATT_OP_EXEC_WRITE_REQ           = 0x18;
const ATT_OP_EXEC_WRITE_RESP          = 0x19;
const ATT_OP_HANDLE_NOTIFY            = 0x1b;
const ATT_OP_HANDLE_IND               = 0x1d;
const ATT_OP_HANDLE_CNF               = 0x1e;
const ATT_OP_SIGNED_WRITE_CMD         = 0xd2;

const GATT_PRIM_SVC_UUID              = 0x2800;
const GATT_INCLUDE_UUID               = 0x2802;
const GATT_CHARAC_UUID                = 0x2803;

const GATT_CLIENT_CHARAC_CFG_UUID     = 0x2902;
const GATT_CLIENT_CHARAC_CFG_UUID_S   = '2902';
const GATT_SERVER_CHARAC_CFG_UUID     = 0x2903;

const ATT_ECODE_SUCCESS               = 0x00;
const ATT_ECODE_INVALID_HANDLE        = 0x01;
const ATT_ECODE_READ_NOT_PERM         = 0x02;
const ATT_ECODE_WRITE_NOT_PERM        = 0x03;
const ATT_ECODE_INVALID_PDU           = 0x04;
const ATT_ECODE_AUTHENTICATION        = 0x05;
const ATT_ECODE_REQ_NOT_SUPP          = 0x06;
const ATT_ECODE_INVALID_OFFSET        = 0x07;
const ATT_ECODE_AUTHORIZATION         = 0x08;
const ATT_ECODE_PREP_QUEUE_FULL       = 0x09;
const ATT_ECODE_ATTR_NOT_FOUND        = 0x0a;
const ATT_ECODE_ATTR_NOT_LONG         = 0x0b;
const ATT_ECODE_INSUFF_ENCR_KEY_SIZE  = 0x0c;
const ATT_ECODE_INVAL_ATTR_VALUE_LEN = 0x0d;
const ATT_ECODE_UNLIKELY              = 0x0e;
const ATT_ECODE_INSUFF_ENC            = 0x0f;
const ATT_ECODE_UNSUPP_GRP_TYPE       = 0x10;
const ATT_ECODE_INSUFF_RESOURCES      = 0x11;

const ATT_CID = 0x0004;

class Gatt  extends EventEmitter {
  constructor() {
    super();

    this.maxMtu = 256;
    this._mtu = 23;
    this._preparedWriteRequest = null;

    this.setServices([]);

    this.onAclStreamDataBinded = this.onAclStreamData.bind(this);
    this.onAclStreamEndBinded = this.onAclStreamEnd.bind(this);
  }

  setServices(services) {
    const deviceName = process.env.BLENO_DEVICE_NAME || os.hostname();

    // base services and characteristics
    const allServices = [
      {
        uuid: '1800',
        characteristics: [
          {
            uuid: '2a00',
            properties: ['read'],
            secure: [],
            value: Buffer.from(deviceName),
            descriptors: []
          },
          {
            uuid: '2a01',
            properties: ['read'],
            secure: [],
            value: Buffer.from([0x80, 0x00]),
            descriptors: []
          }
        ]
      },
      {
        uuid: '1801',
        characteristics: [
          {
            uuid: '2a05',
            properties: ['indicate'],
            secure: [],
            value: Buffer.from([0x00, 0x00, 0x00, 0x00]),
            descriptors: []
          }
        ]
      }
    ].concat(services);

    this._handles = [];

    let handle = 0;

    for (let i = 0; i < allServices.length; i++) {
      const service = allServices[i];

      handle++;
      const serviceHandle = handle;

      this._handles[serviceHandle] = {
        type: 'service',
        uuid: service.uuid,
        attribute: service,
        startHandle: serviceHandle
        // endHandle filled in below
      };

      for (let j = 0; j < service.characteristics.length; j++) {
        const characteristic = service.characteristics[j];

        let properties = 0;
        let secure = 0;

        if (characteristic.properties.indexOf('read') !== -1) {
          properties |= 0x02;

          if (characteristic.secure.indexOf('read') !== -1) {
            secure |= 0x02;
          }
        }

        if (characteristic.properties.indexOf('writeWithoutResponse') !== -1) {
          properties |= 0x04;

          if (characteristic.secure.indexOf('writeWithoutResponse') !== -1) {
            secure |= 0x04;
          }
        }

        if (characteristic.properties.indexOf('write') !== -1) {
          properties |= 0x08;

          if (characteristic.secure.indexOf('write') !== -1) {
            secure |= 0x08;
          }
        }

        if (characteristic.properties.indexOf('notify') !== -1) {
          properties |= 0x10;

          if (characteristic.secure.indexOf('notify') !== -1) {
            secure |= 0x10;
          }
        }

        if (characteristic.properties.indexOf('indicate') !== -1) {
          properties |= 0x20;

          if (characteristic.secure.indexOf('indicate') !== -1) {
            secure |= 0x20;
          }
        }

        handle++;
        const characteristicHandle = handle;

        handle++;
        const characteristicValueHandle = handle;

        this._handles[characteristicHandle] = {
          type: 'characteristic',
          uuid: characteristic.uuid,
          properties,
          secure,
          attribute: characteristic,
          startHandle: characteristicHandle,
          valueHandle: characteristicValueHandle
        };

        this._handles[characteristicValueHandle] = {
          type: 'characteristicValue',
          handle: characteristicValueHandle,
          value: characteristic.value
        };

        if (properties & 0x30) { // notify or indicate
          // add client characteristic configuration descriptor

          handle++;
          const clientCharacteristicConfigurationDescriptorHandle = handle;
          this._handles[clientCharacteristicConfigurationDescriptorHandle] = {
            type: 'descriptor',
            handle: clientCharacteristicConfigurationDescriptorHandle,
            uuid: GATT_CLIENT_CHARAC_CFG_UUID_S,
            attribute: characteristic,
            properties: (0x02 | 0x04 | 0x08), // read/write
            secure: (secure & 0x10) ? (0x02 | 0x04 | 0x08) : 0,
            value: Buffer.from([0x00, 0x00])
          };
        }

        for (let k = 0; k < characteristic.descriptors.length; k++) {
          const descriptor = characteristic.descriptors[k];
          
          //https://github.com/abandonware/bleno/issues/51
          //above, if the characteristic defines notify, the 2902 characteristic descriptor is added automatically
          //if the peripheral also declares this, we don't want to add it again
          //flags (properties, secure etc) above are better defined
          if(descriptor.uuid == GATT_CLIENT_CHARAC_CFG_UUID_S)
          {
            continue;
          }

          handle++;
          const descriptorHandle = handle;

          this._handles[descriptorHandle] = {
            type: 'descriptor',
            handle: descriptorHandle,
            uuid: descriptor.uuid,
            attribute: descriptor,
            properties: 0x02, // read only
            secure: 0x00,
            value: descriptor.value
          };
        }
      }

      this._handles[serviceHandle].endHandle = handle;
    }

    const debugHandles = [];
    for (let i = 0; i < this._handles.length; i++) {
      handle = this._handles[i];

      debugHandles[i] = {};
      for (let j in handle) {
        if (Buffer.isBuffer(handle[j])) {
          debugHandles[i][j] = handle[j] ? 'Buffer(\'' + handle[j].toString('hex') + '\', \'hex\')' : null;
        } else if (j !== 'attribute') {
          debugHandles[i][j] = handle[j];
        }
      }
    }

    debug('handles = ' + JSON.stringify(debugHandles, null, 2));
  }

  setAclStream(aclStream) {
    this._mtu = 23;
    this._preparedWriteRequest = null;

    this._aclStream = aclStream;

    this._aclStream.on('data', this.onAclStreamDataBinded);
    this._aclStream.on('end', this.onAclStreamEndBinded);
  }

  onAclStreamData(cid, data) {
    if (cid !== ATT_CID) {
      return;
    }

    this.handleRequest(data);
  }

  onAclStreamEnd() {
    this._aclStream.removeListener('data', this.onAclStreamDataBinded);
    this._aclStream.removeListener('end', this.onAclStreamEndBinded);

    for (let i = 0; i < this._handles.length; i++) {
      if (this._handles[i] && this._handles[i].type === 'descriptor' &&
          this._handles[i].uuid === '2902' && this._handles[i].value.readUInt16LE(0) !== 0) {

        this._handles[i].value = Buffer.from([0x00, 0x00]);

        if (this._handles[i].attribute && this._handles[i].attribute.emit) {
          this._handles[i].attribute.emit('unsubscribe');
        }
      }
    }
  }

  send(data) {
    debug('send: ' + data.toString('hex'));
    this._aclStream.write(ATT_CID, data);
  }

  errorResponse(opcode, handle, status) {
    const buf = Buffer.alloc(5);

    buf.writeUInt8(ATT_OP_ERROR, 0);
    buf.writeUInt8(opcode, 1);
    buf.writeUInt16LE(handle, 2);
    buf.writeUInt8(status, 4);

    return buf;
  }

  handleRequest(request) {
    debug('handing request: ' + request.toString('hex'));

    const requestType = request[0];
    let response = null;

    switch (requestType) {
      case ATT_OP_MTU_REQ:
        response = this.handleMtuRequest(request);
        break;

      case ATT_OP_FIND_INFO_REQ:
        response = this.handleFindInfoRequest(request);
        break;

      case ATT_OP_FIND_BY_TYPE_REQ:
        response = this.handleFindByTypeRequest(request);
        break;

      case ATT_OP_READ_BY_TYPE_REQ:
        response = this.handleReadByTypeRequest(request);
        break;

      case ATT_OP_READ_REQ:
      case ATT_OP_READ_BLOB_REQ:
        response = this.handleReadOrReadBlobRequest(request);
        break;

      case ATT_OP_READ_BY_GROUP_REQ:
        response = this.handleReadByGroupRequest(request);
        break;

      case ATT_OP_WRITE_REQ:
      case ATT_OP_WRITE_CMD:
        response = this.handleWriteRequestOrCommand(request);
        break;

      case ATT_OP_PREP_WRITE_REQ:
        response = this.handlePrepareWriteRequest(request);
        break;

      case ATT_OP_EXEC_WRITE_REQ:
        response = this.handleExecuteWriteRequest(request);
        break;

      case ATT_OP_HANDLE_CNF:
        this.handleConfirmation(request);
        break;

      default:
      case ATT_OP_READ_MULTI_REQ:
      case ATT_OP_SIGNED_WRITE_CMD:
        response = this.errorResponse(requestType, 0x0000, ATT_ECODE_REQ_NOT_SUPP);
        break;
    }

    if (response) {
      debug('response: ' + response.toString('hex'));

      this.send(response);
    }
  }

  handleMtuRequest(request) {
    let mtu = request.readUInt16LE(1);

    if (mtu < 23) {
      mtu = 23;
    } else if (mtu > this.maxMtu) {
      mtu = this.maxMtu;
    }

    this._mtu = mtu;

    this.emit('mtuChange', this._mtu);

    const response = Buffer.alloc(3);

    response.writeUInt8(ATT_OP_MTU_RESP, 0);
    response.writeUInt16LE(mtu, 1);

    return response;
  }

  handleFindInfoRequest(request) {
    const startHandle = request.readUInt16LE(1);
    const endHandle = request.readUInt16LE(3);

    const infos = [];
    let uuid = null;

    for (let i = startHandle; i <= endHandle; i++) {
      const handle = this._handles[i];

      if (!handle) {
        break;
      }

      uuid = null;

      if ('service' === handle.type) {
        uuid = '2800';
      } else if ('includedService' === handle.type) {
        uuid = '2802';
      } else if ('characteristic' === handle.type) {
        uuid = '2803';
      } else if ('characteristicValue' === handle.type) {
        uuid = this._handles[i - 1].uuid;
      } else if ('descriptor' === handle.type) {
        uuid = handle.uuid;
      }

      if (uuid) {
        infos.push({
          handle: i,
          uuid: uuid
        });
      }
    }

    if (infos.length) {
      const uuidSize = infos[0].uuid.length / 2;
      let numInfo = 1;

      for (let i = 1; i < infos.length; i++) {
        if (infos[0].uuid.length !== infos[i].uuid.length) {
          break;
        }
        numInfo++;
      }

      const lengthPerInfo = (uuidSize === 2) ? 4 : 18;
      const maxInfo = Math.floor((this._mtu - 2) / lengthPerInfo);
      numInfo = Math.min(numInfo, maxInfo);

      const response = Buffer.alloc(2 + numInfo * lengthPerInfo);

      response[0] = ATT_OP_FIND_INFO_RESP;
      response[1] = (uuidSize === 2) ? 0x01 : 0x2;

      for (let i = 0; i < numInfo; i++) {
        const info = infos[i];

        response.writeUInt16LE(info.handle, 2 + i * lengthPerInfo);

        uuid = Buffer.from(info.uuid.match(/.{1,2}/g).reverse().join(''), 'hex');
        for (let j = 0; j < uuid.length; j++) {
          response[2 + i * lengthPerInfo + 2 + j] = uuid[j];
        }
      }
      return response;
    }

    return this.errorResponse(ATT_OP_FIND_INFO_REQ, startHandle, ATT_ECODE_ATTR_NOT_FOUND);
  }

  handleFindByTypeRequest(request) {
    const startHandle = request.readUInt16LE(1);
    const endHandle = request.readUInt16LE(3);
    const uuid = request.slice(5, 7).toString('hex').match(/.{1,2}/g).reverse().join('');
    const value = request.slice(7).toString('hex').match(/.{1,2}/g).reverse().join('');

    const handles = [];
    let handle;

    for (let i = startHandle; i <= endHandle; i++) {
      handle = this._handles[i];

      if (!handle) {
        break;
      }

      if ('2800' === uuid && handle.type === 'service' && handle.uuid === value) {
        handles.push({
          start: handle.startHandle,
          end: handle.endHandle
        });
      }
    }

    if (handles.length) {
      const lengthPerHandle = 4;
      let numHandles = handles.length;
      const maxHandles = Math.floor((this._mtu - 1) / lengthPerHandle);

      numHandles = Math.min(numHandles, maxHandles);

      const response = Buffer.alloc(1 + numHandles * lengthPerHandle);

      response[0] = ATT_OP_FIND_BY_TYPE_RESP;

      for (let i = 0; i < numHandles; i++) {
        handle = handles[i];

        response.writeUInt16LE(handle.start, 1 + i * lengthPerHandle);
        response.writeUInt16LE(handle.end, 1 + i * lengthPerHandle + 2);
      }
      return response;
    }

    return this.errorResponse(ATT_OP_FIND_BY_TYPE_REQ, startHandle, ATT_ECODE_ATTR_NOT_FOUND);
  }

  handleReadByGroupRequest(request) {

    const startHandle = request.readUInt16LE(1);
    const endHandle = request.readUInt16LE(3);
    const uuid = request.slice(5).toString('hex').match(/.{1,2}/g).reverse().join('');

    debug('read by group: startHandle = 0x' + startHandle.toString(16) + ', endHandle = 0x' + endHandle.toString(16) + ', uuid = 0x' + uuid.toString(16));

    if ('2800' === uuid || '2802' === uuid) {
      const services = [];
      const type = ('2800' === uuid) ? 'service' : 'includedService';

      for (let i = startHandle; i <= endHandle; i++) {
        const handle = this._handles[i];

        if (!handle) {
          break;
        }

        if (handle.type === type) {
          services.push(handle);
        }
      }

      if (services.length) {
        const uuidSize = services[0].uuid.length / 2;
        let numServices = 1;

        for (let i = 1; i < services.length; i++) {
          if (services[0].uuid.length !== services[i].uuid.length) {
            break;
          }
          numServices++;
        }

        const lengthPerService = (uuidSize === 2) ? 6 : 20;
        const maxServices = Math.floor((this._mtu - 2) / lengthPerService);
        numServices = Math.min(numServices, maxServices);

        const response = Buffer.alloc(2 + numServices * lengthPerService);

        response[0] = ATT_OP_READ_BY_GROUP_RESP;
        response[1] = lengthPerService;

        for (let i = 0; i < numServices; i++) {
          const service = services[i];

          response.writeUInt16LE(service.startHandle, 2 + i * lengthPerService);
          response.writeUInt16LE(service.endHandle, 2 + i * lengthPerService + 2);

          const serviceUuid = Buffer.from(service.uuid.match(/.{1,2}/g).reverse().join(''), 'hex');
          for (let j = 0; j < serviceUuid.length; j++) {
            response[2 + i * lengthPerService + 4 + j] = serviceUuid[j];
          }
        }
        return response;
      }

      return this.errorResponse(ATT_OP_READ_BY_GROUP_REQ, startHandle, ATT_ECODE_ATTR_NOT_FOUND);
    }

    return this.errorResponse(ATT_OP_READ_BY_GROUP_REQ, startHandle, ATT_ECODE_UNSUPP_GRP_TYPE);
  }

  handleReadByTypeRequest(request) {
    let response = null;
    const requestType = request[0];

    const startHandle = request.readUInt16LE(1);
    const endHandle = request.readUInt16LE(3);
    const uuid = request.slice(5).toString('hex').match(/.{1,2}/g).reverse().join('');

    debug('read by type: startHandle = 0x' + startHandle.toString(16) + ', endHandle = 0x' + endHandle.toString(16) + ', uuid = 0x' + uuid.toString(16));

    if ('2803' === uuid) {
      const characteristics = [];

      for (let i = startHandle; i <= endHandle; i++) {
        const handle = this._handles[i];

        if (!handle) {
          break;
        }

        if (handle.type === 'characteristic') {
          characteristics.push(handle);
        }
      }

      if (characteristics.length) {
        const uuidSize = characteristics[0].uuid.length / 2;
        let numCharacteristics = 1;

        for (let i = 1; i < characteristics.length; i++) {
          if (characteristics[0].uuid.length !== characteristics[i].uuid.length) {
            break;
          }
          numCharacteristics++;
        }

        const lengthPerCharacteristic = (uuidSize === 2) ? 7 : 21;
        const maxCharacteristics = Math.floor((this._mtu - 2) / lengthPerCharacteristic);
        numCharacteristics = Math.min(numCharacteristics, maxCharacteristics);

        response = Buffer.alloc(2 + numCharacteristics * lengthPerCharacteristic);

        response[0] = ATT_OP_READ_BY_TYPE_RESP;
        response[1] = lengthPerCharacteristic;

        for (let i = 0; i < numCharacteristics; i++) {
          const characteristic = characteristics[i];

          response.writeUInt16LE(characteristic.startHandle, 2 + i * lengthPerCharacteristic);
          response.writeUInt8(characteristic.properties, 2 + i * lengthPerCharacteristic + 2);
          response.writeUInt16LE(characteristic.valueHandle, 2 + i * lengthPerCharacteristic + 3);

          const characteristicUuid = Buffer.from(characteristic.uuid.match(/.{1,2}/g).reverse().join(''), 'hex');
          for (let j = 0; j < characteristicUuid.length; j++) {
            response[2 + i * lengthPerCharacteristic + 5 + j] = characteristicUuid[j];
          }
        }
      } else {
        response = this.errorResponse(ATT_OP_READ_BY_TYPE_REQ, startHandle, ATT_ECODE_ATTR_NOT_FOUND);
      }
    } else {
      let handleAttribute = null;
      let valueHandle = null;
      let secure = false;

      for (let i = startHandle; i <= endHandle; i++) {
        const handle = this._handles[i];

        if (!handle) {
          break;
        }

        if (handle.type === 'characteristic' && handle.uuid === uuid) {
          handleAttribute = handle.attribute;
          valueHandle = handle.valueHandle;
          secure = handle.secure & 0x02;
          break;
        } else if (handle.type === 'descriptor' && handle.uuid === uuid) {
          valueHandle = i;
          secure = handle.secure & 0x02;
          break;
        }
      }

      if (secure && !this._aclStream.encrypted) {
        response = this.errorResponse(ATT_OP_READ_BY_TYPE_REQ, startHandle, ATT_ECODE_AUTHENTICATION);
      } else if (valueHandle) {
        const callback = (function (valueHandle) {
          return function (result, data) {
            let callbackResponse;

            if (ATT_ECODE_SUCCESS === result) {
              const dataLength = Math.min(data.length, this._mtu - 4);
              callbackResponse = Buffer.alloc(4 + dataLength);

              callbackResponse[0] = ATT_OP_READ_BY_TYPE_RESP;
              callbackResponse[1] = dataLength + 2;
              callbackResponse.writeUInt16LE(valueHandle, 2);
              for (let i = 0; i < dataLength; i++) {
                callbackResponse[4 + i] = data[i];
              }
            } else {
              callbackResponse = this.errorResponse(requestType, valueHandle, result);
            }

            debug('read by type response: ' + callbackResponse.toString('hex'));

            this.send(callbackResponse);
          }.bind(this);
        }.bind(this))(valueHandle);

        const data = this._handles[valueHandle].value;

        if (data) {
          callback(ATT_ECODE_SUCCESS, data);
        } else if (handleAttribute) {
          handleAttribute.emit('readRequest', 0, callback);
        } else {
          callback(ATT_ECODE_UNLIKELY);
        }
      } else {
        response = this.errorResponse(ATT_OP_READ_BY_TYPE_REQ, startHandle, ATT_ECODE_ATTR_NOT_FOUND);
      }
    }

    return response;
  }

  handleReadOrReadBlobRequest(request) {
    let response = null;

    const requestType = request[0];
    const valueHandle = request.readUInt16LE(1);
    const offset = (requestType === ATT_OP_READ_BLOB_REQ) ? request.readUInt16LE(3) : 0;

    const handle = this._handles[valueHandle];

    if (handle) {
      let result = null;
      let data = null;
      const handleType = handle.type;

      const callback = (function (requestType, valueHandle) {
        return function (result, data) {
          let callbackResponse;

          if (ATT_ECODE_SUCCESS === result) {
            const dataLength = Math.min(data.length, this._mtu - 1);
            callbackResponse = Buffer.alloc(1 + dataLength);

            callbackResponse[0] = (requestType === ATT_OP_READ_BLOB_REQ) ? ATT_OP_READ_BLOB_RESP : ATT_OP_READ_RESP;
            for (let i = 0; i < dataLength; i++) {
              callbackResponse[1 + i] = data[i];
            }
          } else {
            callbackResponse = this.errorResponse(requestType, valueHandle, result);
          }

          debug('read response: ' + callbackResponse.toString('hex'));

          this.send(callbackResponse);
        }.bind(this);
      }.bind(this))(requestType, valueHandle);

      if (handleType === 'service' || handleType === 'includedService') {
        result = ATT_ECODE_SUCCESS;
        data = Buffer.from(handle.uuid.match(/.{1,2}/g).reverse().join(''), 'hex');
      } else if (handleType === 'characteristic') {
        const uuid = Buffer.from(handle.uuid.match(/.{1,2}/g).reverse().join(''), 'hex');

        result = ATT_ECODE_SUCCESS;
        data = Buffer.alloc(3 + uuid.length);
        data.writeUInt8(handle.properties, 0);
        data.writeUInt16LE(handle.valueHandle, 1);

        for (let i = 0; i < uuid.length; i++) {
          data[i + 3] = uuid[i];
        }
      } else if (handleType === 'characteristicValue' || handleType === 'descriptor') {
        let handleProperties = handle.properties;
        let handleSecure = handle.secure;
        let handleAttribute = handle.attribute;
        if (handleType === 'characteristicValue') {
          handleProperties = this._handles[valueHandle - 1].properties;
          handleSecure = this._handles[valueHandle - 1].secure;
          handleAttribute = this._handles[valueHandle - 1].attribute;
        }

        if (handleProperties & 0x02) {
          if (handleSecure & 0x02 && !this._aclStream.encrypted) {
            result = ATT_ECODE_AUTHENTICATION;
          } else {
            data = handle.value;

            if (data) {
              result = ATT_ECODE_SUCCESS;
            } else {
              handleAttribute.emit('readRequest', offset, callback);
            }
          }
        } else {
          result = ATT_ECODE_READ_NOT_PERM; // non-readable
        }
      }

      if (data && typeof data === 'string') {
        data = Buffer.from(data);
      }

      if (result === ATT_ECODE_SUCCESS && data && offset) {
        if (data.length < offset) {
          result = ATT_ECODE_INVALID_OFFSET;
          data = null;
        } else {
          data = data.slice(offset);
        }
      }

      if (result !== null) {
        callback(result, data);
      }
    } else {
      response = this.errorResponse(requestType, valueHandle, ATT_ECODE_INVALID_HANDLE);
    }

    return response;
  }

  handleWriteRequestOrCommand(request) {
    let response = null;

    const requestType = request[0];
    const withoutResponse = (requestType === ATT_OP_WRITE_CMD);
    const valueHandle = request.readUInt16LE(1);
    const data = request.slice(3);
    const offset = 0;

    let handle = this._handles[valueHandle];

    if (handle) {
      if (handle.type === 'characteristicValue') {
        handle = this._handles[valueHandle - 1];
      }

      const handleProperties = handle.properties;
      const handleSecure = handle.secure;

      if (handleProperties && (withoutResponse ? (handleProperties & 0x04) : (handleProperties & 0x08))) {

        const callback = (function (requestType, valueHandle, withoutResponse) {
          return function (result) {
            if (!withoutResponse) {
              let callbackResponse;

              if (ATT_ECODE_SUCCESS === result) {
                callbackResponse = Buffer.from([ATT_OP_WRITE_RESP]);
              } else {
                callbackResponse = this.errorResponse(requestType, valueHandle, result);
              }

              debug('write response: ' + callbackResponse.toString('hex'));

              this.send(callbackResponse);
            }
          }.bind(this);
        }.bind(this))(requestType, valueHandle, withoutResponse);

        if (handleSecure & (withoutResponse ? 0x04 : 0x08) && !this._aclStream.encrypted) {
          response = this.errorResponse(requestType, valueHandle, ATT_ECODE_AUTHENTICATION);
        } else if (handle.type === 'descriptor' || handle.uuid === '2902') {
          let result;

          if (data.length !== 2) {
            result = ATT_ECODE_INVAL_ATTR_VALUE_LEN;
          } else {
            const value = data.readUInt16LE(0);
            const handleAttribute = handle.attribute;

            handle.value = data;

            if (value & 0x0003) {
              const updateValueCallback = (function (valueHandle, attribute) {
                return function (data) {
                  const dataLength = Math.min(data.length, this._mtu - 3);
                  const useNotify = attribute.properties.indexOf('notify') !== -1;
                  const useIndicate = attribute.properties.indexOf('indicate') !== -1;

                  if (useNotify) {
                    const notifyMessage = Buffer.alloc(3 + dataLength);

                    notifyMessage.writeUInt8(ATT_OP_HANDLE_NOTIFY, 0);
                    notifyMessage.writeUInt16LE(valueHandle, 1);

                    for (let i = 0; i < dataLength; i++) {
                      notifyMessage[3 + i] = data[i];
                    }

                    debug('notify message: ' + notifyMessage.toString('hex'));
                    this.send(notifyMessage);

                    attribute.emit('notify');
                  } else if (useIndicate) {
                    const indicateMessage = Buffer.alloc(3 + dataLength);

                    indicateMessage.writeUInt8(ATT_OP_HANDLE_IND, 0);
                    indicateMessage.writeUInt16LE(valueHandle, 1);

                    for (let i = 0; i < dataLength; i++) {
                      indicateMessage[3 + i] = data[i];
                    }

                    this._lastIndicatedAttribute = attribute;

                    debug('indicate message: ' + indicateMessage.toString('hex'));
                    this.send(indicateMessage);
                  }
                }.bind(this);
              }.bind(this))(valueHandle - 1, handleAttribute);

              if (handleAttribute.emit) {
                handleAttribute.emit('subscribe', this._mtu - 3, updateValueCallback);
              }
            } else {
              if (handleAttribute.emit) {
                handleAttribute.emit('unsubscribe');
              }
            }

            result = ATT_ECODE_SUCCESS;
          }

          callback(result);
        } else {
          handle.attribute.emit('writeRequest', data, offset, withoutResponse, callback);
        }
      } else {
        response = this.errorResponse(requestType, valueHandle, ATT_ECODE_WRITE_NOT_PERM);
      }
    } else {
      response = this.errorResponse(requestType, valueHandle, ATT_ECODE_INVALID_HANDLE);
    }

    return response;
  }

  handlePrepareWriteRequest(request) {
    let response;

    const requestType = request[0];
    const valueHandle = request.readUInt16LE(1);
    const offset = request.readUInt16LE(3);
    const data = request.slice(5);

    let handle = this._handles[valueHandle];

    if (handle) {
      if (handle.type === 'characteristicValue') {
        handle = this._handles[valueHandle - 1];

        const handleProperties = handle.properties;
        const handleSecure = handle.secure;

        if (handleProperties && (handleProperties & 0x08)) {
          if ((handleSecure & 0x08) && !this._aclStream.encrypted) {
            response = this.errorResponse(requestType, valueHandle, ATT_ECODE_AUTHENTICATION);
          } else if (this._preparedWriteRequest) {
            if (this._preparedWriteRequest.handle !== handle) {
              response = this.errorResponse(requestType, valueHandle, ATT_ECODE_UNLIKELY);
            } else if (offset === (this._preparedWriteRequest.offset + this._preparedWriteRequest.data.length)) {
              this._preparedWriteRequest.data = Buffer.concat([
                this._preparedWriteRequest.data,
                data
              ]);

              response = Buffer.alloc(request.length);
              request.copy(response);
              response[0] = ATT_OP_PREP_WRITE_RESP;
            } else {
              response = this.errorResponse(requestType, valueHandle, ATT_ECODE_INVALID_OFFSET);
            }
          } else {
            this._preparedWriteRequest = {
              handle,
              valueHandle,
              offset,
              data
            };

            response = Buffer.alloc(request.length);
            request.copy(response);
            response[0] = ATT_OP_PREP_WRITE_RESP;
          }
        } else {
          response = this.errorResponse(requestType, valueHandle, ATT_ECODE_WRITE_NOT_PERM);
        }
      } else {
        response = this.errorResponse(requestType, valueHandle, ATT_ECODE_ATTR_NOT_LONG);
      }
    } else {
      response = this.errorResponse(requestType, valueHandle, ATT_ECODE_INVALID_HANDLE);
    }

    return response;
  }

  handleExecuteWriteRequest(request) {
    let response = null;

    const requestType = request[0];
    const flag = request[1];

    if (this._preparedWriteRequest) {
      const valueHandle = this._preparedWriteRequest.valueHandle;

      if (flag === 0x00) {
        response = Buffer.from([ATT_OP_EXEC_WRITE_RESP]);
      } else if (flag === 0x01) {
        const callback = (function (requestType, valueHandle) {
          return function (result) {
            let callbackResponse;

            if (ATT_ECODE_SUCCESS === result) {
              callbackResponse = Buffer.from([ATT_OP_EXEC_WRITE_RESP]);
            } else {
              callbackResponse = this.errorResponse(requestType, valueHandle, result);
            }

            debug('execute write response: ' + callbackResponse.toString('hex'));

            this.send(callbackResponse);
          }.bind(this);
        }.bind(this))(requestType, this._preparedWriteRequest.valueHandle);

        this._preparedWriteRequest.handle.attribute.emit('writeRequest', this._preparedWriteRequest.data, this._preparedWriteRequest.offset, false, callback);
      } else {
        response = this.errorResponse(requestType, 0x0000, ATT_ECODE_UNLIKELY);
      }

      this._preparedWriteRequest = null;
    } else {
      response = this.errorResponse(requestType, 0x0000, ATT_ECODE_UNLIKELY);
    }

    return response;
  }

  handleConfirmation(request) {
    if (this._lastIndicatedAttribute) {
      if (this._lastIndicatedAttribute.emit) {
        this._lastIndicatedAttribute.emit('indicate');
      }

      this._lastIndicatedAttribute = null;
    }
  }
}

module.exports = Gatt;
