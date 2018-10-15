const { bridge } = require('../spring_api');
const log = require('electron-log');

const chokidar = require('chokidar');

var watcher = chokidar.watch(null, {
  persistent: true,
  followSymlinks: true,
  // TODO: chokidar doesn't seem to work without explicitly enabling polling
  // This is probably less efficient and should be reported/fixed
  // It does seem to work if initialized with a dir instead
  // gameDir = '/home/user/.config/spring/games/SomeGame.sdd/'
  // chokidar.watch(gameDir, {ignored: /(^|[\/\\])\../}).on('all', (event, path) => {
  usePolling: true
});

watcher.on('change', (path, stats) => {
  // console.log('!!!!!!!!!!!!!!!!!!!!!!chokidar!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!', path, stats);
  bridge.send("FileChanged", {
    path: path,
  });
});

bridge.on("WatchFile", command => {
  const path = command.path;
  watcher.add(path);
  // log.info(`Tracking file: ${path}`)

  var watchedPaths = watcher.getWatched();
  // log.info('Watched paths:');
  // for (var key in watchedPaths) {
  //   log.info(key, watchedPaths[key]);
  // }
});
