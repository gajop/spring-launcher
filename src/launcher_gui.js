'use strict';

const electron = require('electron');
const { app, dialog, BrowserWindow, Menu, Tray } = electron;
const isDev = require('electron-is-dev');
const { join, parse } = require('path');
const fs = require('fs');
const url = require('url');

const { config } = require('./launcher_config');
const argv = require('./launcher_args');
const springPlatform = require('./spring_platform');

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

function startReplayHeadless(replayFile) {
	// TODO: when we support downloading assets (map/game/engine) we might
	// need to show the GUI anyway, to provide feedback on the
	// downloads/ask for user confirmation.

	function checkFileExists(file, errorMsg) {
		if (!fs.existsSync(file)) {
			dialog.showMessageBoxSync(null, {message: errorMsg});
			app.quit();
		}
	}

	const { launcher } = require('./engine_launcher');

	const replayPath = decodeURI(url.parse(replayFile).pathname);

	checkFileExists(replayPath, `Demo file not found: ${replayPath}`);

	const engineName = parse(replayPath).name.split('_').pop().toLowerCase();

	const enginePath = join(
		springPlatform.writePath,
		'engine',
		engineName,
		springPlatform.springBin
	);

	checkFileExists(enginePath, `Engine not found: ${engineName}`);

	launcher.launchSpring(enginePath, [replayPath]);
}

function startGUI() {
	const { wizard } = require('./launcher_wizard');

	const display = electron.screen.getPrimaryDisplay();
	const sWidth = display.workAreaSize.width;
	const width = 800;
	const height = process.platform === 'win32' ? 418 : 380 + 8;

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
			enableRemoteModule: true,
		},
	};
	windowOpts.resizable = true; // enable resizing here, because this is what gets passed to spring.exe, and we want that to be resizeable
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
		//	 role: 'about',
		//	 click: () => {
		//	   log.info("About clicked");
		//	 }
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
		mainWindow.resizable = false; // Disable resizing of the launcher window, this does not get passed to spring.exe

		gui.send('all-configs', config.getAvailableConfigs());

		const { generateAndBroadcastWizard } = require('./launcher_wizard_util');
		generateAndBroadcastWizard();

		if (config.no_downloads && config.auto_start) {
			wizard.nextStep();
		} else if (config.auto_download) {
			gui.send('wizard-started');
			wizard.nextStep();
		} else {
			gui.send('wizard-stopped');
		}
	});
}

app.prependListener('ready', () => {
	if (argv.replayFile) {
		startReplayHeadless(argv.replayFile);
	} else {
		startGUI();
	}
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
