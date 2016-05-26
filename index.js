function ZwayMqttEndpoint(id, controller) {
    ZwayMqttEndpoint.super_.call(this, id, controller);
}

inherits(ZwayMqttEndpoint, AutomationModule);
_module = ZwayMqttEndpoint;

ZwayMqttEndpoint.prototype.init = function (config, callback) {
    ZwayMqttEndpoint.super_.prototype.init.call(this, config);

    var self = this,
        callback = callback || function () { };

    var startsWith = function(s, searchString){
        return s.substr(0, searchString.length) === searchString;
    };

    var endsWith = function(s, searchString) {
        var start = s.length - searchString.length;
        return start === s.indexOf(searchString, start);
    };

    var log = function(msg) {
        console.log("ZwayMqttEndpoint: " + msg);
    };

    var deviceToTopic = function (d) {
        var id = (typeof d == "string") ? d : d.get("id");
        var normalizedId = id.toLowerCase().replace(/[^a-z0-9]/g, "_");
        return self.config.topic_prefix + "/devices/" + normalizedId;
    };

    var mqttClient = new MqttClient(self.config.host, parseInt(self.config.port));
    mqttClient.ondisconnect = function() {
        log("Disconnected from MQTT server, attempting to reconnect");
        setTimeout(function() { self.connect(); }, 5000);
    };

    this.connect = function () {
        log("Connect");
        var connectArgs = {};
        if ("username" in self.config && self.config.username != null && self.config.username != "") {
            connectArgs.username = self.config.username;
        }
        if ("password" in self.config && self.config.password != null && self.config.password != "") {
            connectArgs.password = self.config.password;
        }
        mqttClient.connect(connectArgs, function (p) {
            if ("errorMessage" in p) {
                log("Cannot connect to MQTT server: " + p.errorMessage);
                setTimeout(function() { self.connect(); }, 5000);
            }
            log("Connected");
            self.setupSubscriptions();
        });
    };

    this.parsePayload = function(payload) {
        try {
            return JSON.parse(String.fromCharCode.apply(null, payload));
        } catch (e) {
            var bytes = "";
            for (var i = 0; i < payload.length; i++) {
                bytes += payload[i].toString(16);
                if (i < (payload.length - 1)) bytes += ", ";
            }
            throw Error("Cannot parse payload, string: '" + String.fromCharCode.apply(null, payload) + "', bytes: " + bytes);
        }
    };

    this.getRetainFlag = function() {
        if ("retain" in self.config) return "true" == self.config.retain;
        return false;
    };

    var handleDeviceMessage = function (payload, topic) {
        var findDeviceMatchingTopic = function (topic) {
            var matches = self.controller.devices.filter(function (d) {
                return deviceToTopic(d) + "/set" == topic;
            });
            if (matches.length == 0) {
                return null;
            } else {
                return matches[0];
            }
        };

        var message = self.parsePayload(payload);
        var device = findDeviceMatchingTopic(topic);
        if (device == null) {
            log("Cannot find device matching topic: " + topic);
        } else {
            device.performCommand(message.command, message.args);
        }
    };

    var handleStatusMessage = function() {
        self.controller.devices.forEach(sendDeviceStatusMessage);
    };

    var sendDeviceStatusMessage = function (device) {
        log("Device update for " + device.get("id"));
        var msg = {
            id: device.get("id"),
            title: device.get("metrics:title"),
            icon: device.get("metrics:icon"),
            type: device.get("deviceType"),
            level: device.get("metrics:level")
        };
        mqttClient.publish(deviceToTopic(device) + "/update", JSON.stringify(msg), self.getRetainFlag());
    };

    var queue = [];
    var queueDeviceStatusMessage = function (device) {
        queue.push({
            id: device.get("id"),
            title: device.get("metrics:title"),
            icon: device.get("metrics:icon"),
            type: device.get("deviceType"),
            level: device.get("metrics:level")
        });
    };

    var processQueue = function() {
        var devicesSent = [];
        for (var i = queue.length - 1; i >= 0; i--) {
            if (queue[i].id in devicesSent) continue;
            mqttClient.publish(deviceToTopic(queue[i].id) + "/update", JSON.stringify(queue[i]), self.getRetainFlag());
            devicesSent[queue[i].id] = true
        }
        queue = [];
    };

    this.setupSubscriptions = function () {
        this.controller.devices.on('change:metrics:level', function (device) {
            queueDeviceStatusMessage(device);
            if (self.config['coalesce_interval'] > 0) {
                setTimeout(processQueue, self.config['coalesce_interval']);
            } else {
                processQueue();
            }
        });

        mqttClient.onmessage = function(topic, payload) {
            if (startsWith(topic, self.config.topic_prefix)) {
                if (topic == self.config.topic_prefix + "/status") {
                    log("Status reques message on topic " + topic);
                    handleStatusMessage();
                } else if (endsWith(topic, "/set")) {
                    log("Status change message on topic " + topic);
                    handleDeviceMessage(payload, topic);
                }
            }
        };

        mqttClient.subscribe(self.config.topic_prefix + "/#", callback);
    };

    this.end = function () {
        mqttClient.close();
    };

    this.connect();
};

