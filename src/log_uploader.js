'use strict';

const { dialog, clipboard } = require('electron');
const { config } = require('./launcher_config');
const fs = require('fs');

const AWS = require('aws-sdk');
const GistClient = require("gist-client")
const got = require('got');

const { log, logPath } = require('./spring_log');

const logs_upload_location = config.logs_upload_location;

const logs_s3_bucket = 'bar-infologs'
const logs_github_gist_account = 'beyond-all-reason'

const shouldUploadWithSpring = logs_upload_location != null && logs_upload_location == 'spring';
const shouldUploadWithGithub = logs_upload_location != null && logs_upload_location == 'gist';
//const shouldUploadWithS3 = logs_upload_location != null && logs_upload_location == 's3';

function s2b(str) {
	const bytes = new Uint8Array(str.length / 2);
	for (let i = 0; i !== bytes.length; i++) {
		bytes[i] = parseInt(str.substr(i * 2, 2), 16);
	}
	return bytes;
}

// such security, much wow
const a1 = [
	'414B494133',
	'5843505A41',
	'51414B424C',
	'4D52545747'
];

const a2 = [
	'6939487543',
	'386B497255',
	'673149596A',
	'48692B6C6A',
	'33786D734D',
	'434A5A6D66',
	'4A4F415875',
	'7A5543574A'
];

const gh = [
	'6768705F5A516C63',
	'36434D7A64763467',
	'635A35377969424C',
	'53346F69434B6D63',
	'7A76317864525575'
];

const aws_id = new TextDecoder().decode(s2b(a1.join('')));
const aws_secret = new TextDecoder().decode(s2b(a2.join('')));
const github_access_token = new TextDecoder().decode(s2b(gh.join('')));

function upload_ask() {
	// TODO: probably should disable the UI while this is being done
	const dialogBtns = ['Yes, upload', 'No'];

	const uploadDestination = shouldUploadWithSpring ? 'https://log.springrts.com' : (shouldUploadWithGithub ? `https://gist.github.com/${logs_github_gist_account}` : `https://${logs_s3_bucket}.s3.amazonaws.com/`);

	dialog.showMessageBox({
		'type': 'info',
		'buttons': dialogBtns,
		'title': 'Upload log',
		'message': 'Do you want to upload your log to:\n'
			+ `${uploadDestination} ?\n`
			+ 'Log information like hardware config and game path will be available to anyone you share the resulting URL with.'
	}).then(result => {
		const response = result.response;
		log.info('User wants to upload? ', dialogBtns[response]);
		if (response != 0) {
			return;
		}

		(shouldUploadWithSpring ? uploadToSpringRTS() : (shouldUploadWithGithub ? uploadToGithub() : uploadToS3()))
			.then(obj => {
				clipboard.clear();
				clipboard.writeText(obj.url);
				const msg = 'Your log has been uploaded to:\n'
					+ `${obj.url}\n`
					+ '(Copied to clipboard)';
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
	return shouldUploadWithSpring ? uploadToSpringRTS() : (shouldUploadWithGithub ? uploadToGithub() : uploadToS3());
}

function uploadToS3() {
	const fileContent = fs.readFileSync(logPath);
	const fileName = 'infolog_' + new Date().getTime() + '.txt' // File name to save as

	const s3 = new AWS.S3({
		accessKeyId: aws_id,
		secretAccessKey: aws_secret
	});

	const params = {
		Bucket: logs_s3_bucket,
		Key: fileName,
		Body: fileContent,
		ContentType: 'text/plain'
	};

	return new Promise((resolve, reject) => {
		s3.upload(params, function(err, data) {
			if (err) {
				reject(err);
			}
			resolve({ 'url': data?.Location });
		});
	});
}

function uploadToGithub() {
	const fileName = 'infolog_' + new Date().getTime() + '.txt' // File name to save as

	var content = {
		description: '',
		files: {
			[fileName]: {
				'content': fs.readFileSync(logPath).toString(),
			}
		}
	};

	const gistClient = new GistClient()

	gistClient.setToken(github_access_token)

	return new Promise((resolve, reject) => {
		gistClient.create(content).then(newGist => {
			resolve({ 'url': newGist?.html_url });
		}).catch(err => {
			reject(err.toString());
		});
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

