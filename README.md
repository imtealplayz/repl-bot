# Repl-Bot

Repl-Bot is a versatile Discord bot designed to provide various functionalities to your server, including moderation, utility commands, and interactive features. Built with `discord.js` and integrated with MongoDB, it offers a persistent and dynamic experience for server members.

## Features

*   **Custom Commands:** A wide range of commands for server management and user interaction.
*   **Giveaway System:** Automated giveaway management to engage your community.
*   **MongoDB Integration:** Stores data persistently for user settings, giveaways, and other features.
*   **Modular Structure:** Easily extensible with new commands and events.

## Technologies Used

*   **Language:** JavaScript
*   **Framework:** Node.js, Discord.js
*   **Database:** MongoDB (via Mongoose)

## Project Structure

```
repl-bot/
├── commands.js             # Defines and handles bot commands
├── config.js               # Configuration settings for the bot (e.g., tokens, URIs)
├── deploy.js               # Script for deploying slash commands to Discord
├── events.js               # Handles Discord bot events (e.g., message, guildMemberAdd)
├── index.js                # Main bot entry point and initialization
├── models.js               # MongoDB schemas and models
├── package.json            # Project dependencies and scripts
├── utils.js                # Utility functions, including giveaway scheduler
└── README.md               # Project documentation
```

## Setup Instructions

To set up and run Repl-Bot on your Discord server, follow these steps:

### 1. Prerequisites

*   **Node.js:** Ensure you have Node.js (LTS version recommended) installed.
*   **MongoDB:** A running MongoDB instance (local or cloud-hosted, e.g., MongoDB Atlas).
*   **Discord Bot Token:** Create a new application on the [Discord Developer Portal](https://discord.com/developers/applications) and obtain your bot token.
*   **Discord Client ID:** Get your bot's client ID from the Discord Developer Portal.

### 2. Clone the Repository

```bash
git clone https://github.com/imtealplayz/repl-bot.git
cd repl-bot
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory of the project and add the following:

```
TOKEN=YOUR_DISCORD_BOT_TOKEN
CLIENT_ID=YOUR_DISCORD_CLIENT_ID
MONGO_URI=YOUR_MONGODB_CONNECTION_STRING
```

*Replace the placeholder values with your actual bot token, client ID, and MongoDB connection string.*

### 5. Deploy Slash Commands

Run the `deploy.js` script to register the bot's slash commands with Discord:

```bash
node deploy.js
```

### 6. Run the Bot

```bash
node index.js
```

The bot should now be online and ready to join your Discord server. Ensure you have invited the bot to your server with the necessary permissions.
