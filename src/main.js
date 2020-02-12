const { app, ipcMain } = require('electron');
const settings = require('electron-settings');

const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) {
  app.quit();
  return;
}

const { log } = require('./spring_log.js');
const { config } = require('./launcher_config');
const { gui } = require('./launcher_gui.js');
const { wizard } = require('./launcher_wizard.js');
const springDownloader = require('./spring_downloader');
const autoUpdater = require('./updater');
const springApi = require('./spring_api');
const launcher = require('./engine_launcher');
const { writePath } = require('./spring_platform');
const log_uploader = require('./log_uploader');
const file_opener = require('./file_opener');

springDownloader.on('started', (downloadItem, type, args) => {
  log.info(`Download started: ${downloadItem}, ${type}, ${args}`);
  gui.send('dl-started', downloadItem, type, args);
});

springDownloader.on('progress', (downloadItem, current, total) => {
  if (total < 1024 * 1024) {
    return; // ignore downloads less than 1MB (probably not real downloads!)
  }
  log.info(`Download progress: ${downloadItem}, ${current}, ${total}`);
  gui.getMainWindow().setProgressBar(current / total);
  gui.send('dl-progress', downloadItem, current, total);
});

springDownloader.on('finished', (downloadItem) => {
  log.info(`Download finished: ${downloadItem}`);
  gui.send('dl-finished', downloadItem);
  wizard.nextStep();
});

springDownloader.on('failed', (downloadItem, msg) => {
  log.error(`${msg}`);
  gui.send('dl-failed', downloadItem, msg);
});

launcher.on('stdout', (text) => {
  log.info(text);
});

launcher.on('stderr', (text) => {
  log.warn(text);
});

launcher.on("finished", (code) => {
  log.info(`Spring finished with code: ${code}`);
  app.quit();
  setTimeout(() => {
    gui.send("launch-finished")
  }, 100);
});

launcher.on("failed", (error) => {
  log.error(error);
  const mainWindow = gui.getMainWindow();
  mainWindow.show();
  setTimeout(() => {
    gui.send("launch-failed", error)
  }, 100);
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

autoUpdater.on('error', (error) => {
  log.error(`Application failed to self-update. Error: ${error}`)
  log.info('Proceeding to next step.');
  wizard.nextStep();
})

function setConfig(cfgName) {
  config.setConfig(cfgName);
  gui.send("config", config.getConfigObj());
  settings.set('config', cfgName);
  wizard.generateSteps();
  const steps = wizard.steps
    .filter(step => step.name != "start")
    .map(step => {
      // we have to make a copy of these steps because IPC shouldn't contain functions (step.action)
      return {
        name: step.name,
        item: step.item
      }
    });
  gui.send("wizard-list", steps);
}

ipcMain.on("change-cfg", (e, cfgName) => {
  setConfig(cfgName);
});

ipcMain.on("log-upload-ask", (e) => {
  log_uploader.upload_ask();
});

ipcMain.on("open-install-dir", (e) => {
  if (file_opener.open(writePath)) {
    log.info(`User opened install directory: ${writePath}`);
  } else {
    log.error(`Failed to open install directory: ${writePath}`);
  }
});

app.on('ready', () => {
  if (!gui) {
    return;
  }
  // Use local settings file
  settings.setPath(`${writePath}/launcher_cfg.json`)
  const oldConfig = settings.get('config');
  if (oldConfig) {
    if (!setConfig(oldConfig)) {
      // forget invalid configs
      settings.set('config', undefined);
    }
  }
})
