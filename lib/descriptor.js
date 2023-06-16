const debug = require('debug')('descriptor');

const UuidUtil = require('./uuid-util');

class Descriptor {
  constructor(options) {
    this.uuid = UuidUtil.removeDashes(options.uuid);
    this.value = options.value || Buffer.alloc(0);
  }

  toString() {
    return JSON.stringify({
      uuid: this.uuid,
      value: Buffer.isBuffer(this.value) ? this.value.toString('hex') : this.value
    });
  }
}

module.exports = Descriptor;
