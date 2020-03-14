// const { exec } = require('child_process');
const { bridge } = require('../spring_api');
const file_opener = require('../file_opener');

bridge.on("OpenFile", (command) => {
  // const fullPath = file_opener.GetOpenCommand(command.path);
  if (file_opener.open(command.path)) {
    bridge.send("OpenFileFinished", {
      path: command.path
    });
  } else {
    bridge.send("OpenFileFailed", {
      path: command.path
    });
  }

  // exec(fullPath, (err, stdout, stderr) => {
  //   if (err) {
  //     bridge.send("OpenedFileFailed", {
  //       path: command.path,
  //       stderr: stderr,
  //       stdout: stdout,
  //     });
  //   } else {
  //     bridge.send("OpenFileFinished", {
  //       path: command.path,
  //       stderr: stderr,
  //       stdout: stdout,
  //     });
  //   }
  // });
  // console.log(fullPath);
});
