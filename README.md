# Brawl Clipper

Brawl Clipper is an automated tool for Brawlhalla streamers and tournament organizers that captures all death events and displays them with real-time stats. The system monitors Brawlhalla's built-in stats system for death events and automatically triggers OBS replay buffer recording, providing a seamless integration for capturing every KO during streams. Because in Brawlhalla, death is just another statistic worth collecting!

## Features

- **Automatic Death Clips** - Records gameplay clips whenever anyone dies in Brawlhalla (RIP)
- **Real-time Stats Display** - Overlays match statistics on clips so viewers know exactly who got wrecked and how
- **Local Web Interface** - Provides a browser source for OBS that's easier to set up than explaining to your friend why they lost
- **Auto-Cleanup** - Automatically deletes clips at the start of new games (if only memories worked that way)
- **Support for Both Tournament 1v1 Gamemodes and Tournament 2v2 Gamemodes** - Record every 1v1 ego boost and every 2v2 betrayal in crisp resolution.
- **Dual PC Support** - Optimized for tournament streaming setups, because one PC just can't handle all that carnage

## System Requirements

**The secondary computer may only be used to spectate the game—you cannot play the match on it. Attempting to play from the secondary computer will cause it to not work properly.**

- **OBS Studio** with WebSocket server enabled
- **Brawlhalla** with `-writestats` launch option
- **Windows** operating system
- **Dual PC Setup** (Recommended): 
  - While running on a single PC is possible, the `-writestats` feature could potentially crash the game and is not recommended by the developers for production use. A dual PC setup isolates this risk from your streaming environment.
  - The secondary computer should be spectating the game with a shorter or equal spectate delay (shorter is preferred).
- An internet connection, patience, this clover leaf 🍀 (recommended), and at least 4 gumballs (optional). 

## Installation

### Option 1: Standalone Release (Windows)

1. Download the latest executables from the [Releases](https://github.com/ErrorCode313/Brawl-Clipper/releases) page
2. Extract the files to separate locations on your gaming PC and streaming PC (or the same PC if you like living dangerously)

### Option 2: From Source

**Prerequisites:**
- [Node.js](https://nodejs.org/) (v12 or higher)

**Setup:**
1. Clone this repository
2. Install dependencies for both components:
   ```
   # In secondaryPC directory
   npm install
   
   # In streamingPC directory
   npm install
   ```
3. You probably know what you're doing if you're doing this... Good Luck!

## Setup and Configuration

**Note: the application stores your WebSocket connection settings locally for convenience in `stored.json`. DO NOT SHARE THIS FILE WITH ANYONE. This will be made more secure in the future 🙃**

### Step 1: Configure Brawlhalla on secondary

Add the `-writestats` launch option to Brawlhalla:

1. On Steam in secondary PC: Right-click Brawlhalla > Properties > General > Launch Options
2. Add `-writestats` and click OK

### Step 2: Configure OBS

1. Enable WebSocket Server in OBS:
   - Tools > WebSocket Server Settings
   - Check "Enable WebSocket Server"
   - Enable Authentication and generate a password (recommended)
   - Note the Server Port (default: 4455)

2. Set up Replay Buffer in OBS:
   - Settings > Output > Replay Buffer
   - Enable and configure Replay Buffer
   - Set the Maximum Replay Time (~7 seconds recommended)
   - Set a replay buffer filename prefix (e.g., "Replay-")

### Step 3: Run Brawl Clipper

### Dual PC setup (Recommended)
#### On Secondary/Gaming PC:
1. Run the secondaryPC application
2. Have Brawlhalla running with `-writestats` launch option
2. Enter your OBS WebSocket server details when prompted (OBS Tools > WebSocket Server Settings > Show Connect Info)

#### On Streaming PC:
1. Run the streamingPC application
2. Enter your OBS WebSocket server details when prompted (OBS Tools > WebSocket Server Settings > Show Connect Info)
3. Add the provided URL as a Browser Source in OBS:
   - Add a Browser Source to your scene
   - Enter the URL provided in the terminal (http://[LOCAL-IP]:3122)
   - Set appropriate width/height for your scene

### Single PC setup:
1. Run Brawlhalla with `-writestats` launch option
2. Start both the streamingPC application and the secondaryPC application
3. Add the provided URL as a Browser Source in OBS:
   - Add a Browser Source to your scene
   - Enter the URL provided in the terminal (http://[LOCAL-IP]:3122)
   - Set appropriate width/height for your scene

## Usage

Once configured, Brawl Clipper will:

1. Connect to OBS on both computers using the WebSocket protocol
2. Monitor Brawlhalla's death events through its stats system (it's basically a digital vulture)
3. Automatically trigger OBS replay buffer recordings when deaths occur
4. Display these clips with overlaid stats in your stream through the browser source

Any existing clips will be displayed on the web interface and will be automatically cleared when a new game begins.

## Troubleshooting

- **OBS Connection Issues**: Verify WebSocket server is enabled and credentials are correct. 
- **No Clips Being Created**: Ensure Replay Buffer is enabled in OBS and properly configured.
- **Stats Not Appearing**: Verify Brawlhalla is running with the `-writestats` option. Yes, you actually have to follow directions.
- **Browser Source Not Working**: Check that the correct URL is being used. "Close enough" doesn't count with URLs.
- **Viewing Error Messages**: If encountering issues, run the program through command prompt/terminal to see error messages before the window auto-closes. 
- **The secondary computer may only be used to spectate the game—you cannot play the match on it. Attempting to play from the secondary computer will cause it to not work properly.**

## Attribution

Created by [@ErrorCode313](https://x.com/ErrorCode313) & Goblins from Grimblehook - because someone had to do it, and that someone was me (mostly).

## License

This project is dual-licensed:

- **Code (Node.js apps, CLI logic, server)**: [GNU General Public License v3.0 (GPLv3)](LICENSE)
- **Website UI content (HTML, CSS, frontend)**: [Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE-CC-BY)
- **Images licenced by and "borrowed" from Blue Mammoth Games**

Usage of the UI components requires maintaining the attribution to the original creator (@ErrorCode313).
