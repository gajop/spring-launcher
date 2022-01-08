'use strict';

const fs = require('fs');
const path = require('path');

const log = require('electron-log');

const EXTS_DIR = './exts/';

const normalizedPath = path.join(__dirname, EXTS_DIR);

fs.readdirSync(normalizedPath).forEach(function(file) {
	const extPath = `./${EXTS_DIR}/${file}`;
	if (extPath.endsWith('.js')) {
		log.info(`Including extension: ${extPath}...`);
		try {
			require(extPath);
		} catch (err) {
			log.error(`Failed to load extension: ${extPath}`);
			log.error(err);
		}
	}
});