'use strict';

const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const { existsSync, mkdirSync } = fs;
const assert = require('assert');

const platformName = process.platform;

const { config } = require('./launcher_config');
const { resolveWritePath } = require('./write_path');

var FILES_DIR = 'files';
FILES_DIR = path.resolve(`${__dirname}/../files`);
if (!existsSync(FILES_DIR)) {
	FILES_DIR = path.resolve(`${process.resourcesPath}/../files`);
}

// The following order is necessary:
// 1. Set write dir
// 2. Set logfile based on the writedir
// 3. Start logging

assert(config.title != undefined);
const writePath = resolveWritePath(config.title);

assert(writePath != undefined);
if (!existsSync(writePath)) {
	try {
		mkdirSync(writePath);
	} catch (err) {
		log.error(`Cannot create writePath at: ${writePath}`);
		log.error(err);
	}
}
if (existsSync(FILES_DIR) && existsSync(writePath)) {
	fs.readdirSync(FILES_DIR).forEach(function (file) {
		const srcPath = path.join(FILES_DIR, file);
		const dstPath = path.join(writePath, file);
		// NB: we copy files each time, which is possibly slow
		// if (!existsSync(dstPath)) {
		try {
			fs.copyFileSync(srcPath, dstPath);
		} catch (err) {
			log.error(`Failed to copy file from ${srcPath} tp ${dstPath}`);
			log.error(err);
		}
		//}
	});
}

let prDownloaderBin;
let butlerBin;
if (platformName === 'win32') {
	prDownloaderBin = 'pr-downloader.exe';
	butlerBin = 'butler/windows/butler.exe';
	exports.springBin = 'spring.exe';
} else if (platformName === 'linux') {
	prDownloaderBin = 'pr-downloader';
	butlerBin = 'butler/linux/butler';
	exports.springBin = 'spring';
	// } else if (platformName === 'darwin') {
	// 	prDownloaderBin = 'pr-downloader-mac';
	// 	butlerBin = 'butler'; // TODO: Support Mac?
	// 	exports.springBin = 'Contents/MacOS/spring';
} else {
	log.error(`Unsupported platform: ${platformName}`);
	process.exit(-1);
}

exports.prDownloaderPath = path.resolve(`${__dirname}/../bin/${prDownloaderBin}`);
if (!existsSync(exports.prDownloaderPath)) {
	exports.prDownloaderPath = path.resolve(`${process.resourcesPath}/../bin/${prDownloaderBin}`);
}
exports.butlerPath = path.resolve(`${__dirname}/../bin/${butlerBin}`);
if (!existsSync(exports.butlerPath)) {
	exports.butlerPath = path.resolve(`${process.resourcesPath}/../bin/${butlerBin}`);
}

exports.writePath = writePath;
