'use strict';

const { ipcRenderer } = require('electron');

const { getCurrentWindow } = require('@electron/remote');

const mainWindow = getCurrentWindow();

const { format } = require('util');
const util = require('util');

const btnShowLog = document.getElementById('btn-show-log');
const btnUploadLog = document.getElementById('btn-upload-log');
const logContent = document.getElementById('note-content');

btnShowLog.addEventListener('click', (event) => {
	event.preventDefault();

	const cl = logContent.classList;
	const baseHeight = process.platform === 'win32' ? 418 : 380 + 8;
	const expandedHeight = baseHeight + 362;
	if (cl.contains('open')) {
		cl.remove('open');
		// We have to call setMinimumSize before .setSize due to Electron bug
		// https://github.com/electron/electron/issues/15560
		mainWindow.setMinimumSize(800, baseHeight);
		mainWindow.setSize(800, baseHeight);
	} else {
		cl.add('open');
		// We have to call setMinimumSize before .setSize due to Electron bug
		// https://github.com/electron/electron/issues/15560
		mainWindow.setMinimumSize(800, expandedHeight);
		mainWindow.setSize(800, expandedHeight);
	}
});

btnUploadLog.addEventListener('click', () => {
	ipcRenderer.send('log-upload-ask');
});

ipcRenderer.on('log', (e, msg) => {
	const para = document.createElement('p');
	const text = format.apply(util, msg.data);
	const node = document.createTextNode(`[${msg.date} ${msg.level}] ${text}`);
	para.appendChild(node);
	para.classList.add(msg.level);
	logContent.appendChild(para);
});
