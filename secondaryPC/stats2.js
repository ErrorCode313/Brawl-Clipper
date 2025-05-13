const os = require("os");
const fs = require("fs");
const FS = require("graceful-fs");
const express = require("express");
console.log("starting 2s");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

// Initialize arrays to store data for each team
let sendData = [];
let liveData = [];

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
async function main(teamnumber) {
  let file = await readFileWithRetries(getMostRecentFile(dumpPath));
  let matchData = JSON.parse(file);
  let file2 = await readFileWithRetries(deathsPath);
  let file3 = await readFileWithRetries(loadoutPath);
  let deathData = JSON.parse(file2);
  let loadoutData = JSON.parse(file3);
  if (matchData.Teams == false) {
    return;
  }
  // Filter players based on team number
  let plrNumbers = Object.keys(matchData).filter((val) => {
    return (
      (teamnumber === 0 && val.includes("Player")) ||
      matchData[val].TeamNum == teamnumber
    );
  });

  liveData[teamnumber] = loadoutData.Players.map((val) => {
    return {
      name: val.PlayerName,
      face: fs.readFileSync(path.join(rendersPath, val.Loadout.FaceImageName)),
    };
  });

  let plr1Weapons = Object.entries(matchData[plrNumbers[0]])
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

  let plr2Weapons = Object.entries(matchData[plrNumbers[1]])
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
    .map((val) => val.name)
    .forEach((val) => {
      Object.entries(matchData[plrNumbers[0]][val]).forEach((val) => {
        if (val[1].Uses) {
          plr1Attacks += val[1].Uses;
        }
      });
    });

  plr2Weapons
    .map((val) => val.name)
    .forEach((val) => {
      Object.entries(matchData[plrNumbers[1]][val]).forEach((val) => {
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
      val.BrawlhallaID == matchData[plrNumbers[0]].BrawlhallaID &&
      val.PlayerName == matchData[plrNumbers[0]].PlayerName
    );
  });

  if (plr1data?.Loadout) {
    let plr1Image = plr1data.Loadout.SkinImageName;
    let plr1Face = plr1data.Loadout.FaceImageName;
    imgUrl = fs.readFileSync(path.join(rendersPath, plr1Image), {
      encoding: "base64",
    });
    imgUrl = `data:image/png;base64,${imgUrl}`;
    faceUrl = fs.readFileSync(path.join(rendersPath, plr1Face), {
      encoding: "base64",
    });
    faceUrl = `data:image/png;base64,${faceUrl}`;
  }

  let plr2data = loadoutData.Players.find((val) => {
    return (
      val.BrawlhallaID == matchData[plrNumbers[1]].BrawlhallaID &&
      val.PlayerName == matchData[plrNumbers[1]].PlayerName
    );
  });

  if (plr2data?.Loadout) {
    let plr2Image = plr2data.Loadout.SkinImageName;
    let plr2Face = plr2data.Loadout.FaceImageName;
    imgUrl2 = fs.readFileSync(path.join(rendersPath, plr2Image), {
      encoding: "base64",
    });
    imgUrl2 = `data:image/png;base64,${imgUrl2}`;
    faceUrl2 = fs.readFileSync(path.join(rendersPath, plr2Face), {
      encoding: "base64",
    });
    faceUrl2 = `data:image/png;base64,${faceUrl2}`;
  }

  sendData[teamnumber] = {
    player1: {
      name: matchData[plrNumbers[0]].PlayerName,
      damageDone: matchData[plrNumbers[0]].DamageDealt,
      weapons: plr1Weapons,
      plrImage: imgUrl,
      faceUrl: faceUrl,
      attacks: plr1Attacks,
      damageChart: matchData[plrNumbers[0]].Sequence.filter((val) => {
        return val.d != undefined;
      }).map((val) => {
        return { x: val.t, y: val.d };
      }),
      deaths: Object.entries(deathData.DeathList)
        .filter(([key, val]) => {
          return val.Victim.Player == parseInt(plrNumbers[0].slice(-1));
        })
        .map(([key, val]) => {
          return val.Time;
        }),
    },
    player2: {
      name: matchData[plrNumbers[1]].PlayerName,
      damageDone: matchData[plrNumbers[1]].DamageDealt,
      weapons: plr2Weapons,
      plrImage: imgUrl2,
      faceUrl: faceUrl2,
      attacks: plr2Attacks,
      damageChart: matchData[plrNumbers[1]].Sequence.filter((val) => {
        return val.d != undefined;
      }).map((val) => {
        return { x: val.t, y: val.d };
      }),
      deaths: Object.entries(deathData.DeathList)
        .filter(([key, val]) => {
          return val.Victim.Player == parseInt(plrNumbers[1].slice(-1));
        })
        .map(([key, val]) => {
          return val.Time;
        }),
    },
  };
}

const app = express();

app.use(
  cors({
    origin: "*",
  })
);
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "web2")));

// Set up interval to update data for each team
function start() {
  setInterval(() => {
    main(1);
    main(2);
  }, 1000);
}
// Team-specific endpoints matching the original format
app.get("/team0/api/data", (req, res) => {
  res.send(sendData[1]);
});

app.get("/team0/live", (req, res) => {
  res.send(liveData[1]);
});

app.get("/team1/api/data", (req, res) => {
  res.send(sendData[2]);
});

app.get("/team1/live", (req, res) => {
  res.send(liveData[2]);
});

// Default route for serving the web interface
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "web2", "index.html"));
});

module.exports = {
  app,
  main,
  start,
};
