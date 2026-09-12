# Repl-Bot

A modular Discord moderation and community bot built with Node.js, discord.js, and MongoDB.

## Features

- Moderation and utility commands
- Giveaway management
- Discord event handling
- Persistent MongoDB storage
- Slash-command deployment
- Modular command/event structure

## Stack

- JavaScript
- Node.js
- discord.js
- MongoDB / Mongoose

## Setup

```bash
npm install
node deploy.js
node index.js
```

Create a `.env` file containing the Discord and MongoDB configuration expected by `config.js`. Keep credentials and bot tokens out of Git.

## Structure

```text
commands.js   Commands and server features
config.js     Runtime configuration
deploy.js     Slash-command registration
events.js     Discord event handlers
index.js      Bot entry point
models.js     MongoDB models
utils.js      Shared utilities and scheduled tasks
```

## Status

Functional Discord bot project with room for additional features.
