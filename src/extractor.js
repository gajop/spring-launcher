'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

const extractZip = require('extract-zip');

const { path7za } = require('./path_7za');
const { extractFull: extract7z } = require('node-7z');

const { log } = require('./spring_log');

const TOTAL_EXTRACT_ATTEMPTS = 5;
const TIME_BETWEEN_ATTEMPTS_MS = 3000;

function RemoveEmptyDirs(path) {
	if (!IsDirTreeEmpty(path)) {
		throw 'Cannot delete directory. Directory tree is not empty.';
	}
	fs.rmdirSync(path, { recursive: true });
}

function IsDirTreeEmpty(dir) {
	for (const file of fs.readdirSync(dir)) {
		const filePath = path.join(dir, file);
		const stats = fs.statSync(filePath);
		if (stats.isDirectory()) {
			return IsDirTreeEmpty(filePath);
		} else {
			return false;
		}
	}
	return true;
}

class Extractor extends EventEmitter {
	constructor() {
		super();

		this.attemptNumber = 1;
	}

	extract(name, url, source, destination, attempts = TOTAL_EXTRACT_ATTEMPTS, timeBetweenAttempts = TIME_BETWEEN_ATTEMPTS_MS) {
		const extractor = this.getExtractor(url);
		extractor.on('finished', () => {
			try {
				log.info(`Deleting file after extraction has been finished: ${source}`);
				fs.unlinkSync(source);
			} catch (error) {
				log.error(`Cannot unlink file after extracting: ${source}`);
			}
			this.emit('finished', );
		});

		extractor.on('failed', err => {
			log.error(`Failed to extract ${name} with error: ${err}. Attempt ${this.attemptNumber} / ${attempts}.`);
			log.error(`err.stderr: ${err.stderr}`);
			if (this.currentProgress != null) {
				log.error(`Current extraction progress: ${this.currentProgress}`);
			}

			if (this.attemptNumber < attempts) {
				setTimeout(() => {
					this.attemptNumber++;
					log.info(`Retrying extraction ${this.attemptNumber} / ${attempts}`);
					extractor.extract(source, destination);
				}, timeBetweenAttempts);
			} else {
				try {
					log.info(`Deleting temporary after extraction has failed: ${source}`);
					fs.unlinkSync(source);
				} catch (error) {
					log.error(`Cannot unlink file after extracting: ${source}`);
				}
				try {
					log.info(`Deleting destination after extraction has failed: ${destination}`);
					RemoveEmptyDirs(destination);
				} catch (error) {
					log.error(`Cannot unlink file after extracting: ${destination}`);
				}

				this.emit('failed', name, `Extraction failure: ${err}`);
			}
		});

		extractor.extract(source, destination);
	}

	getExtractor(url) {
		const isZip = url.href.endsWith('.zip');
		const is7z = url.href.endsWith('.7z');
		if (isZip) {
			log.info('Extracting as .zip file.');
			return new ExtractorZip();
		} else if (is7z) {
			log.info('Extracting as .7z file.');
			log.info(`Path to 7zip: ${path7za}`);
			return new Extractor7Zip();
		} else {
			log.warn(`Unknown archive format: ${url}. Assuming it's a zip file.`);
			return new ExtractorZip();
		}
	}
}


class Extractor7Zip extends EventEmitter {
	extract(source, destination) {
		log.info(`Extracting ${source} to ${destination}...`);
		let hasFailed = false;

		const stream7z = extract7z(source, destination, {
			$bin: path7za,
			$progress: true
		});

		// NB: This is called even when failing
		stream7z.on('end', () => {
			if (hasFailed) {
				return;
			}
			this.emit('finished');
		});

		this.currentProgress = null;
		stream7z.on('progress', (progress) => {
			this.currentProgress = progress;
		});

		stream7z.on('error', (err) => {
			hasFailed = true;
			this.emit('failed', err);
		});
	}
}

class ExtractorZip extends EventEmitter {
	extract(source, destination) {
		extractZip(source, { dir: destination }).then(() => {
			this.emit('finished');
		}).catch(err => {
			this.emit('failed', err);
		});
	}
}

module.exports = Extractor;
