const { app } = require('electron');
const path = require('path');
const platformName = process.platform;

function resolveWritePath(title) {
	const argv = require('./launcher_args');
	if (argv.writePath != null) {
		return argv.writePath;
	}

	if (process.env.PORTABLE_EXECUTABLE_DIR != null) {
		return path.join(process.env.PORTABLE_EXECUTABLE_DIR, title);
	}

	if (platformName === 'win32') {
		const isDev = require('electron-is-dev');
		if (isDev) {
			return path.join(app.getAppPath(), 'data');
		} else {
			return path.join(app.getAppPath(), '../../data');
		}
	}

	return path.join(app.getPath('documents'), title);
}

module.exports = {
	resolveWritePath: resolveWritePath
};
