const { bridge } = require('../spring_api');
const log = require('electron-log');

const chokidar = require('chokidar');

var watcher = chokidar.watch('file', {
  ignoreInitial: true,
  persistent: true,
  followSymlinks: true,
  // TODO: chokidar doesn't seem to work without explicitly enabling polling
  // This is probably less efficient and should be reported/fixed
  // It does seem to work if initialized with a dir instead
  // gameDir = '/home/user/.config/spring/games/SomeGame.sdd/'
  // chokidar.watch(gameDir, {ignored: /(^|[\/\\])\../}).on('all', (event, path) => {
  usePolling: true
});

function Notify(path, type) {
  bridge.send("FileChanged", {
    path: path,
    type: type
  });
}

watcher.on('add', (path, stats) => {
  Notify(path, 'add');
});
watcher.on('addDir', (path, stats) => {
  Notify(path, 'addDir');
});
watcher.on('change', (path, stats) => {
  Notify(path, 'change');
});
watcher.on('unlink', (path, stats) => {
  Notify(path, 'unlink');
});
watcher.on('unlinkDir', (path, stats) => {
  Notify(path, 'unlinkDir');
});

bridge.on("WatchFile", command => {
  const path = command.path;
  watcher.add(path);
  // log.info(`Tracking file: ${path}`)

  // var watchedPaths = watcher.getWatched();
  // log.info('Watched paths:');
  // for (var key in watchedPaths) {
  //   log.info(key, watchedPaths[key]);
  // }
});
