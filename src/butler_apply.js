'use strict';

const { spawn } = require('child_process');
const EventEmitter = require('events');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const log = require('electron-log');

const { makeParentDir, getTemporaryFileName, TMP_DIR } = require('./fs_utils');
const springPlatform = require('./spring_platform');

const APPLY_DIR = path.join(TMP_DIR, 'patch_apply');
class ButlerApply extends EventEmitter {

	apply(patch, target) {
		return new Promise((resolve, reject) => {
			const tmpDestination = getTemporaryFileName('download');
			makeParentDir(tmpDestination);
			fs.rmdirSync(APPLY_DIR, { recursive: true });

			const args = ['-j', 'apply', `--staging-dir=${APPLY_DIR}`, patch, target];
			const process = spawn(springPlatform.butlerPath, args);
			this.emit('started', args.join(' '));

			let finished = false;
			let total = 1;

			const rlStdout = readline.createInterface({ input: process.stdout });
			rlStdout.on('line', line => {
				log.info(line);
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
				this.emit('warn', line);
			});


			process.on('close', code => {
				if (finished) { // the process already counts as finished
					return;
				}
				if (code == 0) {
					this.emit('progress', total, total);
					resolve();
				} else {
					reject(`Applying patch failed with : ${code}`);
				}
			});

			process.on('error', error => {
				finished = true;
				reject(`Failed to launch butler with error: ${error}`);
			});

			this.process = process;
		});
	}

	stopDownload() {
		this.process.kill('SIGKILL');
		this.emit('aborted', 'Download interrupted via user action.');
	}
}

module.exports = ButlerApply;
