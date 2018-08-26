// API file to be included by modules

const fs = require("fs");
const path = require("path");

const log = require('electron-log');

const { bridge } = require('./spring_bridge');

EXTS_DIR = "exts";

bridge.on('listening', () => {
  const address = bridge.server.address();
  const json = JSON.stringify({
    address: address.address,
    port: address.port
  });
  const fs = require('fs');
  fs.writeFile('server-info.json', json, 'utf8', () => {
    log.debug("Written connection details to server-info.json");
  });


  const normalizedPath = path.join(__dirname, EXTS_DIR);
  fs.readdirSync(normalizedPath).forEach(function(file) {
    const extPath = `./${EXTS_DIR}/` + file;
    log.info(`Including extension: ${extPath}...`);
    require(extPath);
  });
});


module.exports = {
  bridge: bridge,
}
