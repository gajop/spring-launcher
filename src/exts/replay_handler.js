const { bridge } = require('../spring_api');
const springPlatform = require('../spring_platform');
const { log } = require('../spring_log');
const { parseReplay } = require('../replay_utils');

bridge.on('ReadReplayInfo', async command => {
	try {
		const info = await parseReplay(
			springPlatform.writePath, command.relativePath, false
		);
		bridge.send('ReplayInfo', info);
	} catch (err) {
		log.error(`Error parsing file: ${command.relativePath}`);
	}
});
