const { bridge } = require('../spring_api');
const file_opener = require('../file_opener');

bridge.on('OpenFile', async (command) => {
	let success = false;
	try {
		await file_opener.open(command.path);
		success = true;
	} catch (e) {
		success = false;
	}

	if (success) {
		bridge.send('OpenFileFinished', {
			path: command.path
		});
	} else {
		bridge.send('OpenFileFailed', {
			path: command.path
		});
	}
});
