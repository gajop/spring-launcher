'use strict';

const EventEmitter = require('events');

const prdDownloader = require('./prd_downloader');
const httpDownloader = require('./http_downloader');

function getDownloader(name) {
	let url;
	try {
		url = new URL(name);
	} catch (_) {
		return prdDownloader;
	}

	if (url.protocol === 'http:' || url.protocol === 'https:') {
		return httpDownloader;
	} else {
		return prdDownloader;
	}
}

class SpringDownloader extends EventEmitter {
	constructor() {
		super();

		let downloaders = [ prdDownloader, httpDownloader ];
		for (const downloader of downloaders) {
			downloader.on('started', (downloadItem, type, args) => {
				this.emit('started', downloadItem, type, args);
			});

			downloader.on('progress', (downloadItem, current, total) => {
				this.emit('progress', downloadItem, current, total);
			});

			downloader.on('finished', (downloadItem) => {
				this.emit('finished', downloadItem);
			});

			downloader.on('failed', (downloadItem, msg) => {
				this.emit('failed', downloadItem, msg);
			});
		}
	}

	downloadEngine(engineName) {
		prdDownloader.downloadEngine(engineName);
	}

	downloadGame(gameName) {
		prdDownloader.downloadGame(gameName);
	}

	downloadMap(mapName) {
		prdDownloader.downloadMap(mapName);
	}

	downloadResource(resource) {
		getDownloader(resource['url']).downloadResource(resource);
	}
}

module.exports = new SpringDownloader();
