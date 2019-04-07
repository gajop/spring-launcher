const log = require('electron-log');
const assert = require('assert');

const configDefault = {
  "package": {
    // Possible values are 'darwin', 'linux', 'win32'
    "platform": "all",
  },

  "display": {
    "title": "Spring Launcher"
  },

  "isolation": true,
  "auto_download": false,
  "auto_start": false,
  "no_downloads": false,
  "no_start_script": false,
  "load_dev_exts": false,

  "downloads": {
    "games": [],
    "maps": [],
    "engines": [],
  },

  "launch": {
    "start_args": [],
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
var availableConfigs = [];
var currentConfig;

function canUse(config) {
  if (config.package.platform != "all") {
    log.info("process.platform", process.platform, config.package.platform);
    if (config.package.platform != process.platform) {
      return false;
    }
  }
  return true;
}

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
function mergeDeep(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

const configFile = require("./config.json");
configDefault.title = configFile.title;
configFile.setups.forEach((c) => {
  // config = JSON.parse(JSON.stringify(configDefault));
  // const config = {...configDefault, ...c};
  // const config = Object.assign(c, configDefault);
  const configDefaultCopy = JSON.parse(JSON.stringify(configDefault));
  const config = mergeDeep(configDefaultCopy, c);
  configs.push(config);

  if (canUse(config)) {
    availableConfigs.push(config);
    if (!currentConfig) {
      currentConfig = config;
    }
  }
  // exports.start_args = (config.start_args != undefined) ? config.start_args : [];

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
})

const proxy = new Proxy({
    setConfig: function(id) {
      var found = false;
      availableConfigs.forEach((cfg) => {
        if (cfg.package.id == id) {
          currentConfig = cfg;
          found = true;
        }
      });
      if (!found) {
        log.error(`No config with ID: ${id} - ignoring`);
        return false;
      } else {
        return true;
      }
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
    } else if (configFile[name] != undefined) {
      return configFile[name];
    } {
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
