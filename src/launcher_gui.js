'use strict';

const electron = require('electron');
const { app, BrowserWindow, Menu, Tray } = electron;
const isDev = require('electron-is-dev');

const { config } = require('./launcher_config');

let mainWindow;
let tray;

app.on('second-instance', () => {
	// Someone tried to run a second instance, we should focus our window.
	const mainWindow = gui.getMainWindow();
	if (mainWindow) {
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}
		mainWindow.focus();
	}
});

app.prependListener('ready', () => {
	const display = electron.screen.getPrimaryDisplay();
	const sWidth = display.workAreaSize.width;
	const width = 800;
	const height = 380 + 8;

	let windowOpts = {
		x: (sWidth - width) / 2,
		// y: (sHeight - height) / 2,
		y: 100,
		width: width,
		height: height,
		show: false,
		icon: `${__dirname}/renderer/spring-icon.png`,
		webPreferences: {
			nodeIntegration: true,
		}
	};
	windowOpts.resizable = false;
	Menu.setApplicationMenu(null);
	mainWindow = new BrowserWindow(windowOpts);

	mainWindow.loadFile(`${__dirname}/renderer/index.html`);
	if (isDev) {
		// mainWindow.webContents.openDevTools();
	}

	mainWindow.on('closed', () => {
		mainWindow = null;
		app.quit();
	});

	tray = new Tray(`${__dirname}/renderer/spring-icon.png`);
	var template = [
		// TODO: About dialog that shows URL, author, version, etc.
		// {
		//   role: 'about',
		//   click: () => {
		//     log.info("About clicked");
		//   }
		// },
		{
			// TODO: Proper "show/hide"
			label: 'Toggle hide',
			click: () => {
				if (mainWindow.isVisible()) {
					//menuItem.label = "Show";
					mainWindow.hide();
				} else {
					mainWindow.show();
					//menuItem.label = "Hide";
				}
			}
		},
		// TODO: Settings dialog for user config
		{ role: 'quit' }
	];
	if (process.platform === 'linux') {
		// template.unshift([{label: 'Spring-Launcher'}]);
	}
	// tray.setToolTip('Spring-Launcher: Distribution system for SpringRTS.');
	tray.setToolTip(config.title);
	tray.setContextMenu(Menu.buildFromTemplate(template));

	mainWindow.once('ready-to-show', () => {
		mainWindow.show();

		gui.send('all-configs', config.getAvailableConfigs());
		gui.send('config', config.getConfigObj());

		const { wizard } = require('./launcher_wizard.js');

		const steps = wizard.steps
			.filter(step => step.name != 'start')
			.map(step => {
				// we have to make a copy of these steps because IPC shouldn't contain functions (step.action)
				return {
					name: step.name,
					item: step.item
				};
			});
		gui.send('wizard-list', steps);

		if (config.no_downloads &&
      config.auto_start) {
			wizard.nextStep();
		} else if (config.auto_download) {
			gui.send('wizard-started');
			wizard.nextStep();
		} else {
			gui.send('wizard-stopped');
		}
	});
});

class GUI {
	send(...args) {
		if (mainWindow && mainWindow.webContents) {
			mainWindow.webContents.send(...args);
		}
	}

	getMainWindow() {
		return mainWindow;
	}
}

const gui = new GUI();

module.exports = {
	gui: gui,
};
