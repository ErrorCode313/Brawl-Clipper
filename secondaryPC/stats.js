const os = require("os");
const path = require("path");
const fs = require("fs");
const FS = require("graceful-fs");


let sendData = { message: "default value" };
console.log("starting 1s");
let liveData = { message: "default value" };
function getMostRecentFile(directory) {
  const files = fs.readdirSync(directory);

  if (files.length === 0) {
    return null; // No files in the directory
  }

  const fileStats = files.map((file) => {
    const filePath = path.join(directory, file);
    return {
      file,
      mtime: fs.statSync(filePath).mtime,
    };
  });


  fileStats.sort((a, b) => b.mtime - a.mtime);

  return path.join(directory, fileStats[0].file);
}


function isFile(pathToCheck) {
  try {
    const stat = fs.statSync(pathToCheck);
    return stat.isFile();
  } catch (e) {
    return false;
  }
}

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

async function readFileWithRetriesBase64(filePath, retries = 5, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      // Try reading the file
      let data = FS.readFileSync(filePath, "base64");
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

const dumpPath = path.join(os.homedir(), "BrawlhallaStatDumps");
const deathsPath = path.join(
  os.homedir(),
  "BrawlhallaStatsLive",
  "Deaths.json"
);
const loadoutPath = path.join(
  os.homedir(),
  "BrawlhallaStatsLive",
  "Loadouts.json"
);
const rendersPath = path.join(os.homedir(), "BrawlhallaRenders");

async function main() {
  let file = await readFileWithRetries(getMostRecentFile(dumpPath));
  let matchData = JSON.parse(file);
  let file2 = await readFileWithRetries(deathsPath);
  let file3 = await readFileWithRetries(loadoutPath);
  let deathData = JSON.parse(file2);
  let loadoutData = JSON.parse(file3);
  let sum = 0;
  if (matchData.Teams == true) {
    console.log(getMostRecentFile(dumpPath));
    console.log("The latest stored match is a team match. Waiting for next one to start.");
    return;
  }
  liveData = await Promise.all(loadoutData.Players.map(async (val) => {
    if (val.Loadout.FaceImageName !== undefined) {
      let faceImagePath = path.join(rendersPath, val.Loadout.FaceImageName);

      if (!isFile(faceImagePath)) {
        console.log(`Face image not found or is a directory: ${faceImagePath}`);
        return null;
      }

      return {
        name: val.PlayerName,
        face: await readFileWithRetriesBase64(faceImagePath),
      };
    }
  }));


  let plr1Weapons = Object.entries(matchData.Player1)
    .filter(([string, val]) => {
      return val.TimeHeld != undefined;
    })
    .map((val) => {
      let damageDone = 0;
      Object.entries(val[1]).forEach((val) => {
        damageDone += val[1].EnemyDamage || 0;
      });
      return { name: val[0], damageDone: damageDone };
    });
  let plr2Weapons = Object.entries(matchData.Player2)
    .filter(([string, val]) => {
      return val.TimeHeld != undefined;
    })
    .map((val) => {
      let damageDone = 0;
      Object.entries(val[1]).forEach((val) => {
        damageDone += val[1].EnemyDamage || 0;
      });
      return { name: val[0], damageDone: damageDone };
    });

  let plr1Attacks = 0;
  let plr2Attacks = 0;

  plr1Weapons
    .map((val) => {
      return val.name;
    })
    .forEach((val) => {
      Object.entries(matchData.Player1[val]).forEach((val) => {
        if (val[1].Uses) {
          plr1Attacks += val[1].Uses;
        }
      });
    });

  plr2Weapons
    .map((val) => {
      return val.name;
    })
    .forEach((val) => {
      Object.entries(matchData.Player2[val]).forEach((val) => {
        if (val[1].Uses) {
          plr2Attacks += val[1].Uses;
        }
      });
    });

  let imgUrl = "";
  let imgUrl2 = "";
  let faceUrl = "";
  let faceUrl2 = "";
  let plr1data = loadoutData.Players.find((val) => {
    return (
      val.BrawlhallaID == matchData.Player1.BrawlhallaID &&
      val.PlayerName == matchData.Player1.PlayerName
    );
  });
  if (plr1data && plr1data.Loadout) {
    let plr1Image = plr1data.Loadout.SkinImageName;
    let plr1Face = plr1data.Loadout.FaceImageName;
    // console.log("Face: ", plr1Face);
    // console.log("Image: ", plr1ImagePath);
    let plr1ImagePath = path.join(rendersPath, plr1Image);
    let plr1FacePath = path.join(rendersPath, plr1Face);

    if (isFile(plr1ImagePath)) {
      let imgData = fs.readFileSync(plr1ImagePath, { encoding: "base64" });
      imgUrl = `data:image/png;base64,${imgData}`;

    } else {
      console.warn(`Image: ${plr1Image}, Face: ${plr1Face}, Image is missing or is not a file in Renders path.`);
    }

    if (isFile(plr1FacePath)) {
      let faceData = fs.readFileSync(plr1FacePath, { encoding: "base64" });
      faceUrl = `data:image/png;base64,${faceData}`;
    } else {
      console.warn(`Image: ${plr1Image}, Face: ${plr1Face}, Image is missing or is not a file in Renders path.`);
    }
  }

  let plr2data = loadoutData.Players.find((val) => {
    return (
      val.BrawlhallaID == matchData.Player2.BrawlhallaID &&
      val.PlayerName == matchData.Player2.PlayerName
    );
  });
  if (plr2data && plr2data.Loadout) {
    let plr2Image = plr2data.Loadout.SkinImageName;
    let plr2Face = plr2data.Loadout.FaceImageName;
    let plr2ImagePath = path.join(rendersPath, plr2Image);
    let plr2FacePath = path.join(rendersPath, plr2Face);
    // console.log("Image: ", plr2Image);
    // console.log("Face: ", plr2Face);
    if (isFile(plr2ImagePath)) {
      let imgData = fs.readFileSync(plr2ImagePath, { encoding: "base64" });
      imgUrl2 = `data:image/png;base64,${imgData}`;
    } else {
      console.warn(`Image: ${plr2Image}, Face: ${plr2Face}, Image is missing or is not a file in Renders path.`);
    }

    if (isFile(plr2FacePath)) {
      let faceData = fs.readFileSync(plr2FacePath, { encoding: "base64" });
      faceUrl2 = `data:image/png;base64,${faceData}`;
    } else {
      console.warn(`Image: ${plr2Image}, Face: ${plr2Face}, Image is missing or is not a file in Renders path.`);
    }
  }

  sendData = {
    player1: {
      name: matchData.Player1.PlayerName,
      damageDone: matchData.Player1.DamageDealt,
      weapons: plr1Weapons,
      plrImage: imgUrl,
      faceUrl: faceUrl,
      attacks: plr1Attacks,
      damageChart: matchData.Player1.Sequence.filter((val) => {
        return val.d != undefined;
      }).map((val) => {
        return { x: val.t, y: val.d };
      }),
      deaths: Object.entries(deathData.DeathList)
        .filter(([key, val]) => {
          return val.Victim.Player == 1;
        })
        .map(([key, val]) => {
          return val.Time;
        }),
    },
    player2: {
      name: matchData.Player2.PlayerName,
      damageDone: matchData.Player2.DamageDealt,
      weapons: plr2Weapons,
      plrImage: imgUrl2,
      faceUrl: faceUrl2,
      attacks: plr2Attacks,
      damageChart: matchData.Player2.Sequence.filter((val) => {
        return val.d != undefined;
      }).map((val) => {
        return { x: val.t, y: val.d };
      }),
      deaths: Object.entries(deathData.DeathList)
        .filter(([key, val]) => {
          return val.Victim.Player == 2;
        })
        .map(([key, val]) => {
          return val.Time;
        }),
    },
  };
}

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const exp = require("constants");

const app = express();

app.use(cors({ origin: "*" }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "web")));

const baseDir = path.join(__dirname, "web");

app.get("/", (req, res) => {
  const indexPath = path.join(baseDir, "index.html");
  const content = fs.readFileSync(indexPath, "utf8");
  res.type("html").send(content);
});

app.get("/api/data", (req, res) => {
  res.send(sendData);
});

app.get("/api/live", (req, res) => {
  res.send(liveData);
});

function start() {
  setInterval(() => {
    main();
  }, 1000);
}

module.exports.app = app;
module.exports.main = main;
module.exports.start = start;
