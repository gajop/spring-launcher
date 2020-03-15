const { bridge } = require('../spring_api');
const file_opener = require('../file_opener');

bridge.on('OpenFile', (command) => {
	if (file_opener.open(command.path)) {
		bridge.send('OpenFileFinished', {
			path: command.path
		});
	} else {
		bridge.send('OpenFileFailed', {
			path: command.path
		});
	}
});
