'use strict';

const platformName = process.platform;
const platformMap = {
	'win32': 'windows-amd64',
	'linux': 'linux-amd64',
	'darwin': 'darwin-amd64',
	'any': 'any'
};
const defaultPlatform = platformMap[platformName];
const defaultChannel = 'main';
const defaultVersion = 'latest';

// fullName format: 'user/repo@channel:version#platform'
// channel, version and platform are optional
const fullNameRegex = new RegExp(
	'^' +
	'(?<user>[A-Za-z0-9_\\-\\.]+)' +
	'/' +
	'(?<repo>[A-Za-z0-9_\\-\\.]+)' +
	'(@(?<channel>[A-Za-z0-9]+))?' +
	'(:(?<version>[0-9]+))?' +
	'(#(?<platform>windows-amd64|linux-amd64|darwin-amd64|any))?' +
	'$'
);

function parse(fullName) {
	const match = fullNameRegex.exec(fullName);
	if (match === null) {
		throw `Failed to parse: ${fullName}`;
	}

	let obj = {
		user: match.groups.user,
		repo: match.groups.repo,
	};

	if (match.groups.version != null) {
		obj.version = parseInt(match.groups.version);
	}
	if (match.groups.channel != null) {
		obj.channel = match.groups.channel;
	}
	if (match.groups.platform != null) {
		obj.platform = match.groups.platform;
	}

	return obj;
}

function fillEmptyWithDefaults(obj) {
	obj.version = obj.version != null ? obj.version : defaultVersion;
	obj.channel = obj.channel != null ? obj.channel : defaultChannel;
	obj.platform = obj.platform != null ? obj.platform : defaultPlatform;
	return obj;
}

function parseWithDefaults(fullName) {
	return fillEmptyWithDefaults(parse(fullName));
}

function fillChannelPlatform(obj, pkgInfo) {
	// If channel is specified require an exact match.
	// If no channel is specified prefer main but accept anything
	const matchChannelExactly = obj.channel != null;
	let channel = null;
	let platforms = null;
	for (const [remoteChannel, remotePlatforms] of Object.entries(pkgInfo['channels'])) {
		if (matchChannelExactly) {
			if (remoteChannel === obj.channel) {
				channel = remoteChannel;
				platforms = remotePlatforms;
				break;
			}
		} else {
			if (channel == null || remoteChannel === 'main') {
				channel = remoteChannel;
				platforms = remotePlatforms;

				if (remoteChannel === 'main') {
					break;
				}
			}
		}
	}

	if (channel == null) {
		throw 'No matching channel found';
	}

	// If platform is specified (as non-any) require an exact match.
	// If no platform is specified prefer native, but accept the 'any' platform.
	// Do not accept non-native platforms.
	const matchPlatformExactly = obj.platform != null && obj.platform != 'any';
	let platform = null;
	for (const remotePlatform of platforms) {
		if (matchPlatformExactly) {
			if (obj.platform === remotePlatform) {
				platform = remotePlatform;
				break;
			}
		} else {
			if (remotePlatform == 'any') {
				platform = remotePlatform;
			} else if (remotePlatform == defaultPlatform) {
				platform = defaultPlatform;
				break;
			}
		}
	}

	if (platform == null) {
		throw 'No matching platform found';
	}

	obj.channel = channel;
	obj.platform = platform;
	return obj;
}

module.exports = {
	parse: parse,
	parseWithDefaults: parseWithDefaults,
	fillEmptyWithDefaults: fillEmptyWithDefaults,
	fillChannelPlatform: fillChannelPlatform,
	defaultChannel: defaultChannel,
	defaultPlatform: defaultPlatform,
};
