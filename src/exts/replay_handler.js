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

	bridge.send('ReplayInfo', {
		relativePath : command.relativePath,
		engine: demo.header.versionString,
		game: demo.script.gameSettings.gametype,
		map: demo.script.gameSettings.mapname
		// TODO: missing textual representation of start script
		// startScript: demo.script
	});
});
