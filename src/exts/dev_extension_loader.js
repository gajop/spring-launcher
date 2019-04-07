const fs = require('fs');

const { bridge } = require('../spring_api');

let m_enabled = false;

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

    console.log(`Development extension: ${path}.`);
}

bridge.on("LoadArchiveExtensions", (command) => {
    const archvePath = command.archvePath;
    if (archvePath == null) {
        return;
    }

    const distCfgPath = `${archvePath}/dist_cfg`;

    console.log(`Loading archive extensions from: ${distCfgPath}...`);
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
