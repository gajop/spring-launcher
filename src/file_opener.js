"use strict";

const shell = require('electron').shell;

module.exports.open = function (path) {
    // getDefaultAppOpener() + " '" + path + "'"
    // switch (process.platform) {
    //     // Note the empty quotes; necessary hack apparently
    //     case 'win32' : case 'win64': return 'start ""';
    //     default: return 'xdg-open';
    // }

    return shell.openItem(path)
    // return shell.openExternal(path, {
    //     activate = true
    // })
}