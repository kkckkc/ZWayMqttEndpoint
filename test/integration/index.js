var assert = require('assert'),
    mosca = require('mosca'),
    mqtt = require('mqtt');

// Load file directly
var fs = require('fs');
eval(fs.readFileSync('zway-api-mock.js','utf8'));
eval(fs.readFileSync('mqtt.js','utf8'));
eval(fs.readFileSync('index.js','utf8'));

describe("ZWay Plugin", function() {
    var PORT = 1885,
        anonymousServer;
    before(function() {
        anonymousServer = new mosca.Server({ port: PORT });
    });
    after(function() {
        anonymousServer.close();
    });

    it("can be instantiated", function(done) {
        var z = new ZwayMqttEndpoint("id", new Controller());
        z.init({ host: "localhost", port: PORT }, function() {
            done();
            z.end();
        });

        assert.notEqual(null, z.controller);
    });

    it("should emit events on mqtt topic", function(done) {
        var z = new ZwayMqttEndpoint("id", new Controller());

        var externalClient = mqtt.connect("mqtt://localhost:" + PORT);
        externalClient.on("message", function (topic, message) {
            assert.equal("zway/devices/id/update", topic);
            assert.equal("deviceType", JSON.parse(String.fromCharCode.apply(null, message)).type);
            done();
            externalClient.end();
            z.end();
        });

        externalClient.subscribe('#', function() {
            z.init({ host: "localhost", port: PORT, topic_prefix: "zway" }, function() {
                z.controller.emit("change:metrics:level", new Device({
                    id: "id",
                    "metrics:title": "title",
                    "metrics:level": "level",
                    "metrics:icon": "icon",
                    deviceType: "deviceType"
                }));
            });
        });
    });

    it("should call device command on mqtt messages", function (done) {
        var mockDevice = new Device({ id: "id-182" });
        var z = new ZwayMqttEndpoint("id", new Controller([ mockDevice ]));

        mockDevice.performCommand = function(cmd, args) {
            assert.equal(cmd, "set");
            assert.equal(null, args);
            done();
            z.end();
        };

        z.init({ host: "localhost", port: PORT, topic_prefix: "zway" }, function() {
            mqtt.connect("mqtt://localhost:" + PORT).publish("zway/devices/id_182/set", '{ "command": "set" }');
        });
    });

    it("should send status update back when requesting a full status updated", function(done) {
        var z = new ZwayMqttEndpoint("id", new Controller([ new Device({ id: "id-1" }), new Device({ id: "id-2" }) ]));
        var externalClient = mqtt.connect("mqtt://localhost:" + PORT);
        var numberOfStatusMessagesReceived = 0;
        externalClient.on("message", function (topic, message) {
            if (topic.startsWith("zway/devices") && ++numberOfStatusMessagesReceived == 2) {
                done();
                z.end();
            }
        });
        externalClient.subscribe('zway/#', function() {
            z.init({ host: "localhost", port: PORT, topic_prefix: "zway" }, function() {
                externalClient.publish("zway/status", '');
            });
        });
    });

    it("should coalesce events for one device", function(done) {
        var z = new ZwayMqttEndpoint("id", new Controller());

        var externalClient = mqtt.connect("mqtt://localhost:" + PORT);
        externalClient.on("message", function (topic, message) {
            assert.equal("zway/devices/id/update", topic);
            assert.equal("level2", JSON.parse(String.fromCharCode.apply(null, message)).level);
            done();
            externalClient.end();
            z.end();
        });

        externalClient.subscribe('#', function() {
            z.init({ host: "localhost", port: PORT, topic_prefix: "zway", coalesce_interval: 100 }, function() {
                z.controller.emit("change:metrics:level", new Device({
                    id: "id",
                    "metrics:title": "title",
                    "metrics:level": "level",
                    "metrics:icon": "icon",
                    deviceType: "deviceType"
                }));
                z.controller.emit("change:metrics:level", new Device({
                    id: "id",
                    "metrics:title": "title",
                    "metrics:level": "level2",
                    "metrics:icon": "icon",
                    deviceType: "deviceType"
                }));
            });
        });
    });
});