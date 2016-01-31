var net = require('net');

var socket = {
    tcp: function () {
        var self = this;

        this.send = function (data) {
            self.client.write(new Buffer(data));
        };

        this.onrecv = this.onconnect = this.onclose = function () {
        };

        this.connect = function (host, port) {
            self.client = new net.Socket();
            self.client.connect(port, host, function () {
                self.onconnect();
            });
            self.client.on('close', self.onclose);
            self.client.on('data', self.onrecv);
        };

        this.close = function () {
            self.client.end();
        };
    }
};

function inherits (ctor, superCtor) {
    Object.defineProperty(ctor, "super_", {
        value: superCtor,
        enumerable: false,
        writable: false,
        configurable: false
    });
    ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
            value: ctor,
            enumerable: false,
            writable: true,
            configurable: true
        }
    });
}

function AutomationModule(id, controller) {
    this.id = id;
    this.controller = controller;
}

AutomationModule.prototype.init = function(subclass, config) {
    this.config = config;
};


function Controller(devices) {
    this.callbacks = [];
    this.devices = devices || [];

    var self = this;
    this.devices.on = function(event, callback) {
        self.callbacks.push({ event: event, callback: callback });
    }
}

Controller.prototype.emit = function (event, payload) {
    for (var i = 0; i < this.callbacks.length; i++) {
        if (this.callbacks[i].event == event) {
            this.callbacks[i].callback(payload);
        }
    }
};


function Device(props) {
    this.props = props;
}

Device.prototype.get = function (name) {
    return this.props[name];
};
