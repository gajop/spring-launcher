const log = require('electron-log');

const configDefault = {
  "package": {
    "platform": "all",
  },

  "auto_download": false,
  "auto_start": false,
  "no_downloads": false,

  "downloads": {
    "games": [],
    "maps": [],
    "engines": [],
  }
}

// function _get(obj, key, default) {
//   if (obj[key] == undefined) {
//     return default[key]
//   } else if (typeof(obj) == "object") {
//     return _get(obj[key])
//   }
// }

var configs = [];
var availableConfigs = {};
var currentConfig;

function canUse(config) {
  return true;
}

(require("./config.json")).forEach((c) => {
  // config = JSON.parse(JSON.stringify(configDefault));
  let config = {...configDefault, ...c};
  configs.push(config);

  if (canUse(config)) {
    availableConfigs[config.package.id] = config;
    if (!currentConfig) {
      currentConfig = config;
    }
  }
  // if (c.package)
  // config.auto_download = (config.auto_download != undefined)
  // exports.auto_start = config.auto_start
  // exports.no_downloads = config.no_downloads
  //
  // exports.game_title = config.game_title
  //
  // exports.launcher_game_id = config.launcher_game_id
  //
  // exports.games = (config.games != undefined) ? config.games : [];
  // exports.maps = (config.maps != undefined) ? config.maps : [];
  // exports.engines = (config.engines != undefined) ? config.engines : [];
  //
  // exports.start_args = (config.start_args != undefined) ? config.start_args : [];
})

log.info(`Launcher configs:\n${JSON.stringify(configs, null, 4)}`);
log.info(`Default config:\n${JSON.stringify(currentConfig, null, 4)}`);

const proxy = new Proxy({
    setConfig: function(id) {
      currentConfig = availableConfigs[id];
    },
    getAvailableConfigs: function() {
      return availableConfigs;
    },
    getConfigObj: function() {
      return currentConfig;
    }
  },
  {
  get: function(target, name) {
    if (target[name] != undefined) {
      return target[name];
    } else {
      return currentConfig[name];
    }
  }
})

module.exports = {
  config: proxy,
}

// exports.setConfig = (id) => {
//   currentConfig = configs[id];
// }
//
// exports.availableConfigs = () => {
//   return configs;
// }
