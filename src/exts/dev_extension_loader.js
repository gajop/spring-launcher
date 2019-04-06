const fs = require('fs');

const { bridge } = require('../spring_api');

let m_enabled = false;
let archvePath;

function loadDevExtension(path) {
    let content;
    try {
        content = fs.readFileSync(path).toString();
    } catch (e) {
        bridge.send("LoadExtensionFailed", {
            error: `Failed to open extension file: ${path} with error: ${e.message}`
        });
        return;
    }

    try {
        eval(content);
    } catch (e) {
        bridge.send("LoadExtensionFailed", {
            error: `Failed to load extension file: ${path} with error: ${e.message}`
        });
        return;
    }
}

bridge.on("SetArchivePath", (command) => {
    archvePath = command.archvePath;
    if (archvePath == null) {
        return;
    }

    const distCfgPath = `${archvePath}/dist_cfg`;
    fs.readdirSync(distCfgPath).forEach(function(file) {
        if (file.endsWith(".js")) {
            loadDevExtension(file);
        }
    });
});

bridge.on("LoadExtension", (command) => {
    if (!m_enabled) {
        return false;
    }

    loadDevExtension(command.path);
});

exports.setEnabled = function(enabled) { m_enabled = enabled }
