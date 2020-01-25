// API file to be included by modules

const fs = require("fs");
const path = require("path");

const log = require('electron-log');

const { bridge } = require('./spring_bridge');
const { config } = require('./launcher_config');
const { wizard } = require('./launcher_wizard.js');

const EXTS_DIR = "exts";

var dev_extension_loader;

function loadExtension(extPath) {
  log.info(`Including extension: ${extPath}...`);
  return require(extPath);
}

bridge.on('listening', () => {
  const normalizedPath = path.join(__dirname, EXTS_DIR);
  fs.readdirSync(normalizedPath).forEach(function(file) {
    if (file.endsWith(".js")) {
      const extension = loadExtension(`./${EXTS_DIR}/${file}`);
      if (file == 'dev_extension_loader.js') {
        dev_extension_loader = extension;
      }
    }
  });
});

wizard.on("launched", () => dev_extension_loader.setEnabled(config.load_dev_exts));

module.exports = {
  bridge: bridge,
  loadExtension: loadExtension
}
