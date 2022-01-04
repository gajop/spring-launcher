const fs = require('fs');
const argv = require('yargs') // eslint-disable-line
	.command('$0', 'default command', (yargs) => {
		yargs
			.option('config', {
				alias: 'c',
				type: 'string',
				description: 'Path to config.json'
			})
			.option('write-path', {
				alias: 'w',
				type: 'string',
				description: 'Path to Spring'
			})
			.positional('replay-file', {
				describe: 'A replay file to play',
				type: 'string'
			});
	}, () => {}).argv;


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

if (argv._[0] != null) {
	argv.replayFile = argv._[0];
}

module.exports = argv;
