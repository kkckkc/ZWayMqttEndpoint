var assert = require('assert'),
    mosca = require('mosca'),
    mqtt = require('mqtt');

// Load file directly
var fs = require('fs');
eval(fs.readFileSync('zway-api-mock.js','utf8'));
eval(fs.readFileSync('mqtt.js','utf8'));

describe("MQTT client", function() {
    var PORT = 1883;

    function client() {
        return new MqttClient("localhost", PORT);
    }

    context("when anonymous server exists", function() {
        var anonymousServer;
        before(function() {
            anonymousServer = new mosca.Server({ port: PORT });
        });
        after(function() {
            anonymousServer.close();
        });

        it("should connect", function (done) {
            client().connect({}, function (p) {
                assert.equal(undefined, p.errorMessage);
                done();
            });
        });

        it("should receive message", function(done) {
            var m = client();
            m.onmessage = function (topic, data) {
                assert.equal("Lorem ipsum", String.fromCharCode.apply(null, data));
                done();
            };
            m.connect({}, function () {
                m.subscribe("test/test", function() {
                    var externalClient = mqtt.connect("mqtt://localhost:" + PORT);
                    externalClient.publish('test/test', 'Lorem ipsum');
                });
            });
        });

        it("should send messages", function(done) {
            var fn = function (packet, client) {
                if (packet.topic != "test/send-test") return;
                assert.equal(false, packet.retain);
                assert.equal("Dolor sit amet", String.fromCharCode.apply(null, packet.payload));
                anonymousServer.removeListener("published", fn);
                done();
            };

            anonymousServer.on('published', fn);

            client().connect({}, function (pkg, c) {
                c.publish("test/send-test", "Dolor sit amet");
            });
        });

        it("should send messages with retain flag", function(done) {
            var fn = function (packet, client) {
                if (packet.topic != "test/send-test") return;
                assert.equal(true, packet.retain);
                assert.equal("Dolor sit amet", String.fromCharCode.apply(null, packet.payload));
                anonymousServer.removeListener("published", fn);
                done();
            };

            anonymousServer.on('published', fn);

            client().connect({}, function (pkg, c) {
                c.publish("test/send-test", "Dolor sit amet", true);
            });
        });
    });

    context("when server requires authentication", function () {
        var authenticatedServer;
        before(function(done) {
            authenticatedServer = new mosca.Server({ port: PORT });
            authenticatedServer.on("ready", function() {
                authenticatedServer.authenticate = function (client, username, password, callback) {
                    var authorized = (username === 'alice' && password.toString() === 'secret');
                    if (authorized) client.user = username;
                    callback(null, authorized);
                };
                done();
            });
        });
        after(function() {
            authenticatedServer.close();
        });

        it("should connect with proper credentials", function (done) {
            client().connect({ username: "alice", password: "secret" }, function (p) {
                assert.equal(undefined, p.errorMessage);
                done();
            });
        });

        it("should fail connect with incorrect credentials", function (done) {
            client().connect({ username: "alice", password: "jkadsjkd" }, function (p) {
                assert.equal("Not authorized", p.errorMessage);
                done();
            });
        })
    });
});