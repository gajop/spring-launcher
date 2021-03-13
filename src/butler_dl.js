'use strict';

const { spawn } = require('child_process');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

const springPlatform = require('./spring_platform');

const TEMP_DIR = `${springPlatform.writePath}/tmp`;

function makeParentDir(filepath) {
	const destinationParentDir = path.dirname(filepath);
	if (!fs.existsSync(destinationParentDir)) {
		fs.mkdirSync(destinationParentDir, { recursive: true });
	}
}

function getTemporaryFileName(baseName) {
	let i = 0;
	while (true) {
		const temp = path.join(TEMP_DIR, `${baseName}.${i}`);
		if (!fs.existsSync(temp)) {
			return temp;
		}
		i++;
	}
	// unreachable
}

class ButlerDownload extends EventEmitter {

	download(url, downloadPath) {
		return new Promise((resolve, reject) => {
			const tmpDestination = getTemporaryFileName();
			makeParentDir(tmpDestination);
			const args = ['-j', 'dl', url, tmpDestination];
			const process = spawn(springPlatform.butlerPath, args);
			this.emit('started', args);

			let finished = false;
			let total = 1;

			process.stdout.on('data', data => {
				let line = data.toString();
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

			process.stderr.on('data', data => {
				const line = data.toString();
				this.emit('warn', line);
			});


			process.on('close', code => {
				if (finished) { // the process already counts as finished
					return;
				}
				if (code == 0) {
					this.emit('progress', total, total);
					fs.renameSync(tmpDestination, downloadPath);
					resolve();
				} else {
					fs.unlinkSync(tmpDestination);
					reject('failed', `Download failed: ${code}`);
				}
			});

			process.on('error', error => {
				finished = true;
				reject('failed', `Failed to launch butler with error: ${error}`);
			});

			this.process = process;
		});
	}

	stopDownload() {
		this.process.kill('SIGKILL');
		this.emit('aborted', 'Download interrupted via user action.');
	}
}

module.exports = ButlerDownload;
