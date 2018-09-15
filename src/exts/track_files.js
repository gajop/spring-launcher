const { bridge } = require('../spring_api');

const chokidar = require('chokidar');

// One-liner for current directory, ignores .dotfiles
gameDir = '/home/gajop/.config/spring/games/LD/LD42.sdd/'

//chokidar.watch(gameDir, {ignored: /(^|[\/\\])\../}).on('all', (event, path) => {
chokidar.watch(gameDir, {}).on('all', (event, path) => {
  console.log('!!!!!!!!!!!!!!!!!!!!!!chokidar!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!', event, path);
  if (event == "change") {
    bridge.send("FileChanged", {
      path: path,
    });
  }
});


