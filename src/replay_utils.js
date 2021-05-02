'use strict';

const fs = require('fs').promises;
const { constants } = require('fs');
const path = require('path');

const { DemoParser } = require('sdfz-demo-parser');

// Parse a replay and create the needed info structure. If there is a cache
// file for this replay, use it.
async function parseReplay(springPath, replayPath, exitIfCacheExists) {
	const fullReplayPath = path.join(springPath, replayPath);
	const demoCachePath = `${fullReplayPath}.cache`;

	try {
		// Check if there is a cache file
		await fs.access(demoCachePath, constants.R_OK);
	} catch (err) {
		// If there isn't, go parse the original replay, create the cache file,
		// and return the info.
		const parser = new DemoParser();
		const demo = await parser.parseDemo(fullReplayPath);
		const info = {
			relativePath : replayPath,
			engine: demo.header.versionString,
			game: demo.info.hostSettings.gametype,
			map: demo.info.hostSettings.mapname,
			players: demo.info.players.concat(demo.info.ais),
			gameTime: demo.header.gameTime
		};

		// Since there is no cache file yet, create it
		fs.writeFile(demoCachePath, JSON.stringify(info));

		return info;
	}

	// We found a cache file: return its content if asked for.
	if (exitIfCacheExists) {
		return null;
	}
	return JSON.parse(await fs.readFile(demoCachePath));
}

module.exports = {
	parseReplay: parseReplay
};
