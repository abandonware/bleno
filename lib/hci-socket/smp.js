const debug = require('debug')('smp');

const { EventEmitter } = require('events');

const crypto = require('./crypto');
const mgmt = require('./mgmt');

const SMP_CID = 0x0006;

const SMP_PAIRING_REQUEST = 0x01;
const SMP_PAIRING_RESPONSE = 0x02;
const SMP_PAIRING_CONFIRM = 0x03;
const SMP_PAIRING_RANDOM = 0x04;
const SMP_PAIRING_FAILED = 0x05;
const SMP_ENCRYPT_INFO = 0x06;
const SMP_MASTER_IDENT = 0x07;

const SMP_UNSPECIFIED = 0x08;

class Smp extends EventEmitter {
  constructor(aclStream, localAddressType, localAddress, remoteAddressType, remoteAddress) {
    super();

    this._aclStream = aclStream;

    this._iat = Buffer.from([(remoteAddressType === 'random') ? 0x01 : 0x00]);
    this._ia = Buffer.from(remoteAddress.split(':').reverse().join(''), 'hex');
    this._rat = Buffer.from([(localAddressType === 'random') ? 0x01 : 0x00]);
    this._ra = Buffer.from(localAddress.split(':').reverse().join(''), 'hex');

    this._stk = null;
    this._random = null;
    this._diversifier = null;

    this.onAclStreamDataBinded = this.onAclStreamData.bind(this);
    this.onAclStreamEncryptChangeBinded = this.onAclStreamEncryptChange.bind(this);
    this.onAclStreamLtkNegReplyBinded = this.onAclStreamLtkNegReply.bind(this);
    this.onAclStreamEndBinded = this.onAclStreamEnd.bind(this);

    this._aclStream.on('data', this.onAclStreamDataBinded);
    this._aclStream.on('encryptChange', this.onAclStreamEncryptChangeBinded);
    this._aclStream.on('ltkNegReply', this.onAclStreamLtkNegReplyBinded);
    this._aclStream.on('end', this.onAclStreamEndBinded);
  }

  onAclStreamData(cid, data) {
    if (cid !== SMP_CID) {
      return;
    }

    const code = data.readUInt8(0);

    if (SMP_PAIRING_REQUEST === code) {
      this.handlePairingRequest(data);
    } else if (SMP_PAIRING_CONFIRM === code) {
      this.handlePairingConfirm(data);
    } else if (SMP_PAIRING_RANDOM === code) {
      this.handlePairingRandom(data);
    } else if (SMP_PAIRING_FAILED === code) {
      this.handlePairingFailed(data);
    }
  }

  onAclStreamEncryptChange(encrypted) {
    if (encrypted) {
      if (this._stk && this._diversifier && this._random) {
        this.write(Buffer.concat([
          Buffer.from([SMP_ENCRYPT_INFO]),
          this._stk
        ]));

        this.write(Buffer.concat([
          Buffer.from([SMP_MASTER_IDENT]),
          this._diversifier,
          this._random
        ]));
      }
    }
  }

  onAclStreamLtkNegReply() {
    this.write(Buffer.from([
      SMP_PAIRING_FAILED,
      SMP_UNSPECIFIED
    ]));

    this.emit('fail');
  }

  onAclStreamEnd() {
    this._aclStream.removeListener('data', this.onAclStreamDataBinded);
    this._aclStream.removeListener('encryptChange', this.onAclStreamEncryptChangeBinded);
    this._aclStream.removeListener('ltkNegReply', this.onAclStreamLtkNegReplyBinded);
    this._aclStream.removeListener('end', this.onAclStreamEndBinded);
  }

  handlePairingRequest(data) {
    this._preq = data;

    this._pres = Buffer.from([
      SMP_PAIRING_RESPONSE,
      0x03, // IO capability: NoInputNoOutput
      0x00, // OOB data: Authentication data not present
      0x01, // Authentication requirement: Bonding - No MITM
      0x10, // Max encryption key size
      0x00, // Initiator key distribution: <none>
      0x01  // Responder key distribution: EncKey
    ]);

    this.write(this._pres);
  }

  handlePairingConfirm(data) {
    this._pcnf = data;

    this._tk = Buffer.from('00000000000000000000000000000000', 'hex');
    this._r = crypto.r();

    this.write(Buffer.concat([
      Buffer.from([SMP_PAIRING_CONFIRM]),
      crypto.c1(this._tk, this._r, this._pres, this._preq, this._iat, this._ia, this._rat, this._ra)
    ]));
  }

  handlePairingRandom(data) {
    const r = data.slice(1);

    const pcnf = Buffer.concat([
      Buffer.from([SMP_PAIRING_CONFIRM]),
      crypto.c1(this._tk, r, this._pres, this._preq, this._iat, this._ia, this._rat, this._ra)
    ]);

    if (this._pcnf.toString('hex') === pcnf.toString('hex')) {
      this._diversifier = Buffer.from('0000', 'hex');
      this._random = Buffer.from('0000000000000000', 'hex');
      this._stk = crypto.s1(this._tk, this._r, r);

      mgmt.addLongTermKey(this._ia, this._iat, 0, 0, this._diversifier, this._random, this._stk);

      this.write(Buffer.concat([
        Buffer.from([SMP_PAIRING_RANDOM]),
        this._r
      ]));
    } else {
      this.write(Buffer.from([
        SMP_PAIRING_FAILED,
        SMP_PAIRING_CONFIRM
      ]));

      this.emit('fail');
    }
  }

  handlePairingFailed(data) {
    this.emit('fail');
  }

  write(data) {
    this._aclStream.write(SMP_CID, data);
  }
}

module.exports = Smp;
