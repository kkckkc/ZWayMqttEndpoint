var assert = require('assert');

// Load file directly
var fs = require('fs');
eval(fs.readFileSync('mqtt.js','utf8'));


describe("LengthEncoding", function() {
    describe("#encode", function() {
        it("should encode < 127 to one byte", function() {
            var arr = new DynamicByteArray();
            LengthEncoding.encode(127, arr);
            assert.equal(127, arr.byteArray[0]);
        });

        it("should encode < 16 384 to two bytes", function() {
            var arr = new DynamicByteArray();
            LengthEncoding.encode(1 << 7 | 2, arr);
            assert.equal(0x80 | 2, arr.byteArray[0]);
            assert.equal(1, arr.byteArray[1]);
        });

        it("should encode < 2 097 151 to three bytes", function() {
            var arr = new DynamicByteArray();
            LengthEncoding.encode(1 << 14 | 2 << 7 | 3, arr);
            assert.equal(0x80 | 3, arr.byteArray[0]);
            assert.equal(0x80 | 2, arr.byteArray[1]);
            assert.equal(1, arr.byteArray[2]);
        });

        it("should encode < 268 435 455 to four bytes", function() {
            var arr = new DynamicByteArray();
            LengthEncoding.encode(1 << 21 | 2 << 14 | 3 << 7 | 4, arr);
            assert.equal(0x80 | 4, arr.byteArray[0]);
            assert.equal(0x80 | 3, arr.byteArray[1]);
            assert.equal(0x80 | 2, arr.byteArray[2]);
            assert.equal(1, arr.byteArray[3]);
        });
    });

    describe("#decode", function() {
        it("should decode one byte", function() {
            var arr = new DynamicByteArray();
            arr.pushBytes([0, 127]);
            assert.equal(127, LengthEncoding.decode(arr));
        });

        it("should decode two bytes", function() {
            var arr = new DynamicByteArray();
            arr.pushBytes([0, 0x80 | 2, 1]);
            assert.equal(1 <<7 | 2, LengthEncoding.decode(arr));
        });

        it("should decode three bytes", function() {
            var arr = new DynamicByteArray();
            arr.pushBytes([0, 0x80 | 3, 0x80 | 2, 1]);
            assert.equal(1 << 14 | 2 << 7 | 3, LengthEncoding.decode(arr));
        });

        it("should decode four bytes", function() {
            var arr = new DynamicByteArray();
            arr.pushBytes([0, 0x80 | 4, 0x80 | 3, 0x80 | 2, 1]);
            assert.equal(1 << 21 | 2 << 14 | 3 << 7 | 4, LengthEncoding.decode(arr));
        });
    });

    describe("#length", function() {
        it("should encode < 127 to one byte", function() {
            assert.equal(1, LengthEncoding.length(127));
        });

        it("should encode < 16 383 to two bytes", function() {
            assert.equal(2, LengthEncoding.length(16383));
        });

        it("should encode < 2 097 151 to three bytes", function() {
            assert.equal(3, LengthEncoding.length(2097151));
        });

        it("should encode < 268 435 455 to four bytes", function() {
            assert.equal(4, LengthEncoding.length(268435455));
        });
    })
});