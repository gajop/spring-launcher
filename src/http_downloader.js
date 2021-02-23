'use strict';

const EventEmitter = require('events');
const follow_redirects = require('follow-redirects');
const http = follow_redirects.http;
const https = follow_redirects.https;
const fs = require('fs');
const path = require('path');

const springPlatform = require('./spring_platform');
const { log } = require('./spring_log');
const Extractor = require('./extractor');

// const ENGINE_FOLDER = path.join(springPlatform.writePath, 'engine');
// const GAMES_FOLDER = path.join(springPlatform.writePath, 'games');
// const MAPS_FOLDER = path.join(springPlatform.writePath, 'maps');

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

	// TODO: http is currently enabled explicitly and only for resources
	// Consider if it should be enabled for existing categories (game, map, engine)
	// Problem with using it for existing categories are as follows:
	// - It makes it hard to figure out whether the asset should be extracted or not
	// - It makes it hard to figure out what the destination should be just based on the URL
	// - It makes it hard to detect whether the file has already been downloaded

	// downloadEngine(engineName) {
	// 	const url = new URL(engineName);
	// 	const filename = engineName.split('/').pop();
	// 	if (filename == '') {
	// 		this.emit('failed', engineName, `Link is not a file: ${engineName}`);
	// 		return;
	// 	}
	// 	if (path.extname(filename) != '.zip') {
	// 		this.emit('failed', engineName, `Link is not a ZIP: ${engineName}`);
	// 		return;
	// 	}

	// 	this.emit('started', engineName, 'engine');
	// 	this.download(engineName, 'engine', url, makeTemporary(), ENGINE_FOLDER);
	// }

	// downloadGame(gameName) {
	// 	const url = new URL(gameName);
	// 	let filename = gameName.split('/').pop();
	// 	if (filename == '') {
	// 		this.emit('failed', gameName, `Link is not a file: ${gameName}`);
	// 		return;
	// 	}
	// 	if (path.extname(filename) == '.zip') {
	// 		filename = path.basename(filename, path.extname(filename)) + '.zip';
	// 	} else if (path.extname(filename) != '.sdz' && path.extname(filename) != '.sd7') {
	// 		filename = path.join(filename, '.sdz');
	// 	}

	// 	this.emit('started', gameName, 'game');
	// 	this.download(gameName, 'game', url, path.join(GAMES_FOLDER, filename), null);
	// }

	// downloadMap(mapName) {
	// 	const url = new URL(mapName);
	// 	let filename = mapName.split('/').pop();
	// 	if (filename == '') {
	// 		this.emit('failed', mapName, `Link is not a file: ${mapName}`);
	// 		return;
	// 	}
	// 	if (path.extname(filename) == 'zip') {
	// 		filename = path.basename(filename, path.extname(filename)) + '.zip';
	// 	} else if (path.extname(filename) != 'sdz' && path.extname(filename) != 'sd7') {
	// 		filename = path.join(filename, 'sdz');
	// 	}

	// 	this.emit('started', mapName, 'map');
	// 	this.download(mapName, 'map', url, path.join(MAPS_FOLDER, filename), null);
	// }

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
		this.download(name, 'resource', url, destinationTemp).then(() => {
			makeParentDir(destination);

			if (!resource['extract']) {
				fs.renameSync(destinationTemp, destination);
				this.emit('finished', name);
				return;
			}

			this.emit('progress', `Extracting to ${destination}`, 100, 100);

			this.extractor.extract(name, url, destinationTemp, destination);
		}).catch(() => fs.unlinkSync(destinationTemp));
	}

	download(name, type, url, downloadPath) {
		return new Promise((resolve, reject) => {
			const file = fs.createWriteStream(downloadPath);
			const backend = url.protocol == 'http:' ? http : https;
			backend.get(url, (res) => {
				const { statusCode } = res;

				if (statusCode !== 200) {
					const error = new Error(`Request Failed.\nStatus Code: ${statusCode}`);
					this.emit('failed', name, `Failed to download ${type}: ${error.message}`);
					// Consume response data to free up memory
					res.resume();
					return;
				}

				const totalBytes = res.headers['content-length'];
				let receivedBytes = 0;
				// res.setEncoding('utf8');
				res.pipe(file);
				res.on('data', chunk => {
					receivedBytes += chunk.length;
					if (totalBytes != null) {
						this.emit('progress', name, receivedBytes, totalBytes);
					}
				});
				res.on('end', () => {
					resolve();
				});
			}).on('error', (e) => {
				this.emit('failed', name, `Failed with error: ${e.message}`);
				reject();
			});
		});
	}
}

module.exports = new HttpDownloader();
