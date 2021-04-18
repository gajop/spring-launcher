const path = require('path');

const { DemoParser } = require('sdfz-demo-parser');

const { bridge } = require('../spring_api');
const springPlatform = require('../spring_platform');

const util = require('util');

bridge.on('ReadReplayInfo', async command => {
	const demoPath = path.join(springPlatform.writePath, command.relativePath);
	const parser = new DemoParser();
	const demo = await parser.parseDemo(demoPath);

	console.log(util.inspect(demo, false, null, true));
	const info = {
		relativePath : command.relativePath,
		engine: demo.header.versionString,
		game: demo.info.hostSettings.gametype,
		map: demo.info.hostSettings.mapname,
		// TODO: We're passing only the allyTeams part of the script, because
		// that's all we need in BAR/Chobby. Do we need to pass more ?
		players: demo.info.players,
		gameTime: demo.header.gameTime
	};
	console.log(info);
	bridge.send('ReplayInfo', info);
});
