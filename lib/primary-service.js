const { EventEmitter } = require('events');

const debug = require('debug')('primary-service');

const UuidUtil = require('./uuid-util');

class PrimaryService extends EventEmitter {
  constructor(options) {
    super();
    this.uuid = UuidUtil.removeDashes(options.uuid);
    this.characteristics = options.characteristics || [];
  }

  toString() {
    return JSON.stringify({
      uuid: this.uuid,
      characteristics: this.characteristics
    });
  }
}

module.exports = PrimaryService;
