'use strict';

const { dialog, net, clipboard } = require('electron');
const { config } = require('./launcher_config');
const fs = require('fs');

const github = require('octonode');

const { log, logPath } = require('./spring_log');

// such security, much wow
const sec = [
	'ghp',
	'_j1npS8i',
	'jzzVLSsJ',
	'R0NBQVM',
	'pjUWN1Fi4WdO7n'
];
const github_access_token = sec.join('');

function upload_ask() {
	// TODO: probably should disable the UI while this is being done
	const dialogBtns = ['Yes (Upload)', 'No'];

	const github_log_repo = config.github_log_repo;
	const shouldUploadWithGithub = github_log_repo != null && github_log_repo != '';
	const uploadDestination = shouldUploadWithGithub ? `https://github.com/${github_log_repo}` : 'https://log.springrts.com';

	dialog.showMessageBox({
		'type': 'info',
		'buttons': dialogBtns,
		'title': 'Upload log',
		'message': `Do you want to upload your log to ${uploadDestination} ? All information will be public.`
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
	const github_log_repo = config.github_log_repo;
	const shouldUploadWithGithub = github_log_repo != null && github_log_repo != '';

	return shouldUploadWithGithub ? uploadToGithub() : uploadToSpringRTS();
}

function uploadToGithub() {
	const github_client = github.client(github_access_token);
	const ghrepo = github_client.repo('Spring-SpringBoard/Logs');
	return ghrepo.issueAsync({
		'title': `spring-launcher log: ${config.title}`,
		'body': '```' + fs.readFileSync(logPath).toString() + '```',
	}).then(obj => {
		return { 'url': obj[0].html_url };
	});
}

function uploadToSpringRTS() {
	return new Promise((resolve, reject) => {
		log.info('Uploading...');
		const fileData = fs.readFileSync(logPath).toString();
		const isDev = require('electron-is-dev');
		var tags = ['spring-launcher', config.title];
		if (isDev) {
			tags.push('dev');
		}

		const uploadData = {
			name: `spring-launcher log: ${config.title}`,
			text: fileData,
			tags: tags
		};
		const request = net.request({
			protocol: 'http:',
			hostname: 'logs.springrts.com',
			path: '/logfiles/',
			port: 80,
			method: 'POST',
		});
		request.on('response', (response) => {
			after_upload(response, resolve, reject);
		});
		request.setHeader('content-type', 'application/json');
		request.write(JSON.stringify(uploadData));
		request.end();
	}).then(obj => {
		obj.url = obj.url.replace('http://', 'https://');
		return obj;
	});
}

function after_upload(response, resolve, reject) {
	log.info(`STATUS: ${response.statusCode}`);
	log.info(`HEADERS: ${JSON.stringify(response.headers)}`);
	var chunks = [];
	response.on('data', (chunk) => {
		chunks.push(chunk);
	});

	response.on('error', (err) => {
		reject(err);
	});

	response.on('end', () => {
		const body = Buffer.concat(chunks);
		let obj;
		try {
			obj = JSON.parse(body);
		} catch (err) {
			reject('Unable to parse response from server. See log for details');
			log.error(`Unable to parse response from server: ${body}`);
			return;
		}
		if (obj.url == null) {
			reject('unexpected error');
			return;
		}
		resolve(obj);
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

