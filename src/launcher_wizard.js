const EventEmitter = require('events');
const { app, BrowserWindow, ipcMain } = require('electron');

const log = require('electron-log');

const { config } = require('./launcher_config');
const { gui } = require('./launcher_gui.js');
const updater = require('./updater');
const springDownloader = require('./spring_downloader');
const launcher = require('./engine_launcher');

let mainWindow;
app.on('ready', () => {
  mainWindow = gui.getMainWindow();
})

class Wizard extends EventEmitter {
  constructor() {
    super();
    this.steps = this.generateSteps();
    this.started = false;
  }

  generateSteps() {
    var steps = [];
    if (!config.no_downloads) {
      steps.push({
        name: "launcher_update",
        action: () => {
          log.info("Checking for launcher update");
          if (false && app.isPackaged()) {
            updater.checkForUpdates();
          } else {
            setTimeout(() => {
              this.nextStep()
            }, 1000);
          }
        }
      })

      config.downloads.engines.forEach((engine) => {
        steps.push({
          name: "engine",
          item: engine,
          action: () => {
            springDownloader.downloadEngine(engine);
          }
        })
      });

      config.downloads.games.forEach((game) => {
        steps.push({
          name: "game",
          item: game,
          action: () => {
            springDownloader.downloadGame(game);
          }
        })
      });

      config.downloads.maps.forEach((map) => {
        steps.push({
          name: "map",
          item: map,
          action: () => {
            springDownloader.downloadMap(map);
          }
        })
      });
    }

    steps.push({
      name: "start",
      action: (step) => {
        setTimeout(() => {
          if (launcher.state != "failed") {
            mainWindow.hide();
          }
        }, 1000);
        // launcher.on("started", () => {
        //   mainWindow.hide();
        // })

        launcher.launch(config.downloads.engines[0], config.start_args);

        gui.send("launch-started")

        launcher.on('stdout', (text) => {
          log.info(text);
          // console.log(text);
        });

        launcher.on('stderr', (text) => {
          log.warn(text);
          // console.warn(text);
        });

        launcher.on("finished", () => {
          app.quit();
          this.steps.push(step);
          setTimeout(() => {
            gui.send("launch-finished")
          }, 100);
        });
        launcher.on("failed", (code) => {
          mainWindow.show();
          this.steps.push(step);
          setTimeout(() => {
            gui.send("launch-failed", code)
          }, 100);
        });
      }
    })

    return steps;
  }

  nextStep(forced) {
    const step = this.steps.shift();
    if (step === undefined) {
      log.warn(`No more steps to do.`);
      gui.send("wizard-stopped");
      gui.send("wizard-finished");
      this.started = false;
      return false;
    }
    if (!this.started) {
      gui.send("wizard-started");
      this.started = true;
    }

    log.info(`Step: ${JSON.stringify(step, null, 4)}`);

    if (step.name != "start") {
      gui.send("wizard-next-step", step);
    } else {
      if (!(config.auto_start || forced)) {
        gui.send("wizard-stopped");
        gui.send("wizard-finished");
        this.steps.push(step);
        return false;
      }
    }

    step.action(step);
    return true;
  }
}

ipcMain.on("wizard-next", () => {
  wizard.nextStep(true);
});


const wizard = new Wizard();

module.exports = {
  wizard: wizard,
}
