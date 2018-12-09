const { app } = require('electron');
const util = require('util');
const { format } = util;
const log = require('electron-log');

const springPlatform = require('./spring_platform');
const { config } = require('./launcher_config');

var logBuffer = [];
var ready = false;
let mainWindow;
log.transports.console = (msg) => {
  var text = format.apply(util, msg.data);
  console.log(text);
  if (ready && mainWindow) {
    mainWindow.send("log", msg)
  } else {
    logBuffer.push(msg);
  }
}

const logPath = `${springPlatform.writePath}/spring-launcher.log`;
const { existsSync, unlinkSync } = require('fs');
if (existsSync(logPath)) {
  unlinkSync(logPath);
}
log.transports.file.file = logPath;
log.transports.file.level = 'info';

log.info(`Log file: ${logPath}`);
log.info(`${app.getName()} - ${app.getVersion()}`);
log.info(`App path: ${app.getAppPath()}`);
log.info(`pr-downloader path: ${springPlatform.prDownloaderPath}`);
log.info(`Write path: ${springPlatform.writePath}`);

log.info(`Launcher configs:\n${JSON.stringify(config.getAvailableConfigs(), null, 4)}`);
log.info(`Default config:\n${JSON.stringify(config.getConfigObj(), null, 4)}`);


const { gui } = require('./launcher_gui.js');

app.on('ready', () => {
  if (!gui) {
    return;
  }
  mainWindow = gui.getMainWindow();

  setTimeout(() => {
    logBuffer.forEach((msg) => {
      mainWindow.send("log", msg)
    });
    logBuffer = [];
    ready = true;
  }, 1000);
})

module.exports = {
  log: log,
  logPath: logPath
}
