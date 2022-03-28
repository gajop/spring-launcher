'use strict';

const EventEmitter = require('events');
const { app } = require('electron');

const log = require('electron-log');

const { config } = require('./launcher_config');
const { gui } = require('./launcher_gui');
const updater = require('./updater');
const springDownloader = require('./spring_downloader');
const { launcher } = require('./engine_launcher');
const fs = require('fs');

const path = require('path');
const springPlatform = require('./spring_platform');

let mainWindow;
app.on('ready', () => {
	if (!gui) {
		return;
	}
	mainWindow = gui.getMainWindow();
});

class Wizard extends EventEmitter {
	constructor() {
		super();
		this.isActive = false;
		this.generateSteps();
	}

	generateSteps() {
		var steps = [];
		if (!config.no_downloads) {
			if (config.config_url != null) {
				steps.push({
					name: 'config fetch',
					action: () => {
						log.info(`Fetching latest config from: ${config.config_url}...`);
						this.isActive = true;
						this.isConfigDownload = true;
						const TMP_CONFIG = 'config.new.json';
						const TMP_CONFIG_FILE = path.join(springPlatform.writePath, TMP_CONFIG);
						if (fs.existsSync(TMP_CONFIG_FILE)) {
							fs.unlinkSync(TMP_CONFIG_FILE);
						}
						springDownloader.downloadResource({
							'url': config.config_url,
							'destination': TMP_CONFIG,
							'extract': false
						});
					}
				});
			}

			steps.push({
				name: 'launcher_update',
				action: () => {
					const isDev = !require('electron').app.isPackaged;
					log.info('Checking for launcher update');
					if (!isDev) {
						updater.checkForUpdates();
					} else {
						console.log('Development version: no self-update required');
						setTimeout(() => {
							this.nextStep();
						}, 300);
					}
				}
			});


			config.downloads.engines.forEach((engine) => {
				steps.push({
					name: 'engine',
					item: engine,
					action: () => {
						this.isActive = true;
						springDownloader.downloadEngine(engine);
					}
				});
			});

			config.downloads.games.forEach((game) => {
				steps.push({
					name: 'game',
					item: game,
					action: () => {
						this.isActive = true;
						springDownloader.downloadGame(game);
					}
				});
			});

			config.downloads.maps.forEach((map) => {
				steps.push({
					name: 'map',
					item: map,
					action: () => {
						this.isActive = true;
						springDownloader.downloadMap(map);
					}
				});
			});

			config.downloads.resources.forEach((resource) => {
				steps.push({
					name: 'resource',
					item: resource,
					action: () => {
						this.isActive = true;
						springDownloader.downloadResource(resource);
					}
				});
			});

			config.downloads.nextgen.forEach((resource) => {
				steps.push({
					name: 'nextgen',
					item: resource,
					action: () => {
						this.isActive = true;
						springDownloader.downloadNextGen(resource);
					}
				});
			});
		}

		let enginePath;
		if (config.launch.engine_path != null) {
			enginePath = config.launch.engine_path;
		} else {
			const engineName = config.launch.engine || config.downloads.engines[0];
			if (engineName != null) {
				enginePath = path.join(springPlatform.writePath, 'engine', engineName, springPlatform.springBin);
			}
		}
		if (enginePath != null) {
			steps.push({
				name: 'start',
				action: (step) => {
					setTimeout(() => {
						if (launcher.state != 'failed') {
							mainWindow.hide();
						}
					}, 1000);

					log.info(`Starting Spring from: ${enginePath}`);
					launcher.launch(enginePath, config.launch.start_args);

					this.emit('launched');

					gui.send('launch-started');
					launcher.once('finished', () => {
						this.steps.push(step);
					});

					launcher.once('failed', () => {
						this.steps.push(step);
					});
				}
			});
		}

		this.started = false;
		this.steps = steps;
		this.enabled = true;

		this.emit('stepsGenerated', this.steps);
	}

	setEnabled(enabled) {
		this.enabled = enabled;
	}

	nextStep(forced) {
		if (!this.enabled) {
			return;
		}

		const step = this.steps.shift();
		if (step === undefined) {
			log.warn('No more steps to do.');
			gui.send('wizard-stopped');
			gui.send('wizard-finished');
			this.started = false;
			gui.send('set-next-enabled', false);
			return false;
		}
		if (!this.started) {
			gui.send('wizard-started');
			this.started = true;
		}

		log.info(`Step: ${JSON.stringify(step, null, 4)}`);

		if (step.name === 'start') {
			if (!(config.auto_start || forced)) {
				gui.send('wizard-stopped');
				gui.send('wizard-finished');
				this.steps.push(step);
				return false;
			}
		} else {
			gui.send('wizard-next-step', {
				name: step.name,
				item: step.item
			});
		}

		step.action(step);
		return true;
	}
}

const wizard = new Wizard();

module.exports = {
	wizard: wizard,
};
