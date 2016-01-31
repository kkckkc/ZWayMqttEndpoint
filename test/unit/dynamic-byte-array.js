var assert = require('assert');

// Load file directly
var fs = require('fs');
eval(fs.readFileSync('mqtt.js','utf8'));


describe("DynamicByteArray", function() {
    it("should expand when adding large payloads", function() {
        var arr = new DynamicByteArray(100);
        for (var i = 0; i < 100; i++) {
            arr.pushArr(new Uint8Array(new ArrayBuffer(1000)));
        }
    });

    describe("#pushInt8", function() {
        it("should add byte", function() {
            var arr = new DynamicByteArray();
            arr.pushInt8(123);
            assert.equal(123, arr.byteArray[0]);
            assert.equal(1, arr.length);
        });
    });

    describe("#pushInt16", function() {
        it("should add 16 bit integer, MSB first", function() {
            var arr = new DynamicByteArray();
            arr.pushInt16(0x7FFF);
            assert.equal(0x7F, arr.byteArray[0]);
            assert.equal(0xFF, arr.byteArray[1]);
            assert.equal(2, arr.length);
        })
    });

    describe("#pushBytes", function() {
        it("should add bytes as is", function() {
            var data = [3, 4, 1, 7];
            var arr = new DynamicByteArray();
            arr.pushBytes(data);
            for (var i = 0; i < data.length; i++) {
                assert.equal(data[i], arr.byteArray[i]);
            }
            assert.equal(data.length, arr.length);
        });
    });

    describe("#pushString", function() {
        it("should encode with length prefix", function() {
            var arr = new DynamicByteArray();
            arr.pushString("ABC", true);

            // Length
            assert.equal(0, arr.byteArray[0]);
            assert.equal(3, arr.byteArray[1]);

            // Characters
            assert.equal(65, arr.byteArray[2]);
            assert.equal(66, arr.byteArray[3]);
            assert.equal(67, arr.byteArray[4]);
        });

        it("should encode without length prefix", function() {
            var arr = new DynamicByteArray();
            arr.pushString("ABC", false);

            // Characters
            assert.equal(65, arr.byteArray[0]);
            assert.equal(66, arr.byteArray[1]);
            assert.equal(67, arr.byteArray[2]);
        });

        it("should encode unicode according to spec 1.5.3.1", function() {
            var arr = new DynamicByteArray();
            arr.pushString("A𪛔", true);
            assert.equal(0x00, arr.byteArray[0]);
            assert.equal(0x05, arr.byteArray[1]);
            assert.equal(0x41, arr.byteArray[2]);
            assert.equal(0xF0, arr.byteArray[3]);
            assert.equal(0xAA, arr.byteArray[4]);
            assert.equal(0x9B, arr.byteArray[5]);
            assert.equal(0x94, arr.byteArray[6]);
        })
    })
});