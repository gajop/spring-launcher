'use strict';

const { ipcRenderer } = require('electron');

const mainWindow = require('electron').remote.getCurrentWindow();

const { format } = require('util');
const util = require('util');

const btnShowLog = document.getElementById('btn-show-log');
const btnUploadLog = document.getElementById('btn-upload-log');
const logContent = document.getElementById('note-content');

btnShowLog.addEventListener('click', (event) => {
	event.preventDefault();

	const cl = logContent.classList;
	if (cl.contains('open')) {
		cl.remove('open');
		// We have to call setMinimumSize before .setSize due to Electron bug
		// https://github.com/electron/electron/issues/15560
		mainWindow.setMinimumSize(800, 380 + 8);
		mainWindow.setSize(800, 380 + 8);
	} else {
		cl.add('open');
		// We have to call setMinimumSize before .setSize due to Electron bug
		// https://github.com/electron/electron/issues/15560
		mainWindow.setMinimumSize(800, 750);
		mainWindow.setSize(800, 750);
	}
});

btnUploadLog.addEventListener('click', () => {
	ipcRenderer.send('log-upload-ask');
});

ipcRenderer.on('log', (e, msg) => {
	var para = document.createElement('p');
	var text = format.apply(util, msg.data);
	var node = document.createTextNode(`[${msg.date} ${msg.level}] ${text}`);
	para.appendChild(node);
	para.classList.add(msg.level);
	logContent.appendChild(para);
});