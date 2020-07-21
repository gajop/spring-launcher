# spring-launcher
Launcher for SpringRTS games

[![Build Status](https://travis-ci.org/gajop/spring-launcher.svg?branch=master)](https://travis-ci.org/gajop/spring-launcher)

## What's this for?

The goal of SpringLauncher it to work as an installer and downloader of all required files for a game to run on the SpringRTS engine. Optionally maps and other specific files can be auto-downloaded after install in the player's machine, and you may even generate a portable version with SpringLauncher as a frontend to launch your game.

## How can I make my game compatible with SpringLauncher?

1. First you need to have your game working on Rapid. Rapid is a system which generates games/mod files automatically in an auto-downloadable format any time a new version of your game is ready, constantly (every 4 mins or so) checking your assigned Github repository for a predefined commit message in the format VERSION{x.xx} - eg. *VERSION{1.02}*. Check https://springrts.com/wiki/Rapid to learn how to do it.
2. Create a fork from an existing SpringRTS chobby wrapper, for instance: https://github.com/beyond-all-reason/BYAR-Chobby. Name your fork something like gamename-Chobby (optional, but usually helps finding it later)
3. Open an issue to create new Rapid tags (just like you did in step 1) for all game versions you need, usually 'Test' (for local testing) and 'Release' (for public consumption). For TA Prime, for instance, those tags were *tap-chobby:test* and *tap-chobby:stable*
4. Install https://github.com/apps/springrts-launcher in the GitHub repository you created
5. Change the game name and rapid tags in dist_cfg\config.json so it uses your own game name and rapid tags. Commit and push, this will trigger the automatic generation of installers of your game.

## How do I generate a new installer for Windows and Linux?

The process is automatic. Simply make a commit to your *gamename-chobby* repository and push it. Make sure it modifies something in the dist_cfg folder (even changing a single character in a .json will do), that's the one being monitored by the installer generation app. After a few minutes, usually less than five, new releases for Windows and Linux will be ready at the links informed by Gajop to you (after Step 4 above you'll want to reach out for him on Discord, link below).

## Help and Questions

Please join the Spring-Launcher Discord channel (in the SpringRTS server - https://discord.gg/ZcBJ2c7) for direct access to the developer (@Gajop) and other SpringRTS mod developers who might be able to assist you with any issues or questions you might have.

## Setup (Advanced, to generate your installers by yourself)

1. Download this repository
2. Install npm if you haven't
3. Create a `config.json` file in the `src` directory. See `config.json` example: https://github.com/Spring-Chobby/DistCfg/blob/master/dist_cfg/config.json
4. Install dependencies with `npm install`
5. Start the program with `npm start`
