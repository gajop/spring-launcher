const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const { existsSync, mkdirSync } = fs;
const { app } = require('electron');
const assert = require('assert');

const { config } = require('./launcher_config');

// The following order is necessary:
// 1. Set write dir
// 2. Set logfile based on the writedir
// 3. Start logging

// bad path (mounted)
// const writePath = path.join(app.getPath('exe'), config.title);
// bad path (relative to current directory, not app directory)
// const writePath = `./${config.title}`;
assert(config.title != undefined);
let dirPrefix = app.getPath('appData');
if (process.env.PORTABLE_EXECUTABLE_DIR != null) {
  dirPrefix = process.env.PORTABLE_EXECUTABLE_DIR;
}
const writePath = path.join(dirPrefix, config.title);
assert(writePath != undefined);
if (!existsSync(writePath)){
  mkdirSync(writePath);
}

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
if (!existsSync(exports.prDownloaderPath)) {
  exports.prDownloaderPath = path.resolve(`${process.resourcesPath}/../bin/${prDownloaderBin}`);
}
exports.writePath = writePath;
