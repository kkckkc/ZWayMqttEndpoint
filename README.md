# ZWayMqttEndpoint
Provide inbound and outbound MQTT connectivity for zway (razberry). This allows control of ZWay devices through MQTT.


## Installation

```
git clone git@github.com:kkckkc/ZWayMqttEndpoint.git
cd ZwayMqttEndpoint
node build.js
cp -R ZwayMqttEndpoint /opt/z-way-server/automation/modules
sudo service z-way-server restart
```

Activate ZWayMqttEndpoint app in zway admin


## Overview

### MQTT topics and messages supported

The following topics are used (`<prefix>` can be configured and is by default `zway`):

1. `<prefix>/<device-id>/update` - app sends update on this topic whenever the state of a zway device is changed. The
message is a JSON object with the following properties:

    1. id
    2. title
    3. icon
    4. type
    5. level

2. `<prefix>/status` - request to get status of all devices. ZWayMqttEndpoint responds with status update (see 1) for all
devices

3. `<prefix>/<device-id>/set` - request to run zway command. Accepts JSON payload with two properties `command` and `args`

    Examples:

    ```
{ "command": "on" }
{ "command": "off" }
{ "command": "exact", "args": { "level": 50 } }
    ```


### Code overview

The code consists of a number of components:

1. `index.js` - contains the zway app

2. `mqtt.js` - simple mqtt client with no external dependencies. Created in such a way that it is compatible with zway
v8 runtime, but can also be run with node

3. `zway-api-mock.js` - stubs etc to allow `index.js` to be run and tested outside of the zway v8 engine

4. `build.js` - simple build script to create `ZWayMqttEndpoint/index.js` in the right format