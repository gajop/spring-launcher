'use strict';

const { app, ipcMain } = require('electron');

const settings = require('electron-settings');

const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) {
	app.quit();
	return;
}

const { log } = require('./spring_log');
// Setup error handling
require('./error_handling');
const { config } = require('./launcher_config');
const { gui } = require('./launcher_gui');
const { wizard } = require('./launcher_wizard');
const { generateAndBroadcastWizard } = require('./launcher_wizard_util');
const springDownloader = require('./spring_downloader');
const autoUpdater = require('./updater');
// TODO: Despite not using it in this file, we have to require spring_api here
require('./spring_api');
const launcher = require('./engine_launcher');
const { writePath } = require('./spring_platform');
const log_uploader = require('./log_uploader');
const file_opener = require('./file_opener');


springDownloader.on('started', (downloadItem, type, args) => {
	log.info(`Download started: ${downloadItem}, ${type}, ${args}`);
	gui.send('dl-started', downloadItem, type, args);
});

// NB: needs to be a function as we use this. on it
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
	if (shouldUpdateGUI) {
		const mainWindow = gui.getMainWindow();
		if (mainWindow != null) {
			mainWindow.setProgressBar(current / total);
		}
		gui.send('dl-progress', downloadItem, current, total);
	}
});

springDownloader.on('finished', (downloadItem) => {
	log.info(`Download finished: ${downloadItem}`);
	gui.send('dl-finished', downloadItem);
	wizard.nextStep();
});

springDownloader.on('failed', (downloadItem, msg) => {
	log.error(`${downloadItem}: ${msg}`);
	gui.send('error', msg);
	wizard.setEnabled(false);
});

launcher.on('stdout', (text) => {
	log.info(text);
});

launcher.on('stderr', (text) => {
	log.warn(text);
});

launcher.on('finished', (code) => {
	log.info(`Spring finished with code: ${code}`);
	app.quit();
	setTimeout(() => {
		gui.send('launch-finished');
	}, 100);
});

launcher.on('failed', (error) => {
	log.error(error);
	const mainWindow = gui.getMainWindow();
	mainWindow.show();
	setTimeout(() => {
		gui.send('launch-failed', error);
	}, 100);
});

autoUpdater.on('update-available', () => {
	gui.send('dl-started', 'autoupdate');

	autoUpdater.on('download-progress', (d) => {
		console.info(`Self-download progress: ${d.percent}`);
		gui.send('dl-progress', 'autoUpdate', d.percent, 100);
	});
	autoUpdater.on('update-downloaded', () => {
		log.info('Self-update downloaded');
		gui.send('dl-finished', 'autoupdate');
	});

	autoUpdater.downloadUpdate();
});

autoUpdater.on('update-not-available', () => {
	log.info('No update available.');
	wizard.nextStep();
});

autoUpdater.on('update-downloaded', () => {
	setImmediate(() => autoUpdater.quitAndInstall(true, true));
});

autoUpdater.on('error', error => {
	log.error(`Application failed to self-update. Error: ${error}`);
	log.info('Proceeding to next step.');
	wizard.nextStep();
});

function maybeSetConfig(cfgName) {
	if (!config.setConfig(cfgName)) {
		return false;
	}

	settings.set('config', cfgName);
	generateAndBroadcastWizard();

	return true;
}

ipcMain.on('change-cfg', (_, cfgName) => {
	settings.set('checkForUpdates', undefined);
	if (maybeSetConfig(cfgName)) {
		wizard.setEnabled(true);
	}
});

ipcMain.on('log-upload-ask', () => {
	log_uploader.upload_ask();
});

ipcMain.on('open-install-dir', () => {
	if (file_opener.open(writePath)) {
		log.info(`User opened install directory: ${writePath}`);
	} else {
		log.error(`Failed to open install directory: ${writePath}`);
	}
});

ipcMain.on('wizard-next', () => {
	wizard.nextStep(true);
});

ipcMain.on('wizard-check-for-updates', (_, checkForUpdates) => {
	if (checkForUpdates === settings.get('checkForUpdates')) {
		return;
	}
	log.info('wizard-check-for-updates', checkForUpdates);
	settings.set('checkForUpdates', checkForUpdates);
	generateAndBroadcastWizard();
});

app.on('ready', () => {
	if (!gui) {
		return;
	}
	// Use local settings file
	settings.setPath(`${writePath}/launcher_cfg.json`);
	const oldConfig = settings.get('config');
	if (oldConfig) {
		if (!maybeSetConfig(oldConfig)) {
			// forget invalid configs
			settings.set('config', undefined);
		}
	}
});

app.on('window-all-closed', () => {
	log.info('All windows closed. Quitting...');
});
