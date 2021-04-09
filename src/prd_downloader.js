'use strict';

const { spawn } = require('child_process');
const EventEmitter = require('events');

const log = require('electron-log');

const springPlatform = require('./spring_platform');
const { isTouchedByNextgen, setTouchedByNextgen } = require('./nextgen_downloader');
const fs = require('fs');
const path = require('path');

class PrdDownloader extends EventEmitter {
	constructor() {
		super();
		this.progressPattern = new RegExp('[0-9]+/[0-9]+');
		this.missingPattern = new RegExp('.*no engine.*|.*no mirrors.*|.*no game found.*|.*no map found.*|.*error occured while downloading.*');
	}

	errorCheck(name, line) {
		if (line.startsWith('[Error]')) {
			if (line.toLowerCase().match(this.missingPattern)) {
				this.emit('failed', name, line);
				return true;
			}
		}
		return false;
	}

	downloadPackage(name, args) {
		let finished = false;
		const prd = spawn(springPlatform.prDownloaderPath, args);
		this.emit('started', name);

		prd.stdout.on('data', (data) => {
			const line = data.toString();
			log.info(line);
			if (line.startsWith('[Progress]')) {
				const matched = line.match(this.progressPattern);
				if (!matched || matched.length == 0) {
					return;
				}
				const progressStr = matched[0];
				var [current, total] = progressStr.split('/');
				current = parseInt(current);
				total = parseInt(total);
				this.emit('progress', name, current, total);
			} else if (this.errorCheck(name, line)) {
				finished = true;
			} else if (line.startsWith('[Info]')) {
				this.emit('info', name, line);
			}
		});

		prd.stderr.on('data', (data) => {
			const line = data.toString();
			log.warn(line);
			if (this.errorCheck(name, line)) {
				finished = true;
			}
		});


		prd.on('close', (code) => {
			if (finished) { // the process already counts as finished
				return;
			}
			if (code == 0) {
				this.emit('finished', name);
			} else {
				this.emit('failed', name, `Download failed: ${name}: ${code}`);
			}
		});

		prd.on('error', (error) => {
			finished = true;
			this.emit('failed', name, `Failed to launch pr-downloader: ${error}`);
		});

		this.prd = prd;
		this.name = name;
	}


	downloadEngine(engineName) {
		this.downloadPackage(engineName, ['--filesystem-writepath', springPlatform.writePath, '--download-engine', engineName]);
	}

	downloadGame(gameName) {
		if (gameName.includes(':')) {
			const rapidTag = gameName.split(':')[0];
			const versionsGz = path.join(springPlatform.writePath, `rapid/repos.springrts.com/${rapidTag}/versions.gz`);
			if (isTouchedByNextgen(versionsGz)) {
				fs.unlinkSync(versionsGz);
				setTouchedByNextgen(versionsGz, false);
			}
		}

		this.downloadPackage(gameName, ['--filesystem-writepath', springPlatform.writePath, '--download-game', gameName]);
	}

	downloadMap(mapName) {
		this.downloadPackage(mapName, ['--filesystem-writepath', springPlatform.writePath, '--download-map', mapName]);
	}

	downloadResource(resource) {
		throw `downloadResource(${resource['url']}, ${resource[']destination']}): pr_downloader cannot be used to download resources`;
	}

	stopDownload() {
		if (this.name == null) {
			return;
		}

		// this.prd.kill('SIGKILL');
		this.prd.kill(9);
		this.emit('aborted', this.name, 'Download interrupted via user action.');
	}
}

module.exports = new PrdDownloader();
