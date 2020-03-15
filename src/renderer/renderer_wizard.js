'use strict';

const { ipcRenderer } = require('electron');

const { setConfigEnabled } = require('./renderer_config');

const lblFull = document.getElementById('lbl-progress-full');
const lblPart = document.getElementById('lbl-progress-part');
const pbPart = document.getElementById('progress-part');
const pbFull = document.getElementById('progress-full');

const btnProgress = document.getElementById('btn-progress');

let steps;
let currentStep = 0;

let operationInProgress = false;
let nextStepEnabled = true;

ipcRenderer.on('wizard-list', (_, s) => {
	steps = s;
});

ipcRenderer.on('wizard-started', () => {
	currentStep = 0;
	setInProgress(true);
});

ipcRenderer.on('wizard-stopped', () => {
	setInProgress(false);
});

ipcRenderer.on('wizard-finished', () => {
	btnProgress.innerHTML = 'Start';
	lblFull.innerHTML = 'Download complete';
	lblPart.innerHTML = '';

	pbPart.value = 100;
	pbFull.value = 100;

	pbPart.classList.remove('is-primary', 'is-danger');
	pbPart.classList.add('is-success');

	pbFull.classList.remove('is-primary', 'is-danger');
	pbFull.classList.add('is-success');
	//pbPart.value = parseInt(100 * currentStep / steps.length);
});

ipcRenderer.on('wizard-next-step', (e, step) => {
	lblPart.innerHTML = '';
	lblFull.innerHTML =
`Step ${currentStep} of ${steps.length} Checking for download: ${step.name} `;
	pbFull.value = Math.round(100 * currentStep / steps.length);
	currentStep++;
});

btnProgress.addEventListener('click', (event) => {
	console.log(operationInProgress, nextStepEnabled);
	event.preventDefault();
	if (!operationInProgress && nextStepEnabled) {
		lblFull.classList.remove('error');
		btnProgress.classList.remove('is-warning');
		ipcRenderer.send('wizard-next');
	}
});

function setInProgress(state) {
	setConfigEnabled(!state);
	if (state) {
		btnProgress.classList.add('is-loading');
	} else {
		btnProgress.classList.remove('is-loading');
	}
	operationInProgress = state;
}

function stepError(message) {
	lblFull.innerHTML = message;
	lblFull.classList.add('error');
	lblPart.classList.add('error');

	pbFull.classList.remove('is-primary');
	pbPart.classList.remove('is-primary');

	pbFull.classList.add('is-danger');
	pbPart.classList.add('is-danger');

	setInProgress(false);
}

function updateWizard(config) {
	let buttonText;
	if (config.no_downloads) {
		if (config.auto_start && !operationInProgress && false) { // eslint-disable-line no-constant-condition
			// TODO: add later
			buttonText = 'Starting...';
		} else {
			buttonText = 'Start';
		}
	} else {
		if (config.auto_download && !operationInProgress && false) { // eslint-disable-line no-constant-condition
			// TODO: add later
			if (config.auto_start) {
				buttonText = 'Updating and Starting...';
			} else {
				buttonText = 'Updating...';
			}
		} else {
			if (config.auto_start) {
				buttonText = 'Update & Start';
			} else {
				buttonText = 'Update';
			}
		}
	}

	resetUI();
	btnProgress.innerHTML = buttonText;
}

function resetUI() {
	pbPart.value = 0;
	pbFull.value = 0;
	pbFull.classList.remove('is-danger', 'is-success');
	pbPart.classList.remove('is-danger', 'is-success');
	pbFull.classList.add('is-primary');
	pbPart.classList.add('is-primary');

	lblFull.classList.remove('error');
	lblPart.classList.remove('error');
	lblFull.innerHTML = '';
	lblPart.innerHTML = '';

	btnProgress.classList.remove('is-warning');
	btnProgress.classList.add('is-primary');
	setNextStepEnabled(true);
}

function setNextStepEnabled(enabled) {
	nextStepEnabled = enabled;
	btnProgress.disabled = !enabled;
}

module.exports = {
	stepError: stepError,
	setInProgress: setInProgress,
	getCurrentStepIndex: () => currentStep,
	getTotalSteps: () => steps.length,
	setNextStepEnabled: setNextStepEnabled,
	updateWizard: updateWizard
};
