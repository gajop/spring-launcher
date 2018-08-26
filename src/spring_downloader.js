const { spawn } = require('child_process');
const EventEmitter = require('events');

const log = require('electron-log');

const springPlatform = require('./spring_platform');

class SpringDownloader extends EventEmitter {
  constructor() {
    super()
    this.progressPattern = new RegExp('[0-9]+/[0-9]+');
    this.missingPattern = new RegExp(".*no engine.*|.*no mirrors.*|.*no game found.*|.*no map found.*|.*error occured while downloading.*");
  }

  error_check(name, line) {
    if (line.startsWith("[Error]")) {
      if (line.toLowerCase().match(this.missingPattern)) {
        this.emit("failed", name, line);
        return true;
      }
    }
    return false;
  }

  download_package(name, type, args) {
    let finished = false;
    const prd = spawn(springPlatform.prDownloaderPath, args);
    this.emit("started", name, type, args);

    prd.stdout.on('data', (data) => {
      const line = data.toString();
      if (line.startsWith("[Progress]")) {
        const matched = line.match(this.progressPattern);
        if (!matched || matched.length == 0) {
          return;
        }
        var progressStr = matched[0];
        var [current, total] = progressStr.split("/");
        var current = parseInt(current);
        var total = parseInt(total);
        this.emit("progress", name, current, total);
      } else if (this.error_check(name, line)) {
        finished = true;
      } else if (line.startsWith("[Info]")) {
        this.emit("info", name, line);
      }
    });

    prd.stderr.on('data', (data) => {
      const line = data.toString();
      log.warn(line);
      if (this.error_check(name, line)) {
        finished = true;
      }
    });


    prd.on('close', (code) => {
      if (finished) { // the process already counts as finished
        return;
      }
      //console.log(`child process exited with code ${code}`);
      if (code == 0) {
        this.emit("finished", name);
      } else {
        this.emit("failed", name);
      }
    });

  }


  downloadEngine(engineName) {
    this.download_package(engineName, "engine", ['--filesystem-writepath', springPlatform.writePath, '--download-engine', engineName])
  }

  downloadGame(gameName) {
    this.download_package(gameName, "game", ['--filesystem-writepath', springPlatform.writePath, '--download-game', gameName])
  }

  downloadMap(mapName) {
    this.download_package(mapName, "map", ['--filesystem-writepath', springPlatform.writePath, '--download-map', mapName])
  }
}

module.exports = new SpringDownloader();
