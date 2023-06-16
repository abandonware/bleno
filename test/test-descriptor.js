/* jshint mocha: true */

const should = require('should');

const Descriptor = require('../lib/descriptor');

describe('Descriptor', function() {
  const mockUuid = 'mockuuid';
  const mockValue = Buffer.from('mock value');

  it('should create with uuid option', function() {
    const descriptor = new Descriptor({
      uuid: mockUuid
    });

    descriptor.uuid.should.equal(mockUuid);

    Buffer.isBuffer(descriptor.value).should.equal(true);
    descriptor.value.length.should.equal(0);
  });

  it('should create with value option', function() {
    const descriptor = new Descriptor({
      value: mockValue
    });

    descriptor.value.should.equal(mockValue);
  });

  describe('toString', function() {
    it('should hex buffer value', function() {
      const descriptor = new Descriptor({
        uuid: mockUuid,
        value: mockValue
      });

      descriptor.toString().should.equal('{"uuid":"mockuuid","value":"6d6f636b2076616c7565"}');
    });

    it('should leave non-buffer value alone', function() {
      const descriptor = new Descriptor({
        uuid: mockUuid,
        value: 'mock value'
      });

      descriptor.toString().should.equal('{"uuid":"mockuuid","value":"mock value"}');
    });
  });
});
