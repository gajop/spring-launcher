'use strict';

const net = require('net');
const EventEmitter = require('events');

const log = require('electron-log');
const crypto = require('crypto');

const SERVER_URL = 'springrts.com';
const SERVER_PORT = 8200;

class Lobby extends EventEmitter {
	constructor() {
		super();

		this.connected = false;
	}

	connect() {
		this.socket = new net.Socket();
		this.socket.connect(SERVER_PORT, SERVER_URL);
		this.socket.on('connect', () => {
			this.connected = true;
			log.info(`lobby: Connection to ${SERVER_URL} established`);
		});

		this.socket.on('close', () => {
			this.connected = false;
			log.info('lobby: Connection lost.');
		});
        
		this.socket.on('data', (data) => {
			const msg = data.toString();
			console.log(`DATA from receive: ${msg}`);
            
			if (msg.startsWith('ACCEPTED')) {
				this.emit('login-success');
			}
			if (msg.startsWith('DENIED')) {
				const reason = msg.substring('DENIED'.length, msg.length);
				this.emit('login-failed', reason);
			}
			// This is where you'd write a complex protocol for each command the server can send to the client
		});
	}

	// Write client -> server commands in this style. Provide an API but hide the implementation detials
	login(username, password) {
		const hashedPassword = crypto.createHash('md5').update(password).digest('base64');
		const msg = `LOGIN ${username} ${hashedPassword} * 0\n`;
		this.__send(msg);
	}

	__send(msg) {
		this.socket.write(msg);
	}
}

const lobby = new Lobby();

module.exports = {
	lobby: lobby,
};