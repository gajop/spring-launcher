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

const isDev = false;
const PKG_URL = isDev ? 'http://0.0.0.0:8000/pkg' : 'https://content.spring-launcher.com/pkg/';
const PKG_DIR = `${springPlatform.writePath}/pkgs`;

const PHASE_METADATA = 'metadata';
const PHASE_FULL_DL = 'full_dl';
const PHASE_PATCH_DL = 'patch_dl';
const PHASE_PATCH_APPLY = 'patch_apply';

// TODO 3rd April:
// Support downloading based on Spring path (game, map or engine full name)
// Fix interrupting a patch-apply resulting in incorrect local version information (might lag by one)

// TODO: later
// Report downloads to some service
// Allow custom path (not just game)
// sync -> async for all IO operations?

class NextGenDownloader extends EventEmitter {
	constructor() {
		super();

		/*
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

		butlerDl.on('progress', (current, total) => {
			if (this.phase === PHASE_METADATA) {
				// console.log('metadata');
			} else if (this.phase === PHASE_FULL_DL) {
				// console.log('full');
				this.emit('progress', this.name, current, total);
			} else if (this.phase === PHASE_PATCH_DL) {
				// console.log('dl');
				this.emit('progress', this.name, this.progressedPatchSize + current, this.totalPatchSize);
			} else if (this.phase === PHASE_PATCH_APPLY) {
				console.log('apply');
				// this.emit('progress', this.name, current, total);
			}
		});

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
		this.phase = PHASE_METADATA;

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

		await this.downloadPackage(name, urlPart, localVersion, targetVersion);
		this.updateLocalVersion(name, targetVersion);
		this.maybeUpdateRapid(name, pkgInfo, targetVersion);

		this.emit('finished', name);
	}

	async queryPackageInfo(name) {
		const pkgInfo = `${PKG_DIR}/${name}/package-info.json`;
		if (!fs.existsSync(pkgInfo)) {
			await this.butlerDl.download(`${PKG_URL}/${name}/package-info.json`, pkgInfo);
		}
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
		await this.butlerDl.download(`${PKG_URL}/${baseUrl}`, versionInfoFile);
		let versionInfo = JSON.parse(fs.readFileSync(versionInfoFile));
		return {
			version: version,
			name: versionInfo['name']
		};
	}

	async downloadPackage(name, urlPart, localVersion, targetVersion) {
		if (localVersion === null) {
			const latestVersion = await this.queryLatestVersion(urlPart);
			await this.downloadPackageFull(name, urlPart, latestVersion);
			await this.downloadPackagePartial(name, urlPart, latestVersion, targetVersion);
		} else {
			return await this.downloadPackagePartial(name, urlPart, localVersion, targetVersion);
		}
	}

	async downloadPackageFull(name, urlPart, targetVersion) {
		this.phase = PHASE_FULL_DL;
		const targetVersionName = targetVersion['name'];
		const dest = path.join(springPlatform.writePath, 'games', targetVersionName);
		return await this.butlerDl.download(`${PKG_URL}/${urlPart}/full/${targetVersionName}`, dest);
	}

	async downloadPackagePartial(name, urlPart, localVersion, targetVersion) {
		const localVersionID = localVersion['version'];
		const targetVersionID = targetVersion['version'];

		// assume patches exist in linear order
		const versionDir = targetVersionID > localVersionID ? 1 : -1;

		let patchJsonDls = [];
		let destFiles = [];
		for (let version = localVersionID; version != targetVersionID; version += versionDir) {
			const patchJsonUrl = `${PKG_URL}/${urlPart}/patch/${version}.json`;
			const patchJsonFile = `${PKG_DIR}/${urlPart}/patch/${version}.json`;

			patchJsonDls.push(this.butlerDl.download(patchJsonUrl, patchJsonFile));
			destFiles.push(patchJsonFile);
		}
		console.log(`Total downloads: ${patchJsonDls.length}`);
		await Promise.all(patchJsonDls);

		let patchSizes = [];
		let patchSigSizes = [];
		let totalSize = 0;
		{
			let i = 0;
			for (let version = localVersionID; version != targetVersionID; version += versionDir) {
				const destFile = destFiles[i++];
				const nextVersion = version + versionDir;
				const patchesJson = JSON.parse(fs.readFileSync(destFile));
				let foundPatch = false;
				for (const patch of patchesJson['patches']) {
					if (patch['version'] === nextVersion) {
						patchSizes.push(patch['size']);
						patchSigSizes.push(patch['sig_size']);
						foundPatch = true;
						totalSize += patch['size'];
						break;
					}
				}
				if (!foundPatch) {
					throw `Missing patch ${version} -> ${nextVersion}`;
				}

			}
		}

		this.phase = PHASE_PATCH_DL;
		this.totalPatchSize = totalSize;
		this.remainingPatchSize = totalSize;
		this.progressedPatchSize = 0;
		this.totalPatches = patchSizes.length;
		let patches = [];
		let i = 0;
		this.emit('started', `${urlPart}: patches`);
		let downloads = [];
		for (let version = localVersionID; version != targetVersionID; version += versionDir, i++) {
			const nextVersion = version + versionDir;
			const patchUrl = `${PKG_URL}/${urlPart}/patch/${version}-${nextVersion}`;
			const patchSigUrl = `${patchUrl}.sig`;

			const patchFile = `${PKG_DIR}/${urlPart}/patch/${version}-${nextVersion}`;
			const patchSigFile = `${patchFile}.sig`;

			if (!fs.existsSync(patchFile)) {
				downloads.push({
					url: patchUrl,
					path: patchFile,
					size: patchSizes[i],
				});
			}

			this.phase = null;
			if (!fs.existsSync(patchSigFile)) {
				downloads.push({
					url: patchSigUrl,
					path: patchSigFile,
					size: patchSigSizes[i],
				});
			}
			this.phase = PHASE_PATCH_DL;
			this.remainingPatchSize -= patchSizes[i];
			this.progressedPatchSize += patchSizes[i];

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

		// await Promise.all(downloads);
		this.emit('progress', this.name, this.totalPatchSize, this.totalPatchSize);

		this.emit('started', `${urlPart}: applying`);
		this.phase = PHASE_PATCH_APPLY;
		// Represent patch application in MBs to satisfy our progress display logic
		i = 0;
		this.remainingPatchSize = totalSize;
		this.progressedPatchSize = 0;
		let targetVersionCopy = JSON.parse(JSON.stringify(targetVersion));
		for (let version = localVersionID; version != targetVersionID; version += versionDir, i++) {
			console.log(`Starting patch ${version} -> ${version + versionDir}`);
			// targetVersionCopy['patchProgress'] = '';
			targetVersionCopy['version'] = version + versionDir;
			await this.butlerApply.apply(patches[i], `${springPlatform.writePath}/games`);
			this.updateLocalVersion(name, targetVersionCopy);
			console.log(`Finished patch ${version} -> ${version + versionDir}`);

			this.progressedPatchSize += patchSizes[i];
			this.emit('progress', this.name, this.progressedPatchSize, this.totalPatchSize);
		}
	}

	async maybeUpdateRapid(name, pkgInfo, latestVersion) {
		const rapidTag = pkgInfo['rapid'];
		if (rapidTag == null) {
			return;
		}

		const versionsGz = path.join(springPlatform.writePath, `rapid/repos.springrts.com/${rapidTag}/versions.gz`);
		const fullRapidTag = `${rapidTag}:test`;
		let archiveName = latestVersion['name'];
		archiveName = archiveName.substring(0, archiveName.length - '.sdz'.length);
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

			downloader.on('progress', (current, total) => {
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
