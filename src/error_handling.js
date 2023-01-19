// const { app, dialog } = require('electron');

const process = require('process');
const log = require('electron-log');
const { gui } = require('./launcher_gui');

// If we failed to write stuff to stderr or stdout: it's fine, let's not create
// intfinite loop when writing info about unhandled exception causes another unhandled
// exception: we managed to create 1TiB of logs for one user this way 🤣.
process.stdout.on('error', () => {});
process.stderr.on('error', () => {});

log.catchErrors({
	showDialog: false,
	onError(err) {
		// Ignore self-updater errors
		try {
			if (err.stack.includes('app-update.yml')) {
				log.info('Auto-update error, ignoring...');
				return;
			}
		} catch (err) {
			// Empty on purpose
		}

		log.error('Unexpected error occurred.');
		log.error(err);
		try {
			gui.send('error', 'Something went wrong :( Please upload the log.');
		} catch (errGui) {
			log.error('Failed to broadcast error to GUI');
			log.error(errGui);
		}
	}

	// Alternatively/Additionally we should consider streamlining the log upload process
	// But disabled for now as this might impact UX very negatively

	// onError(error, versions, submitIssue) {
	// 	dialog.showMessageBox({
	// 		title: 'An error occurred',
	// 		message: error.message,
	// 		detail: error.stack,
	// 		type: 'error',
	// 		buttons: ['Ignore', 'Report', 'Exit'],
	// 	})
	// 		.then((result) => {
	// 			if (result.response === 1) {
	// 				submitIssue('https://github.com/gajop/spring-launcher/issues/new', {
	// 					title: `Error report for ${versions.app}`,
	// 					body: 'Error:\n```' + error.stack + '\n```\n' + `OS: ${versions.os}`
	// 				});
	// 				return;
	// 			}

	// 			if (result.response === 2) {
	// 				app.quit();
	// 			}
	// 		});
	// }
});