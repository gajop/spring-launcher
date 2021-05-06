'use strict';

const { app } = require('electron');
const EventEmitter = require('events');
const { spawn } = require('child_process');
const { resolve } = require('path');
const fs = require('fs');

const log = require('electron-log');

const springPlatform = require('./spring_platform');
const { config } = require('./launcher_config');
const { springsettings } = require('./springsettings');

const { gui } = require('./launcher_gui');

const { bridge } = require('./spring_bridge');
let address;
let port;

bridge.on('listening', () => {
	const a = bridge.server.address();
	address = a.address;
	port = a.port;
});

function generateScriptTXT() {
	let extraModOptions = '';
	if (config.launch.mod_options != null) {
		for (let [key, value] of Object.entries(config.launch.mod_options)) {
			extraModOptions = extraModOptions + `\n${key} = ${value};`;
		}
	}

	let mapOptions = '';
	if (config.launch.map_options != null) {
		mapOptions = '[MapOptions]\n{';
		for (let [key, value] of Object.entries(config.launch.map_options)) {
			mapOptions = mapOptions + `\n${key} = ${value};`;
		}
		mapOptions += '\n}';
	}

	let extraGameOptions = '';
	if (config.launch.game_options != null) {
		for (let [key, value] of Object.entries(config.launch.game_options)) {
			extraGameOptions = extraGameOptions + `\n${key} = ${value};`;
		}
	}

	return `[GAME]
{
	GameType = ${config.launch.game};
	HostIP = 127.0.0.1;
	IsHost = 1;
	MapName = ${config.launch.map};
	NumPlayers = 2;
	NumUsers = 2;
	GameStartDelay = 0;

	${extraGameOptions}

	[allyTeam0]
	{
		NumAllies = 0;
	}

	[allyTeam1]
	{
		NumAllies = 0;
	}

	[ModOptions]
	{
	_sl_address = ${address};
	_sl_port = ${port};
	_sl_write_path = ${springPlatform.writePath};
	_sl_launcher_version = ${app.getVersion()};
	${extraModOptions}
	}

	${mapOptions}

	[player0]
	{
		IsFromDemo = 1;
		Name = Enemy;
		Spectator = 0;
		Team = 1;
	}

	[player1]
	{
		IsFromDemo = 1;
		Name = 0;
		Spectator = 0;
		Team = 0;
	}

	[team0]
	{
		AllyTeam = 0;
		RGBColor = 0.35294119 0.35294119 1;
		TeamLeader = 0;
	}

	[team1]
	{
		AllyTeam = 1;
		RGBColor = 0.78431374 0 0;
		TeamLeader = 0;
	}

}`;
}

class Launcher extends EventEmitter {
	launch(enginePath, opts) {
		springsettings.applyDefaults();
		if (config.no_start_script) {
			fs.writeFileSync(`${springPlatform.writePath}/sl-connection.json`, JSON.stringify({
				_sl_address: address,
				_sl_port: port,
				_sl_write_path: springPlatform.writePath,
				_sl_launcher_version: app.getVersion()
			}));
			this.launchSpring(enginePath, opts);
		} else {
			const scriptTXT = generateScriptTXT();
			const scriptTxtPath = `${springPlatform.writePath}/script.txt`;
			opts = [];
			fs.writeFile(scriptTxtPath, scriptTXT, 'utf8', () => {
				opts.push(scriptTxtPath);
				this.launchSpring(enginePath, opts);
			});
		}
	}

	launchSpring(enginePath, extraArgs) {
		var args = ['--write-dir', resolve(springPlatform.writePath)];
		if (config.isolation) {
			args.push('--isolation');
		}
		if (extraArgs != undefined) {
			args = args.concat(extraArgs);
		}

		var outputMode = 'pipe';
		const isDev = false;
		if (process.platform === 'linux' && isDev) {
			outputMode = 'inherit';
		}

		// If the main window has a restricted resize, the child process window (Spring) will inherit this property
		// Since we don't want to impose such restriction to Spring, we explicitly make it resizable before launching
		const oldResizable = gui.getMainWindow().resizable;
		gui.getMainWindow().resizable = true;

		log.info(`Launching Spring with command: ${enginePath} ${args.join(' ')}`);
		const spring = spawn(enginePath, args,
			{ stdio: outputMode, stderr: outputMode, windowsHide: false });

		// After launching we toggle back resizable since it will no longer impact the child process window
		gui.getMainWindow().resizable = oldResizable;

		this.state = 'running';

		spring.on('close', (code) => {
			if (this.state != 'running') {
				return;
			}
			if (code == 0) {
				this.state = 'finished';
				this.emit('finished', code);
			} else {
				this.state = 'failed';
				this.emit('failed', `Spring failed with code: ${code}`);
			}
		});

		if (spring.stdout) {
			spring.stdout.on('data', (data) => {
				var text = data.toString();
				// remove newline character at the end
				text = text.substring(0, text.length - 1);
				this.emit('stdout', text);
			});
		}

		if (spring.stderr) {
			spring.stderr.on('data', (data) => {
				var text = data.toString();
				text = text.substring(0, text.length - 1);
				this.emit('stderr', text);
			});
		}

		spring.on('error', (error) => {
			this.state = 'failed';
			this.emit('failed', `Failed to launch Spring: ${error}`);
		});
	}
}

const launcher = new Launcher();

module.exports = {
	Launcher: Launcher,
	launcher: launcher
};
