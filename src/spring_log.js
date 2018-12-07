const { app } = require('electron');
const util = require('util');
const { format } = util;

const log = require('electron-log');

let mainWindow;

log.transports.file.level = 'info';

var logBuffer = [];
var ready = false;

log.transports.console = (msg) => {
  var text = format.apply(util, msg.data);
  console.log(text);
  if (ready && mainWindow) {
    mainWindow.send("log", msg)
  } else {
    logBuffer.push(msg);
  }
}


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
  log: log
}
