const { default: OBSWebSocket } = require("obs-websocket-js");
const obs = new OBSWebSocket();
const path = require("path");
let replayPrefix = "Replay-";
let recordingsPath = null;
const FS = require("graceful-fs");

// Handle paths for both development and pkg execution
const getAppRoot = () => {
  return process.pkg ? path.dirname(process.execPath) : process.cwd();
};

const storedJsonPath = path.join(getAppRoot(), "stored.json");
FS.existsSync(storedJsonPath) || FS.writeFileSync(storedJsonPath, "{}");
const stored = JSON.parse(FS.readFileSync(storedJsonPath));
const inquirer = require("inquirer");
const { glob } = require("glob");
// Use standard require for clipServer.js so pkg can bundle it correctly
const clipServer = require("./clipServer.js");
const questions = [
  {
    name: "obsIp",
    message: "What's your OBS websocket server ip? ",
    type: "input",
    default: stored.obsIp ? stored.obsIp : null,
  },
  {
    name: "obsPort",
    message: "What's your OBS websocket server port? ",
    type: "number",
    default: stored.obsPort ? stored.obsPort : 4455,
  },
  {
    name: "obsPassword",
    message: "What's your OBS websocket server password? ",
    type: "input",
    default: stored.obsPassword ? stored.obsPassword : null,
  },
  {
    name: "obsPrefix",
    message: "Replay Buffer Filename Prefix? (You must have one)",
    type: "input",
    default: stored.obsPrefix ? stored.obsPrefix : "Replay-",
  },
];

function start() {
  inquirer.prompt(questions).then((answers) => {
    let { obsPassword, obsPort, obsIp, obsPrefix } = answers;
    FS.writeFileSync(storedJsonPath, JSON.stringify(answers));
    replayPrefix = obsPrefix;
    console.log("pass: ", obsPassword);
    console.log("port: ", obsPort);
    obs.connect(`ws://${obsIp}:${obsPort}`, obsPassword).then(() => {
      console.log("OBS connected!");
      obs.call("GetRecordDirectory").then(async (dir) => {
        recordingsPath = dir.recordDirectory;
        if (await existingClips(obs)) {
          let answers = await inquirer.prompt([
            {
              name: "existClips",
              type: "list",
              message: "We've found existing clips. What would you like to do?",
              choices: ["Delete them (recommended)", "Keep them", "Exit the program"],
            },
          ]);
          switch (answers.existClips) {
            case "Delete them (recommended)":
              console.log("Deleting clips...");
              await clearClips();
              break;
            case "Keep them":
              console.log("Keeping clips.");
              break;
            case "Exit the program":
              console.log("Exiting program...");
              process.exit(0);
          }
        }
        obs.call("GetReplayBufferStatus", "Replay Buffer").then((status) => {
          if (!status.outputActive) {
            console.log(
              "Replay Buffer not started on OBS. Starting it for you..."
            );
            obs.call("StartReplayBuffer").then(() => {
              console.log("Replay Buffer Started!");
            });
          }
        });
        obs.addListener("CustomEvent", (data) => {
          if (data.name == "pingMain") {
            sendPing(obs);
          } else if (data.name == "clearClips") {
            clearClips();
          }
        });
        sendPing(obs);
        clipServer.startServer(recordingsPath, replayPrefix);
      });
    });
  });
}

start();

function existingClips() {
  const pattern = path
    .join(recordingsPath, `${replayPrefix}*`)
    .replaceAll("\\", "/");
  return new Promise((resolve, reject) => {
    glob(pattern).then((files) => {
      resolve(files.length > 0);
    });
  });
}

function clearClips() {
  const pattern = path
    .join(recordingsPath, `${replayPrefix}*`)
    .replaceAll("\\", "/");
  return new Promise((resolve, reject) => {
    //    console.log(pattern);
    glob(pattern).then((files) => {
      files.forEach((file) => {
        FS.unlink(file, (err) => {
          if (err) {
            reject(`Error deleting file ${file}: `, err);
          } else {
          }
        });
      });
      console.log("Clips Cleared!");
      resolve();
    });
  });
}

function sendClips(obs) {
  existingClips().then((exist) => {
    obs.call("BroadcastCustomEvent", {
      eventData: { name: "sendingExistingClips", value: exist },
    });
  });
}

function sendPing(obs) {
  obs.call("BroadcastCustomEvent", {
    eventData: { name: "mainActive" },
  });
}

const { exec } = require("child_process");

function showErrorPopup(errorMessage) {
  console.error(errorMessage); // Always log error to console

  if (process.platform === "win32") {
    // Windows: Use built-in PowerShell message box
    exec(
      `powershell -command "& {Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${errorMessage.replace(
        /'/g,
        "''"
      )}', 'Error', 0, 16)}"`
    );
  } else if (process.platform === "darwin") {
    // macOS: Use AppleScript for a pop-up
    exec(
      `osascript -e 'display dialog "${errorMessage}" buttons {"OK"} with icon caution'`
    );
  } else {
    // Linux: Use Zenity
    exec(`zenity --error --text="${errorMessage}"`);
  }
}

//showErrorPopup("Test error message");

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  showErrorPopup(`Uncaught Exception: ${err.message}`);
  //process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Promise Rejection:", reason);
  showErrorPopup(`Unhandled Promise Rejection: ${reason}`);
  //process.exit(1);
});
