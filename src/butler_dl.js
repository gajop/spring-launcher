'use strict';

const { spawn } = require('child_process');
const EventEmitter = require('events');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const { makeParentDir, getTemporaryFileName } = require('./fs_utils');
const springPlatform = require('./spring_platform');

class ButlerDownload extends EventEmitter {

	async download(url, downloadPath) {

		// uncomment to simulate network lag
		// await new Promise(r => setTimeout(r, Math.random() * 3000));

		let promise = new Promise((resolve, reject) => {
			const tmpDestination = getTemporaryFileName(path.basename(downloadPath));
			makeParentDir(tmpDestination);
			const args = ['-j', '-v', 'dl', url, tmpDestination];
			const process = spawn(springPlatform.butlerPath, args);
			this.emit('started', args.join(' '));

			let finished = false;
			let total = 1;

			const rlStdout = readline.createInterface({ input: process.stdout });
			rlStdout.on('line', line => {
				line = JSON.parse(line);
				const lineType = line['type'];
				if (lineType === 'log') {
					const msg = line['message'];
					if (msg.startsWith('Downloading')) {
						try {
							const msgParts = msg.split(' ');
							const size = msgParts[1];
							const unit = msgParts[2];
							if (unit == 'KiB') {
								total = size * 1024;
							} else if (unit == 'MiB') {
								total = size * 1024 * 1024;
							} else if (unit == 'GiB') {
								total = size * 1024 * 1024 * 1024;
							} else if (unit == 'TiB') {
								total = size * 1024 * 1024 * 1024 * 1024;
							} else {
								total = size;
							}
						} catch (_) {
							// ignore errors when parsing unstructured data
						}
					}
				} else if (lineType === 'progress') {
					const progress = line['progress'];
					this.emit('progress', progress * total, total);
				}
			});

			const rlStderr = readline.createInterface({ input: process.stderr });
			rlStderr.on('line', line => {
				if (line.includes('connect: connection refuse')) {
					console.log('Connection refused error');
				}
				this.emit('warn', line);
			});

			process.on('close', code => {
				if (finished) { // the process already counts as finished
					return;
				}
				if (code == 0) {
					this.emit('progress', total, total);
					makeParentDir(downloadPath);
					fs.renameSync(tmpDestination, downloadPath);
					resolve();
				} else {
					if (fs.existsSync(tmpDestination)) {
						fs.unlinkSync(tmpDestination);
					}
					reject(`Download ${url} -> ${downloadPath} failed with: ${code}`);
				}
			});

			process.on('error', error => {
				finished = true;
				reject(`Failed to launch butler with error: ${error}, for download ${url} -> ${downloadPath}`);
			});

			this.process = process;
		});

		return promise;
	}

	stopDownload() {
		this.process.kill('SIGKILL');
		this.emit('aborted', 'Download interrupted via user action.');
	}
}

module.exports = ButlerDownload;
