'use strict';

const path = require('path');
const fs = require('fs');

const { ipcRenderer } = require('electron');

const { parseReplay } = require('../replay_utils');

// This worker's goal is to index the replays. For the moment, it simply goes
// once over all the replays at start, and verifies that cache files exists
// for them.
//
// Replays that weren't parsed & cached now will be via `ReadReplayInfo`
// requests anyway, so we don't need to ensure that every replay is always
// indexed.

ipcRenderer.on('start-indexing-replays', (ev, springPath) => {
	fs.readdir(path.join(springPath, 'demos'), (err, files) => {
		files.forEach(async (file) => {
			//	Skip non sdfz files (.cache files)
			if (!file.endsWith('.sdfz')) {
				return;
			}

			try {
				// Parse replays, for the sole purpose of creating the cache files.
				// We ignore the return value because we don't need it here, we're
				// only interested in side effects.
				parseReplay(springPath, path.join('demos', file), true);
			} catch (err) {
				console.error(`Error parsing file: ${file}`);
			}
		});
	});
});
