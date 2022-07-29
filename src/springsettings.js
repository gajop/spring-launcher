'use strict';

const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');

const { writePath } = require('./spring_platform');

class Springsettings extends EventEmitter {
	// Parsing according to implementation in rts/System/Config/ConfigSource.cpp
	readSettings(springsettingsPath) {
		var fileContent = '';
		try {
			fileContent = fs.readFileSync(springsettingsPath).toString();
		} catch (err) {
			// ignore errors
		}
		const lines = fileContent.split(/\r?\n/g);
		if (lines[lines.length-1] === '') lines.pop();
		const values = {};
		const comments = {};
		let comment = '';
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.trim() === '' || line.trim()[0] === '#') {
				comment += line + '\n';
				continue;
			}
			const keyvalue = line.split(/=/, 2);
			if (keyvalue.length != 2) {
				throw new Error(
					`Error loading ${springsettingsPath}: Cannot parse line ` +
					`${i+1} ("${line}"): it's not a comment or option assignment`);
			}
			const key = keyvalue[0].trim();
			const value = keyvalue[1].trim();

			values[key] = value;
			comments[key] = comment;
			comment = '';
		}
		return {
			values: values,
			comments: comments,
			endComment: comment,
		};
	}

	writeSettings(settings, springsettingsPath) {
		const valuesKeys = Object.keys(settings.values).sort();
		const commentKeys = Object.keys(settings.comments).sort();
		const result = [];
		let commi = 0;
		for (let vali = 0; vali < valuesKeys.length; vali++) {
			const valk = valuesKeys[vali];
			for (; commi < commentKeys.length && commentKeys[commi] <= valk; commi++) {
				result.push(settings.comments[commentKeys[commi]]);
			}
			result.push(valk + ' = ' + settings.values[valk] + '\n');
		}
		for (; commi < commentKeys.length; commi++) {
			result.push(settings.comments[commentKeys[commi]]);
		}
		result.push(settings.endComment);
		fs.writeFileSync(springsettingsPath, result.join(''));
	}

	applyDefaultsAndOverrides(overrides) {
		const defaults = require('./springsettings.json');
		const springsettingsPath = `${writePath}/springsettings.cfg`;
		const settings = this.readSettings(springsettingsPath);
		for (const key in defaults) {
			if (!(key in settings.values)) {
				settings.values[key] = defaults[key];
			}
		}
		for (const key in overrides) {
			if (overrides[key] === null) {
				delete settings.values[key];
			} else {
				settings.values[key] = overrides[key];
			}
		}
		this.writeSettings(settings, springsettingsPath);
	}
}

exports.springsettings = new Springsettings();