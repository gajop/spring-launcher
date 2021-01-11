'use strict';

const shell = require('electron').shell;

module.exports.open = async (path) => {
	await shell.openPath(path);
};