'use strict';

const { ipcRenderer } = require('electron');

const cmbConfig = document.getElementById('config-select');

let config;
let allConfigs;
let configEnabled = true;

module.exports = {
	setConfigEnabled: (state) => {
		configEnabled = state;
		if (state) {
			cmbConfig.removeAttribute('disabled');
		} else {
			cmbConfig.setAttribute('disabled', '');
		}
	}
};

const { setMainTitle } = require('./renderer_misc');
const { updateWizard } = require('./renderer_wizard');

ipcRenderer.on('config', (e, c) => {
	config = c;

	document.title = config.title;
	setMainTitle(config.title);

	updateWizard(config);

	document.getElementById(`cfg-${config.package.id}`).selected = true;
	// document.getElementById("current_config").innerHTML = `Config: ${config.package.display}`;
});

ipcRenderer.on('all-configs', (e, ac) => {
	allConfigs = ac;

	allConfigs.forEach((cfg) => {
		var cfgElement = document.createElement('option');
		cfgElement.id = `cfg-${cfg.package.id}`;
		cfgElement.appendChild(document.createTextNode(cfg.package.display));

		cmbConfig.appendChild(cfgElement);
	});
});

cmbConfig.addEventListener('change', (event) => {
	if (!configEnabled) {
		return;
	}
	const s = event.target;
	const selectedID = s[s.selectedIndex].id;
	const cfgName = selectedID.substring('cfg-'.length);
	ipcRenderer.send('change-cfg', cfgName);
});
