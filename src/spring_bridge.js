const net = require('net');
const EventEmitter = require('events');

const log = require('electron-log');

const HOST = '127.0.0.1';
var port;

class Bridge extends EventEmitter {
  constructor() {
    super();

    var server = net.createServer((socket) => {
      this.socket = socket; // Allow multiple sockets?
    	socket.write('spring-launcher server');

      socket.on('data', (data) => {
        // console.log("received data: ", data.toString());
        const msgs = data.toString().split('\n');
        // console.log(msgs);
        msgs.forEach((msg) => {
          if (msg == '') {
            return;
          }
          log.debug(msg);
          const obj = JSON.parse(msg);

          // console.log("received obj: ", obj);
          const name = obj.name;
          const command = obj.command;
          this._executeCommand(name, command);
        });
      })
    });


    server.on('listening', (e) => {
      port = server.address().port;

      log.info(`Creating server on port: ${HOST}:${port}`)
      this.emit('listening', e);
    });


    server.on('error', (e) => console.log('errored', e));
    server.listen(0, HOST);
    this.server = server;
  }

  send(name, command) {
    if (command == undefined) {
      command = {}
    }
    const json = JSON.stringify({
      name: name,
      command: command
    });
    this.socket.write(json);
  }

  _executeCommand(name, command) {
    log.debug("Do command", name, command);
    this.emit(name, command)
  }
}

const bridge = new Bridge();

module.exports = {
  bridge: bridge,
}
