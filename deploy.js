require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { TOKEN, CLIENT_ID } = require('./config');
const { commandDefs } = require('./commands');

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Deploying slash commands...');
    const data = await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commandDefs.map(c => c.toJSON()),
    });
    console.log(`✅ Deployed ${data.length} commands globally.`);
  } catch (err) {
    console.error('❌ Deploy failed:', err);
  }
})();
