'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

const springPlatform = require('./spring_platform');
const ButlerDownload = require('./butler_dl');
const { log } = require('./spring_log');
const Extractor = require('./extractor');
const { makeParentDir, getTemporaryFileName, removeTemporaryFiles } = require('./fs_utils');


class HttpDownloader extends EventEmitter {
	constructor() {
		super();

		const butlerDl = new ButlerDownload();

		butlerDl.on('started', args => {
			this.emit('started', this.name, this.type, args);
		});

		butlerDl.on('progress', (current, total) => {
			this.emit('progress', this.name, current, total);
		});

		butlerDl.on('aborted', msg => {
			this.emit('aborted', this.name, msg);
		});

		butlerDl.on('warn', msg => {
			log.warn(msg);
		});

		this.butlerDl = butlerDl;

		try {
			removeTemporaryFiles();
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

	downloadResource(resource) {
		const url = new URL(resource['url']);
		const name = resource['destination'];
		const destination = path.join(springPlatform.writePath, name);
		if (fs.existsSync(destination)) {
			this.emit('finished', `Skipping ${destination}: already exists.`);
			log.info(`Skipping ${destination}: already exists.`);
			return;
		}

		const destinationTemp = getTemporaryFileName('download');
		this.emit('started', name);
		// FIXME: What's going on here..? () shouldn't be preventing this. from working
		// Is then the problem?
		const extractor = this.extractor;
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

				extractor.extract(name, url, destinationTemp, destination);
			}).catch(reason => {
				if (fs.existsSync(destinationTemp)) {
					try {
						fs.unlinkSync(destinationTemp);
					} catch (err) {
						if (fs.existsSync(destinationTemp)) {
							log.error(`Failed to cleanup stale download: ${destinationTemp}`);
						}
					}
				}
				log.info('failed', `Download failed: ${reason}`);
				this.emit('failed', this.name, reason);
			});
	}

	download(name, type, url, downloadPath) {
		this.name = name;
		this.type = type;
		return this.butlerDl.download(url, downloadPath);
	}

	stopDownload() {
		this.butlerDl.stopDownload();
	}
}

module.exports = new HttpDownloader();
