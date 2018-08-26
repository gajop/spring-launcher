const { app } = require('electron');
const EventEmitter = require('events');
const { spawn } = require('child_process');
const { resolve } = require('path');

const log = require('electron-log');

const { writePath, springBin } = require('./spring_platform');

class Launcher extends EventEmitter {
  launch(engineName, extraArgs=[]) {
    const springPath = `${writePath}/engine/${engineName}/${springBin}`;
    var args = ["--write-dir", resolve(writePath)];
    if (extraArgs != undefined) {
      args = args.concat(extraArgs);
    }

    log.info("Starting Spring with args:");
    log.info(`${springPath} ${args.join(" ")}`);
    // const process = spawn(springPath, args, {stdio: "inherit", stderr: "inherit"});

    var outputMode = "pipe";
    const isDev = false;
    if (process.platform === "linux" && isDev) {
      outputMode = "inherit";
    }

    const spring = spawn(springPath, args,
      { stdio: outputMode, stderr: outputMode, windowsHide: true });
    this.state = "launching";


    spring.on('close', (code) => {
      if (code == 0) {
        log.info(`Spring finished with code: ${code}`);
        this.state = "finished";
        this.emit("finished");
      } else {
        log.error(`Spring failed with code: ${code}`);
        this.state = "failed";
        this.emit("failed", code)
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
  }
}

const launcher = new Launcher();

module.exports = launcher;
