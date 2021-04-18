const path = require('path');

const { MapParser } = require('spring-map-parser');

const { bridge } = require('../spring_api');
const springPlatform = require('../spring_platform');

let concurrentCalls = 0;

bridge.on('ParseMiniMap', async command => {
	const destinationPath = path.join(springPlatform.writePath, command.destination);
	const miniMapSize = command.miniMapSize || 4;
	const parser = new MapParser({ verbose: true, mipmapSize: miniMapSize, skipSmt: true });
	const map = await parser.parseMap(command.mapPath);

	while (concurrentCalls > 0) {
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
	try {
		concurrentCalls++;
		await map.miniMap.writeAsync(destinationPath);
	} finally {
		concurrentCalls--;
	}

	bridge.send('ParseMiniMapFinished', {
		mapPath : command.mapPath,
		destinationPath: destinationPath
	});
});