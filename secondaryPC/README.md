# BrawlhallaAutoClip - SecondaryPC Component

This application monitors Brawlhalla gameplay data and triggers OBS replay buffer saves when a death occurs. It also serves statistics for display as a browser source.

## Requirements

- Node.js (v18 or higher recommended)
- OBS Studio with WebSocket plugin configured
- Brawlhalla game with stats output enabled

## Setup and Build Instructions

1. **Install Dependencies and Build Executable:**
   - Run `setup.bat` to install dependencies and build the executable
   - This will create a standalone executable `secondarypc.exe`

2. **Running the Application:**
   - Use `run.bat` to start the packaged application
   - **OR**
   - Run `start.bat` to run from Node.js (without packaging)
   - **OR**
   - Use `start 1v1s.bat` or `start 2v2s.bat` to directly select a game mode

## Configuration

During first run, you'll be prompted to provide:

1. OBS WebSocket connection details:
   - IP address
   - Port (default: 4455)
   - Password
   - Replay buffer prefix

2. Game mode selection:
   - 1v1s - For solo matches
   - 2v2s - For team matches

Settings will be saved to `stored.json` in the application directory.

## Statistics Browser Source

After the application starts, it will display a URL (e.g., `http://192.168.1.100:3122`) to use as a browser source in OBS on your streaming PC.
