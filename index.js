function ZwayMqttEndpoint(id, controller) {
    ZwayMqttEndpoint.super_.call(this, id, controller);
    this.onconnected = function() { };
}

inherits(ZwayMqttEndpoint, AutomationModule);
_module = ZwayMqttEndpoint;

ZwayMqttEndpoint.prototype.init = function (config) {
    ZwayMqttEndpoint.super_.prototype.init(this, config);

    var self = this;

    var deviceToTopic = function (d) {
        var id = d.get("id").toLowerCase().replace(/[^a-z0-9]/g, "_");
        return self.config.topic_prefix + "/devices/" + id;
    };

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

    var mqttClient = new MqttClient(self.config.host, self.config.port);
    mqttClient.ondisconnect = function() {
        console.log("ZwayMqttEndpoint: Disconnected from MQTT server, attempting to reconnect");
        setTimeout(function() { self.connect(); }, 5000);
    };

    this.connect = function () {
        var connectArgs = {};
        if ("username" in self.config && self.config.username != null && self.config.username != "") {
            connectArgs.username = self.config.username;
        }
        if ("password" in self.config && self.config.password != null && self.config.password != "") {
            connectArgs.password = self.config.password;
        }
        mqttClient.connect(connectArgs, function (p) {
            if ("errorMessage" in p) {
                console.log("ZwayMqttEndpoint: Cannot connect to MQTT server: " + p.errorMessage);
                setTimeout(function() { self.connect(); }, 5000);
            }
            self.setupSubscriptions();
        });
    };

    this.setupSubscriptions = function () {
        this.controller.devices.on('change:metrics:level', function (device) {
            var msg = {
                id: device.get("id"),
                title: device.get("metrics:title"),
                icon: device.get("metrics:icon"),
                type: device.get("deviceType"),
                level: device.get("metrics:level")
            };
            mqttClient.publish(deviceToTopic(device) + "/update", JSON.stringify(msg));
        });

        mqttClient.onmessage = function(topic, payload) {
            if (! topic.endsWith("/set")) return;

            var message = JSON.parse(String.fromCharCode.apply(null, payload));
            var device = findDeviceMatchingTopic(topic);
            if (device == null) {
                console.log("ZwayMqttEndpoint: Cannot find device matching topic: " + topic);
            } else {
                device.performCommand(message.command, message.args);
            }
        };

        mqttClient.subscribe(self.config.topic_prefix + "/#", function() {
            self.onconnected();
        });
    };

    this.end = function () {
        mqttClient.close();
    };

    this.connect();
};

