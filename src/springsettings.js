'use strict';

const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');

const { writePath } = require('./spring_platform');

class Springsettings extends EventEmitter {

	// Returns instance of Map, each config line in it's own entry.
	// Map preserves insertion order, so it can be iterated in the same order as
	// in the file, and it also contains comments, under unique
	// Symbol('comment') keys.
	#readSettings(springsettingsPath) {
		let fileContent = '';
		try {
			fileContent = fs.readFileSync(springsettingsPath).toString();
		} catch (err) {
			// ignore errors
		}
		const lines = fileContent.split(/\r?\n/g);
		if (lines[lines.length - 1] === '') {
			lines.pop();
		}
		const settings = new Map();
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.trim() === '' || line.trim()[0] === '#') {
				settings.set(Symbol('comment'), line);
				continue;
			}
			const keyvalue = line.split(/=/, 2);
			if (keyvalue.length != 2) {
				throw new Error(
					`Error loading ${springsettingsPath}: Cannot parse line ` +
					`${i+1} ("${line}"): it's not a comment or option assignment`);
			}
			settings.set(keyvalue[0].trim(), keyvalue[1].trim());
		}
		return settings;
	}

	#writeSettings(settings, springsettingsPath) {
		const result = [];
		for (const [key, value] of settings) {
			if (typeof key === 'symbol' && key.description === 'comment') {
				result.push(value);
			} else if (typeof key === 'string') {
				result.push(`${key} = ${value}`);
			} else {
				throw new Error(`internal error: unexpected key in map: ${key}`);
			}
		}
		fs.writeFileSync(springsettingsPath, result.join(os.EOL) + os.EOL);
	}

	#applyDefaults(settings, defaults) {
		for (const key in defaults) {
			if (!settings.has(key)) {
				settings.set(key, defaults[key]);
			}
		}
	}

	#applyOverrides(settings, overrides) {
		for (const key in overrides) {
			if (overrides[key] === null) {
				settings.delete(key);
			} else {
				settings.set(key, overrides[key]);
			}
		}
	}

	applyDefaultsAndOverrides(overrides) {
		const defaults = require('./springsettings.json');
		const springsettingsPath = `${writePath}/springsettings.cfg`;
		const settings = this.#readSettings(springsettingsPath);
		this.#applyDefaults(settings, defaults);
		this.#applyOverrides(settings, overrides);
		this.#writeSettings(settings, springsettingsPath);
	}
}

exports.springsettings = new Springsettings();