'use strict';

const { dialog, clipboard } = require('electron');
const { config } = require('./launcher_config');
const fs = require('fs');

const GistClient = require("gist-client")
const got = require('got');

const { log, logPath } = require('./spring_log');

function s2b(str) {
	const bytes = new Uint8Array(str.length / 2);
	for (let i = 0; i !== bytes.length; i++) {
		bytes[i] = parseInt(str.substr(i * 2, 2), 16);
	}
	return bytes;
}

// such security, much wow
const sec = [
	'6768705F',
	'5A516C63',
	'36434D7A',
	'64763467',
	'635A3537',
	'7969424C',
	'53346F69',
	'434B6D63',
	'7A763178',
	'64525575'
];

const github_access_token = new TextDecoder().decode(s2b(sec.join('')));

function upload_ask() {
	// TODO: probably should disable the UI while this is being done
	const dialogBtns = ['Yes (Upload)', 'No'];

	const github_gist_account = config.github_gist_account;
	const shouldUploadWithGithub = github_gist_account != null && github_gist_account != '';
	const uploadDestination = shouldUploadWithGithub ? `https://gist.github.com/${github_gist_account}` : 'https://log.springrts.com';

	dialog.showMessageBox({
		'type': 'info',
		'buttons': dialogBtns,
		'title': 'Upload log',
		'message': `Do you want to upload your log to ${uploadDestination}? Log information like hardware config and game path will be available to anyone you share the resulting URL with.`
	}).then(result => {
		const response = result.response;
		log.info('User wants to upload? ', dialogBtns[response]);
		if (response != 0) {
			return;
		}

		(shouldUploadWithGithub ? uploadToGithub() : uploadToSpringRTS())
			.then(obj => {
				clipboard.clear();
				clipboard.writeText(obj.url);
				const msg = `Your log has been uploaded to: ${obj.url}` +
                    '\n(Copied to clipboard)';
				dialog.showMessageBox({
					'type': 'info',
					'buttons': ['OK'],
					'title': 'Log Uploaded',
					'message': msg,
				});
				log.info(msg);
			})
			.catch(err => failed_to_upload(err));
	});
}

function upload() {
	const github_gist_account = config.github_gist_account;
	const shouldUploadWithGithub = github_gist_account != null && github_gist_account != '';

	return shouldUploadWithGithub ? uploadToGithub() : uploadToSpringRTS();
}

function uploadToGithub() {
	var content = {
		description: '',
		files: {
			'infolog.txt': {
				'content': fs.readFileSync(logPath).toString(),
			}
		}
	};

	const gistClient = new GistClient()

	gistClient.setToken(github_access_token)

	return gistClient.create(content).then(newGist => {
		//console.log(newGist)
		return { 'url': newGist.html_url };
	});
}

function uploadToSpringRTS() { // It's dead, Jim
	return new Promise((resolve, reject) => {
		log.info('Uploading...');
		const fileData = fs.readFileSync(logPath).toString();
		const isDev = require('electron-is-dev');
		var tags = ['spring-launcher', config.title];
		if (isDev) {
			tags.push('dev');
		}

		got.post('https://logs.springrts.com/logfiles/', {
			json: {
				name: `spring-launcher log: ${config.title}`,
				text: fileData,
				tags: tags
			},
			responseType: 'json'
		}).then(obj => {
			resolve(obj.body);
		}).catch(err => {
			reject(err);
		});
	}).then(obj => {
		obj.url = obj.url.replace('http://', 'https://');
		return obj;
	});
}

function failed_to_upload(msg) {
	const errMsg = `Failed to upload log, copy and upload the log manually.\nReason: ${String(msg)}.`;
	log.error(errMsg);
	log.error(msg);
	dialog.showMessageBox({
		'type': 'error',
		'buttons': ['OK'],
		'title': 'Log Upload failed',
		'message': errMsg,
	});
}

module.exports = {
	'upload_ask': upload_ask,
	'upload': upload
};

