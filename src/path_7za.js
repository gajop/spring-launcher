'use strict';

let { path7za } = require('7zip-bin');
// A terrible hack indeed
path7za = path7za.replace('app.asar', 'app.asar.unpacked');

module.exports = path7za;
