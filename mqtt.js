var NOOP = function() {},
    PACKET_TYPE = {
        CONNECT: 1, CONNACK: 2, PUBLISH: 3, PUBACK: 4, PUBREC: 5, PUBREL: 6, PUBCOMP: 7, SUBSCRIBE: 8,
        SUBACK: 9, UNSUBSCRIBE: 10, UNSUBACK: 11, PINGREQ: 12, PINGRESP: 13, DISCONNECT: 14
    },
    CONNECTION_ERRORS = [
        "Unacceptable protocol version", "Identifier rejected", "Server unavailable", "Bad username / password",
        "Not authorized"
    ];

var MqttClient = function (host, port, clientId) {
    this.sock = new socket.tcp();
    this.host = host;
    this.port = port;
    this.packetId = 0;
    this.callbacks = {};
    this.clientId = clientId || (new Date).getTime() + "_" + Math.floor(Math.random() * 100000);
    this.onmessage = this.ondisconnect = NOOP;
};

MqttClient.prototype.connect = function (options, callback) {
    this.options = options || {};
    this.options.clientId = this.clientId;
    callback = callback || NOOP;

    var self = this;
    var packageStream = new PacketStream(function (p) {
        switch (p.type) {
            case PACKET_TYPE.CONNACK:
                callback(p, self);
                break;
            case PACKET_TYPE.PUBLISH:
                self.onmessage(p.topic, p.payload, self);
                break;
            case PACKET_TYPE.SUBACK:
            case PACKET_TYPE.UNSUBACK:
                if (p.packetId in self.callbacks) {
                    self.callbacks[p.packetId].call(self);
                }
        }
    });

    this.sock.onconnect = function () {
        self.sock.send(new Packet(PACKET_TYPE.CONNECT, self.options).encode());
    };

    this.sock.onrecv = function (data) {
        packageStream.processBytes(data);
    };

    this.sock.onclose = function () {
        self.ondisconnect();
    };

    this.sock.connect(this.host, this.port);
};

MqttClient.prototype.close = function () {
    this.ondisconnect = NOOP;
    var p = new Packet(PACKET_TYPE.DISCONNECT, {clientId: this.clientId});
    this.sock.send(p.encode());
    this.sock.close();
};

MqttClient.prototype.publish = function (topic, message) {
    var p = new Packet(PACKET_TYPE.PUBLISH, {topicName: topic, payload: message, clientId: this.clientId});
    this.sock.send(p.encode());
};

MqttClient.prototype.subscribe = function (topic, callback) {
    var packetId = this.packetId++,
        p = new Packet(PACKET_TYPE.SUBSCRIBE, {topicFilters: [topic], packetId: packetId, clientId: this.clientId});
    this.callbacks[packetId] = callback || NOOP;
    this.sock.send(p.encode());
};

MqttClient.prototype.unsubscribe = function (topic, callback) {
    var p = new Packet(PACKET_TYPE.UNSUBSCRIBE,
        { topicFilters: [topic], packetId: this.packetId++, clientId: this.clientId });
    this.callbacks[this.packetId] = callback || NOOP;
    this.sock.send(p.encode());
};

var DynamicByteArray = function (startSize, expansionFactor) {
    this.expansionFactor = expansionFactor || 1.25;
    this.byteArray = new Uint8Array(new ArrayBuffer(startSize || 100));
    this.length = 0;
};

DynamicByteArray.prototype.ensureCapacityFor = function (dataSize) {
    if (this.length + dataSize >= this.byteArray.length) {
        var newByteArray = new Uint8Array(new ArrayBuffer(Math.ceil(Math.max(
            this.byteArray.length + dataSize * this.expansionFactor, this.byteArray.length * this.expansionFactor))));
        newByteArray.set(this.byteArray);
        this.byteArray = newByteArray;
    }
};

DynamicByteArray.prototype.pushInt8 = function (data) {
    this.ensureCapacityFor(1);
    this.byteArray[this.length++] = data;
};

DynamicByteArray.prototype.pushInt16 = function (data) {
    this.ensureCapacityFor(2);
    this.byteArray[this.length++] = data >> 8;
    this.byteArray[this.length++] = data & 0xFF;
};

DynamicByteArray.prototype.pushString = function (data, includeLength) {
    var start = this.length;
    if (includeLength) this.length += 2;

    var charList = unescape(encodeURIComponent(data)).split('');
    this.ensureCapacityFor(charList.length + (includeLength ? 2 : 0));
    for (var i = 0; i < charList.length; i++) {
        this.byteArray[this.length++] = charList[i].charCodeAt(0)
    }

    if (includeLength) {
        var l = this.length - start - 2;
        this.byteArray[start] = l >> 8;
        this.byteArray[start + 1] = l & 0xFF;
    }
};

DynamicByteArray.prototype.pushBytes = function (data) {
    this.ensureCapacityFor(data.length);
    this.byteArray.set(data, this.length);
    this.length += data.length;
};

DynamicByteArray.prototype.pushArr = function (data) {
    this.ensureCapacityFor(data.length + 2);
    this.pushInt16(data.length);
    this.pushBytes(data);
};

DynamicByteArray.prototype.slice = function (start, end) {
    var data = this.byteArray.slice(start, end || start);
    var arr = new DynamicByteArray(data.length);
    arr.pushBytes(data);
    return arr;
};

DynamicByteArray.prototype.toArray = function (start, end) {
    return this.byteArray.slice(start || 0, end || this.length);
};

var Packet = function (type, options) {
    this.type = type;
    this.options = options || {};
};

Packet.prototype.encode = function () {
    var byte1 = (this.type & 0x0f) << 4;

    var arr = new DynamicByteArray();

    switch (this.type) {
        case PACKET_TYPE.CONNECT:
            arr.pushBytes([0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04]);

            var flags = (1 << 1);
            if ("username" in this.options) flags |= (1 << 7);
            if ("password" in this.options) flags |= (1 << 6);
            arr.pushInt8(flags);
            arr.pushInt16("keepAlive" in this.options ? this.options.keepAlive : 0);

            arr.pushString(this.options.clientId, true);

            if ("username" in this.options) {
                arr.pushString(this.options.username, true);
            }

            if ("password" in this.options) {
                if (this.options.password instanceof Array) {
                    arr.pushArr(this.options.payload);
                } else {
                    arr.pushString(this.options.password, true);
                }
            }
            break;

        case PACKET_TYPE.PUBLISH:
            arr.pushString(this.options.topicName, true);

            if (this.options.payload instanceof Array) {
                arr.pushBytes(this.options.payload);
            } else {
                arr.pushString(this.options.payload, false);
            }
            break;

        case PACKET_TYPE.SUBSCRIBE:
            byte1 |= (1 << 1);

            arr.pushInt16(this.options.packetId);
            for (var i = 0; i < this.options.topicFilters.length; i++) {
                arr.pushString(this.options.topicFilters[i], true);
                arr.pushInt8(0);
            }

            break;

        case PACKET_TYPE.UNSUBSCRIBE:
            byte1 |= (1 << 1);

            arr.pushInt16(this.options.packetId);
            for (var i = 0; i < this.options.topicFilters.length; i++) {
                arr.pushString(this.options.topicFilters[i], true);
            }
            break;

        case PACKET_TYPE.PINGREQ:
        case PACKET_TYPE.DISCONNECT:
            break;

        default:
            throw new Error("Unsupported package type " + this.type);
    }

    var fullPackage = new DynamicByteArray(arr.length + 4);
    fullPackage.pushInt8(byte1);
    LengthEncoding.encode(arr.length, fullPackage);
    fullPackage.pushBytes(arr.toArray());

    return fullPackage.toArray();
};

Packet.prototype.decode = function (data, dynHeaderStart) {
    this.type = data[0] >> 4;

    switch (this.type) {
        case PACKET_TYPE.CONNACK:
            var connectReturnCode = data[3];
            if (connectReturnCode >= 1 && connectReturnCode <= 5) {
                this.errorMessage = CONNECTION_ERRORS[connectReturnCode - 1];
            } else if (connectReturnCode > 5) {
                this.errorMessage = "Unknown error";
            }
            break;

        case PACKET_TYPE.PUBLISH:
            var topicLen = (data[dynHeaderStart] << 8 | data[dynHeaderStart + 1]);
            this.payload = data.slice(dynHeaderStart + 2 + topicLen);
            this.topic = String.fromCharCode.apply(null, data.slice(dynHeaderStart + 2, dynHeaderStart + 2 + topicLen));
            break;

        case PACKET_TYPE.UNSUBACK:
        case PACKET_TYPE.SUBACK:
            this.packetId = data[dynHeaderStart] << 8 | data[dynHeaderStart + 1];
            break;
    }
    return this;
};

var LengthEncoding = {
    decode: function(array) {
        var offset = 1, value = 0;
        do {
            if (array.length <= offset) return 0xFFFFFFFF;
            if (offset >= 5) throw new Error("Malformed Remaining Length");
            value += (array.byteArray[offset] & 0x7F) << ((offset - 1) * 7);
        } while ((array.byteArray[offset++] & 0x80) != 0);
        return value;
    },

    encode: function(length, array) {
        do {
            array.pushInt8((length & 0x7F) | (length > 0x7F ? 0x80 : 0));
            length = length >> 7;
        } while (length > 0);
    },

    length: function(v) {
        return v <= 0x7F ? 1 : (v <= 0x7FFF ? 2 : (v <= 0x7FFFFF ? 3 : 4));
    }
};

var PacketStream = function (callback) {
    this.callback = callback;
    this.buffer = new DynamicByteArray();
};

PacketStream.prototype.processBytes = function (bytes) {
    this.buffer.pushBytes(bytes);

    while (true) {
        var packageLength = LengthEncoding.decode(this.buffer);
        if (this.buffer.length < packageLength) break;

        var end = packageLength + LengthEncoding.length(packageLength) + 1;
        this.callback(new Packet().decode(this.buffer.toArray(0, end), LengthEncoding.length(packageLength) + 1));

        this.buffer = this.buffer.slice(end);
    }
};