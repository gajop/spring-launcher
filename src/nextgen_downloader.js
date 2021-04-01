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
const { makeParentDir } = require('./fs_utils');

const isDev = false;
const PKG_URL = isDev ? 'http://0.0.0.0:8000/pkg' : 'https://content.spring-launcher.com/pkg/';
const PKG_DIR = `${springPlatform.writePath}/pkgs`;

// TODO 3rd April:
// Support downloading based on Spring path (game, map or engine full name)
// Fix interrupting a patch-apply resulting in incorrect local version information (might lag by one)

// TODO: later
// Multiple local channels (main, test..)
// Multiple local versions (same channel..?)
// Report downloads to some service
// Allow custom path (not just game)
// sync -> async for all IO operations?

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


		const butlerDl = new ButlerDownload();
		const butlerApply = new ButlerApply();

		butlerDl.on('aborted', msg => {
			this.emit('aborted', this.name, msg);
		});

		butlerDl.on('warn', msg => {
			log.warn(msg);
		});

		this.butlerDl = butlerDl;
		this.butlerApply = butlerApply;
	}

	async download(fullName) {
		await this.downloadInternal(fullName).catch(err => {
			this.emit('failed', fullName, `Download failed ${fullName}`);
			log.error(err);
		});
	}

	async downloadInternal(fullName) {
		let parsed = parse(fullName);

		const name = parsed.user + '/' + parsed.repo;

		this.emit('started', `${name}: metadata`);

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
		console.log(JSON.stringify({
			pkgInfo: pkgInfo,
			localVersion: localVersion,
			targetVersion: targetVersion
		}, null, 2));
		if (localVersion != null) {
			if (localVersion['version'] == targetVersion['version']) {
				console.log(`No download necessary for ${name}`);
				this.emit('finished', name);
				return;
			}
		}

		await this.downloadPackage(pkgInfo, name, urlPart, localVersion, targetVersion);
		this.updateLocalVersion(name, targetVersion);
		if (versionID == null) {
			// TODO: also fill this in case versionID is specified as latest
			this.maybeUpdateRapid(pkgInfo, targetVersion);
		}

		this.emit('finished', name);
	}

	async queryPackageInfo(name) {
		const pkgInfo = `${PKG_DIR}/${name}/package-info.json`;
		// TODO: consider caching?
		// if (!fs.existsSync(pkgInfo)) {
		await this.butlerDl.download(`${PKG_URL}/${name}/package-info.json`, pkgInfo);
		// }
		return JSON.parse(fs.readFileSync(pkgInfo));
	}

	queryLocalVersion(name) {
		const versionInfo = `${PKG_DIR}/${name}/local-version.json`;
		if (!fs.existsSync(versionInfo)) {
			return null;
		}
		return JSON.parse(fs.readFileSync(versionInfo));
	}

	async queryLatestVersion(urlPart) {
		const baseUrl = `${urlPart}/latest.json`;
		const versionInfo = `${PKG_DIR}/${baseUrl}`;
		await this.butlerDl.download(`${PKG_URL}/${baseUrl}`, versionInfo);
		return JSON.parse(fs.readFileSync(versionInfo));
	}

	async queryRemoteVersion(urlPart, version) {
		const baseUrl = `${urlPart}/patch/${version}.json`;
		const versionInfoFile = `${PKG_DIR}/${baseUrl}`;
		if (!fs.existsSync(versionInfoFile)) {
			await this.butlerDl.download(`${PKG_URL}/${baseUrl}`, versionInfoFile);
		}
		let versionInfo = JSON.parse(fs.readFileSync(versionInfoFile));
		return {
			version: version,
			name: versionInfo['name']
		};
	}

	async downloadPackage(pkgInfo, name, urlPart, localVersion, targetVersion) {
		if (localVersion === null) {
			const latestVersion = await this.queryLatestVersion(urlPart);
			this.emit('started', `${name}`);
			await this.downloadPackageFull(pkgInfo, name, urlPart, latestVersion);
			await this.downloadPackagePartial(pkgInfo, name, urlPart, latestVersion, targetVersion);
		} else {
			return await this.downloadPackagePartial(pkgInfo, name, urlPart, localVersion, targetVersion);
		}
	}

	async downloadPackageFull(pkgInfo, name, urlPart, targetVersion) {
		const patchVersions = [{
			fromVersion: 0,
			toVersion: targetVersion['version'],
		}];
		return await this.downloadPackagePartialInternal(pkgInfo, name, urlPart, patchVersions, targetVersion);
	}

	async downloadPackagePartial(pkgInfo, name, urlPart, localVersion, targetVersion) {
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

		await this.downloadPackagePartialInternal(pkgInfo, name, urlPart, patchVersions, targetVersion);
	}

	async downloadPackagePartialInternal(pkgInfo, name, urlPart, patchVersions, targetVersion) {
		let patchJsonDls = [];
		let patchJsonFiles = [];
		for (const patchVersion of patchVersions) {
			const baseUrl = `${urlPart}/patch/${patchVersion.fromVersion}-${patchVersion.toVersion}.json`;
			const patchJsonUrl = `${PKG_URL}/${baseUrl}`;
			const patchJsonFile = `${PKG_DIR}/${baseUrl}`;

			if (!fs.existsSync(patchJsonFile)) {
				patchJsonDls.push(this.butlerDl.download(patchJsonUrl, patchJsonFile));
			}
			patchJsonFiles.push(patchJsonFile);
		}
		console.log(`Total downloads: ${patchJsonDls.length}`);
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
		this.emit('started', `${urlPart}: patches`);
		let downloads = [];
		for (const [i, patchVersion] of patchVersions.entries()) {
			const fromVersion = patchVersion.fromVersion;
			const toVersion = patchVersion.toVersion;

			const patchUrl = `${PKG_URL}/${urlPart}/patch/${fromVersion}-${toVersion}`;
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
			this.emit('progress', this.name, current, total);
		});
		parallelPatchDownload.on('aborted', msg => {
			// TODO: abort should just act as if rejected?
			this.emit('aborted', this.name, msg);
		});
		parallelPatchDownload.on('warn', msg => {
			log.warn(msg);
		});

		await parallelPatchDownload.download(downloads);


		this.emit('started', `${urlPart}: applying`);
		// Represent patch application in MBs to satisfy our progress display logic
		this.remainingPatchSize = totalPatchSize;
		this.progressedPatchSize = 0;
		let targetVersionCopy = JSON.parse(JSON.stringify(targetVersion));

		const repo_path = `${springPlatform.writePath}/${pkgInfo['path']}`;
		for (const [i, patchVersion] of patchVersions.entries()) {
			const fromVersion = patchVersion.fromVersion;
			const toVersion = patchVersion.toVersion;
			console.log(`Starting patch ${fromVersion} -> ${toVersion}`);
			// targetVersionCopy['patchProgress'] = '';
			targetVersionCopy['version'] = toVersion;
			await this.butlerApply.apply(patches[i], repo_path);
			this.updateLocalVersion(name, targetVersionCopy);
			console.log(`Finished patch ${fromVersion} -> ${toVersion}`);

			this.progressedPatchSize += patchSizes[i] + patchSigSizes[i];
			this.emit('progress', this.name, this.progressedPatchSize, totalPatchSize);
		}
	}

	async maybeUpdateRapid(pkgInfo, targetVersion) {
		const rapidTag = pkgInfo['rapid'];
		if (rapidTag == null) {
			return;
		}

		const versionsGz = path.join(springPlatform.writePath, `rapid/repos.springrts.com/${rapidTag}/versions.gz`);
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

			downloader.on('aborted', msg => {
				// TODO: abort should just act as if rejected?
				this.emit('aborted', this.name, msg);
			});

			downloader.on('warn', msg => {
				log.warn(msg);
			});

			promises.push(downloader.download(url, path));
		}

		return Promise.all(promises);
	}
}


module.exports = new NextGenDownloader();
