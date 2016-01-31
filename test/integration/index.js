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
        z.onconnected = function() {
            done();
            z.end();
        };
        z.init({ host: "localhost", port: PORT });

        assert.notEqual(null, z.controller);
    });

    it("should emit events on mqtt topic", function(done) {
        var controller = new Controller(),
            z = new ZwayMqttEndpoint("id", controller),
            externalClient = mqtt.connect("mqtt://localhost:" + PORT);

        externalClient.on("message", function (topic, message) {
            assert.equal("zway/devices/id/update", topic);
            assert.equal("deviceType", JSON.parse(String.fromCharCode.apply(null, message)).type);
            done();
            externalClient.end();
            z.end();
        });

        externalClient.subscribe('#', function() {
            z.onconnected = function() {
                controller.emit("change:metrics:level", new Device({ "id": "id", "metrics:title": "title", "metrics:level": "level",
                    "metrics:icon": "icon", "deviceType": "deviceType" }));
            };
            z.init({ host: "localhost", port: PORT, topic_prefix: "zway" });
        });
    });

    it("should call device command on mqtt messages", function (done) {
        var device = new Device({ id: "id-182" }),
            controller = new Controller([ device ]),
            z = new ZwayMqttEndpoint("id", controller),
            externalClient = mqtt.connect("mqtt://localhost:" + PORT);

        device.performCommand = function(cmd, args) {
            assert.equal(cmd, "set");
            assert.equal(null, args);
            done();
            z.end();
        };

        z.onconnected = function() {
            externalClient.publish("zway/devices/id_182/set", '{ "command": "set" }');
        };
        z.init({ host: "localhost", port: PORT, topic_prefix: "zway" });
    });
});