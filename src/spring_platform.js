const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const assert = require('assert');

const { config } = require('./launcher_config');


const platformName = process.platform

let prDownloaderBin;
if (platformName === "win32") {
  prDownloaderBin = 'pr-downloader.exe';
  exports.springBin = "spring.exe";
} else if (platformName === "linux") {
  prDownloaderBin = 'pr-downloader';
  exports.springBin = "spring";
} else {
  log.error(`Unsupported platform: ${platformName}`);
  process.exit(-1);
}

exports.prDownloaderPath = path.resolve(`${__dirname}/../bin/${prDownloaderBin}`);
if (!fs.existsSync(exports.prDownloaderPath)) {
  exports.prDownloaderPath = path.resolve(`${process.resourcesPath}/../bin/${prDownloaderBin}`);
}

log.info(`pr-downloader path: ${exports.prDownloaderPath}`);

// exports.writePath = './game_package';
//console.info(`Detected platform: ${platformName}`);


assert(config.title != undefined);

const writePath = path.join(app.getAppPath(), config.title);
log.info(`write path: ${writePath}`);
exports.writePath = writePath;
