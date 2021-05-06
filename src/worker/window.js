const { app, BrowserWindow } = require('electron');
const springPlatform = require('../spring_platform');

let workerWindow;

// Create a window for the worker

app.prependListener('ready', () => {
	workerWindow = new BrowserWindow({
		show: false,
		webPreferences: {nodeIntegration: true }
	});
	workerWindow.loadFile(`${__dirname}/index.html`);

	// Send a 'start-indexing-replays' request once the worker is ready
	workerWindow.once('ready-to-show', () => {
		workerWindow.send('start-indexing-replays', springPlatform.writePath);
	});

});

module.exports = {
	getWorkerWindow: function() {
		return workerWindow;
	},
};
