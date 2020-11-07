'use strict';

const settings = require('electron-settings');

const { wizard } = require('./launcher_wizard');
const { config } = require('./launcher_config');
const { gui } = require('./launcher_gui');

function generateAndBroadcastWizard()
{
	const checkForUpdates = settings.get('checkForUpdates', null);
	if (checkForUpdates !== null) {
		config.no_downloads = !checkForUpdates;
	}

	wizard.generateSteps();
	const steps = wizard.steps
		.filter(step => step.name != 'start')
		.map(step => {
			// we have to make a copy of these steps because IPC shouldn't contain functions (step.action)
			return {
				name: step.name,
				item: step.item
			};
		});

	gui.send('config', config.getConfigObj());
	gui.send('wizard-list', steps);
}

module.exports = {
	generateAndBroadcastWizard: generateAndBroadcastWizard,
};
