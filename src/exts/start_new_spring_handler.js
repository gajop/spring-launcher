const { join } = require('path');
const log = require('electron-log');

const { bridge } = require('../spring_api');
const springPlatform = require('../spring_platform');
const { Launcher } = require('../engine_launcher');

bridge.on('StartNewSpring', async command => {
	const launcher = new Launcher();
	const enginePath = join(
		springPlatform.writePath,
		'engine',

		// We need to put the engine's version in lowercase, because the
		// directory name is in lowercase, and FS is case sensitive on
		// some OSes.
		command.Engine.toLowerCase(),

		springPlatform.springBin
	);

	const replayPath = join(springPlatform.writePath, command.StartDemoName); // Removed the hardcoded 'demos' folder to allow launching savegames too

	launcher.launchSpring(enginePath, [replayPath]);

	launcher.on('stdout', (text) => {
		log.info(text);
	});

	launcher.on('stderr', (text) => {
		log.warn(text);
	});

	launcher.on('finished', (code) => {
		log.info(`Spring finished with code: ${code}`);
	});

	launcher.on('failed', (error) => {
		log.error(error);
	});

});
