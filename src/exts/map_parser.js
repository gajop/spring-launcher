const path = require('path');
const fs = require('fs');

const { MapParser } = require('spring-map-parser');

const { bridge } = require('../spring_api');
const { log } = require('../spring_log');
const springPlatform = require('../spring_platform');
const path7za = require('../path_7za');

let concurrentCalls = 0;

bridge.on('ParseMiniMap', async command => {
	const destinationPath = path.join(springPlatform.writePath, command.destination);
	const miniMapSize = command.miniMapSize || 4;

	if (!fs.existsSync(path7za)) {
		log.error(`Failed to find 7za at: ${path7za}, minimap cannot be parsed`);
		return;
	}

	while (concurrentCalls > 0) {
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
	concurrentCalls++;
	log.info(`Parsing minimap from ${destinationPath}`);
	try {
		const parser = new MapParser({ verbose: true, mipmapSize: miniMapSize, skipSmt: true, path7za: path7za });
		const map = await parser.parseMap(command.mapPath);
		await map.miniMap.writeAsync(destinationPath);
	} catch(err) {
		log.error(`Failed to parse minimap from: ${destinationPath}`);
		log.error(err);
	} finally {
		concurrentCalls--;
	}

	bridge.send('ParseMiniMapFinished', {
		mapPath : command.mapPath,
		destinationPath: destinationPath
	});
});
