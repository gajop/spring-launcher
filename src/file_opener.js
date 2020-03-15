'use strict';

const shell = require('electron').shell;

module.exports.open = function (path) {
	return shell.openItem(path);
};