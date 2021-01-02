const { bridge } = require('../spring_api');

const { ungzip } = require('node-gzip');
const fsPromises = require('fs').promises;
const path = require('path');

const { DemoParser } = require('sdfz-demo-parser');

// const { log } = require('../spring_log');
const springPlatform = require('../spring_platform');

bridge.on('ReadReplayInfo', async command => {
	const demoPath = path.join(springPlatform.writePath, command.relativePath);
	// log.info(`demoPath: ${demoPath}`);
	const sdfz = await fsPromises.readFile(demoPath);
	const sdf = await ungzip(sdfz);

	const parser = new DemoParser();

	const demo = parser.parseDemo(sdf);

	bridge.send('ReplayInfo', {
		relativePath : command.relativePath,
		engine: demo.header.versionString,
		game: demo.script.gameSettings.gametype,
		map: demo.script.gameSettings.mapname
		// TODO: missing textual representation of start script
		// startScript: demo.script
	});

});
