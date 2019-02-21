import { EventEmitter } from "events";
import * as net from "net"

export class mqttConnection extends EventEmitter {
  socket: net.Socket;
  apikey: string = "";

  constructor(socket: net.Socket) {
    super()
    this.socket = socket;
    socket.on("data", this.handleData(socket))
    socket.on("close", (err) => { this.emit("close", err); })
  }

  publish = (topic: string, data: any) => {
    if (typeof data != "string") { data = JSON.stringify(data); }
    try {
      this.socket.write(buildMqttPublishPacket(topic, data));
    } catch (err) { console.log(err); }
  }

  handleData = (socket: net.Socket) => {
    return (data: Buffer) => {

      // //debug
      // for (var d = 0; d < data.length; d++) {
      //   console.log(d + "\t" + bufferToBinary(data, d) + "\t" + data.slice(d, d + 1).toString())
      // }


      var packetTypeHex = data.slice(0, 1).toString('hex')[0]
      var mqttPacketType = Buffer.from('0' + packetTypeHex, 'hex')[0];
      var remainingLength = data.readUInt8(1)

      if (mqttPacketType == 1) {

        var connect: any = {
          lengthMSB: data.readInt8(2),
          lengthLSB: data.readInt8(3)
        }

        connect.protocol = data.slice(4, 4 + connect.lengthLSB).toString();

        // connect.protocolLevel = data.readInt8(8);

        // connect.flagsBinaryStr = data.readUInt8(9).toString(2)
        // connect.flags = {
        //   reserved: checkBit(data.slice(9, 10), 0),
        //   cleanSession: checkBit(data.slice(9, 10), 1),
        //   willFlag: checkBit(data.slice(9, 10), 2),
        //   willQosA: checkBit(data.slice(9, 10), 3),
        //   willQosB: checkBit(data.slice(9, 10), 4),
        //   willRetain: checkBit(data.slice(9, 10), 5),
        //   passwordFlag: checkBit(data.slice(9, 10), 6),
        //   usernameFlag: checkBit(data.slice(9, 10), 7)
        // }

        // connect.keepAlive = data.readInt16BE(10)

        // var clientidLength = data.readInt16BE(12)
        // connect.clientid = data.slice(14, 14 + clientidLength).toString()

        // var usernameLength = data.readInt16BE(14 + clientidLength)
        // var usernameOffset = 14 + clientidLength + 2
        // connect.username = data.slice(usernameOffset, usernameOffset + usernameLength).toString()


        // var passwordLength = data.readInt16BE(usernameOffset + usernameLength)
        // var passwordOffset = usernameOffset + usernameLength + 2
        // connect.password = data.slice(passwordOffset, passwordOffset + passwordLength).toString()

        console.log(connect);
        socket.write(" \u0002\u0000\u0000");
      }

      if (mqttPacketType == 2) {
        console.log("CONNACK")
      }

      /*-----------------------------------------------------------------------
          Handle an incoming PUBLISH packet
      */
      if (mqttPacketType == 3) {

        var dataToParse = true;
        var byteOffset = 0;

        while (dataToParse) {
          var parse: any = {}
          //packet Type
          var packetTypeHex = data.slice(byteOffset, byteOffset + 1).toString('hex')[0]
          parse.packetType = Buffer.from('0' + packetTypeHex, 'hex')[0];
          parse.remainingLength = data.readUInt8(byteOffset + 1)
          parse.remainingDataTotal = data.length - byteOffset;

          parse.retain = !!parseInt(bufferToBinary(data, byteOffset)[7 - 0])
          parse.dup = !!parseInt(bufferToBinary(data, byteOffset)[7 - 3])
          parse.qos = parseInt(bufferToBinary(data, byteOffset).slice(-3, -1), 2);

          parse.length = data.readUInt16BE(byteOffset + 2);

          var topicStartByte = byteOffset + 4
          var topicEndByte = topicStartByte + parse.length
          parse.topicEndByte = topicEndByte
          parse.topic = data.slice(topicStartByte, topicEndByte).toString()


          // for (var d = byteOffset; d <= (byteOffset + parse.remainingLength) + 1; d++) {
          //   console.log(d + "\t" + bufferToBinary(data, d) + "\t" + data.slice(d, d + 1).toString())
          // }

          var payloadByte = topicEndByte;
          if (parse.qos > 0) {
            payloadByte += 2; /// if QOS 1 or 2 then these two bytes exist for packetIdentifier
            parse.packetIdentifier = data.readUInt16BE(topicEndByte);
            parse.packetIdentifierBuffer = data.slice(topicEndByte, topicEndByte + 2)
          }

          //PAYLOAD
          parse.payloadStartByte = payloadByte
          parse.payloadEndByte = byteOffset + parse.remainingLength + 2
          parse.payloadBuffer = data.slice(parse.payloadStartByte, parse.payloadEndByte);
          parse.payload = parse.payloadBuffer.toString()


          //console.log(parse);
          if (parse.qos == 1) {
            //var remaininglength = 4;
            var PUBACK = Buffer.concat([Buffer.from([0b01000000]), Buffer.from([2]), parse.packetIdentifierBuffer]); //header
            socket.write(PUBACK)
          }
          if (parse.qos == 2) {
            var PUBREC = Buffer.concat([Buffer.from([0b01010000]), Buffer.from([2]), parse.packetIdentifierBuffer]); //header
            socket.write(PUBREC)
          }

          this.emit("publish", parse)
          dataToParse = false;
        }
      }

      /*-----------------------------------------------------------------------
          PUBACK
      */

      if (mqttPacketType == 4) {
        console.log("PUBACK")
      }

      /*-----------------------------------------------------------------------
          PUBREC
      */

      if (mqttPacketType == 5) {
        console.log("PUBREC")
      }

      /*-----------------------------------------------------------------------
         PUBREL used for QOS2
      */

      if (mqttPacketType == 6) {
        var parse: any = {}
        var packetTypeHex = data.slice(0, 0 + 1).toString('hex')[0]
        parse.packetType = Buffer.from('0' + packetTypeHex, 'hex')[0];
        parse.packetIdentifier = data.readUInt16BE(2);
        parse.packetIdentifierBuffer = data.slice(2, 4)
        var PUBCOMP = Buffer.concat([Buffer.from([0b01110000]), Buffer.from([2]), parse.packetIdentifierBuffer]); //header
        socket.write(PUBCOMP)
      }

      /*-----------------------------------------------------------------------
         PUBCOMP     
      */

      if (mqttPacketType == 7) {
        console.log("PUBCOMP")
      }

      /*-----------------------------------------------------------------------
          SUBSCRIBE
      */
      if (mqttPacketType == 8) {
        var parse: any = {}
        parse.packetIdentifier = data.slice(2, 4)
        parse.remainingLength = getRemainingLength(data)

        var subTopics = true;
        parse.subs = []

        var topicParseByte = 4

        while (subTopics) {
          var st: any = {}
          st.length = data.readUInt16BE(topicParseByte);
          var topicStartByte = topicParseByte + 2
          var topicEndByte = topicStartByte + st.length
          st.topic = data.slice(topicStartByte, topicEndByte).toString();
          st.qos = parseInt(bufferToBinary(data, topicEndByte).slice(-2), 2);
          parse.subs.push(st)
          topicParseByte = topicEndByte + 5
          if ((data.length - topicEndByte) < 5) {
            subTopics = false;
          }
        }


        var suback = Buffer.concat([
          Buffer.from([parseInt("10010000", 2)]),
          Buffer.from([3]),
          parse.packetIdentifier,
          Buffer.from([parse.qos])
        ])
        //console.log(suback);
        socket.write(suback);

        for (var sub of parse.subs) {
          this.emit("subscribe", {
            subscribe: sub.topic
          })
        }

        return;
      }

      /*-----------------------------------------------------------------------
          SUBACK
      */
      if (mqttPacketType == 9) { console.log("SUBACK") }
      if (mqttPacketType == 10) { console.log("UNSUBSCRIBE") }
      if (mqttPacketType == 11) { console.log("UNSUBACK") }

      /*-----------------------------------------------------------------------
          PINGREQ
      */
      if (mqttPacketType == 12) {
        var ping = Buffer.concat([Buffer.from([0b11010000]), Buffer.from([0b0000000])]); //header
        socket.write(ping)
      }
      /*-----------------------------------------------------------------------
          PINGRESP
      */
      if (mqttPacketType == 13) { console.log("PINGRESP") }
      /*-----------------------------------------------------------------------
          DISCONNECT    
      */
      if (mqttPacketType == 14) { console.log("DISCONNECT") }
      /*-----------------------------------------------------------------------
            
      */
    }
  }


}



function getRemainingLength(data: any) {
  var total = 0;
  var bytenum = 0;

  if (data[1] <= 127) {
    total += data[1]
    bytenum = 1;
  } else {
    bytenum = 2;
    total += data[1] - 128

    if (data[2] <= 127) {

      total += data[2] * 128
    } else {
      bytenum = 3;
      total += (data[2] - 128) * 128
      total += data[3] * (128 * 128)
    }
  }

  return { total, bytenum }
}




function getPacketIdentifier(data: any) {

  var remainingdata = true;
  var total = 0;
  var bytenum = 0;
  if (data[1] <= 127) {

    total += data[1]
    bytenum = 1;
  } else {

    bytenum = 2;
    total += data[1] - 128

    if (data[2] <= 127) {

      total += data[2] * 128
    } else {
      bytenum = 3;
      total += (data[2] - 128) * 128
      total += data[3] * (128 * 128)
    }
  }

  return { total, bytenum }
}


function checkBit(data: Buffer, bitnum: number) {
  //bitnum from right
  try {
    var binaryStr = data.readUInt8(0).toString(2);
    return parseInt(binaryStr.slice(binaryStr.length - bitnum - 1, binaryStr.length - bitnum))
  } catch (err) {
    return undefined
  }

}




function buildMqttPublishPacket(topic: any, data: any) {

  console.log("----------")
  console.log(topic);
  console.log(data);
  console.log("----------")

  var totalLength = topic.length + data.length + 2
  var remainingdataBuffer;

  if (totalLength <= 127) {
    remainingdataBuffer = Buffer.from([totalLength])
  } else {
    if (totalLength <= 16383) {
      remainingdataBuffer = Buffer.from([128 + (totalLength % 128), Math.floor(totalLength / 128)])
    } else {
      remainingdataBuffer = Buffer.from([128 + (totalLength % 128), 128 + (Math.floor((totalLength % (128 * 128)) / 128)), Math.floor(totalLength / (128 * 128))])
    }

  }
  //console.log(remainingdataBuffer)

  var pubbuf = Buffer.concat([Buffer.from([0b00110000]), //header
    remainingdataBuffer,
  Buffer.from([
    Math.floor(topic.length / 256),                 //topic length MSB
    topic.length,                                 //topic length LSB
  ]),
  Buffer.from(topic),
  Buffer.from(data)
  ])



  return pubbuf;
}


function bufferToBinary(bufferIn: Buffer, byteNu: number) {
  var binarystring = parseInt(bufferIn.slice(byteNu, byteNu + 1).toString("hex"), 16).toString(2)
  while (binarystring.length < 8) {
    binarystring = "0" + binarystring;
  }

  return binarystring
}


function printBuffer(data: Buffer) {
  for (var d = 0; d < data.length; d++) {
    console.log(d + "\t" + bufferToBinary(data, d) + "\t" + data.slice(d, d + 1).toString())
  }
}