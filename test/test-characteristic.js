/* jshint mocha: true */

const should = require('should');

const Characteristic = require('../lib/characteristic');

describe('Characteristic', function() {
  const mockUuid = 'mockuuid';
  const mockProperties = ['property1', 'property2', 'property3'];
  const mockSecure = ['secure1', 'secure2', 'secure3'];
  const mockValue = Buffer.from('mock value');
  const mockDescriptors = [{}, {}, {}];

  const mockOnReadRequest = function() {};
  const mockOnWriteRequest = function() {};
  const mockOnSubscribe = function() {};
  const mockOnUnsubscribe = function() {};
  const mockOnNotify = function() {};
  const mockOnIndicate = function() {};

  const mockMaxValueSize = 20;
  const mockUpdateValueCallback = function() {};

  it('should create with uuid option', function() {
    const characteristic = new Characteristic({
      uuid: mockUuid
    });

    characteristic.uuid.should.equal(mockUuid);

    Array.isArray(characteristic.properties).should.equal(true);
    characteristic.properties.length.should.equal(0);

    Array.isArray(characteristic.secure).should.equal(true);
    characteristic.secure.length.should.equal(0);

    should(characteristic.value).equal(null);

    Array.isArray(characteristic.descriptors).should.equal(true);
    characteristic.descriptors.length.should.equal(0);
  });

  it('should create with properties option', function() {
    const characteristic = new Characteristic({
      properties: mockProperties
    });

    characteristic.properties.should.equal(mockProperties);
  });

  it('should create with secure option', function() {
    const characteristic = new Characteristic({
      secure: mockSecure
    });

    characteristic.secure.should.equal(mockSecure);
  });

  it('should create with value option', function() {
    const characteristic = new Characteristic({
      properties: ['read'],
      value: mockValue
    });

    characteristic.value.should.equal(mockValue);
  });

  it('should not create with value option and non-read properties', function() {
    (function(){
      const characteristic = new Characteristic({
        properties: ['write'],
        value: mockValue
      });
    }).should.throw();
  });

  it('should create with descriptors option', function() {
    const characteristic = new Characteristic({
      descriptors: mockDescriptors
    });

    characteristic.descriptors.should.equal(mockDescriptors);
  });

  it('should create with onReadRequest option', function() {
    const characteristic = new Characteristic({
      onReadRequest: mockOnReadRequest
    });

    characteristic.onReadRequest.should.equal(mockOnReadRequest);
  });

  it('should create with onWriteRequest option', function() {
    const characteristic = new Characteristic({
      onWriteRequest: mockOnWriteRequest
    });

    characteristic.onWriteRequest.should.equal(mockOnWriteRequest);
  });

  it('should create with onSubscribe option', function() {
    const characteristic = new Characteristic({
      onSubscribe: mockOnSubscribe
    });

    characteristic.onSubscribe.should.equal(mockOnSubscribe);
  });

  it('should create with onUnsubscribe option', function() {
    const characteristic = new Characteristic({
      onUnsubscribe: mockOnUnsubscribe
    });

    characteristic.onUnsubscribe.should.equal(mockOnUnsubscribe);
  });

  it('should create with onNotify option', function() {
    const characteristic = new Characteristic({
      onNotify: mockOnNotify
    });

    characteristic.onNotify.should.equal(mockOnNotify);
  });

  it('should create with onIndicate option', function() {
    const characteristic = new Characteristic({
    onIndicate: mockOnIndicate
  });

    characteristic.onIndicate.should.equal(mockOnIndicate);
  });

  it('should toString', function() {
    const characteristic = new Characteristic({
      uuid: mockUuid
    });

    characteristic.toString().should.equal('{"uuid":"mockuuid","properties":[],"secure":[],"value":null,"descriptors":[]}');
  });

  it('should handle read request', function(done) {
    const characteristic = new Characteristic({});

    characteristic.emit('readRequest', 0, function(result, data) {
      result.should.equal(0x0e);
      should(data).equal(null);

      done();
    });
  });

  it('should handle write request', function(done) {
    const characteristic = new Characteristic({});

    characteristic.emit('writeRequest', Buffer.alloc(0), 0, false, function(result) {
      result.should.equal(0x0e);

      done();
    });
  });

  it('should handle unsubscribe', function() {
    const characteristic = new Characteristic({});

    characteristic.maxValueSize = mockMaxValueSize;
    characteristic.updateValueCallback = mockUpdateValueCallback;

    characteristic.emit('unsubscribe');

    should(characteristic.maxValueSize).equal(null);
    should(characteristic.updateValueCallback).equal(null);
  });
});
