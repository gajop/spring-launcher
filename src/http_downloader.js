'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

const springPlatform = require('./spring_platform');
const ButlerDownload = require('./butler_dl');
const { log } = require('./spring_log');
const Extractor = require('./extractor');

const TEMPORARY_FILE_DIR = springPlatform.writePath;
const TEMPORARY_FILE_PREFIX = 'download_temp_';

function makeTemporary() {
	let i = 0;
	while (true) {
		let temp = path.join(TEMPORARY_FILE_DIR, `${TEMPORARY_FILE_PREFIX}${i}`);
		if (!fs.existsSync(temp)) {
			return temp;
		}
		i++;
	}
	// unreachable
}

function makeParentDir(filepath) {
	const destinationParentDir = path.dirname(filepath);
	if (!fs.existsSync(destinationParentDir)) {
		fs.mkdirSync(destinationParentDir, { recursive: true });
	}
}

class HttpDownloader extends EventEmitter {
	constructor() {
		super();

		const butler_dl = new ButlerDownload();

		butler_dl.on('started', args => {
			this.emit('started', this.name, this.type, args);
		});

		butler_dl.on('progress', (current, total) => {
			this.emit('progress', this.name, current, total);
		});

		butler_dl.on('aborted', msg => {
			this.emit('aborted', this.name, msg);
		});

		butler_dl.on('warn', msg => {
			log.warn(msg);
		});

		this.butler_dl = butler_dl;

		try {
			this.cleanupOldDownloads();
			this.extractor = new Extractor();
			this.extractor.on('finished', downloadItem => {
				this.emit('finished', downloadItem);
			});

			this.extractor.on('failed', (downloadItem, msg) => {
				this.emit('failed', downloadItem, msg);
			});
		} catch (error) {
			// If for some weird permission reason we failed to cleanup downloads, just log it and ignore it
			// No need to disturb the user with this
			log.error('Failed to delete old temporary files');
			log.error(error);
		}
	}

	cleanupOldDownloads()
	{
		fs.readdirSync(TEMPORARY_FILE_DIR)
			.filter(file => file.startsWith(TEMPORARY_FILE_PREFIX))
			.forEach(file => fs.unlinkSync(path.join(TEMPORARY_FILE_DIR, file)));
	}

	downloadResource(resource) {
		const url = new URL(resource['url']);
		const name = resource['destination'];
		const destination = path.join(springPlatform.writePath, name);
		if (fs.existsSync(destination)) {
			this.emit('finished', `Skipping ${destination}: already exists.`);
			log.info(`Skipping ${destination}: already exists.`);
			return;
		}

		const destinationTemp = makeTemporary();
		this.emit('started', name, 'resource');
		this.download(name, 'resource', url, destinationTemp)
			.then(() => {
				log.info('Finished http download');

				makeParentDir(destination);

				if (!resource['extract']) {
					fs.renameSync(destinationTemp, destination);
					this.emit('finished', name);
					return;
				}

				this.emit('progress', `Extracting to ${destination}`, 100, 100);

				this.extractor.extract(name, url, destinationTemp, destination);
			}).catch(reason => {
				fs.unlinkSync(destinationTemp);
				log.info('failed', `Download failed: ${reason}`);
				this.emit('failed', this.name, reason);
			});
	}

	download(name, type, url, downloadPath) {
		this.name = name;
		this.type = type;
		return this.butler_dl.download(url, downloadPath);
	}

	stopDownload() {
		this.butler_dl.stopDownload();
	}
}

module.exports = new HttpDownloader();
