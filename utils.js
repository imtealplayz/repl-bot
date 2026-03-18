const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { COLORS, OWNER_ID } = require('./config');
const { User, Guild, Giveaway } = require('./models');

// ─── Embed Builders ──────────────────────────────────────────────────────────
function makeEmbed(opts = {}) {
  const e = new EmbedBuilder().setColor(opts.color || COLORS.PRIMARY);
  if (opts.title)       e.setTitle(opts.title);
  if (opts.description) e.setDescription(opts.description);
  if (opts.footer)      e.setFooter({ text: opts.footer });
  if (opts.thumbnail)   e.setThumbnail(opts.thumbnail);
  if (opts.image)       e.setImage(opts.image);
  if (opts.fields)      e.addFields(opts.fields);
  if (opts.timestamp)   e.setTimestamp();
  return e;
}

function successEmbed(desc)  { return makeEmbed({ color: COLORS.SUCCESS, description: `✅ ${desc}` }); }
function errorEmbed(desc)    { return makeEmbed({ color: COLORS.ERROR,   description: `❌ ${desc}` }); }
function warningEmbed(desc)  { return makeEmbed({ color: COLORS.WARNING, description: `⚠️ ${desc}` }); }
function infoEmbed(desc)     { return makeEmbed({ color: COLORS.INFO,    description: `ℹ️ ${desc}` }); }

// ─── Permission Checks ───────────────────────────────────────────────────────
function isOwner(userId)             { return userId === OWNER_ID; }
function hasAdmin(member)            { return member.permissions.has(PermissionsBitField.Flags.Administrator); }
function hasModPerms(member)         { return member.permissions.has(PermissionsBitField.Flags.ModerateMembers); }
function hasBanPerms(member)         { return member.permissions.has(PermissionsBitField.Flags.BanMembers); }
function hasKickPerms(member)        { return member.permissions.has(PermissionsBitField.Flags.KickMembers); }

function canActOn(executor, target) {
  if (!target.manageable) return false;
  if (executor.roles.highest.comparePositionTo(target.roles.highest) <= 0) return false;
  return true;
}

// ─── XP / Leveling ───────────────────────────────────────────────────────────
function xpForLevel(level) { return Math.floor(100 * Math.pow(level, 1.5)); }

function progressBar(current, needed, size = 10) {
  const filled = Math.round((current / needed) * size);
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, size - filled));
}

async function addXp(userId, guildId, guildData, client) {
  const xpGain = Math.floor(Math.random() * ((guildData.xpMax || 25) - (guildData.xpMin || 15) + 1)) + (guildData.xpMin || 15);
  let userData = await User.findOneAndUpdate(
    { userId, guildId },
    { $inc: { xp: xpGain }, $setOnInsert: { userId, guildId } },
    { upsert: true, new: true }
  );

  const needed = xpForLevel(userData.level + 1);
  if (userData.xp >= needed) {
    userData = await User.findOneAndUpdate(
      { userId, guildId },
      { $inc: { level: 1 }, $set: { xp: userData.xp - needed } },
      { new: true }
    );
    return { leveledUp: true, newLevel: userData.level, userData };
  }
  return { leveledUp: false, userData };
}

// ─── Welcome Variable Resolver ────────────────────────────────────────────────
function resolveVars(text, member) {
  if (!text) return '';
  const guild = member.guild;
  return text
    .replace(/{servername}/g, guild.name)
    .replace(/{user}/g,       `<@${member.id}>`)
    .replace(/{username}/g,   member.user.username)
    .replace(/{userid}/g,     member.id)
    .replace(/{members}/g,    guild.memberCount.toString())
    .replace(/{memberjoin}/g, guild.memberCount.toString())
    .replace(/{avatar}/g,     member.user.displayAvatarURL({ dynamic: true, size: 512 }));
}

async function buildWelcomeEmbed(member, cfg) {
  const avatarUrl = member.user.displayAvatarURL({ dynamic: true, size: 512 });
  const resolve   = (t) => resolveVars(t, member);
  const resolveUrl = (u) => u === '{avatar}' ? avatarUrl : (u || null);

  const embed = new EmbedBuilder().setColor(cfg.color || '#7C3AED');
  if (cfg.title)         embed.setTitle(resolve(cfg.title));
  if (cfg.description)   embed.setDescription(resolve(cfg.description));
  if (cfg.authorText)    embed.setAuthor({ name: resolve(cfg.authorText), iconURL: resolveUrl(cfg.authorIconUrl) || undefined });
  if (cfg.thumbnailUrl)  embed.setThumbnail(resolveUrl(cfg.thumbnailUrl));
  if (cfg.imageUrl)      embed.setImage(resolveUrl(cfg.imageUrl));
  if (cfg.showTimestamp) embed.setTimestamp();
  if (cfg.footerText)    embed.setFooter({ text: resolve(cfg.footerText), iconURL: resolveUrl(cfg.footerIconUrl) || undefined });
  if (cfg.fields?.length) {
    embed.addFields(cfg.fields.map(f => ({ name: resolve(f.name), value: resolve(f.value), inline: f.inline })));
  }
  return embed;
}

// ─── Giveaway ID Generator ────────────────────────────────────────────────────
function genGiveawayId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'GIV-';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const n = parseInt(match[1]);
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * units[match[2]];
}

function formatDuration(ms) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Giveaway Entry Eligibility ───────────────────────────────────────────────
async function getEntryCount(member, guildData) {
  if (guildData.giveawayWhitelistMode && guildData.giveawayWhitelist?.length) {
    const wl = guildData.giveawayWhitelist;
    const allowed = wl.some(e =>
      (e.type === 'user' && e.id === member.id) ||
      (e.type === 'role' && member.roles.cache.has(e.id))
    );
    if (!allowed) return 0;
  } else {
    const bl = guildData.giveawayBlacklist || [];
    const blocked = bl.some(e =>
      (e.type === 'user' && e.id === member.id) ||
      (e.type === 'role' && member.roles.cache.has(e.id))
    );
    if (blocked) return 0;
  }

  let entries = 1;
  for (const bonus of guildData.giveawayBonusEntries || []) {
    if (member.roles.cache.has(bonus.roleId)) entries += bonus.entries;
  }
  return entries;
}

// ─── Anti-Raid Tracker ────────────────────────────────────────────────────────
const raidTracker = new Map();

async function checkRaid(member, guildData, client) {
  if (!guildData.antiRaidEnabled) return;
  const guildId = member.guild.id;
  const now = Date.now();
  const window = (guildData.raidJoinWindow || 10) * 1000;

  if (!raidTracker.has(guildId)) raidTracker.set(guildId, []);
  const joins = raidTracker.get(guildId);
  joins.push(now);
  const recent = joins.filter(t => now - t < window);
  raidTracker.set(guildId, recent);

  if (recent.length >= (guildData.raidJoinCount || 5)) {
    raidTracker.set(guildId, []);
    await triggerRaid(member.guild, guildData, client);
  }
}

async function triggerRaid(guild, guildData, client) {
  try {
    await guild.setVerificationLevel(4);

    if (guildData.modLogChannelId) {
      const ch = guild.channels.cache.get(guildData.modLogChannelId);
      if (ch) ch.send({ embeds: [makeEmbed({
        color: COLORS.ERROR,
        title: '🚨 RAID DETECTED',
        description: `Raid protection activated.\nVerification level raised to maximum.\nResets in 5 minutes.`,
        timestamp: true,
      })] });
    }

    if (guildData.raidOwnerDm) {
      try {
        const owner = await client.users.fetch(OWNER_ID);
        owner.send({ embeds: [makeEmbed({ color: COLORS.ERROR, title: `🚨 Raid detected in ${guild.name}`, description: 'Verification raised to max for 5 minutes.' })] });
      } catch {}
    }

    setTimeout(async () => {
      try { await guild.setVerificationLevel(1); } catch {}
    }, 300000);
  } catch {}
}

// ─── Anti-Nuke Tracker ────────────────────────────────────────────────────────
const nukeTracker = new Map();

async function checkNuke(entry, guild, guildData, client) {
  if (!guildData.antiNukeEnabled) return;
  const executorId = entry.executorId;
  if (!executorId) return;
  if (executorId === OWNER_ID) return;
  if ((guildData.nukeWhitelist || []).includes(executorId)) return;

  const actionMap = {
    'CHANNEL_DELETE': { key: 'channelDelete', threshold: guildData.nukeThresholds?.channelDelete || 3 },
    'MEMBER_BAN_ADD': { key: 'ban',           threshold: guildData.nukeThresholds?.ban           || 3 },
    'MEMBER_KICK':    { key: 'kick',          threshold: guildData.nukeThresholds?.kick          || 5 },
    'ROLE_DELETE':    { key: 'roleDelete',    threshold: guildData.nukeThresholds?.roleDelete    || 2 },
  };
  const action = actionMap[entry.action];
  if (!action) return;

  const key = `${guild.id}:${executorId}:${action.key}`;
  const now = Date.now();
  if (!nukeTracker.has(key)) nukeTracker.set(key, []);
  const times = nukeTracker.get(key);
  times.push(now);
  const recent = times.filter(t => now - t < 5000);
  nukeTracker.set(key, recent);

  if (recent.length >= action.threshold) {
    nukeTracker.delete(key);
    await punishNuker(executorId, guild, guildData, entry.action, client);
  }
}

async function punishNuker(executorId, guild, guildData, action, client) {
  try {
    const member = await guild.members.fetch(executorId).catch(() => null);
    const punishment = guildData.nukePunishment || 'both';

    if (member && (punishment === 'strip' || punishment === 'both')) {
      await member.roles.set([]).catch(() => {});
    }
    if (punishment === 'ban' || punishment === 'both') {
      await guild.bans.create(executorId, { reason: `[Anti-Nuke] Triggered by ${action}` }).catch(() => {});
    }

    const alertEmbed = makeEmbed({
      color: COLORS.ERROR,
      title: '💣 NUKE ATTEMPT DETECTED',
      fields: [
        { name: 'User', value: `<@${executorId}> (${executorId})`, inline: true },
        { name: 'Action', value: action, inline: true },
        { name: 'Punishment', value: punishment, inline: true },
      ],
      timestamp: true,
    });

    if (guildData.modLogChannelId) {
      const ch = guild.channels.cache.get(guildData.modLogChannelId);
      if (ch) ch.send({ embeds: [alertEmbed] });
    }

    try {
      const owner = await client.users.fetch(OWNER_ID);
      owner.send({ embeds: [alertEmbed] });
    } catch {}
  } catch {}
}

// ─── Giveaway Scheduler ───────────────────────────────────────────────────────
async function endGiveaway(giveaway, client) {
  const { EmbedBuilder } = require('discord.js');
  try {
    const guild   = await client.guilds.fetch(giveaway.guildId).catch(() => null);
    if (!guild) return;
    const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) return;

    // Build weighted pool — each userId appears N times for bonus entries
    // but we pick unique winners only
    const pool       = [...giveaway.entries]; // may have duplicates for bonus
    const uniquePool = [...new Set(pool)];    // unique entrants
    const winners    = [];
    const count      = Math.min(giveaway.winnerCount, uniquePool.length);
    const remaining  = [...uniquePool];

    for (let i = 0; i < count; i++) {
      // Weighted pick — count how many times each user appears for their weight
      const weights = remaining.map(uid => pool.filter(e => e === uid).length);
      const total   = weights.reduce((a, b) => a + b, 0);
      let rand      = Math.random() * total;
      let picked    = remaining[remaining.length - 1];
      for (let j = 0; j < remaining.length; j++) {
        rand -= weights[j];
        if (rand <= 0) { picked = remaining[j]; break; }
      }
      winners.push(picked);
      remaining.splice(remaining.indexOf(picked), 1);
    }

    await Giveaway.findOneAndUpdate({ giveawayId: giveaway.giveawayId }, { ended: true, winners });

    const winnerMentions = winners.length ? winners.map(w => `<@${w}>`).join(', ') : 'No valid entries';
    const uniqueCount    = uniquePool.length;

    const embed = new EmbedBuilder()
      .setColor(0xf9a825)
      .setTitle(`🎉 ${giveaway.prize}`)
      .setDescription([
        `**Winners:** ${winnerMentions}`,
        ``,
        `⏰ **Ended:** <t:${Math.floor(new Date(giveaway.endsAt).getTime()/1000)}:R>`,
        `🏆 **Winners:** ${giveaway.winnerCount}`,
        `👤 **Hosted by:** <@${giveaway.hostId}>`,
        `🎟️ **Total Entries:** ${uniqueCount}`,
      ].join('\n'))
      .setFooter({ text: `ID: ${giveaway.giveawayId} • Giveaway Ended` })
      .setTimestamp();

    if (giveaway.messageId) {
      const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (msg) await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
    }

    if (winners.length) {
      channel.send({ content: `🎉 Congratulations ${winnerMentions}! You won **${giveaway.prize}**!\nID: \`${giveaway.giveawayId}\`` });
    } else {
      channel.send({ embeds: [embed] });
    }
  } catch (e) {
    console.error('endGiveaway error:', e.message);
  }
}

function startGiveawayScheduler(client) {
  // Check every 10 seconds for more accurate timing
  setInterval(async () => {
    try {
      const now = new Date();
      const due = await Giveaway.find({ ended: false, endsAt: { $lte: now } });
      for (const g of due) await endGiveaway(g, client);
    } catch (e) {
      console.error('Scheduler error:', e.message);
    }
  }, 10000);
}

// ─── Get or create guild data ─────────────────────────────────────────────────
async function getGuild(guildId) {
  return Guild.findOneAndUpdate({ guildId }, { $setOnInsert: { guildId } }, { upsert: true, new: true });
}

// ─── Send to mod log ──────────────────────────────────────────────────────────
async function logMod(guild, guildData, embed) {
  if (!guildData?.modLogChannelId) return;
  const ch = guild.channels.cache.get(guildData.modLogChannelId);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

// ─── Paginate ─────────────────────────────────────────────────────────────────
function paginate(array, page, perPage = 5) {
  const total = Math.ceil(array.length / perPage);
  const items = array.slice(page * perPage, (page + 1) * perPage);
  return { items, total, page };
}

module.exports = {
  makeEmbed, successEmbed, errorEmbed, warningEmbed, infoEmbed,
  isOwner, hasAdmin, hasModPerms, hasBanPerms, hasKickPerms, canActOn,
  xpForLevel, progressBar, addXp,
  resolveVars, buildWelcomeEmbed,
  genGiveawayId, parseDuration, formatDuration,
  getEntryCount, checkRaid, checkNuke,
  startGiveawayScheduler, endGiveaway,
  getGuild, logMod, paginate,
};
