const { dialog, net } = require('electron');
const { config } = require('./launcher_config');

const { log } = require('./spring_log.js');
const fs = require('fs');

function upload_ask() {
    // TODO: probably should disable the UI while this is being done
    const result = dialog.showMessageBox({
        "type": "info",
        "buttons": ["Yes (Upload)", "No"],
        "title": "Upload log",
        "message": "Do you want to upload your log to http://logs.springrts.com ? All information will be public."
    });
    log.info("User wants to upload? ", result);
    if (result == 0) {
        upload();
    }    
}

function upload() {
    log.info("Uploading...");
    const fileData = fs.readFileSync(`${config.title}/spring-launcher.log`).toString();
    console.log(fileData);
    const isDev = require('electron-is-dev');
    var tags = ['spring-launcher', config.title ];
    if (isDev) {
        tags.push('dev');
    }

    const uploadData = {
        name : `spring-launcher log: ${config.title}`,
        text : fileData,
        tags : tags
    }
    const request = net.request({
        protocol : 'http:',
        hostname : 'logs.springrts.com',
        path: '/logfiles/',
        port: 80,
        method : 'POST',
    })
    request.on('response', (response) => {
       after_upload(response);
    })
    request.setHeader("content-type", "application/json");
    request.write(JSON.stringify(uploadData));
    request.end();
}

function after_upload(response) {
    log.info(`STATUS: ${response.statusCode}`);
    log.info(`HEADERS: ${JSON.stringify(response.headers)}`);
    var chunks = [];
    response.on('data', (chunk) => {
        chunks.push(chunk);
    });

    response.on('error', (err) => {
        failed_to_upload(err);
    });
    
    response.on('end', () => {
        const body = Buffer.concat(chunks);
        const obj = JSON.parse(body);
        if (obj.url == null) {
            failed_to_upload("unexpected error");
            return;
        }
        const msg = `Your log has been uploaded to: ${obj.url}`;
        dialog.showMessageBox({
            "type": "info",
            "buttons": ["OK"],
            "title": "Log Uploaded",
            "message": msg,
        });
        log.info(msg);
    });
}

function failed_to_upload(msg) {
    const errMsg = `Failed to upload log, copy and upload the log manually.\nReason: ${String(msg)}.`;
    log.error(errMsg);
    dialog.showMessageBox({
        "type": "error",
        "buttons": ["OK"],
        "title": "Log Upload failed",
        "message": errMsg,
    });
}

module.exports = {
    'upload_ask': upload_ask
};
