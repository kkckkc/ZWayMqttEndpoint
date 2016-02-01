var fs = require("fs");

var dest = "ZwayMqttEndpoint/index.js";

fs.writeFileSync(dest,
    "/*** MQTT Endpoint ***********************************************************\n"+
    " Version: 0.1.0\n" +
    " -----------------------------------------------------------------------------\n" +
    " Author: Magnus Johansson <kkckkc@gmail.com>\n" +
    " *****************************************************************************/\n\n");

fs.appendFileSync(dest, "var MqttClient = (function() {\n");
fs.appendFileSync(dest, fs.readFileSync("mqtt.js"));
fs.appendFileSync(dest, "return MqttClient;\n})();\n\n");

fs.appendFileSync(dest, fs.readFileSync("index.js"));
