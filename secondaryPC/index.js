const chokidar = require("chokidar");
const FS = require("graceful-fs");
const os = require("os");
const path = require("path");
const inquirer = require("inquirer");
const { default: OBSWebSocket } = require("obs-websocket-js");
const args = process.argv.slice(2);
let stats;
if (args.length == 0 || args[0].includes("1")) {
  stats = require("./stats.js");
} else if (args[0].includes("2")) {
  stats = require("./stats2.js");
}
const app = stats.app;

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
const stored = require("./stored.json");
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

function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  let localIP = null;

  for (const interfaceName in interfaces) {
    const addresses = interfaces[interfaceName];

    for (const addressInfo of addresses) {
      // We're only interested in IPv4 and non-internal (i.e., not `localhost`) addresses
      if (addressInfo.family === "IPv4" && !addressInfo.internal) {
        localIP = addressInfo.address;
      }
    }
  }

  return localIP;
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

async function init() {
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
      FS.writeFileSync("./stored.json", JSON.stringify(answers));
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

      app.listen(3122, () => {
        console.log(
          `Use http://${getLocalIPAddress()}:3122 on streaming computer as browser source to view stats`
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
