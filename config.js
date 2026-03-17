require('dotenv').config();

module.exports = {
  TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID || '1473915873373720652',
  MONGO_URI: process.env.MONGO_URI,
  OWNER_ID: '926063716057894953',

  // Anti-Raid defaults
  RAID_JOIN_COUNT: 5,
  RAID_JOIN_WINDOW: 10000,
  NEW_ACCOUNT_AGE_DAYS: 7,

  // Anti-Nuke defaults
  NUKE_CHANNEL_DELETE: 3,
  NUKE_BAN_COUNT: 3,
  NUKE_KICK_COUNT: 5,
  NUKE_ROLE_DELETE: 2,
  NUKE_WINDOW: 5000,

  // XP defaults
  XP_MIN: 15,
  XP_MAX: 25,
  XP_COOLDOWN: 60000,

  // Custom command prefix
  CMD_PREFIX: '!',

  // Colors
  COLORS: {
    PRIMARY: 0x7C3AED,
    SUCCESS: 0x4ADE80,
    ERROR: 0xEF4444,
    WARNING: 0xFBBF24,
    INFO: 0x4F8EF7,
  },
};
