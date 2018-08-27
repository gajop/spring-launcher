const log = require('electron-log');
const path = require('path');
const fs = require('fs');

const platformName = process.platform

if (platformName === "win32") {
  exports.prDownloaderPath = path.resolve(`${__dirname}/../bin/pr-downloader.exe`);
  exports.springBin = "spring.exe";
} else if (platformName === "linux") {
  exports.prDownloaderPath = path.resolve(`${__dirname}/../bin/pr-downloader`);
  if (!fs.existsSync(exports.prDownloaderPath)) {
    exports.prDownloaderPath = path.resolve(`${__dirname}/../../../bin/pr-downloader`);
  }
  exports.springBin = "spring";
} else {
  log.error(`Unsupported platform: ${platformName}`);
  process.exit(-1);
}

log.info(`pr-downloader path: ${exports.prDownloaderPath}`);

exports.writePath = './game_package';
//console.info(`Detected platform: ${platformName}`);
