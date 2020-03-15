'use strict';

/*
And connect with a tcp client from the command line using netcat, the *nix
utility for reading and writing across tcp/udp network connections.  I've only
used it for debugging myself.

$ netcat 127.0.0.1 1337

You should see:
> Echo server

*/

/* Or use this example tcp client written in node.js.  (Originated with
example code from
http://www.hacksparrow.com/tcp-socket-programming-in-node-js.html.) */

const fs = require('fs');
const net = require('net');

const data = fs.readFileSync('server-info.json', 'utf8');
const obj = JSON.parse(data);
const address = obj.address;
const port = obj.port;

var client;

let EXIT_CONDITION = false;
function connect() {
	console.log(`Connecting to: ${address}:${port}`);

	client = new net.Socket();
	client.connect(port, address, function() {
		console.log('Connected');
		sendCommand('HelloWorld', {hello: 'World'});
		sendCommand('CompileMap', {
			diffusePath: '/home/gajop/radni_direktorijum/programi/spring-launcher-electron/game_package/springboard/projects/test-textures/diffuse.png',
			heightPath: '/home/gajop/radni_direktorijum/programi/spring-launcher-electron/game_package/springboard/projects/test-textures/heightmap.png',
			grass: '/home/gajop/radni_direktorijum/programi/spring-launcher-electron/game_package/springboard/projects/test-textures/grass.png',
			outputPath: '/home/gajop/radni_direktorijum/programi/spring-launcher-electron/game_package/springboard/projects/test-textures/MyName'
		});
		// sendCommand("OpenFile", {
		// 	path: "file:///text.txt"
		// });
		// // sendCommand("OpenFile", {
		// // 	path: "file:///home/gajop/notes.txt"
		// // });
		// sendCommand("OpenFile", {
		// 	path: "file:///home/gajop/Downloads/MyCube_LInux_v1/games/LD42.sdd/Bitmaps/LoadPictures/Background2.png"
		// });
		// sendCommand("OpenFile", {
		// 	path: "file:///home/gajop/"
		// });
	});

	client.on('data', function(data) {
		console.log('Received: {' + data + '}');
		// client.destroy(); // kill client after server's response
	});

	client.on('close', function() {
		console.log('Connection closed');
		EXIT_CONDITION = true;
	});

	client.on('error', (e) => {
		console.log(`Errored: ${e}`);
	});
}

connect();

function sendCommand(name, command) {
	const json = JSON.stringify({
		name: name,
		command: command,
	});
	client.write(json);
	client.write('\n');
}


(function wait () {
	if (!EXIT_CONDITION) setTimeout(wait, 100);
})();
