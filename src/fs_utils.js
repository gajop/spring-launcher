'use strict';

const fs = require('fs');
const path = require('path');

const springPlatform = require('./spring_platform');

const TMP_DIR = path.join(springPlatform.writePath, 'tmp');

function makeParentDir(filepath) {
	const destinationParentDir = path.dirname(filepath);
	makeDir(destinationParentDir);
}

function makeDir(dirpath) {
	if (!fs.existsSync(dirpath)) {
		fs.mkdirSync(dirpath, { recursive: true });
	}
}

let tempCounter = 0;
function getTemporaryFileName(baseName) {
	while (true) {
		tempCounter++;
		const temp = path.join(TMP_DIR, `${baseName}.${tempCounter}`);
		if (!fs.existsSync(temp)) {
			return temp;
		}
	}
	// unreachable
}

function removeTemporaryFiles() {
	if (fs.existsSync(TMP_DIR)) {
		fs.rmdirSync(TMP_DIR, { recursive: true });
	}
}


module.exports = {
	getTemporaryFileName: getTemporaryFileName,
	removeTemporaryFiles: removeTemporaryFiles,
	makeParentDir: makeParentDir,
	makeDir: makeDir,
	TMP_DIR: TMP_DIR
};
