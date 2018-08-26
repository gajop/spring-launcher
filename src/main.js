const fs = require('fs');
const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');

const { log } = require('./spring_log.js');

const { config } = require('./launcher_config');

const settings = require('electron-settings');

const { gui } = require('./launcher_gui.js');
const { wizard } = require('./launcher_wizard.js');
const springDownloader = require('./spring_downloader');
const autoUpdater = require('./updater');
const springApi = require('./spring_api');

//console.log(log.transports.file.findLogPath())
//console.log(fs.readFileSync(log.transports.file.findLogPath(), 'utf8'))

springDownloader.on('started', (downloadItem, type, args) => {
  log.info(`Download started: ${downloadItem}, ${type}, ${args}`);
  gui.send('dl-started', downloadItem, type, args);
});

springDownloader.on('progress', (downloadItem, current, total) => {
  if (total < 1024 * 1024) {
    return; // ignore downloads less than 1MB (probably not real downloads!)
  }
  log.info(`Download progress: ${downloadItem}, ${current}, ${total}`);
  gui.send('dl-progress', downloadItem, current, total);
});

springDownloader.on('finished', (downloadItem) => {
  log.info(`Download finished: ${downloadItem}`);
  gui.send('dl-finished', downloadItem);
  wizard.nextStep();
});

springDownloader.on('failed', (downloadItem, error) => {
  log.info(`Download failed: ${downloadItem}: ${error}`);
  gui.send('dl-failed', downloadItem, error);
});

autoUpdater.on('update-available', () => {
  gui.send('dl-started', "autoupdate");

  autoUpdater.on('download-progress', (d) => {
    console.info(`Self-download progress: ${d.percent}`);
    gui.send('dl-progress', "autoUpdate", d.percent, 100);
  });
  autoUpdater.on('update-downloaded', () => {
    console.info("Self-update downloaded");
    gui.send('dl-finished', "autoupdate");
  });

  autoUpdater.downloadUpdate();
})

autoUpdater.on('update-not-available', () => {
  log.info("No update available.");
  wizard.nextStep();
});

autoUpdater.on('update-downloaded', () => {
  setImmediate(() => autoUpdater.quitAndInstall())
});

function setConfig(cfgName) {
  config.setConfig(cfgName);

  gui.send("config", config.getConfigObj());
  wizard.generateSteps();

  settings.set('config', cfgName);
}

ipcMain.on("change-cfg", (e, cfgName) => {
  setConfig(cfgName);
});

app.on('ready', () => {
  if (!gui) {
    return;
  }
  const oldConfig = settings.get('config');
  if (oldConfig) {
    setConfig(oldConfig);
  }
})
