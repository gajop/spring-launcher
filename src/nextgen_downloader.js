'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

const log = require('electron-log');

const ButlerDownload = require('./butler_dl');
const ButlerApply = require('./butler_apply');
const springPlatform = require('./spring_platform');
const { parse, fillChannelPlatform } = require('./nextgen_version_parse');
const { makeParentDir, makeDir } = require('./fs_utils');

const isDev = false;
const PKG_URL = isDev ? 'http://0.0.0.0:8000/pkg' : 'https://content.spring-launcher.com/pkg';
const FALLBACK_URL = isDev ? PKG_URL : 'https://spring-launcher.ams3.digitaloceanspaces.com/pkg';
const PKG_DIR = `${springPlatform.writePath}/pkgs`;

const PKG_INFO_CACHE_TIME = 3600;
const LATEST_VERSION_CACHE_TIME = 300;

// TODO 3rd April:
// Support downloading based on Spring path (game, map or engine full name)
// Fix interrupting a patch-apply resulting in incorrect local version information (might lag by one)

// TODO: later
// Multiple local channels (main, test..)
// Multiple local versions (same channel..?)
// Report downloads to some service
// Allow custom path (not just game)
// sync -> async for all IO operations?

const SYSTEM_VERSION = 3;

class NextGenDownloader extends EventEmitter {
	constructor() {
		super();

		/*
		// TODO: or not TODO
		// Check if any patches were in progress and correct any mistakes
		let inProgressFile = `${PKG_DIR}/.inprogress`;
		if (fs.existsSync(inProgressFile)) {
			const inProgress = JSON.parse(fs.readFileSync(inProgressFile));

			inProgress['originalFile'] = '';
			const localVersion = this.queryLocalVersion(inProgress['urlPart']);

			this.updateLocalVersion(inProgress['name'], resolvedVersion);

			fs.unlinkSync(inProgressFile);
		}
		*/

		this.systemVersionCheck();

		this.butlerDl = new ButlerDownload();
		this.butlerApply = new ButlerApply();

		// this.butlerDl.on('aborted', msg => {
		// 	this.emit('aborted', this.name, msg);
		// });

		this.butlerDl.on('warn', msg => {
			log.warn(msg);
		});

		this.butlerApply.on('warn', msg => {
			log.warn(msg);
		});
	}

	systemVersionCheck() {
		const existingVersion = this.getSystemVersion();

		if (existingVersion == SYSTEM_VERSION) {
			return;
		}

		log.info(`System upgrade: ${existingVersion} -> ${SYSTEM_VERSION}`);

		if (fs.existsSync(PKG_DIR)) {
			fs.rmdirSync(PKG_DIR, { recursive: true });
		}
		fs.mkdirSync(PKG_DIR);

		const systemVersionJson = path.join(PKG_DIR, 'system.json');
		fs.writeFileSync(systemVersionJson, JSON.stringify({
			version: SYSTEM_VERSION
		}));
	}

	getSystemVersion() {
		const systemVersionJson = path.join(PKG_DIR, 'system.json');
		if (!fs.existsSync(systemVersionJson)) {
			return 0;
		}

		try {
			return JSON.parse(fs.readFileSync(systemVersionJson))['version'];
		} catch (err) {
			log.info(`Failed to parse ${systemVersionJson}, resetting`);
			fs.unlinkSync(systemVersionJson);
			return 0;
		}
	}

	async download(fullName) {
		try {
			await this.downloadInternal(fullName);
		} catch (err) {
			this.emit('failed', fullName, `Download failed ${fullName}`);
			log.error(err);
		}
	}

	async downloadInternal(fullName) {
		let parsed = parse(fullName);
		const name = parsed.user + '/' + parsed.repo;
		this.emit('started', `${fullName}: metadata`);

		const pkgInfo = await this.queryPackageInfo(name);

		parsed = fillChannelPlatform(parsed, pkgInfo);
		const channel = parsed.channel;
		const platform = parsed.platform;
		const versionID = parsed.version;
		const urlPart = `${name}/${channel}/${platform}`;

		const localVersion = this.queryLocalVersion(name);
		const targetVersion = await (
			versionID != null
				? this.queryRemoteVersion(urlPart, versionID)
				: this.queryLatestVersion(urlPart)
		);

		if (localVersion != null) {
			if (localVersion['version'] == targetVersion['version']) {
				log.info(`No download necessary for ${fullName}`);

				const rapidTag = pkgInfo['rapid'];
				if (rapidTag != null && versionID == null) {
					const versionsGz = path.join(springPlatform.writePath, `rapid/repos.springrts.com/${rapidTag}/versions.gz`);
					if (!fs.existsSync(versionsGz)) {
						this.maybeUpdateRapid(pkgInfo, targetVersion);
					}
				}

				this.emit('finished', fullName);
				return;
			}
		}

		await this.downloadPackage(pkgInfo, fullName, name, urlPart, localVersion, targetVersion);
		this.updateLocalVersion(name, targetVersion);
		if (versionID == null) {
			// TODO: also fill this in case versionID is specified as latest
			this.maybeUpdateRapid(pkgInfo, targetVersion);
		}

		this.emit('finished', name);
	}

	async downloadMetadata(fullName) {
		await this.downloadMetadataInternal(fullName).catch(err => {
			log.error(err);
			log.info(typeof err);
			throw err;
		});
	}

	// DRY this and downloadInternal
	async downloadMetadataInternal(fullName) {
		let parsed = parse(fullName);
		const name = parsed.user + '/' + parsed.repo;
		this.emit('started', `${fullName}: metadata`);

		const pkgInfo = await this.queryPackageInfo(name);

		parsed = fillChannelPlatform(parsed, pkgInfo);
		const channel = parsed.channel;
		const platform = parsed.platform;
		const versionID = parsed.version;
		const urlPart = `${name}/${channel}/${platform}`;

		await (
			versionID != null
				? this.queryRemoteVersion(urlPart, versionID)
				: this.queryLatestVersion(urlPart)
		);
	}

	async queryPackageInfo(name) {
		return this.queryWithCache(`${name}/package-info.json`, PKG_INFO_CACHE_TIME);
	}

	queryLocalVersion(name) {
		const versionInfo = `${PKG_DIR}/${name}/local-version.json`;
		if (!fs.existsSync(versionInfo)) {
			return null;
		}
		return JSON.parse(fs.readFileSync(versionInfo));
	}

	async queryLatestVersion(urlPart) {
		return this.queryWithCache(`${urlPart}/latest.json`, LATEST_VERSION_CACHE_TIME);
	}

	async queryRemoteVersion(urlPart, version) {
		const versionInfo = this.queryFileIfNotExist(`${urlPart}/patch/${version}.json`);
		return {
			version: version,
			name: versionInfo['name']
		};
	}

	async queryWithCache(baseUrl, cacheTime) {
		const localFile = `${PKG_DIR}/${baseUrl}`;
		let shouldQueryRemote = true;
		if (fs.existsSync(localFile)) {
			const stat = fs.statSync(localFile);
			const now = new Date();
			if (now - stat.mtime < cacheTime * 1000) {
				shouldQueryRemote = false;
			}
		}

		while (true) {
			if (shouldQueryRemote) {
				await downloadFileWithFallback(this.butlerDl, baseUrl, localFile);
			}
			try {
				return JSON.parse(fs.readFileSync(localFile));
			} catch (err) {
				if (shouldQueryRemote) {
					// we already queried once, nothing we can do
					throw err;
				} else {
					// try to query the file again
					shouldQueryRemote = true;
				}
			}
		}
	}

	async queryFileIfNotExist(baseUrl) {
		const localFile = `${PKG_DIR}/${baseUrl}`;
		let shouldQueryRemote = !fs.existsSync(localFile);

		while (true) {
			if (shouldQueryRemote) {
				await downloadFileWithFallback(this.butlerDl, baseUrl, localFile);
			}
			try {
				return JSON.parse(fs.readFileSync(localFile));
			} catch (err) {
				if (shouldQueryRemote) {
					// we already queried once, nothing we can do
					throw err;
				} else {
					// try to query the file again
					shouldQueryRemote = true;
				}
			}
		}
	}

	async downloadPackage(pkgInfo, fullName, name, urlPart, localVersion, targetVersion) {
		if (localVersion === null) {
			const latestVersion = await this.queryLatestVersion(urlPart);
			this.emit('started', fullName);
			await this.downloadPackageFull(pkgInfo, fullName, name, urlPart, latestVersion);
			await this.downloadPackagePartial(pkgInfo, fullName, name, urlPart, latestVersion, targetVersion);
		} else {
			return await this.downloadPackagePartial(pkgInfo, fullName, name, urlPart, localVersion, targetVersion);
		}
	}

	async downloadPackageFull(pkgInfo, fullName, name, urlPart, targetVersion) {
		const patchVersions = [{
			fromVersion: 0,
			toVersion: targetVersion['version'],
		}];
		return await this.downloadPackagePartialInternal(pkgInfo, fullName, name, urlPart, patchVersions, targetVersion);
	}

	async downloadPackagePartial(pkgInfo, fullName, name, urlPart, localVersion, targetVersion) {
		const localVersionID = localVersion['version'];
		const targetVersionID = targetVersion['version'];

		// assume patches exist in linear order
		const versionDir = targetVersionID > localVersionID ? 1 : -1;
		let patchVersions = [];
		for (let version = localVersionID; version != targetVersionID; version += versionDir) {
			patchVersions.push({
				fromVersion: version,
				toVersion: version + versionDir
			});
		}

		await this.downloadPackagePartialInternal(pkgInfo, fullName, name, urlPart, patchVersions, targetVersion);
	}

	async downloadPackagePartialInternal(pkgInfo, fullName, name, urlPart, patchVersions, targetVersion) {
		let patchJsonDls = [];
		let patchJsonFiles = [];
		for (const patchVersion of patchVersions) {
			const patchJsonUrl = `${urlPart}/patch/${patchVersion.fromVersion}-${patchVersion.toVersion}.json`;
			const patchJsonFile = `${PKG_DIR}/${patchJsonUrl}`;

			if (!fs.existsSync(patchJsonFile)) {
				patchJsonDls.push(downloadFileWithFallback(this.butlerDl, patchJsonUrl, patchJsonFile));
			}
			patchJsonFiles.push(patchJsonFile);
		}
		console.log(`${patchJsonDls.length} patches to download`);
		await Promise.all(patchJsonDls);

		let patchSizes = [];
		let patchSigSizes = [];
		let totalPatchSize = 0;
		for (const patchJsonFile of patchJsonFiles) {
			const patchesJson = JSON.parse(fs.readFileSync(patchJsonFile));
			const size = patchesJson['size'];
			const sig_size = patchesJson['sig_size'];
			patchSizes.push(size);
			patchSigSizes.push(sig_size);
			totalPatchSize += size;
			totalPatchSize += sig_size;
		}

		this.totalPatches = patchSizes.length;
		let patches = [];
		this.emit('started', fullName);
		let downloads = [];
		for (const [i, patchVersion] of patchVersions.entries()) {
			const fromVersion = patchVersion.fromVersion;
			const toVersion = patchVersion.toVersion;

			const patchUrl = `${urlPart}/patch/${fromVersion}-${toVersion}`;
			const patchSigUrl = `${patchUrl}.sig`;

			const patchFile = `${PKG_DIR}/${urlPart}/patch/${fromVersion}-${toVersion}`;
			const patchSigFile = `${patchFile}.sig`;

			if (!fs.existsSync(patchFile)) {
				downloads.push({
					url: patchUrl,
					path: patchFile,
					size: patchSizes[i],
				});
			}

			if (!fs.existsSync(patchSigFile)) {
				downloads.push({
					url: patchSigUrl,
					path: patchSigFile,
					size: patchSigSizes[i],
				});
			}

			patches.push(patchFile);
		}

		const parallelPatchDownload = new ParallelDownload();
		parallelPatchDownload.on('progress', (current, total) => {
			this.emit('progress', fullName, current, total);
		});
		parallelPatchDownload.on('aborted', msg => {
			// TODO: abort should just act as if rejected?
			this.emit('aborted', fullName, msg);
		});
		parallelPatchDownload.on('warn', msg => {
			log.warn(msg);
		});

		await parallelPatchDownload.download(downloads);


		this.emit('started', `${fullName}: applying`);
		// Represent patch application in MBs to satisfy our progress display logic
		this.remainingPatchSize = totalPatchSize;
		this.progressedPatchSize = 0;
		let targetVersionCopy = JSON.parse(JSON.stringify(targetVersion));

		const repo_path = `${springPlatform.writePath}/${pkgInfo['path']}`;
		for (const [i, patchVersion] of patchVersions.entries()) {
			makeDir(repo_path);

			const fromVersion = patchVersion.fromVersion;
			const toVersion = patchVersion.toVersion;
			console.log(`Starting patch ${fromVersion} -> ${toVersion}`);
			// targetVersionCopy['patchProgress'] = '';
			targetVersionCopy['version'] = toVersion;
			await this.butlerApply.apply(patches[i], repo_path);
			this.updateLocalVersion(name, targetVersionCopy);
			console.log(`Finished patch ${fromVersion} -> ${toVersion}`);

			this.progressedPatchSize += patchSizes[i] + patchSigSizes[i];
			this.emit('progress', fullName, this.progressedPatchSize, totalPatchSize);
		}
	}

	async maybeUpdateRapid(pkgInfo, targetVersion) {
		const rapidTag = pkgInfo['rapid'];
		if (rapidTag == null) {
			return;
		}

		const versionsGz = path.join(springPlatform.writePath, `rapid/repos.springrts.com/${rapidTag}/versions.gz`);
		setTouchedByNextgen(versionsGz, true);

		const fullRapidTag = `${rapidTag}:test`;
		let archiveName = targetVersion['name'];
		archiveName = archiveName.substring(0, archiveName.length - '.sdz'.length);
		console.log(`${fullRapidTag} rapid tag now points to: ${archiveName}`);
		const newLine = `${fullRapidTag},,,${archiveName}`;

		let lines = [];
		if (fs.existsSync(versionsGz)) {
			let lineReader = readline.createInterface({
				input: fs.createReadStream(versionsGz).pipe(zlib.createGunzip())
			});
			for await (let line of lineReader) {
				if (line.includes(fullRapidTag)) {
					line = newLine;
				}
				lines.push(line);
			}
		} else {
			lines.push(newLine);
		}

		makeParentDir(versionsGz);
		const output = fs.createWriteStream(versionsGz);
		const compress = zlib.createGzip();
		compress.pipe(output);
		for (const line of lines) {
			compress.write(line + '\n');
		}
		compress.end();
	}

	updateLocalVersion(name, latestVersion) {
		const versionInfo = `${PKG_DIR}/${name}/local-version.json`;
		fs.writeFileSync(versionInfo, JSON.stringify(latestVersion));
	}

	stopDownload() {
		// TODO
	}
}

async function downloadFileWithFallback(butlerDl, baseUrl, file) {
	try {
		return await butlerDl.download(`${PKG_URL}/${baseUrl}`, file);
	} catch (err) {
		log.warn(`Primary url download failed ${PKG_URL}/${baseUrl} -> ${file}. Retrying with fallback: ${FALLBACK_URL}/${baseUrl}`);
		return await butlerDl.download(`${FALLBACK_URL}/${baseUrl}`, file);
	}
}


class ParallelDownload extends EventEmitter {
	async download(downloads) {
		let promises = [];
		this.downloads = downloads;
		let combinedTotal = 0;
		let combinedProgress = 0;
		let downloadProgresses = [];
		for (const download of downloads) {
			combinedTotal += download['size'];
			downloadProgresses.push(0);
		}

		for (const [i, download] of downloads.entries()) {
			const url = download['url'];
			const path = download['path'];

			const downloader = new ButlerDownload();

			downloader.on('progress', current => {
				combinedProgress += current - downloadProgresses[i];
				downloadProgresses[i] = current;
				this.emit('progress', combinedProgress, combinedTotal);
			});

			// downloader.on('aborted', msg => {
			// 	// TODO: abort should just act as if rejected?
			// 	this.emit('aborted', this.name, msg);
			// });

			downloader.on('warn', msg => {
				log.warn(`${download}: ${msg}`);
			});

			promises.push(downloadFileWithFallback(downloader, url, path));
		}

		return Promise.all(promises);
	}
}

function setTouchedByNextgen(versionsGz, isTouched) {
	let touchedFiles = [];
	const touchedFilesRegistry = `${PKG_DIR}/touched_rapid.json`;
	if (fs.existsSync(touchedFilesRegistry)) {
		touchedFiles = JSON.parse(fs.readFileSync(touchedFilesRegistry));
	}
	if (isTouched) {
		touchedFiles.push(versionsGz);
	} else {
		const index = touchedFiles.indexOf(versionsGz);
		if (index > -1) {
			touchedFiles.splice(index, 1);
		}
	}

	fs.writeFileSync(touchedFilesRegistry, JSON.stringify(touchedFiles));
}

function clearTouchedByNextgen() {
	const touchedFilesRegistry = `${PKG_DIR}/touched_rapid.json`;
	if (fs.existsSync(touchedFilesRegistry)) {
		fs.unlinkSync(touchedFilesRegistry);
	}
}

function isTouchedByNextgen(versionsGz) {
	return getTouchedByNextgen().includes(versionsGz);
}

function getTouchedByNextgen() {
	const touchedFilesRegistry = `${PKG_DIR}/touched_rapid.json`;
	if (!fs.existsSync(touchedFilesRegistry)) {
		return [];
	}

	try {
		return JSON.parse(fs.readFileSync(touchedFilesRegistry));
	} catch (err) {
		return [];
	}
}

module.exports = {
	NextGenDownloader: NextGenDownloader,
	setTouchedByNextgen: setTouchedByNextgen,
	getTouchedByNextgen: getTouchedByNextgen,
	isTouchedByNextgen: isTouchedByNextgen,
	clearTouchedByNextgen: clearTouchedByNextgen,
};
