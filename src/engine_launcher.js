const { app } = require('electron');
const EventEmitter = require('events');
const { spawn } = require('child_process');
const { resolve } = require('path');

const { writePath, springBin } = require('./spring_platform');
const { config } = require('./launcher_config');

const { bridge } = require('./spring_bridge');
let address;
let json;
bridge.on('listening', () => {
  const a = bridge.server.address();
  address = a.address;
  port = a.port;
});

function generateScriptTXT() {
return `[GAME]
{
	GameType = ${config.launch.game};
	HostIP = 127.0.0.1;
	IsHost = 1;
	MapName = ${config.launch.map};
	NumPlayers = 2;
	NumUsers = 2;

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
    _sl_write_path = ${writePath};
    _sl_launcher_version = ${app.getVersion()};
	}

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
  launchSpring(engineName, extraArgs) {
    const springPath = `${writePath}/engine/${engineName}/${springBin}`;
    var args = ["--write-dir", resolve(writePath)];
    if (config.isolation) {
      args.push("--isolation");
    }
    if (extraArgs != undefined) {
      args = args.concat(extraArgs);
    }
    // const process = spawn(springPath, args, {stdio: "inherit", stderr: "inherit"});

    var outputMode = "pipe";
    const isDev = false;
    if (process.platform === "linux" && isDev) {
      outputMode = "inherit";
    }

    const spring = spawn(springPath, args,
      { stdio: outputMode, stderr: outputMode, windowsHide: true });
    this.state = "running";

    spring.on('close', (code) => {
      if (this.state != "running") {
        return;
      }
      if (code == 0) {
        this.state = "finished";
        this.emit("finished", code);
      } else {
        this.state = "failed";
        this.emit("failed", `Spring failed with code: ${code}`)
      }
    })

    if (spring.stdout) {
      spring.stdout.on('data', (data) => {
        var text = data.toString();
        // remove newline character at the end
        text = text.substring(0, text.length - 1);
        this.emit("stdout", text);
      });
    }

    if (spring.stderr) {
      spring.stderr.on('data', (data) => {
        var text = data.toString();
        text = text.substring(0, text.length - 1);
        this.emit("stderr", text);
      });
    }

    spring.on('error', (error) => {
      this.state = "failed";
      this.emit("failed", `Failed to launch Spring: ${error}`)
    });
  }

  launch(engineName, opts) {
    if (config.no_start_script) {
      // opts.push(scriptTxtPath);
      // console.log(opts);
      this.launchSpring(engineName, opts);
    } else {
      const scriptTXT = generateScriptTXT()
      const fs = require('fs');
      const scriptTxtPath = `${writePath}/script.txt`;
      opts = [];
      fs.writeFile(scriptTxtPath, scriptTXT, 'utf8', () => {
        opts.push(scriptTxtPath);
        console.log(opts);
        this.launchSpring(engineName, opts);
      });
    }
  }
}

const launcher = new Launcher();

module.exports = launcher;
