const fs = require('fs');
const argv = require('yargs') // eslint-disable-line
	.option('config', {
		alias: 'c',
		type: 'string',
		description: 'Path to config.json'
	})
	.option('write-path', {
		alias: 'w',
		type: 'string',
		description: 'Path to Spring'
	}).argv;

if (argv.config != null) {
	if (!fs.existsSync(argv.config)) {
		console.error(`Config file doesn't exist: "${argv.config}"`);
		process.exit(1);
	}
}
if (argv.writePath != null) {
	try {
		fs.accessSync(argv.writePath, fs.constants.R_OK | fs.constants.W_OK);
	} catch (err) {
		console.error(`Cannot write to specified write path: "${argv.writePath}"`);
		process.exit(1);
	}
}

module.exports = argv;