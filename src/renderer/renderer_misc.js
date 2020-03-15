'use strict';

const { ipcRenderer } = require('electron');
const isDev = require('electron-is-dev');

const btnShowDir = document.getElementById('btn-show-dir');
const lblMainTitle = document.getElementById('main-title');

btnShowDir.addEventListener('click', () => {
	ipcRenderer.send('open-install-dir');
});

module.exports = {
	setMainTitle: (title) => {
		if (isDev) {
			title = `${title} (DEV)`;
		}
		lblMainTitle.innerHTML = title;
	}
};