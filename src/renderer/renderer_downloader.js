'use strict';

const { ipcRenderer } = require('electron');

const { stepError, setNextStepEnabled, getCurrentStepIndex, getTotalSteps } = require('./renderer_wizard');

const pbPart = document.getElementById('progress-part');
const pbFull = document.getElementById('progress-full');
const lblFull = document.getElementById('lbl-progress-full');
const lblPart = document.getElementById('lbl-progress-part');

ipcRenderer.on('dl-started', (e, downloadItem) => {
	lblFull.innerHTML = `Step ${getCurrentStepIndex()} of ${getTotalSteps()}: Downloading ${downloadItem} `;
	pbPart.classList.remove('is-success', 'is-danger');
	pbPart.classList.add('is-primary');
});

ipcRenderer.on('dl-progress', (e, downloadItem, current, total) => {
	pbPart.value = Math.round(100 * current / total);

	const step = getCurrentStepIndex() + current / total - 1;
	pbFull.value = Math.round(100 * step / getTotalSteps());

	if (downloadItem != 'autoUpdate') {
		lblPart.innerHTML = `${formatBytes(current, total)}`;
	} else {
		lblPart.innerHTML = `${current.toFixed(2)}%`;
	}
});

ipcRenderer.on('dl-finished', () => {
	pbPart.value = 100;
	pbPart.classList.remove('is-primary', 'is-danger');
	pbPart.classList.add('is-success');
});

ipcRenderer.on('error', (e, msg) => {
	setNextStepEnabled(false);
	stepError(`Step ${getCurrentStepIndex()} of ${getTotalSteps()}: ${msg}`);
});

ipcRenderer.on('set-next-enabled', (e, enabled) => {
	setNextStepEnabled(enabled);
});

function formatBytes(bytesFirst, bytesSecond, decimals) {
	const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'];
	const k = 1024;

	var strFirst;
	var strSecond;
	var strUnit;

	if (bytesSecond == 0) {
		strFirst = '0';
		strSecond = '0';
		strUnit = sizes[0];
	} else {
		const i = Math.floor(Math.log(bytesSecond) / Math.log(k));
		const dm = decimals || 2;

		strFirst  = parseFloat(bytesFirst / Math.pow(k, i)).toFixed(dm);
		strSecond = parseFloat(bytesSecond / Math.pow(k, i)).toFixed(dm);
		strUnit   = sizes[i];

		strFirst = ' '.repeat(strSecond.indexOf('.') - strFirst.indexOf('.')) + strFirst;
		strFirst = strFirst + ' '.repeat(strSecond.length - strFirst.length);
	}

	return `${strFirst} / ${strSecond} ${strUnit}`;
}