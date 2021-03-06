# libMqttJs
MQTT server implementation in Typescript with as little code as possible.    
Enables full control of packet flow and authentication. 

Docs: [Implementation Reference](http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html)    
Testing: [MQTT.fx 1.7.1](https://mqttfx.jensd.de/)


USAGE
=====

```js
import { mqttConnection } from "./libmqttjs"
import * as net from "net"

var server = net.createServer(function (socket: any) {
  var client = new mqttConnection(socket)
  client.on("connect", (client) => {
    console.log(client);
  })
  client.on("subscribe", (subscribe) => {
    console.log(subscribe)
  })
  client.on("publish", (publish) => {
    console.log(publish)
  })
  client.on("error", (err) => { })
  client.on("close", (err) => { })
})

server.listen(1883);

```