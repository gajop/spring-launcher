'use strict';

const { app } = require('electron');
const util = require('util');
const { format } = util;
const log = require('electron-log');

const springPlatform = require('./spring_platform');
const { config } = require('./launcher_config');

var logBuffer = [];
var ready = false;
let gui = null;
log.transports.console = (msg) => {
	var text = format.apply(util, msg.data);
	console.log(text);
	if (ready) {
		gui.send('log', msg);
	} else {
		logBuffer.push(msg);
	}
};

const logPath = `${springPlatform.writePath}/infolog.txt`; // Who needs spring-launcher.log anyway?
const { existsSync, unlinkSync } = require('fs');
if (existsSync(logPath)) {
	unlinkSync(logPath);
}
log.transports.file.file = logPath;
log.transports.file.level = 'info';

log.info('Begin log');
log.info(`Log file: ${logPath}`);
log.info(`${app.name} - ${app.getVersion()}`);
log.info(`App path: ${app.getAppPath()}`);
log.info(`pr-downloader path: ${springPlatform.prDownloaderPath}`);
log.info(`Write path: ${springPlatform.writePath}`);

log.info(`Launcher configs:\n${JSON.stringify(config.getAvailableConfigs(), null, 4)}`);
log.info(`Default config:\n${JSON.stringify(config.getConfigObj(), null, 4)}`);

gui = require('./launcher_gui').gui;

app.on('ready', () => {
	if (!gui) {
		return;
	}

	setTimeout(() => {
		logBuffer.forEach((msg) => {
			gui.send('log', msg);
		});
		logBuffer = [];
		ready = true;
	}, 1000);
});

function wrapEmitterLogs(emitter) {
	emitter.on('log', (level, msg) => {
		if (level === 'debug') {
			log.debug(msg);
		} else if (level === 'info') {
			log.info(msg);
		} else if (level === 'warn') {
			log.warn(msg);
		} else if (level === 'error') {
			log.error(msg);
		} else if (level === 'verbose') {
			log.verbose(msg);
		} else if (level === 'silly') {
			log.silly(msg);
		}
	});
}

module.exports = {
	log: log,
	logPath: logPath,
	wrapEmitterLogs: wrapEmitterLogs
};
