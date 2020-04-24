const fs = require('fs');
const argv = require('yargs') // eslint-disable-line
	.option('config', {
		alias: 'c',
		type: 'string',
		description: 'Path to config.json'
	}).argv;

if (argv.config != null) {
	if (!fs.existsSync(argv.config)) {
		console.error(`Config file doesn't exist: ${argv.config}`);
		process.exit(1);
	}
}

module.exports = argv;