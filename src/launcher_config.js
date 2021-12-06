'use strict';

const log = require('electron-log');

const argv = require('./launcher_args');

const configDefault = {
	'package': {
		// Possible values are 'darwin', 'linux', 'win32'
		'platform': 'all',
		'portable': false
	},

	'display': {
		'title': 'Spring Launcher'
	},

	'isolation': true,
	'auto_download': false,
	'auto_start': false,
	'no_downloads': false,
	'no_start_script': false,
	'load_dev_exts': false,
	'route_prd_to_nextgen': false,
	'github_gist_account': null,

	'downloads': {
		'games': [],
		'maps': [],
		'engines': [],
		'resources': [],
		'nextgen': [],
	},

	'launch': {
		'start_args': [],
		'game': undefined,
		'map': undefined,
		'engine': undefined,
		'map_options': undefined,
		'mod_options': undefined,
		'game_options': undefined
	}
};

var configs = [];
var availableConfigs = [];
var currentConfig;

function canUse(config) {
	if (config.package.platform != 'all') {
		if (config.package.platform != process.platform) {
			return false;
		}
	}
	if (config.package.portable && !process.env.PORTABLE_EXECUTABLE_DIR) {
		return false;
	}
	if (process.env.PORTABLE_EXECUTABLE_DIR && !config.package.portable) {
		return false;
	}
	return true;
}

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
function isObject(item) {
	return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
function mergeDeep(target, ...sources) {
	if (sources.length === 0) {
		return target;
	}
	const source = sources.shift();

	if (isObject(target) && isObject(source)) {
		for (const key in source) {
			if (isObject(source[key])) {
				if (!target[key]) Object.assign(target, { [key]: {} });
				mergeDeep(target[key], source[key]);
			} else {
				Object.assign(target, { [key]: source[key] });
			}
		}
	}

	return mergeDeep(target, ...sources);
}

const configFile = require(
	argv.config != null ? argv.config : './config.json');

configDefault.title = configFile.title;

configFile.setups.forEach((c) => {
	const configDefaultCopy = JSON.parse(JSON.stringify(configDefault));
	const config = mergeDeep(configDefaultCopy, c);
	configs.push(config);

	if (canUse(config)) {
		availableConfigs.push(config);
		if (!currentConfig) {
			currentConfig = config;
		}
	}
});

const proxy = new Proxy({
	setConfig: function (id) {
		var found = false;
		availableConfigs.forEach((cfg) => {
			if (cfg.package.id == id) {
				currentConfig = cfg;
				found = true;
			}
		});
		if (!found) {
			log.error(`No config with ID: ${id} - ignoring`);
			return false;
		} else {
			return true;
		}
	},
	getAvailableConfigs: function () {
		return availableConfigs;
	},
	getConfigObj: function () {
		return currentConfig;
	}
}, {
	get: function (target, name) {
		if (target[name] != undefined) {
			return target[name];
		} else if (configFile[name] != undefined) {
			return configFile[name];
		} {
			return currentConfig[name];
		}
	},
	set: function (target, name, value) {
		currentConfig[name] = value;
		return true;
	}
});

module.exports = {
	config: proxy,
};