const { EventEmitter, once } = require('events');
const fs = require('fs');
const os = require("os");

const log = require('electron-log');

const { writePath } = require('./spring_platform');

class Springsettings extends EventEmitter {
	applyDefaultsOnSettings(defaults, springsettingsPath) {
		var fileContent = "";
		try {
			fileContent = fs.readFileSync(springsettingsPath).toString();
		} catch (err) {
		}
		const lines = fileContent.split(/\r?\n/g);

		var newContent = "";
		var keysSeen = {};
		// read existing settings for any different values
		for (var i = 0; i < lines.length; i++) {
			const line = lines[i];

			var keyvalue = line.split(/=/);
			if (keyvalue.length != 2) {
				newContent += line + os.EOL;
				continue;
			}
			const key = keyvalue[0].trim();
			const value = keyvalue[1].trim();

			if (defaults[key] === null) {
				newContent += line + os.EOL;
			} else {
				keysSeen[key] = true;
				if (defaults[key] == value) {
					newContent += line + os.EOL;
				} else {
					newContent += key + ' = ' + value + os.EOL;
				}
			}
		}

		// add any keys that aren't in the current config
		for (var key in defaults) {
			if (keysSeen[key]) {
				continue;
			}
			newContent += key + ' = ' + defaults[key] + os.EOL;
		}
		return newContent;
	}

	applyDefaults() {
		const defaults = require('./springsettings.json');
		const springsettingsPath = `${writePath}/springsettings.cfg`;
		const newSpringsettings = this.applyDefaultsOnSettings(defaults, springsettingsPath);
		fs.writeFileSync(springsettingsPath, newSpringsettings);
	}
}

exports.springsettings = new Springsettings();