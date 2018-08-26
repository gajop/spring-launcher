const log = require('electron-log');

const platformName = process.platform

if (platformName === "win32") {
  exports.prDownloaderPath = "./bin/pr-downloader.exe";
  exports.springBin = "spring.exe";
} else if (platformName === "linux") {
  exports.prDownloaderPath = "./bin/pr-downloader";
  exports.springBin = "spring";
} else {
  log.error(`Unsupported platform: ${platformName}`);
  process.exit(-1);
}

exports.writePath = './game_package';
//console.info(`Detected platform: ${platformName}`);
