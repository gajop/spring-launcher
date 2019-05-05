const fs = require('fs');
const path = require('path');

const log = require('electron-log');

const { bridge } = require('../spring_api');

let m_enabled = false;

function loadDevExtension(extensionPath) {
    let content;
    try {
        content = fs.readFileSync(extensionPath).toString();
    } catch (e) {
        bridge.send("LoadExtensionFailed", {
            error: `Failed to open extension file: ${extensionPath} with error: ${e.message}`
        });
        return;
    }

    try {
        eval(content);
    } catch (e) {
        bridge.send("LoadExtensionFailed", {
            error: `Failed to load extension file: ${extensionPath} with error: ${e.message}`
        });
        return;
    }

    log.info(`Development extension: ${extensionPath}.`);
}

bridge.on("LoadArchiveExtensions", (command) => {
    const archivePath = command.archivePath;
    if (archivePath == null) {
        log.error(`No archive path specified for LoadArchiveExtensions command`);
        return;
    }

    if (!m_enabled) {
        log.error(`Development extensions loading disabled.`);
        return;
    }

    const distCfgPath = path.join(archivePath, 'dist_cfg');
    const extsPath = path.join(distCfgPath, 'exts');

    log.info(`Loading archive extensions from: ${extsPath}...`);
    const extensions = fs.readdirSync(extsPath);
    if (extensions.length == 0) {
        log.info(`No extensions found in: ${extsPath}...`);
    }
    extensions.forEach(function(file) {
        if (file.endsWith(".js")) {
            loadDevExtension(path.join(extsPath, file));
        }
    });

    m_enabled = false; // Only load dev extensions once.
});

bridge.on("LoadExtension", (command) => {
    if (!m_enabled) {
        return false;
    }

    loadDevExtension(command.path);
});

exports.setEnabled = function(enabled) { m_enabled = enabled }
