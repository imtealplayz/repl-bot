const { Events, EmbedBuilder } = require('discord.js');
const { User, Ticket, Afk, CustomCommand } = require('./models');
const { OWNER_ID, CMD_PREFIX, COLORS } = require('./config');
const {
  getGuild, addXp, buildWelcomeEmbed, resolveVars,
  checkRaid, checkNuke, makeEmbed, xpForLevel, formatDuration,
} = require('./utils');
const { handleCommand, handleInteraction } = require('./commands');

function registerEvents(client) {

  // ── Ready ──────────────────────────────────────────────────────────────────
  client.on(Events.ClientReady, () => {
    console.log(`✅ Repl Bot is online as ${client.user.tag}`);
    client.user.setActivity('your server 👀', { type: 3 });
  });

  // ── Message Create ─────────────────────────────────────────────────────────
  const xpCooldowns  = new Map();
  const cmdCooldowns = new Map();

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    try {
      const guildId   = message.guild.id;
      const userId    = message.author.id;
      const guildData = await getGuild(guildId).catch(() => null);
      if (!guildData) return;

      // ── Ticket transcript recording ────────────────────────────────────────
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

      // ── AFK — remove AFK when user sends a message ─────────────────────────
      const userAfk = await Afk.findOne({ userId, $or: [{ guildId }, { allGuilds: true }] });
      if (userAfk) {
        const elapsed = Date.now() - new Date(userAfk.createdAt).getTime();
        await Afk.deleteMany({ userId, $or: [{ guildId }, { allGuilds: true }] });
        message.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setDescription(`👋 Welcome back <@${userId}>! You were AFK for **${formatDuration(elapsed)}**.`)
          ]
        }).catch(() => {});
      }

      // ── AFK — notify when someone pings an AFK user ────────────────────────
      if (message.mentions.users.size > 0) {
        for (const [mentionedId, mentionedUser] of message.mentions.users) {
          if (mentionedUser.bot) continue;
          const afkEntry = await Afk.findOne({ userId: mentionedId, $or: [{ guildId }, { allGuilds: true }] });
          if (afkEntry) {
            const elapsed = Date.now() - new Date(afkEntry.createdAt).getTime();
            message.channel.send({
              embeds: [new EmbedBuilder()
                .setColor(COLORS.WARNING)
                .setDescription(`💤 **${mentionedUser.username}** is AFK: **${afkEntry.reason}** — <t:${Math.floor(new Date(afkEntry.createdAt).getTime()/1000)}:R>`)
              ]
            }).catch(() => {});
          }
        }
      }

      // ── Custom commands ────────────────────────────────────────────────────
      if (message.content.startsWith(CMD_PREFIX)) {
        const trigger = message.content.slice(CMD_PREFIX.length).split(' ')[0].toLowerCase();

        // AFK via prefix
        if (trigger === 'afk') {
          const parts  = message.content.slice(CMD_PREFIX.length + 'afk'.length).trim();
          const reason = parts || 'AFK';
          await Afk.deleteMany({ userId, guildId });
          await Afk.create({ userId, guildId, reason, allGuilds: false });
          return message.channel.send({
            embeds: [new EmbedBuilder()
              .setColor(COLORS.INFO)
              .setDescription(`💤 <@${userId}> is now AFK: **${reason}**`)
            ]
          });
        }

        const cmd = await CustomCommand.findOne({ guildId, trigger });
        if (cmd) {
          const coolKey = `${guildId}:${userId}:${trigger}`;
          const last    = cmdCooldowns.get(coolKey);
          if (last && Date.now() - last < 3000) return;
          cmdCooldowns.set(coolKey, Date.now());
          const response = resolveVars(cmd.response, message.member);
          return message.channel.send(response);
        }
      }

      // ── Message count ──────────────────────────────────────────────────────
      const mode = guildData.msgLogMode || 'blacklist';
      let shouldCount = true;
      if (mode === 'blacklist' && (guildData.msgBlacklist || []).includes(message.channelId)) shouldCount = false;
      if (mode === 'whitelist' && (guildData.msgWhitelist || []).length && !(guildData.msgWhitelist || []).includes(message.channelId)) shouldCount = false;

      if (shouldCount) {
        await User.findOneAndUpdate(
          { userId, guildId },
          { $inc: { messageCount: 1 }, $setOnInsert: { userId, guildId } },
          { upsert: true, new: true }
        );
      }

      // ── XP gain ────────────────────────────────────────────────────────────
      if (!guildData.levelingEnabled) return;
      const coolKey = `${guildId}:${userId}:xp`;
      const lastXp  = xpCooldowns.get(coolKey);
      if (lastXp && Date.now() - lastXp < (guildData.xpCooldown || 60) * 1000) return;
      xpCooldowns.set(coolKey, Date.now());

      const { leveledUp, newLevel } = await addXp(userId, guildId, guildData, client);

      if (leveledUp && guildData.levelUpMessages) {
        message.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setDescription(`🎉 <@${userId}> just advanced to **Level ${newLevel}**! Keep it up!`)
            .setFooter({ text: `Use /level to see your full stats` })
          ]
        }).catch(() => {});
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
    try {
      const guildData = await getGuild(member.guild.id);
      await checkRaid(member, guildData, client);
      if (guildData.autoRoleId) {
        const role = member.guild.roles.cache.get(guildData.autoRoleId);
        if (role) member.roles.add(role).catch(() => {});
      }
      const cfg = guildData.welcomeEmbed;
      if (cfg?.enabled && cfg?.channelId) {
        const ch = member.guild.channels.cache.get(cfg.channelId);
        if (ch) {
          const embed   = await buildWelcomeEmbed(member, cfg);
          const outside = cfg.outsideText ? resolveVars(cfg.outsideText, member) : null;
          ch.send({ content: outside || undefined, embeds: [embed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('GuildMemberAdd error:', err.message);
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
    try {
      const guildData = await getGuild(guild.id);
      await checkNuke(entry, guild, guildData, client);
    } catch (err) {
      console.error('AuditLog error:', err.message);
    }
  });
}

module.exports = { registerEvents };
