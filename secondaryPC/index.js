const chokidar = require("chokidar");
const FS = require("graceful-fs");
const os = require("os");
const path = require("path");
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

// Helper function to get app root directory (works in both dev and pkg)
const getAppRoot = () => {
  return process.pkg ? path.dirname(process.execPath) : process.cwd();
};
const inquirer = require("inquirer");
const { default: OBSWebSocket } = require("obs-websocket-js");
let stats;
let app;

// Game mode selection question
const gameModeQuestion = [
  {
    name: "gameMode",
    type: "list",
    message: "Which game mode would you like to run?",
    choices: ["1v1s", "2v2s"]
  }
];

let lastTime = null;
let storedLength = 0;
let brawlPath = path.join(os.homedir(), "BrawlhallaStatsLive", "Deaths.json");
let rendersPath = path.join(os.homedir(), "BrawlhallaRenders", "\\");
let dumpPath = path.join(os.homedir(), "BrawlhallaStatDumps", "\\");
let loadoutPath = path.join(
  os.homedir(),
  "BrawlhallaStatsLive",
  "Loadouts.json"
);
const obs = new OBSWebSocket();

// Get path to stored.json and create it if it doesn't exist
const storedJsonPath = path.join(getAppRoot(), "stored.json");
FS.existsSync(storedJsonPath) || FS.writeFileSync(storedJsonPath, "{}");
const stored = JSON.parse(FS.readFileSync(storedJsonPath));
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

async function readFileWithRetries(filePath, retries = 5, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      // Try reading the file
      let data = FS.readFileSync(filePath, "utf8");
      return data;
    } catch (err) {
      // If the file is busy or locked, retry after a delay
      if (err.code === "EBUSY" || err.code === "EACCES") {
        console.log(`File is busy, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        // If it's another error, throw it
        throw err;
      }
    }
  }
  throw new Error(`Failed to read file after ${retries} attempts`);
}

const dgram = require("dgram");
async function getLocalIPAddress() {
  const socket = dgram.createSocket("udp4");

  return new Promise((resolve) => socket.connect(80, "8.8.8.8", () => {
    const address = socket.address();
    socket.close();
    resolve(address.address); // This is the local IP in use
  }));

}

async function fileExists(filePath) {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      FS.access(filePath, FS.constants.F_OK, (err) => {
        if (!err) {
          clearInterval(interval);
          resolve(true);
        }
      });
    }, 1000); // Check every second
  });
}

// Function to handle game mode selection
async function selectGameMode() {
  return new Promise((resolve) => {
    inquirer.prompt(gameModeQuestion).then((answer) => {
      if (answer.gameMode === "1v1s") {
        console.log("Loading 1v1s mode...");
        stats = require("./stats.js");
      } else {
        console.log("Loading 2v2s mode...");
        stats = require("./stats2.js");
      }
      app = stats.app;
      resolve();
    });
  });
}

async function init() {
  // First, select the game mode
  await selectGameMode();

  // Then check if the brawlPath exists
  let exist = FS.existsSync(brawlPath);
  if (!exist) {
    inquirer
      .prompt([
        {
          name: "notFound",
          type: "list",
          message:
            "Brawlhalla Deaths.json file not found. What would you like to do?",
          choices: [
            "Continue and wait for file to exist",
            "Manually set location",
            "Exit the program",
          ],
        },
      ])
      .then(async (answers) => {
        switch (answers.notFound) {
          case "Continue and wait for file to exist":
            console.log("Waiting...");
            await fileExists(brawlPath);
            start();
            break;
          case "Manually set location":
            inquirer
              .prompt([
                {
                  name: "manualPath",
                  message: "Please enter the full path to Deaths.json: ",
                  type: "input",
                },
              ])
              .then((manualAnswers) => {
                brawlPath = manualAnswers.manualPath;
                init();
              });
            break;
          case "Exit the program":
            console.log("Exiting program...");
            process.exit(0);
        }
      });
  } else {
    start();
  }
}

init();
function start() {
  inquirer.prompt(questions).then(
    async (answers) => {
      let { obsPassword, obsPort, obsIp, obsPrefix } = answers;
      FS.writeFileSync(storedJsonPath, JSON.stringify(answers));
      console.log("pass: ", obsPassword);
      console.log("port: ", obsPort);
      let watcher = chokidar.watch(brawlPath, { persistent: true });
      try {
        await obs.connect(`ws://${obsIp}:${obsPort}`, obsPassword);
      } catch (err) {
        throw Error("Failed to connect to OBS: " + err);
      }
      console.log("OBS connected!");
      console.log("Waiting for streaming PC partner program...");
      await waitForMain(obs);
      console.log("Partner Program connected!");
      console.log("Program started, waiting for death...");
      let localIp = await getLocalIPAddress();
      app.listen(3122, () => {
        console.log(
          `Use http://${localIp}:3122 on streaming computer as browser source to view stats`
        );
      });
      stats.start();
      console.log("Stats App started!");
      watcher.on("change", async () => {
        try {
          // Attempt to read the file with retries
          let newData = await readFileWithRetries(brawlPath, 5, 500);
          if (newData) {
            newData = JSON.parse(newData);
            if (newData.DeathList.length == 0) {
              await clearClips(obs);
              return;
            }

            let newestLastTime =
              newData.DeathList[newData.DeathList.length - 1].Time;
            if (lastTime != newestLastTime) {
              if (
                newData.DeathList.length <= storedLength ||
                lastTime > newestLastTime
              ) {
                await clearClips(obs);
              }
              storedLength = newData.DeathList.length;
              await obs.call("SaveReplayBuffer");
              let lastDeath = newData.DeathList[newData.DeathList.length - 1];
              lastTime = lastDeath.Time;
              console.log(`Replay Saved!`);
            }
          } else {
            console.log("No data: ", newData);
          }
        } catch (err) {
          console.error("Error processing change event:", err);
        }
      });
    },
    (reason) => {
      console.error(reason);
    }
  );
}

function clearClips(obs) {
  return new Promise((resolve, reject) => {
    obs
      .call("BroadcastCustomEvent", {
        eventData: { name: "clearClips" },
      })
      .then(() => {
        resolve();
      });
  });
}

function waitForMain(obs) {
  return new Promise((resolve, reject) => {
    obs
      .call("BroadcastCustomEvent", {
        eventData: { name: "pingMain" },
      })
      .then(() => {
        obs.on("CustomEvent", (data) => {
          if (data.name == "mainActive") {
            obs.removeListener("CustomEvent");
            resolve(true);
          }
        });
      });
  });
}

// Add error handling
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
