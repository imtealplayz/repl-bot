const { Events, AuditLogEvent } = require('discord.js');
const { User, Ticket } = require('./models');
const { OWNER_ID, CMD_PREFIX, COLORS } = require('./config');
const {
  getGuild, addXp, buildWelcomeEmbed, resolveVars,
  checkRaid, checkNuke, makeEmbed, xpForLevel,
} = require('./utils');
const { handleCommand, handleInteraction } = require('./commands');

function registerEvents(client) {

  // ── Ready ──────────────────────────────────────────────────────────────────
  client.on(Events.ClientReady, () => {
    console.log(`✅ Repl Bot is online as ${client.user.tag}`);
    client.user.setActivity('your server 👀', { type: 3 });
  });

  // ── Message Create ─────────────────────────────────────────────────────────
  const xpCooldowns = new Map();

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    try {

    const guildId   = message.guild.id;
    const userId    = message.author.id;
    const guildData = await getGuild(guildId).catch(() => null);
    if (!guildData) return;

    // ── Ticket transcript recording ──────────────────────────────────────────
    const ticket = await Ticket.findOne({ channelId: message.channelId, status: 'open' });
    if (ticket) {
      await Ticket.findOneAndUpdate(
        { ticketId: ticket.ticketId },
        { $push: { transcript: {
          authorId:       userId,
          authorUsername: message.author.username,
          content:        message.content || '',
          attachments:    message.attachments.map(a => a.url),
          timestamp:      message.createdAt,
        }}}
      );
    }

    // ── Custom commands ──────────────────────────────────────────────────────
    if (message.content.startsWith(CMD_PREFIX)) {
      const trigger = message.content.slice(CMD_PREFIX.length).split(' ')[0].toLowerCase();
      const { CustomCommand } = require('./models');
      const cmd = await CustomCommand.findOne({ guildId, trigger });
      if (cmd) {
        const coolKey = `${guildId}:${userId}:${trigger}`;
        const last    = xpCooldowns.get(coolKey);
        if (last && Date.now() - last < 3000) return;
        xpCooldowns.set(coolKey, Date.now());
        const response = resolveVars(cmd.response, message.member);
        return message.reply(response);
      }
    }

    // ── Message count ────────────────────────────────────────────────────────
    const mode = guildData.msgLogMode || 'blacklist';
    let shouldCount = true;
    if (mode === 'blacklist' && (guildData.msgBlacklist || []).includes(message.channelId)) shouldCount = false;
    if (mode === 'whitelist' && (guildData.msgWhitelist || []).length && !(guildData.msgWhitelist || []).includes(message.channelId)) shouldCount = false;

    if (shouldCount) {
      await User.findOneAndUpdate({ userId, guildId }, { $inc: { messageCount: 1 } }, { upsert: true, new: true });
    }

    // ── XP gain ──────────────────────────────────────────────────────────────
    if (!guildData.levelingEnabled) return;
    const coolKey = `${guildId}:${userId}:xp`;
    const lastXp  = xpCooldowns.get(coolKey);
    if (lastXp && Date.now() - lastXp < (guildData.xpCooldown || 60) * 1000) return;
    xpCooldowns.set(coolKey, Date.now());

    const { leveledUp, newLevel, userData } = await addXp(userId, guildId, guildData, client);

    if (leveledUp && guildData.levelUpMessages) {
      message.channel.send({ embeds: [makeEmbed({
        color: COLORS.PRIMARY,
        description: `🎉 <@${userId}> leveled up to **Level ${newLevel}**!`,
      })] }).catch(() => {});
    }

    if (leveledUp) {
      const reward = (guildData.levelRoles || []).find(r => r.level === newLevel);
      if (reward) {
        const guildMember = message.member;
        if (guildMember && !guildMember.roles.cache.has(reward.roleId)) {
          guildMember.roles.add(reward.roleId).catch(() => {});
        }
      }
    }

    } catch (err) {
      console.error('MessageCreate error (non-fatal):', err.message);
    }
  });

  // ── Guild Member Add ───────────────────────────────────────────────────────
  client.on(Events.GuildMemberAdd, async (member) => {
    const guildData = await getGuild(member.guild.id);

    // Anti-Raid
    await checkRaid(member, guildData, client);

    // Auto-role
    if (guildData.autoRoleId) {
      const role = member.guild.roles.cache.get(guildData.autoRoleId);
      if (role) member.roles.add(role).catch(() => {});
    }

    // Welcome message
    const cfg = guildData.welcomeEmbed;
    if (cfg?.enabled && cfg?.channelId) {
      const ch = member.guild.channels.cache.get(cfg.channelId);
      if (ch) {
        const embed   = await buildWelcomeEmbed(member, cfg);
        const outside = cfg.outsideText ? resolveVars(cfg.outsideText, member) : null;
        ch.send({ content: outside || undefined, embeds: [embed] }).catch(() => {});
      }
    }
  });

  // ── Interaction Create ─────────────────────────────────────────────────────
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction, client);
      } else {
        await handleInteraction(interaction, client);
      }
    } catch (err) {
      console.error('Interaction error:', err);
      const errMsg = { embeds: [makeEmbed({ color: COLORS.ERROR, description: `❌ An error occurred: ${err.message}` })], ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        interaction.followUp(errMsg).catch(() => {});
      } else {
        interaction.reply(errMsg).catch(() => {});
      }
    }
  });

  // ── Audit Log — Anti-Nuke ──────────────────────────────────────────────────
  client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    const guildData = await getGuild(guild.id);
    await checkNuke(entry, guild, guildData, client);
  });
}

module.exports = { registerEvents };
