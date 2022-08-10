'use strict';

const { app, ipcMain } = require('electron');

require('@electron/remote/main').initialize();

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
require('./worker/window');
const { wizard } = require('./launcher_wizard');
// Setup downloader bindings
require('./launcher_downloader');
const { generateAndBroadcastWizard } = require('./launcher_wizard_util');
const autoUpdater = require('./updater');
// TODO: Despite not using it in this file, we have to require spring_api here
require('./spring_api');
const { launcher } = require('./engine_launcher');
const { writePath } = require('./spring_platform');
const log_uploader = require('./log_uploader');
const file_opener = require('./file_opener');

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
	setImmediate(() => autoUpdater.quitAndInstall(config.silent, true));
});

autoUpdater.on('error', error => {
	log.error(`Application failed to self-update. Error: ${error}`);
});

function maybeSetConfig(cfgName) {
	if (!config.setConfig(cfgName)) {
		return false;
	}

	settings.setSync('config', cfgName);
	generateAndBroadcastWizard();

	return true;
}

ipcMain.on('change-cfg', (_, cfgName) => {
	settings.setSync('checkForUpdates', undefined);
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
	if (checkForUpdates === settings.getSync('checkForUpdates')) {
		return;
	}
	log.info('wizard-check-for-updates', checkForUpdates);
	settings.setSync('checkForUpdates', checkForUpdates);
	generateAndBroadcastWizard();
});

app.on('ready', () => {
	if (!gui) {
		return;
	}
	// Use local settings file
	settings.configure({
		dir: writePath,
		fileName: 'launcher_cfg.json',
		prettify: true
	});
	const oldConfig = settings.getSync('config');
	if (oldConfig) {
		if (!maybeSetConfig(oldConfig)) {
			// forget invalid configs
			settings.unsetSync('config');
		}
	}
});

app.on('window-all-closed', () => {
	log.info('All windows closed. Quitting...');
});
