const path = require('path');

const { DemoParser } = require('sdfz-demo-parser');

const { bridge } = require('../spring_api');
const springPlatform = require('../spring_platform');
const { log } = require('../spring_log');

bridge.on('ReadReplayInfo', async command => {
	try {
		const demoPath = path.join(springPlatform.writePath, command.relativePath);
		const parser = new DemoParser();
		const demo = await parser.parseDemo(demoPath);

		const info = {
			relativePath : command.relativePath,
			engine: demo.header.versionString,
			game: demo.info.hostSettings.gametype,
			map: demo.info.hostSettings.mapname,
			players: demo.info.players,
			gameTime: demo.header.gameTime
		};

		bridge.send('ReplayInfo', info);
	} catch (err) {
		log.error(`Error parsing file: ${command.relativePath}`);
	}
});
