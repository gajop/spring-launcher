'use strict';

const shell = require('electron').shell;

module.exports.open = async (path) => {
	if (path.match(/^https?:\/\/.*$/) ||
		path.match(/^file:\/\/\/.*$/)) {
		await shell.openExternal(path);
	} else {
		await shell.openPath(path);
	}
};