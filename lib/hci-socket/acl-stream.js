const debug = require('debug')('acl-att-stream');

const { EventEmitter } = require('events');

const crypto = require('./crypto');
const Smp = require('./smp');

class AclStream extends EventEmitter {
  constructor(hci, handle, localAddressType, localAddress, remoteAddressType, remoteAddress) {
    super();
    this._hci = hci;
    this._handle = handle;
    this.encypted = false;

    this._smp = new Smp(this, localAddressType, localAddress, remoteAddressType, remoteAddress);
  }

  write(cid, data) {
    this._hci.queueAclDataPkt(this._handle, cid, data);
  }

  push(cid, data) {
    if (data) {
      this.emit('data', cid, data);
    } else {
      this.emit('end');
    }
  }

  pushEncrypt(encrypt) {
    this.encrypted = !!encrypt;

    this.emit('encryptChange', this.encrypted);
  }

  pushLtkNegReply() {
    this.emit('ltkNegReply');
  }
}

module.exports = AclStream;
