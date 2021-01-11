const path = require('path');

const { MapParser } = require('spring-map-parser');

const { bridge } = require('../spring_api');
const springPlatform = require('../spring_platform');

bridge.on('ParseMiniMap', async command => {
	const destinationPath = path.join(springPlatform.writePath, command.destination);
	const parser = new MapParser({ verbose: true, mipmapSize: 4, skipSmt: true });
	const map = await parser.parseMap(command.mapPath);

	console.log(destinationPath);

	await map.miniMap.toFile('test.png');

	bridge.send('ParseMiniMapFinished', {
		mapPath : command.mapPath,
		destinationPath: command.destinationPath
	});
});
