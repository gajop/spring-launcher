'use strict';

const { log } = require('./spring_log');
const { gui } = require('./launcher_gui');
const springDownloader = require('./spring_downloader');
const { wizard } = require('./launcher_wizard');

springDownloader.on('started', (downloadItem, type, args) => {
	log.info(`Download started: ${downloadItem}, ${type}, ${args}`);
	if (wizard.isActive) {
		gui.send('dl-started', downloadItem, type, args);
	}
});

springDownloader.on('progress', function (downloadItem, current, total) {
	if (total < 1024 * 1024) {
		return; // ignore downloads less than 1MB (probably not real downloads!)
	}

	const LOG_INTERVAL = 1000;
	const GUI_INTERVAL = 10;

	let shouldLog = true;
	let shouldUpdateGUI = true;

	if (typeof this.prevLogTime == 'undefined') {
		this.prevLogTime = (new Date()).getTime();
	} else {
		const now = (new Date()).getTime();
		if (now - this.prevLogTime < LOG_INTERVAL) {
			shouldLog = false;
		} else {
			this.prevLogTime = now;
		}
		if (now - this.prevGUIUpdateTime < GUI_INTERVAL) {
			shouldUpdateGUI = false;
		} else {
			this.prevGUIUpdateTime = now;
		}
	}

	if (shouldLog) {
		log.info(`Download progress: ${downloadItem}, ${current}, ${total}`);
	}
	if (shouldUpdateGUI && wizard.isActive) {
		const mainWindow = gui.getMainWindow();
		if (mainWindow != null) {
			mainWindow.setProgressBar(current / total);
		}
		gui.send('dl-progress', downloadItem, current, total);
	}
});

springDownloader.on('finished', (downloadItem) => {
	log.info(`Download finished: ${downloadItem}`);
	if (wizard.isActive) {
		gui.send('dl-finished', downloadItem);
		wizard.nextStep();
	}
});

springDownloader.on('failed', (downloadItem, msg) => {
	log.error(`${downloadItem}: ${msg}`);
	if (wizard.isActive) {
		gui.send('error', msg);
		wizard.setEnabled(false);
	}
});