
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
