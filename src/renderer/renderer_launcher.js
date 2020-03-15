'use strict';

const { ipcRenderer } = require('electron');

const { setInProgress, stepError } = require('./renderer_wizard');
const { setConfigEnabled } = require('./renderer_config');

const lblFull = document.getElementById('lbl-progress-full');

ipcRenderer.on('launch-started', () => {
	setInProgress(true);
	lblFull.innerHTML = 'Launching';
	setConfigEnabled(true);
});

ipcRenderer.on('launch-finished', () => {
	setInProgress(false);
});

ipcRenderer.on('launch-failed', (e, msg) => {
	stepError(`${msg}`);
});

