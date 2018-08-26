const electron = require('electron');
const { app, BrowserWindow, ipcMain, Menu, Tray } = electron;

const { config } = require('./launcher_config');

let mainWindow;
let tray;

// makeSingleInstance

DEBUG = false;
DEBUG = true;


app.on('ready', () => {
  const display = electron.screen.getPrimaryDisplay();
  const sWidth = display.workAreaSize.width;
  const sHeight = display.workAreaSize.height;
  const width = 800;
  const height = 380 + 30;

  let windowOpts = {
    x: (sWidth - width) / 2,
    // y: (sHeight - height) / 2,
    y: 100,
    width: width,
    height: height,
    show: false,

    icon: `${__dirname}/renderer/spring-icon.png`,
  };
  if (!DEBUG) {
    windowOpts.resizable = false;
    //windowOpts.frame = false;
  }
  mainWindow = new BrowserWindow(windowOpts);
  if (!DEBUG) {
    mainWindow.setMenu(null);
  }

  mainWindow.loadFile(`${__dirname}/renderer/index.html`);
  //mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  })

  tray = new Tray(`${__dirname}/renderer/spring-icon.png`);
  var template = [
    // TODO: About dialog that shows URL, author, version, etc.
    // {
    //   role: 'about',
    //   click: () => {
    //     log.info("About clicked");
    //   }
    // },
    {
      // TODO: Proper "show/hide"
      label: "Toggle hide",
      click: (menuItem) => {
        if (mainWindow.isVisible()) {
          //menuItem.label = "Show";
          mainWindow.hide();
        } else {
          mainWindow.show();
          //menuItem.label = "Hide";
        }
      }
    },
    // TODO: Settings dialog for user config
    {role: 'quit'}
  ];
  if (process.platform === 'linux') {
    // template.unshift([{label: 'Spring-Launcher'}]);
  }
  tray.setToolTip('Spring-Launcher: Distribution system for SpringRTS.');
  tray.setContextMenu(Menu.buildFromTemplate(template));


  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    gui.send("config", config.getConfigObj());
    gui.send("all-configs", config.getAvailableConfigs());

    const { wizard } = require('./launcher_wizard.js');

    const dlSteps = wizard.steps.filter(step => step.name != "start")
    gui.send("wizard-list", dlSteps);

    if (config.no_downloads &&
        config.auto_start) {
      wizard.nextStep();
    } else if (config.auto_download) {
      gui.send("wizard-started");
      wizard.nextStep();
    } else {
      gui.send("wizard-stopped");
    }
  });
});

class GUI {
  send(...args) {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send(...args);
    }
  }

  getMainWindow() {
    return mainWindow;
  }
}

const gui = new GUI();

module.exports = {
  gui: gui,
}
