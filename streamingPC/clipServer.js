const express = require("express");
const path = require("path");
const app = express();
const cors = require("cors");
const fs = require("fs");

// Helper function to get app root directory (works in both dev and pkg)
const getAppRoot = () => {
  return process.pkg ? path.dirname(process.execPath) : process.cwd();
};

app.use(cors());
// Directory where OBS outputs the videos
let obsVideoDirectory = "D:/streamStuff/newClips/clipDestination";
let prefix = "Replay-";
// Serve the videos from the OBS output directory
app.use("/videos", (req, res, next) => {
  // This middleware ensures the directory exists and is accessible
  if (fs.existsSync(obsVideoDirectory)) {
    express.static(obsVideoDirectory)(req, res, next);
  } else {
    console.error(`Error: Video directory not found: ${obsVideoDirectory}`);
    res.status(500).send("Video directory not accessible");
  }
});

// Serve the list of video files
app.get("/api/videos", (req, res) => {
  // fs is already required at the top of the file
  fs.readdir(obsVideoDirectory, (err, files) => {
    if (err) {
      return res.status(500).send("Error reading video directory");
    }
    // Filter for .mp4 files or any video format you are using
    const videoFiles = files.filter((file) => file.startsWith(prefix));
    res.json(videoFiles);
  });
});

// Start the server
const PORT = 3123; // You can change the port if needed

async function startServer(oPath, oPrefix) {
  obsVideoDirectory = oPath;
  prefix = oPrefix;
  app.listen(PORT, () => {
    console.log(`\nClip server is running on http://localhost:${PORT}\n`);
  });
}
module.exports.startServer = startServer;
