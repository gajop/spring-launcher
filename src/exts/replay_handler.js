const fsPromises = require('fs').promises;
const path = require('path');

const { DemoParser } = require('sdfz-demo-parser');

const { bridge } = require('../spring_api');
const springPlatform = require('../spring_platform');

bridge.on('ReadReplayInfo', async command => {
	const demoPath = path.join(springPlatform.writePath, command.relativePath);
	const sdfz = await fsPromises.readFile(demoPath);

	const parser = new DemoParser();

	const demo = await parser.parseDemo(sdfz);

	const info = {
		relativePath : command.relativePath,
		engine: demo.header.versionString,
		game: demo.script.gameSettings.gametype,
		map: demo.script.gameSettings.mapname,
		// TODO: We're passing only the allyTeams part of the script, because
		// that's all we need in BAR/Chobby. Do we need to pass more ?
		allyTeams: demo.script.allyTeams,
		gameTime: demo.header.gameTime
	};
	bridge.send('ReplayInfo', info);
});
