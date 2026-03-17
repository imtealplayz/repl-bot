const {
  SlashCommandBuilder, PermissionsBitField, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { OWNER_ID, COLORS, CMD_PREFIX } = require('./config');
const { User, Guild, Ticket, Giveaway, CustomCommand } = require('./models');
const {
  makeEmbed, successEmbed, errorEmbed, warningEmbed, infoEmbed,
  isOwner, hasAdmin, hasModPerms, hasBanPerms, hasKickPerms, canActOn,
  xpForLevel, progressBar, addXp, resolveVars, buildWelcomeEmbed,
  genGiveawayId, parseDuration, formatDuration,
  getEntryCount, endGiveaway, getGuild, logMod, paginate,
} = require('./utils');
const { nanoid } = require('nanoid');

// ─── Command List (for /help) ─────────────────────────────────────────────────
const HELP_CATEGORIES = {
  moderation: {
    label: '🔨 Moderation', emoji: '🔨',
    commands: [
      { name: '/ban',           desc: 'Ban a member',                  usage: '/ban <user> [reason]',              perms: 'Ban Members' },
      { name: '/kick',          desc: 'Kick a member',                 usage: '/kick <user> [reason]',             perms: 'Kick Members' },
      { name: '/mute',          desc: 'Timeout a member',              usage: '/mute <user> <duration> [reason]',  perms: 'Moderate Members' },
      { name: '/warn',          desc: 'Warn a member',                 usage: '/warn <user> <reason>',             perms: 'Moderate Members' },
      { name: '/warnings',      desc: 'View warnings for a member',    usage: '/warnings <user>',                  perms: 'Moderate Members' },
      { name: '/clearwarnings', desc: 'Clear all warnings for a user', usage: '/clearwarnings <user>',             perms: 'Administrator' },
    ],
  },
  leveling: {
    label: '⬆️ Leveling', emoji: '⬆️',
    commands: [
      { name: '/rank',        desc: 'View your or someone\'s rank', usage: '/rank [user]',              perms: 'Everyone' },
      { name: '/leaderboard', desc: 'Top 10 by levels or messages', usage: '/leaderboard <levels|messages>', perms: 'Everyone' },
      { name: '/setlevelrole',desc: 'Assign role reward for a level',usage: '/setlevelrole <level> <role>',perms: 'Administrator' },
    ],
  },
  tickets: {
    label: '🎫 Tickets', emoji: '🎫',
    commands: [
      { name: '/ticketpanel',    desc: 'Send the ticket panel embed', usage: '/ticketpanel',             perms: 'Owner Only' },
      { name: '/close',          desc: 'Close current ticket',        usage: '/close',                   perms: 'Staff / Ticket Owner' },
      { name: '/setticketlogs',  desc: 'Set ticket log channel',      usage: '/setticketlogs <channel>', perms: 'Administrator' },
      { name: '/setstaffrole',   desc: 'Set the staff role',          usage: '/setstaffrole <role>',     perms: 'Administrator' },
    ],
  },
  welcome: {
    label: '👋 Welcome', emoji: '👋',
    commands: [
      { name: '/welcome',     desc: 'Set the welcome channel',    usage: '/welcome channel:<channel>', perms: 'Administrator' },
      { name: '/setautorole', desc: 'Set auto-role on join',      usage: '/setautorole <role>',        perms: 'Administrator' },
      { name: '/test greet',  desc: 'Test the welcome message',   usage: '/test greet [channel]',      perms: 'Administrator' },
    ],
  },
  utility: {
    label: '📝 Custom Commands', emoji: '📝',
    commands: [
      { name: '/addcommand',    desc: 'Add a custom command',         usage: '/addcommand <trigger> <response>', perms: 'Administrator' },
      { name: '/removecommand', desc: 'Remove a custom command',      usage: '/removecommand <trigger>',         perms: 'Administrator' },
      { name: '/listcommands',  desc: 'List all custom commands',     usage: '/listcommands',                    perms: 'Everyone' },
    ],
  },
  polls: {
    label: '📊 Polls & Giveaways', emoji: '📊',
    commands: [
      { name: '/poll',              desc: 'Create a poll',               usage: '/poll <question> <opt1> <opt2> [opt3] [opt4] [duration]', perms: 'Everyone' },
      { name: '/giveaway',          desc: 'Start a giveaway',            usage: '/giveaway <prize> <duration> [winners] [channel]',       perms: 'Administrator' },
      { name: '/reroll',            desc: 'Reroll giveaway winner',      usage: '/reroll <giveawayId>',                                   perms: 'Administrator' },
      { name: '/endgiveaway',       desc: 'End a giveaway early',        usage: '/endgiveaway <giveawayId>',                              perms: 'Administrator' },
      { name: '/deletegiveaway',    desc: 'Delete a giveaway',           usage: '/deletegiveaway <giveawayId>',                           perms: 'Administrator' },
      { name: '/giveaway entries',  desc: 'Manage bonus entries per role',usage: '/giveaway entries <add|remove|list>',                   perms: 'Owner Only' },
      { name: '/giveaway blacklist',desc: 'Blacklist users/roles',       usage: '/giveaway blacklist <add|remove|list>',                  perms: 'Owner Only' },
      { name: '/giveaway whitelist',desc: 'Whitelist users/roles',       usage: '/giveaway whitelist <add|remove|list|mode>',             perms: 'Owner Only' },
    ],
  },
  config: {
    label: '⚙️ Configuration', emoji: '⚙️',
    commands: [
      { name: '/setup',              desc: 'Guided server setup',                usage: '/setup',                             perms: 'Administrator' },
      { name: '/antiraid',           desc: 'Configure anti-raid',                usage: '/antiraid <on|off|threshold|action>',perms: 'Owner Only' },
      { name: '/antinuke',           desc: 'Configure anti-nuke',                usage: '/antinuke <on|off|threshold|punishment>',perms: 'Owner Only' },
      { name: '/nukewhitelist',      desc: 'Manage anti-nuke whitelist',         usage: '/nukewhitelist <add|remove|list>',   perms: 'Owner Only' },
      { name: '/messagelog',         desc: 'Manage message count channels',      usage: '/messagelog <blacklist|whitelist|mode|reset>', perms: 'Administrator' },
    ],
  },
  owner: {
    label: '👑 Owner Only', emoji: '👑',
    commands: [
      { name: '/announce',    desc: 'Send announcement embed',    usage: '/announce <channel> <message>',  perms: 'Owner Only' },
      { name: '/dm',          desc: 'DM a user from the bot',     usage: '/dm <user> <message>',           perms: 'Owner Only' },
      { name: '/eval',        desc: 'Execute raw JavaScript',     usage: '/eval <code>',                   perms: 'Owner Only' },
      { name: '/maintenance', desc: 'Toggle maintenance mode',    usage: '/maintenance <on|off>',          perms: 'Owner Only' },
      { name: '/servers',     desc: 'List all servers bot is in', usage: '/servers',                       perms: 'Owner Only' },
      { name: '/shutdown',    desc: 'Gracefully shut down bot',   usage: '/shutdown',                      perms: 'Owner Only' },
    ],
  },
};

// ─── Slash Command Definitions ────────────────────────────────────────────────
const commandDefs = [
  new SlashCommandBuilder().setName('help').setDescription('View help for bot commands'),

  // Moderation
  new SlashCommandBuilder().setName('ban').setDescription('Ban a member')
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for ban')),

  new SlashCommandBuilder().setName('kick').setDescription('Kick a member')
    .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for kick')),

  new SlashCommandBuilder().setName('mute').setDescription('Timeout a member')
    .addUserOption(o => o.setName('user').setDescription('User to mute').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 10m, 1h, 2d').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for mute')),

  new SlashCommandBuilder().setName('warn').setDescription('Warn a member')
    .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for warn').setRequired(true)),

  new SlashCommandBuilder().setName('warnings').setDescription('View warnings for a user')
    .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(true)),

  new SlashCommandBuilder().setName('clearwarnings').setDescription('Clear all warnings for a user')
    .addUserOption(o => o.setName('user').setDescription('User to clear').setRequired(true)),

  // Leveling
  new SlashCommandBuilder().setName('rank').setDescription('View rank')
    .addUserOption(o => o.setName('user').setDescription('User to check (defaults to you)')),

  new SlashCommandBuilder().setName('leaderboard').setDescription('View server leaderboard')
    .addStringOption(o => o.setName('type').setDescription('levels or messages').setRequired(true)
      .addChoices({ name: 'Levels', value: 'levels' }, { name: 'Messages', value: 'messages' })),

  new SlashCommandBuilder().setName('setlevelrole').setDescription('Set role reward for a level')
    .addIntegerOption(o => o.setName('level').setDescription('Level number').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true)),

  // Tickets
  new SlashCommandBuilder().setName('ticketpanel').setDescription('Send the ticket panel (owner only)'),
  new SlashCommandBuilder().setName('close').setDescription('Close the current ticket'),
  new SlashCommandBuilder().setName('setticketlogs').setDescription('Set ticket log channel')
    .addChannelOption(o => o.setName('channel').setDescription('Log channel').setRequired(true)),
  new SlashCommandBuilder().setName('setstaffrole').setDescription('Set the staff role')
    .addRoleOption(o => o.setName('role').setDescription('Staff role').setRequired(true)),

  // Welcome
  new SlashCommandBuilder().setName('welcome').setDescription('Set the welcome channel')
    .addChannelOption(o => o.setName('channel').setDescription('Welcome channel').setRequired(true)),

  new SlashCommandBuilder().setName('setautorole').setDescription('Set auto-role on join')
    .addRoleOption(o => o.setName('role').setDescription('Role to auto-assign').setRequired(true)),

  new SlashCommandBuilder().setName('test').setDescription('Test bot features')
    .addSubcommand(s => s.setName('greet').setDescription('Test the welcome message')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to send in (defaults to current)'))),

  // Custom Commands
  new SlashCommandBuilder().setName('addcommand').setDescription('Add a custom command')
    .addStringOption(o => o.setName('trigger').setDescription('Trigger word (without !)').setRequired(true))
    .addStringOption(o => o.setName('response').setDescription('Response message').setRequired(true)),

  new SlashCommandBuilder().setName('removecommand').setDescription('Remove a custom command')
    .addStringOption(o => o.setName('trigger').setDescription('Trigger to remove').setRequired(true)),

  new SlashCommandBuilder().setName('listcommands').setDescription('List all custom commands'),

  // Polls
  new SlashCommandBuilder().setName('poll').setDescription('Create a poll')
    .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(o => o.setName('option1').setDescription('Option 1').setRequired(true))
    .addStringOption(o => o.setName('option2').setDescription('Option 2').setRequired(true))
    .addStringOption(o => o.setName('option3').setDescription('Option 3'))
    .addStringOption(o => o.setName('option4').setDescription('Option 4'))
    .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 10m, 1h (optional)')),

  // Giveaways
  new SlashCommandBuilder().setName('giveaway').setDescription('Giveaway management')
    .addSubcommand(s => s.setName('start').setDescription('Start a giveaway')
      .addStringOption(o => o.setName('prize').setDescription('Prize').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 1h, 2d').setRequired(true))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(10))
      .addChannelOption(o => o.setName('channel').setDescription('Channel for giveaway'))
      .addBooleanOption(o => o.setName('bonusentries').setDescription('Apply bonus entries? (default true)')))
    .addSubcommand(s => s.setName('entries').setDescription('Manage bonus entries')
      .addStringOption(o => o.setName('action').setDescription('add, remove or list').setRequired(true)
        .addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }, { name: 'list', value: 'list' }))
      .addRoleOption(o => o.setName('role').setDescription('Role to modify'))
      .addIntegerOption(o => o.setName('count').setDescription('Number of bonus entries').setMinValue(1).setMaxValue(50)))
    .addSubcommand(s => s.setName('blacklist').setDescription('Manage giveaway blacklist')
      .addStringOption(o => o.setName('action').setDescription('add, remove or list').setRequired(true)
        .addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }, { name: 'list', value: 'list' }))
      .addUserOption(o => o.setName('user').setDescription('User to blacklist/unblacklist'))
      .addRoleOption(o => o.setName('role').setDescription('Role to blacklist/unblacklist')))
    .addSubcommand(s => s.setName('whitelist').setDescription('Manage giveaway whitelist')
      .addStringOption(o => o.setName('action').setDescription('add, remove, list or mode').setRequired(true)
        .addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }, { name: 'list', value: 'list' }, { name: 'mode', value: 'mode' }))
      .addUserOption(o => o.setName('user').setDescription('User to whitelist'))
      .addRoleOption(o => o.setName('role').setDescription('Role to whitelist'))
      .addBooleanOption(o => o.setName('enabled').setDescription('Turn whitelist mode on or off'))),

  new SlashCommandBuilder().setName('reroll').setDescription('Reroll a giveaway winner')
    .addStringOption(o => o.setName('id').setDescription('Giveaway ID e.g. GIV-AB12').setRequired(true)),

  new SlashCommandBuilder().setName('endgiveaway').setDescription('End a giveaway early')
    .addStringOption(o => o.setName('id').setDescription('Giveaway ID e.g. GIV-AB12').setRequired(true)),

  new SlashCommandBuilder().setName('deletegiveaway').setDescription('Delete a giveaway entirely')
    .addStringOption(o => o.setName('id').setDescription('Giveaway ID e.g. GIV-AB12').setRequired(true)),

  // Config
  new SlashCommandBuilder().setName('setup').setDescription('Guided server setup'),

  new SlashCommandBuilder().setName('antiraid').setDescription('Configure anti-raid')
    .addStringOption(o => o.setName('action').setDescription('on, off, threshold, action, newaccounts').setRequired(true)
      .addChoices(
        { name: 'on', value: 'on' }, { name: 'off', value: 'off' },
        { name: 'threshold', value: 'threshold' }, { name: 'raidaction', value: 'raidaction' },
        { name: 'newaccounts', value: 'newaccounts' },
      ))
    .addIntegerOption(o => o.setName('value').setDescription('Numeric value for threshold/days'))
    .addIntegerOption(o => o.setName('seconds').setDescription('Time window in seconds (for threshold)'))
    .addStringOption(o => o.setName('raidtype').setDescription('kick, ban or verify').addChoices(
      { name: 'kick', value: 'kick' }, { name: 'ban', value: 'ban' }, { name: 'verify', value: 'verify' },
    )),

  new SlashCommandBuilder().setName('antinuke').setDescription('Configure anti-nuke')
    .addStringOption(o => o.setName('action').setDescription('on, off, punishment').setRequired(true)
      .addChoices(
        { name: 'on', value: 'on' }, { name: 'off', value: 'off' }, { name: 'punishment', value: 'punishment' },
      ))
    .addStringOption(o => o.setName('punishment').setDescription('strip, ban or both').addChoices(
      { name: 'strip', value: 'strip' }, { name: 'ban', value: 'ban' }, { name: 'both', value: 'both' },
    )),

  new SlashCommandBuilder().setName('nukewhitelist').setDescription('Manage anti-nuke whitelist')
    .addStringOption(o => o.setName('action').setDescription('add, remove or list').setRequired(true)
      .addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }, { name: 'list', value: 'list' }))
    .addUserOption(o => o.setName('user').setDescription('User to whitelist/unwhitelist')),

  new SlashCommandBuilder().setName('messagelog').setDescription('Manage message counting settings')
    .addStringOption(o => o.setName('action').setDescription('Action to perform').setRequired(true)
      .addChoices(
        { name: 'blacklist-add', value: 'bl-add' }, { name: 'blacklist-remove', value: 'bl-remove' },
        { name: 'whitelist-add', value: 'wl-add' }, { name: 'whitelist-remove', value: 'wl-remove' },
        { name: 'mode', value: 'mode' }, { name: 'reset', value: 'reset' },
      ))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to add/remove'))
    .addStringOption(o => o.setName('mode').setDescription('blacklist or whitelist').addChoices(
      { name: 'blacklist', value: 'blacklist' }, { name: 'whitelist', value: 'whitelist' },
    )),

  // Owner
  new SlashCommandBuilder().setName('announce').setDescription('Send an announcement (owner only)')
    .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Message content').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('Embed title')),

  new SlashCommandBuilder().setName('dm').setDescription('DM a user from the bot (owner only)')
    .addUserOption(o => o.setName('user').setDescription('User to DM').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Message to send').setRequired(true)),

  new SlashCommandBuilder().setName('eval').setDescription('Execute JavaScript (owner only)')
    .addStringOption(o => o.setName('code').setDescription('Code to run').setRequired(true)),

  new SlashCommandBuilder().setName('maintenance').setDescription('Toggle maintenance mode (owner only)')
    .addStringOption(o => o.setName('state').setDescription('on or off').setRequired(true)
      .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' })),

  new SlashCommandBuilder().setName('servers').setDescription('List all servers bot is in (owner only)'),
  new SlashCommandBuilder().setName('shutdown').setDescription('Shut down the bot (owner only)'),
];

// ─── Command Executor ─────────────────────────────────────────────────────────
async function handleCommand(interaction, client) {
  const { commandName, guildId, user, member, guild } = interaction;
  const guildData = await getGuild(guildId);

  // Maintenance mode check
  if (guildData.maintenanceMode && !isOwner(user.id)) {
    return interaction.reply({ embeds: [warningEmbed('The bot is currently in maintenance mode. Please try again later.')], ephemeral: true });
  }

  // ── /help ──────────────────────────────────────────────────────────────────
  if (commandName === 'help') {
    const options = Object.entries(HELP_CATEGORIES)
      .filter(([k]) => k !== 'owner' || isOwner(user.id))
      .map(([value, cat]) => ({ label: cat.label, value }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('help_select')
        .setPlaceholder('Select a category...')
        .addOptions(options)
    );
    return interaction.reply({ embeds: [makeEmbed({ color: COLORS.PRIMARY, title: '📖 Repl Bot Help', description: 'Select a category below to view its commands.' })], components: [row], ephemeral: true });
  }

  // ── /ban ───────────────────────────────────────────────────────────────────
  if (commandName === 'ban') {
    if (!hasBanPerms(member)) return interaction.reply({ embeds: [errorEmbed('You need Ban Members permission.')], ephemeral: true });
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    if (!target) return interaction.reply({ embeds: [errorEmbed('User not found.')], ephemeral: true });
    if (!canActOn(member, target)) return interaction.reply({ embeds: [errorEmbed('You cannot act on this user.')], ephemeral: true });
    try {
      await target.send({ embeds: [makeEmbed({ color: COLORS.ERROR, title: `You were banned from ${guild.name}`, fields: [{ name: 'Reason', value: reason }, { name: 'Moderator', value: user.tag }] })] }).catch(() => {});
      await target.ban({ reason });
      const embed = makeEmbed({ color: COLORS.ERROR, title: '🔨 Member Banned', fields: [{ name: 'User', value: `${target.user.tag}`, inline: true }, { name: 'Reason', value: reason, inline: true }, { name: 'Moderator', value: user.tag, inline: true }], timestamp: true });
      await interaction.reply({ embeds: [embed] });
      await logMod(guild, guildData, embed);
    } catch (e) { interaction.reply({ embeds: [errorEmbed(`Failed to ban: ${e.message}`)], ephemeral: true }); }
    return;
  }

  // ── /kick ──────────────────────────────────────────────────────────────────
  if (commandName === 'kick') {
    if (!hasKickPerms(member)) return interaction.reply({ embeds: [errorEmbed('You need Kick Members permission.')], ephemeral: true });
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    if (!target) return interaction.reply({ embeds: [errorEmbed('User not found.')], ephemeral: true });
    if (!canActOn(member, target)) return interaction.reply({ embeds: [errorEmbed('You cannot act on this user.')], ephemeral: true });
    try {
      await target.send({ embeds: [makeEmbed({ color: COLORS.WARNING, title: `You were kicked from ${guild.name}`, fields: [{ name: 'Reason', value: reason }, { name: 'Moderator', value: user.tag }] })] }).catch(() => {});
      await target.kick(reason);
      const embed = makeEmbed({ color: COLORS.WARNING, title: '👢 Member Kicked', fields: [{ name: 'User', value: target.user.tag, inline: true }, { name: 'Reason', value: reason, inline: true }, { name: 'Moderator', value: user.tag, inline: true }], timestamp: true });
      await interaction.reply({ embeds: [embed] });
      await logMod(guild, guildData, embed);
    } catch (e) { interaction.reply({ embeds: [errorEmbed(`Failed to kick: ${e.message}`)], ephemeral: true }); }
    return;
  }

  // ── /mute ──────────────────────────────────────────────────────────────────
  if (commandName === 'mute') {
    if (!hasModPerms(member)) return interaction.reply({ embeds: [errorEmbed('You need Moderate Members permission.')], ephemeral: true });
    const target = interaction.options.getMember('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    if (!target) return interaction.reply({ embeds: [errorEmbed('User not found.')], ephemeral: true });
    if (!canActOn(member, target)) return interaction.reply({ embeds: [errorEmbed('You cannot act on this user.')], ephemeral: true });
    const ms = parseDuration(durationStr);
    if (!ms || ms > 2419200000) return interaction.reply({ embeds: [errorEmbed('Invalid duration. Use format like `10m`, `1h`, `2d`. Max is 28 days.')], ephemeral: true });
    try {
      await target.timeout(ms, reason);
      await target.send({ embeds: [makeEmbed({ color: COLORS.WARNING, title: `You were muted in ${guild.name}`, fields: [{ name: 'Duration', value: durationStr }, { name: 'Reason', value: reason }, { name: 'Moderator', value: user.tag }] })] }).catch(() => {});
      const embed = makeEmbed({ color: COLORS.WARNING, title: '🔇 Member Muted', fields: [{ name: 'User', value: target.user.tag, inline: true }, { name: 'Duration', value: durationStr, inline: true }, { name: 'Reason', value: reason, inline: true }, { name: 'Moderator', value: user.tag, inline: true }], timestamp: true });
      await interaction.reply({ embeds: [embed] });
      await logMod(guild, guildData, embed);
    } catch (e) { interaction.reply({ embeds: [errorEmbed(`Failed to mute: ${e.message}`)], ephemeral: true }); }
    return;
  }

  // ── /warn ──────────────────────────────────────────────────────────────────
  if (commandName === 'warn') {
    if (!hasModPerms(member)) return interaction.reply({ embeds: [errorEmbed('You need Moderate Members permission.')], ephemeral: true });
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const warnId = nanoid(8).toUpperCase();
    const userData = await User.findOneAndUpdate(
      { userId: target.id, guildId },
      { $push: { warns: { warnId, reason, moderatorId: user.id } } },
      { upsert: true, new: true }
    );
    await target.send({ embeds: [makeEmbed({ color: COLORS.WARNING, title: `You were warned in ${guild.name}`, fields: [{ name: 'Reason', value: reason }, { name: 'Moderator', value: user.tag }, { name: 'Total Warnings', value: `${userData.warns.length}` }] })] }).catch(() => {});
    const embed = makeEmbed({ color: COLORS.WARNING, title: '⚠️ Member Warned', fields: [{ name: 'User', value: target.tag, inline: true }, { name: 'Reason', value: reason, inline: true }, { name: 'Warn ID', value: warnId, inline: true }, { name: 'Total Warnings', value: `${userData.warns.length}`, inline: true }, { name: 'Moderator', value: user.tag, inline: true }], timestamp: true });
    await interaction.reply({ embeds: [embed] });
    await logMod(guild, guildData, embed);
    return;
  }

  // ── /warnings ──────────────────────────────────────────────────────────────
  if (commandName === 'warnings') {
    if (!hasModPerms(member)) return interaction.reply({ embeds: [errorEmbed('You need Moderate Members permission.')], ephemeral: true });
    const target = interaction.options.getUser('user');
    const userData = await User.findOne({ userId: target.id, guildId });
    if (!userData || !userData.warns.length) return interaction.reply({ embeds: [infoEmbed(`${target.tag} has no warnings.`)] });
    const warns = userData.warns;
    const page = 0;
    const { items, total } = paginate(warns, page, 5);
    const fields = items.map((w, i) => ({ name: `Warn #${warns.indexOf(w) + 1} — ID: ${w.warnId}`, value: `**Reason:** ${w.reason}\n**Moderator:** <@${w.moderatorId}>\n**Date:** <t:${Math.floor(new Date(w.timestamp).getTime() / 1000)}:R>` }));
    const embed = makeEmbed({ color: COLORS.WARNING, title: `⚠️ Warnings for ${target.tag}`, fields, footer: `Page 1/${total} · ${warns.length} total warnings` });
    const row = total > 1 ? new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`warns_prev_${target.id}_0`).setLabel('← Prev').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(`warns_next_${target.id}_0`).setLabel('Next →').setStyle(ButtonStyle.Primary).setDisabled(total <= 1),
    ) : null;
    return interaction.reply({ embeds: [embed], components: row ? [row] : [] });
  }

  // ── /clearwarnings ─────────────────────────────────────────────────────────
  if (commandName === 'clearwarnings') {
    if (!hasAdmin(member)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
    const target = interaction.options.getUser('user');
    await User.findOneAndUpdate({ userId: target.id, guildId }, { $set: { warns: [] } });
    return interaction.reply({ embeds: [successEmbed(`Cleared all warnings for ${target.tag}.`)] });
  }

  // ── /rank ──────────────────────────────────────────────────────────────────
  if (commandName === 'rank') {
    const target = interaction.options.getUser('user') || user;
    const userData = await User.findOne({ userId: target.id, guildId }) || { xp: 0, level: 0, messageCount: 0 };
    const needed = xpForLevel(userData.level + 1);
    const allUsers = await User.find({ guildId }).sort({ level: -1, xp: -1 });
    const rank = allUsers.findIndex(u => u.userId === target.id) + 1;
    const bar = progressBar(userData.xp, needed);
    const embed = makeEmbed({
      color: COLORS.PRIMARY,
      title: `📊 ${target.username}'s Rank`,
      thumbnail: target.displayAvatarURL({ dynamic: true }),
      fields: [
        { name: 'Level',    value: `${userData.level}`,  inline: true },
        { name: 'XP',       value: `${userData.xp} / ${needed}`, inline: true },
        { name: 'Rank',     value: `#${rank}`,           inline: true },
        { name: 'Messages', value: `${userData.messageCount}`, inline: true },
        { name: 'Progress', value: `\`${bar}\`` },
      ],
    });
    return interaction.reply({ embeds: [embed] });
  }

  // ── /leaderboard ───────────────────────────────────────────────────────────
  if (commandName === 'leaderboard') {
    const type = interaction.options.getString('type');
    const sort = type === 'messages' ? { messageCount: -1 } : { level: -1, xp: -1 };
    const allUsers = await User.find({ guildId }).sort(sort).limit(10);
    const guildMembers = await guild.members.fetch();
    const valid = allUsers.filter(u => guildMembers.has(u.userId));
    const lines = valid.map((u, i) => {
      const m = guildMembers.get(u.userId);
      const val = type === 'messages' ? `${u.messageCount} messages` : `Level ${u.level} · ${u.xp} XP`;
      return `**${i + 1}.** ${m?.user.username || 'Unknown'} — ${val}`;
    });
    return interaction.reply({ embeds: [makeEmbed({ color: COLORS.PRIMARY, title: type === 'messages' ? '💬 Top Messagers' : '⬆️ Top Levels', description: lines.join('\n') || 'No data yet.' })] });
  }

  // ── /setlevelrole ──────────────────────────────────────────────────────────
  if (commandName === 'setlevelrole') {
    if (!hasAdmin(member)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
    const level = interaction.options.getInteger('level');
    const role  = interaction.options.getRole('role');
    await Guild.findOneAndUpdate({ guildId }, { $pull: { levelRoles: { level } } });
    await Guild.findOneAndUpdate({ guildId }, { $push: { levelRoles: { level, roleId: role.id } } });
    return interaction.reply({ embeds: [successEmbed(`Role ${role.name} will now be assigned at level ${level}.`)] });
  }

  // ── /ticketpanel ───────────────────────────────────────────────────────────
  if (commandName === 'ticketpanel') {
    if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Only the bot owner can use this command.')], ephemeral: true });
    const cfg = guildData.ticketPanel;
    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7C3AED')
      .setTitle(cfg.title || 'Support Tickets')
      .setDescription(cfg.description || 'Need help? Click the button below to open a ticket.');
    if (cfg.thumbnailUrl) embed.setThumbnail(cfg.thumbnailUrl);
    if (cfg.imageUrl) embed.setImage(cfg.imageUrl);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_open').setLabel(cfg.buttonLabel || 'Create Ticket').setEmoji(cfg.buttonEmoji || '🎫').setStyle(ButtonStyle.Primary)
    );
    await interaction.reply({ content: '✅ Ticket panel sent!', ephemeral: true });
    return interaction.channel.send({ embeds: [embed], components: [row] });
  }

  // ── /close ─────────────────────────────────────────────────────────────────
  if (commandName === 'close') {
    const ticket = await Ticket.findOne({ channelId: interaction.channelId, status: 'open' });
    if (!ticket) return interaction.reply({ embeds: [errorEmbed('This is not an open ticket channel.')], ephemeral: true });
    const isStaff = guildData.staffRoleId ? member.roles.cache.has(guildData.staffRoleId) : hasAdmin(member);
    if (ticket.userId !== user.id && !isStaff && !isOwner(user.id)) {
      return interaction.reply({ embeds: [errorEmbed('Only the ticket creator or staff can close this ticket.')], ephemeral: true });
    }
    await closeTicket(ticket, interaction.channel, guild, guildData, client, user);
    return;
  }

  // ── /setticketlogs ─────────────────────────────────────────────────────────
  if (commandName === 'setticketlogs') {
    if (!hasAdmin(member)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
    const ch = interaction.options.getChannel('channel');
    await Guild.findOneAndUpdate({ guildId }, { ticketLogChannelId: ch.id });
    return interaction.reply({ embeds: [successEmbed(`Ticket logs will be sent to ${ch}.`)] });
  }

  // ── /setstaffrole ──────────────────────────────────────────────────────────
  if (commandName === 'setstaffrole') {
    if (!hasAdmin(member)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
    const role = interaction.options.getRole('role');
    await Guild.findOneAndUpdate({ guildId }, { staffRoleId: role.id });
    return interaction.reply({ embeds: [successEmbed(`Staff role set to ${role}.`)] });
  }

  // ── /welcome ───────────────────────────────────────────────────────────────
  if (commandName === 'welcome') {
    if (!hasAdmin(member)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
    const ch = interaction.options.getChannel('channel');
    await Guild.findOneAndUpdate({ guildId }, { 'welcomeEmbed.channelId': ch.id, 'welcomeEmbed.enabled': true });
    return interaction.reply({ embeds: [successEmbed(`Welcome channel set to ${ch}. Configure the embed in the dashboard.`)] });
  }

  // ── /setautorole ───────────────────────────────────────────────────────────
  if (commandName === 'setautorole') {
    if (!hasAdmin(member)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
    const role = interaction.options.getRole('role');
    if (!guild.members.me.roles.highest.comparePositionTo(role)) return interaction.reply({ embeds: [errorEmbed('That role is above my highest role.')], ephemeral: true });
    await Guild.findOneAndUpdate({ guildId }, { autoRoleId: role.id });
    return interaction.reply({ embeds: [successEmbed(`Auto-role set to ${role}.`)] });
  }

  // ── /test greet ────────────────────────────────────────────────────────────
  if (commandName === 'test' && interaction.options.getSubcommand() === 'greet') {
    if (!hasAdmin(member) && !isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
    const cfg = guildData.welcomeEmbed;
    if (!cfg?.enabled) return interaction.reply({ embeds: [warningEmbed('Welcome messages are not enabled. Set a channel with `/welcome channel:` first.')], ephemeral: true });
    const ch = interaction.options.getChannel('channel') || interaction.channel;
    const embed = await buildWelcomeEmbed(member, cfg);
    const outside = cfg.outsideText ? resolveVars(cfg.outsideText, member) : null;
    await ch.send({ content: outside || undefined, embeds: [embed] });
    return interaction.reply({ embeds: [successEmbed(`Test welcome sent to ${ch}!`)], ephemeral: true });
  }

  // ── /addcommand ────────────────────────────────────────────────────────────
  if (commandName === 'addcommand') {
    if (!hasAdmin(member)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
    const trigger  = interaction.options.getString('trigger').toLowerCase();
    const response = interaction.options.getString('response');
    const count    = await CustomCommand.countDocuments({ guildId });
    if (count >= 50) return interaction.reply({ embeds: [errorEmbed('You have reached the 50 custom command limit.')], ephemeral: true });
    await CustomCommand.findOneAndUpdate({ guildId, trigger }, { response, createdBy: user.id }, { upsert: true, new: true });
    return interaction.reply({ embeds: [successEmbed(`Custom command \`!${trigger}\` saved.`)] });
  }

  // ── /removecommand ─────────────────────────────────────────────────────────
  if (commandName === 'removecommand') {
    if (!hasAdmin(member)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
    const trigger = interaction.options.getString('trigger').toLowerCase();
    const res = await CustomCommand.findOneAndDelete({ guildId, trigger });
    if (!res) return interaction.reply({ embeds: [errorEmbed(`No command found for \`!${trigger}\`.`)], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed(`Command \`!${trigger}\` removed.`)] });
  }

  // ── /listcommands ──────────────────────────────────────────────────────────
  if (commandName === 'listcommands') {
    const cmds = await CustomCommand.find({ guildId });
    if (!cmds.length) return interaction.reply({ embeds: [infoEmbed('No custom commands set up yet.')] });
    const lines = cmds.map(c => `\`!${c.trigger}\` — ${c.response.substring(0, 60)}${c.response.length > 60 ? '...' : ''}`);
    return interaction.reply({ embeds: [makeEmbed({ color: COLORS.INFO, title: '📝 Custom Commands', description: lines.join('\n'), footer: `${cmds.length}/50 commands used` })] });
  }

  // ── /poll ──────────────────────────────────────────────────────────────────
  if (commandName === 'poll') {
    const question = interaction.options.getString('question');
    const opts     = [1,2,3,4].map(n => interaction.options.getString(`option${n}`)).filter(Boolean);
    const duration = interaction.options.getString('duration');
    const emojis   = ['1️⃣','2️⃣','3️⃣','4️⃣'];
    const desc     = opts.map((o, i) => `${emojis[i]} ${o}`).join('\n\n');
    const embed    = makeEmbed({ color: COLORS.INFO, title: `📊 ${question}`, description: desc, footer: duration ? `Poll ends in ${duration}` : 'Poll is open', timestamp: true });
    const msg      = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (let i = 0; i < opts.length; i++) await msg.react(emojis[i]);

    if (duration) {
      const ms = parseDuration(duration);
      if (ms) {
        setTimeout(async () => {
          const fresh = await msg.fetch().catch(() => null);
          if (!fresh) return;
          const results = opts.map((o, i) => {
            const count = (fresh.reactions.cache.get(emojis[i])?.count || 1) - 1;
            return { option: o, count };
          });
          const total  = results.reduce((s, r) => s + r.count, 0);
          const lines  = results.map((r, i) => `${emojis[i]} **${r.option}** — ${r.count} votes (${total ? Math.round((r.count/total)*100) : 0}%)`);
          const winner = results.reduce((a, b) => b.count > a.count ? b : a);
          const finEmbed = makeEmbed({ color: COLORS.SUCCESS, title: `📊 Poll Ended — ${question}`, description: lines.join('\n\n'), fields: [{ name: '🏆 Winner', value: winner.option }], timestamp: true });
          fresh.edit({ embeds: [finEmbed] }).catch(() => {});
        }, ms);
      }
    }
    return;
  }

  // ── /giveaway ──────────────────────────────────────────────────────────────
  if (commandName === 'giveaway') {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      if (!hasAdmin(member) && !isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
      const prize    = interaction.options.getString('prize');
      const durStr   = interaction.options.getString('duration');
      const winners  = interaction.options.getInteger('winners') || 1;
      const channel  = interaction.options.getChannel('channel') || interaction.channel;
      const useBonus = interaction.options.getBoolean('bonusentries') ?? true;
      const ms       = parseDuration(durStr);
      if (!ms) return interaction.reply({ embeds: [errorEmbed('Invalid duration format. Use e.g. `1h`, `2d`.')], ephemeral: true });
      const endsAt   = new Date(Date.now() + ms);

      let giveawayId;
      do { giveawayId = genGiveawayId(); } while (await Giveaway.findOne({ giveawayId }));

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`🎁 GIVEAWAY — ${prize}`)
        .setDescription(`Click 🎉 to enter!\n\n**Ends:** <t:${Math.floor(endsAt.getTime()/1000)}:R>\n**Winners:** ${winners}\n**Host:** <@${user.id}>\n**ID:** \`${giveawayId}\``)
        .setFooter({ text: `Giveaway ID: ${giveawayId}` })
        .setTimestamp(endsAt);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`giveaway_enter_${giveawayId}`).setLabel('Enter').setEmoji('🎉').setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ embeds: [successEmbed(`Giveaway started! ID: \`${giveawayId}\``)], ephemeral: true });
      const msg = await channel.send({ embeds: [embed], components: [row] });

      await Giveaway.create({ giveawayId, guildId, channelId: channel.id, messageId: msg.id, prize, hostId: user.id, endsAt, winnerCount: winners, bonusEntries: useBonus });
      return;
    }

    if (sub === 'entries') {
      if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Only the bot owner can manage bonus entries.')], ephemeral: true });
      const action = interaction.options.getString('action');
      const role   = interaction.options.getRole('role');
      const count  = interaction.options.getInteger('count');

      if (action === 'list') {
        const entries = guildData.giveawayBonusEntries || [];
        if (!entries.length) return interaction.reply({ embeds: [infoEmbed('No bonus entries configured.')] });
        const lines = entries.map(e => `<@&${e.roleId}> — **${e.entries}** extra entries`);
        return interaction.reply({ embeds: [makeEmbed({ color: COLORS.INFO, title: '🎟️ Bonus Entries', description: lines.join('\n') })] });
      }
      if (!role) return interaction.reply({ embeds: [errorEmbed('Please specify a role.')], ephemeral: true });
      if (action === 'add') {
        if (!count) return interaction.reply({ embeds: [errorEmbed('Please specify entry count.')], ephemeral: true });
        await Guild.findOneAndUpdate({ guildId }, { $pull: { giveawayBonusEntries: { roleId: role.id } } });
        await Guild.findOneAndUpdate({ guildId }, { $push: { giveawayBonusEntries: { roleId: role.id, entries: count } } });
        return interaction.reply({ embeds: [successEmbed(`${role.name} now gets ${count} bonus entries.`)] });
      }
      if (action === 'remove') {
        await Guild.findOneAndUpdate({ guildId }, { $pull: { giveawayBonusEntries: { roleId: role.id } } });
        return interaction.reply({ embeds: [successEmbed(`Removed bonus entries for ${role.name}.`)] });
      }
    }

    if (sub === 'blacklist') {
      if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Only the bot owner can manage the giveaway blacklist.')], ephemeral: true });
      const action = interaction.options.getString('action');
      const tUser  = interaction.options.getUser('user');
      const role   = interaction.options.getRole('role');

      if (action === 'list') {
        const bl = guildData.giveawayBlacklist || [];
        if (!bl.length) return interaction.reply({ embeds: [infoEmbed('Blacklist is empty.')] });
        const users = bl.filter(e => e.type === 'user').map(e => `<@${e.id}>`);
        const roles = bl.filter(e => e.type === 'role').map(e => `<@&${e.id}>`);
        return interaction.reply({ embeds: [makeEmbed({ color: COLORS.ERROR, title: '🚫 Giveaway Blacklist', fields: [{ name: 'Users', value: users.join('\n') || 'None' }, { name: 'Roles', value: roles.join('\n') || 'None' }] })] });
      }
      const entry = tUser ? { type: 'user', id: tUser.id } : role ? { type: 'role', id: role.id } : null;
      if (!entry) return interaction.reply({ embeds: [errorEmbed('Specify a user or role.')], ephemeral: true });
      if (action === 'add') {
        await Guild.findOneAndUpdate({ guildId }, { $pull: { giveawayBlacklist: { id: entry.id } } });
        await Guild.findOneAndUpdate({ guildId }, { $push: { giveawayBlacklist: entry } });
        return interaction.reply({ embeds: [successEmbed(`${tUser?.tag || role?.name} added to giveaway blacklist.`)] });
      }
      if (action === 'remove') {
        await Guild.findOneAndUpdate({ guildId }, { $pull: { giveawayBlacklist: { id: entry.id } } });
        return interaction.reply({ embeds: [successEmbed(`${tUser?.tag || role?.name} removed from blacklist.`)] });
      }
    }

    if (sub === 'whitelist') {
      if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Only the bot owner can manage the giveaway whitelist.')], ephemeral: true });
      const action  = interaction.options.getString('action');
      const tUser   = interaction.options.getUser('user');
      const role    = interaction.options.getRole('role');
      const enabled = interaction.options.getBoolean('enabled');

      if (action === 'mode') {
        if (enabled === null) return interaction.reply({ embeds: [errorEmbed('Specify `enabled: true` or `false`.')], ephemeral: true });
        await Guild.findOneAndUpdate({ guildId }, { giveawayWhitelistMode: enabled });
        return interaction.reply({ embeds: [successEmbed(`Giveaway whitelist mode **${enabled ? 'enabled' : 'disabled'}**.`)] });
      }
      if (action === 'list') {
        const wl = guildData.giveawayWhitelist || [];
        if (!wl.length) return interaction.reply({ embeds: [infoEmbed('Whitelist is empty.')] });
        const users = wl.filter(e => e.type === 'user').map(e => `<@${e.id}>`);
        const roles = wl.filter(e => e.type === 'role').map(e => `<@&${e.id}>`);
        return interaction.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '✅ Giveaway Whitelist', fields: [{ name: 'Mode', value: guildData.giveawayWhitelistMode ? '🟢 On' : '🔴 Off' }, { name: 'Users', value: users.join('\n') || 'None' }, { name: 'Roles', value: roles.join('\n') || 'None' }] })] });
      }
      const entry = tUser ? { type: 'user', id: tUser.id } : role ? { type: 'role', id: role.id } : null;
      if (!entry) return interaction.reply({ embeds: [errorEmbed('Specify a user or role.')], ephemeral: true });
      if (action === 'add') {
        await Guild.findOneAndUpdate({ guildId }, { $pull: { giveawayWhitelist: { id: entry.id } } });
        await Guild.findOneAndUpdate({ guildId }, { $push: { giveawayWhitelist: entry } });
        return interaction.reply({ embeds: [successEmbed(`${tUser?.tag || role?.name} added to giveaway whitelist.`)] });
      }
      if (action === 'remove') {
        await Guild.findOneAndUpdate({ guildId }, { $pull: { giveawayWhitelist: { id: entry.id } } });
        return interaction.reply({ embeds: [successEmbed(`${tUser?.tag || role?.name} removed from whitelist.`)] });
      }
    }
    return;
  }

  // ── /reroll ────────────────────────────────────────────────────────────────
  if (commandName === 'reroll') {
    if (!hasAdmin(member) && !isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
    const id       = interaction.options.getString('id').toUpperCase();
    const giveaway = await Giveaway.findOne({ giveawayId: id, guildId });
    if (!giveaway || !giveaway.ended) return interaction.reply({ embeds: [errorEmbed('Giveaway not found or not ended yet.')], ephemeral: true });
    const pool    = giveaway.entries.filter(e => !giveaway.winners.includes(e));
    if (!pool.length) return interaction.reply({ embeds: [errorEmbed('No eligible entries to reroll from.')] });
    const winner = pool[Math.floor(Math.random() * pool.length)];
    await Giveaway.findOneAndUpdate({ giveawayId: id }, { $push: { winners: winner } });
    return interaction.reply({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '🎉 Rerolled!', description: `New winner: <@${winner}> for **${giveaway.prize}**!` })] });
  }

  // ── /endgiveaway ───────────────────────────────────────────────────────────
  if (commandName === 'endgiveaway') {
    if (!hasAdmin(member) && !isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
    const id       = interaction.options.getString('id').toUpperCase();
    const giveaway = await Giveaway.findOne({ giveawayId: id, guildId, ended: false });
    if (!giveaway) return interaction.reply({ embeds: [errorEmbed('Active giveaway not found with that ID.')], ephemeral: true });
    await endGiveaway(giveaway, client);
    return interaction.reply({ embeds: [successEmbed(`Giveaway \`${id}\` ended.`)] });
  }

  // ── /deletegiveaway ────────────────────────────────────────────────────────
  if (commandName === 'deletegiveaway') {
    if (!hasAdmin(member) && !isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
    const id       = interaction.options.getString('id').toUpperCase();
    const giveaway = await Giveaway.findOneAndDelete({ giveawayId: id, guildId });
    if (!giveaway) return interaction.reply({ embeds: [errorEmbed('Giveaway not found.')], ephemeral: true });
    try {
      const ch  = guild.channels.cache.get(giveaway.channelId);
      const msg = ch ? await ch.messages.fetch(giveaway.messageId).catch(() => null) : null;
      if (msg) await msg.delete().catch(() => {});
    } catch {}
    return interaction.reply({ embeds: [successEmbed(`Giveaway \`${id}\` deleted.`)] });
  }

  // ── /antiraid ──────────────────────────────────────────────────────────────
  if (commandName === 'antiraid') {
    if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Only the bot owner can configure anti-raid.')], ephemeral: true });
    const action = interaction.options.getString('action');
    if (action === 'on')  { await Guild.findOneAndUpdate({ guildId }, { antiRaidEnabled: true });  return interaction.reply({ embeds: [successEmbed('Anti-Raid **enabled**.')] }); }
    if (action === 'off') { await Guild.findOneAndUpdate({ guildId }, { antiRaidEnabled: false }); return interaction.reply({ embeds: [successEmbed('Anti-Raid **disabled**.')] }); }
    if (action === 'threshold') {
      const val = interaction.options.getInteger('value');
      const sec = interaction.options.getInteger('seconds');
      const update = {};
      if (val) update.raidJoinCount = val;
      if (sec) update.raidJoinWindow = sec;
      await Guild.findOneAndUpdate({ guildId }, update);
      return interaction.reply({ embeds: [successEmbed(`Raid threshold updated${val ? `: ${val} joins` : ''}${sec ? ` in ${sec}s` : ''}.`)] });
    }
    if (action === 'raidaction') {
      const type = interaction.options.getString('raidtype');
      if (!type) return interaction.reply({ embeds: [errorEmbed('Specify raidtype: kick, ban or verify.')], ephemeral: true });
      await Guild.findOneAndUpdate({ guildId }, { raidAction: type });
      return interaction.reply({ embeds: [successEmbed(`Raid action set to **${type}**.`)] });
    }
    if (action === 'newaccounts') {
      const days = interaction.options.getInteger('value');
      if (!days) return interaction.reply({ embeds: [errorEmbed('Specify number of days.')], ephemeral: true });
      await Guild.findOneAndUpdate({ guildId }, { raidNewAccDays: days });
      return interaction.reply({ embeds: [successEmbed(`New account filter set to ${days} days.`)] });
    }
  }

  // ── /antinuke ──────────────────────────────────────────────────────────────
  if (commandName === 'antinuke') {
    if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Only the bot owner can configure anti-nuke.')], ephemeral: true });
    const action = interaction.options.getString('action');
    if (action === 'on')  { await Guild.findOneAndUpdate({ guildId }, { antiNukeEnabled: true });  return interaction.reply({ embeds: [successEmbed('Anti-Nuke **enabled**.')] }); }
    if (action === 'off') { await Guild.findOneAndUpdate({ guildId }, { antiNukeEnabled: false }); return interaction.reply({ embeds: [successEmbed('Anti-Nuke **disabled**.')] }); }
    if (action === 'punishment') {
      const p = interaction.options.getString('punishment');
      if (!p) return interaction.reply({ embeds: [errorEmbed('Specify punishment: strip, ban or both.')], ephemeral: true });
      await Guild.findOneAndUpdate({ guildId }, { nukePunishment: p });
      return interaction.reply({ embeds: [successEmbed(`Anti-Nuke punishment set to **${p}**.`)] });
    }
  }

  // ── /nukewhitelist ─────────────────────────────────────────────────────────
  if (commandName === 'nukewhitelist') {
    if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Only the bot owner can manage the nuke whitelist.')], ephemeral: true });
    const action = interaction.options.getString('action');
    const target = interaction.options.getUser('user');
    if (action === 'list') {
      const wl = guildData.nukeWhitelist || [];
      return interaction.reply({ embeds: [makeEmbed({ color: COLORS.INFO, title: '🛡️ Nuke Whitelist', description: wl.length ? wl.map(id => `<@${id}>`).join('\n') : 'No users whitelisted.' })] });
    }
    if (!target) return interaction.reply({ embeds: [errorEmbed('Specify a user.')], ephemeral: true });
    if (action === 'add') {
      await Guild.findOneAndUpdate({ guildId }, { $addToSet: { nukeWhitelist: target.id } });
      return interaction.reply({ embeds: [successEmbed(`${target.tag} added to nuke whitelist.`)] });
    }
    if (action === 'remove') {
      await Guild.findOneAndUpdate({ guildId }, { $pull: { nukeWhitelist: target.id } });
      return interaction.reply({ embeds: [successEmbed(`${target.tag} removed from nuke whitelist.`)] });
    }
  }

  // ── /messagelog ────────────────────────────────────────────────────────────
  if (commandName === 'messagelog') {
    if (!hasAdmin(member) && !isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
    const action = interaction.options.getString('action');
    const ch     = interaction.options.getChannel('channel');
    const mode   = interaction.options.getString('mode');
    if (action === 'bl-add' && ch) { await Guild.findOneAndUpdate({ guildId }, { $addToSet: { msgBlacklist: ch.id } }); return interaction.reply({ embeds: [successEmbed(`${ch} blacklisted from message counting.`)] }); }
    if (action === 'bl-remove' && ch) { await Guild.findOneAndUpdate({ guildId }, { $pull: { msgBlacklist: ch.id } }); return interaction.reply({ embeds: [successEmbed(`${ch} removed from blacklist.`)] }); }
    if (action === 'wl-add' && ch) { await Guild.findOneAndUpdate({ guildId }, { $addToSet: { msgWhitelist: ch.id } }); return interaction.reply({ embeds: [successEmbed(`${ch} whitelisted for message counting.`)] }); }
    if (action === 'wl-remove' && ch) { await Guild.findOneAndUpdate({ guildId }, { $pull: { msgWhitelist: ch.id } }); return interaction.reply({ embeds: [successEmbed(`${ch} removed from whitelist.`)] }); }
    if (action === 'mode' && mode) { await Guild.findOneAndUpdate({ guildId }, { msgLogMode: mode }); return interaction.reply({ embeds: [successEmbed(`Message counting mode set to **${mode}**.`)] }); }
    if (action === 'reset') {
      if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Only the owner can reset message counts.')], ephemeral: true });
      await User.updateMany({ guildId }, { $set: { messageCount: 0 } });
      return interaction.reply({ embeds: [successEmbed('All message counts reset.')] });
    }
    return interaction.reply({ embeds: [errorEmbed('Invalid action or missing channel/mode.')], ephemeral: true });
  }

  // ── /announce ──────────────────────────────────────────────────────────────
  if (commandName === 'announce') {
    if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Owner only.')], ephemeral: true });
    const ch      = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');
    const title   = interaction.options.getString('title');
    await ch.send({ embeds: [makeEmbed({ color: COLORS.PRIMARY, title: title || null, description: message, timestamp: true, footer: `Announced by ${user.tag}` })] });
    return interaction.reply({ embeds: [successEmbed(`Announcement sent to ${ch}.`)], ephemeral: true });
  }

  // ── /dm ────────────────────────────────────────────────────────────────────
  if (commandName === 'dm') {
    if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Owner only.')], ephemeral: true });
    const target  = interaction.options.getUser('user');
    const message = interaction.options.getString('message');
    try {
      await target.send({ embeds: [makeEmbed({ color: COLORS.INFO, title: `Message from ${guild.name}`, description: message })] });
      return interaction.reply({ embeds: [successEmbed(`DM sent to ${target.tag}.`)], ephemeral: true });
    } catch { return interaction.reply({ embeds: [errorEmbed(`Could not DM ${target.tag}. They may have DMs off.`)], ephemeral: true }); }
  }

  // ── /eval ──────────────────────────────────────────────────────────────────
  if (commandName === 'eval') {
    if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Owner only.')], ephemeral: true });
    const code = interaction.options.getString('code');
    const row  = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`eval_confirm_${Date.now()}`).setLabel('Execute').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('eval_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );
    interaction._evalCode = code;
    return interaction.reply({ embeds: [makeEmbed({ color: COLORS.WARNING, title: '⚠️ Eval Confirmation', description: `\`\`\`js\n${code.substring(0, 1000)}\n\`\`\`\nAre you sure you want to execute this?` })], components: [row], ephemeral: true });
  }

  // ── /maintenance ───────────────────────────────────────────────────────────
  if (commandName === 'maintenance') {
    if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Owner only.')], ephemeral: true });
    const state = interaction.options.getString('state') === 'on';
    await Guild.findOneAndUpdate({ guildId }, { maintenanceMode: state });
    return interaction.reply({ embeds: [successEmbed(`Maintenance mode **${state ? 'enabled' : 'disabled'}**.`)] });
  }

  // ── /servers ───────────────────────────────────────────────────────────────
  if (commandName === 'servers') {
    if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Owner only.')], ephemeral: true });
    const guilds = client.guilds.cache.map(g => `**${g.name}** — ${g.memberCount} members`);
    return interaction.reply({ embeds: [makeEmbed({ color: COLORS.INFO, title: `🌐 Servers (${guilds.length})`, description: guilds.join('\n') })], ephemeral: true });
  }

  // ── /shutdown ──────────────────────────────────────────────────────────────
  if (commandName === 'shutdown') {
    if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Owner only.')], ephemeral: true });
    await interaction.reply({ embeds: [warningEmbed('Shutting down... 👋')] });
    setTimeout(() => process.exit(0), 2000);
    return;
  }

  // ── /setup ─────────────────────────────────────────────────────────────────
  if (commandName === 'setup') {
    if (!hasAdmin(member) && !isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('You need Administrator permission.')], ephemeral: true });
    const embed = makeEmbed({
      color: COLORS.PRIMARY,
      title: '⚙️ Repl Bot Setup',
      description: 'Use the buttons below to configure each feature, or head to the **dashboard** for full configuration including the welcome embed builder.',
      fields: [
        { name: '📋 Current Config', value:
          `**Mod Log:** ${guildData.modLogChannelId ? `<#${guildData.modLogChannelId}>` : '❌ Not set'}\n` +
          `**Staff Role:** ${guildData.staffRoleId ? `<@&${guildData.staffRoleId}>` : '❌ Not set'}\n` +
          `**Welcome:** ${guildData.welcomeEmbed?.channelId ? `<#${guildData.welcomeEmbed.channelId}>` : '❌ Not set'}\n` +
          `**Auto-Role:** ${guildData.autoRoleId ? `<@&${guildData.autoRoleId}>` : '❌ Not set'}\n` +
          `**Ticket Logs:** ${guildData.ticketLogChannelId ? `<#${guildData.ticketLogChannelId}>` : '❌ Not set'}\n` +
          `**Anti-Raid:** ${guildData.antiRaidEnabled ? '✅ On' : '❌ Off'}\n` +
          `**Anti-Nuke:** ${guildData.antiNukeEnabled ? '✅ On' : '❌ Off'}`,
        },
      ],
    });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

// ─── Close Ticket Helper ──────────────────────────────────────────────────────
async function closeTicket(ticket, channel, guild, guildData, client, closedBy) {
  await Ticket.findOneAndUpdate({ ticketId: ticket.ticketId }, { status: 'closed', closedAt: new Date() });

  const lines = ticket.transcript.map(m =>
    `[${new Date(m.timestamp).toISOString()}] ${m.authorUsername}: ${m.content}${m.attachments.length ? ' [Attachments: ' + m.attachments.join(', ') + ']' : ''}`
  );
  const transcriptText = lines.join('\n') || 'No messages recorded.';
  const buffer = Buffer.from(transcriptText, 'utf-8');

  if (guildData.ticketLogChannelId) {
    const logCh = guild.channels.cache.get(guildData.ticketLogChannelId);
    if (logCh) {
      await logCh.send({
        embeds: [makeEmbed({ color: COLORS.INFO, title: '🎫 Ticket Closed', fields: [{ name: 'Ticket ID', value: ticket.ticketId, inline: true }, { name: 'Type', value: ticket.type, inline: true }, { name: 'User', value: `<@${ticket.userId}>`, inline: true }, { name: 'Closed By', value: `<@${closedBy.id}>`, inline: true }], timestamp: true })],
        files: [{ attachment: buffer, name: `ticket-${ticket.ticketId}.txt` }],
      }).catch(() => {});
    }
  }

  if (guildData.ticketDmTranscript) {
    try {
      const tUser = await client.users.fetch(ticket.userId);
      await tUser.send({
        embeds: [makeEmbed({ color: COLORS.INFO, title: `Your ticket in ${guild.name} was closed`, fields: [{ name: 'Ticket ID', value: ticket.ticketId }, { name: 'Type', value: ticket.type }] })],
        files: [{ attachment: buffer, name: `ticket-${ticket.ticketId}.txt` }],
      });
    } catch {}
  }

  await channel.send({ embeds: [warningEmbed('This ticket will be deleted in 5 seconds...')] });
  setTimeout(() => channel.delete().catch(() => {}), 5000);
}

// ─── Button / Select Handler ──────────────────────────────────────────────────
async function handleInteraction(interaction, client) {
  const { guildId, user, member, guild } = interaction;
  const guildData = await getGuild(guildId);

  // Help select menu
  if (interaction.isStringSelectMenu() && interaction.customId === 'help_select') {
    const cat = HELP_CATEGORIES[interaction.values[0]];
    if (!cat) return interaction.update({ embeds: [errorEmbed('Category not found.')], components: [] });
    const fields = cat.commands.map(c => ({ name: `\`${c.name}\``, value: `${c.desc}\n**Usage:** \`${c.usage}\`\n**Perms:** ${c.perms}` }));
    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('help_back').setLabel('← Back').setStyle(ButtonStyle.Secondary)
    );
    return interaction.update({ embeds: [makeEmbed({ color: COLORS.PRIMARY, title: `${cat.emoji} ${cat.label}`, fields })], components: [backRow] });
  }

  if (interaction.isButton() && interaction.customId === 'help_back') {
    const options = Object.entries(HELP_CATEGORIES)
      .filter(([k]) => k !== 'owner' || isOwner(user.id))
      .map(([value, cat]) => ({ label: cat.label, value }));
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('help_select').setPlaceholder('Select a category...').addOptions(options)
    );
    return interaction.update({ embeds: [makeEmbed({ color: COLORS.PRIMARY, title: '📖 Repl Bot Help', description: 'Select a category below to view its commands.' })], components: [row] });
  }

  // Ticket open button
  if (interaction.isButton() && interaction.customId === 'ticket_open') {
    const types = guildData.ticketTypes || {};
    const options = [
      types.support && { label: '🛠️ Support', description: 'I need help with something', value: 'support' },
      types.report  && { label: '🚨 Report',  description: 'Report a user or issue',      value: 'report' },
      types.claim   && { label: '🎁 Giveaway Claim', description: 'Claim a giveaway prize', value: 'claim' },
      types.appeal  && { label: '⚖️ Appeal',  description: 'Appeal a ban or mute',         value: 'appeal' },
      types.other   && { label: '📩 Other',   description: 'Something else',               value: 'other' },
    ].filter(Boolean);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('ticket_type_select').setPlaceholder('Select ticket type...').addOptions(options)
    );
    return interaction.reply({ embeds: [makeEmbed({ color: COLORS.PRIMARY, title: '🎫 Open a Ticket', description: 'Select the type of ticket you want to open.' })], components: [row], ephemeral: true });
  }

  // Ticket type selected — show modal
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type_select') {
    const type = interaction.values[0];

    if (guildData.ticketOnePerUser) {
      const existing = await Ticket.findOne({ userId: user.id, guildId, type, status: 'open' });
      if (existing) return interaction.update({ embeds: [errorEmbed(`You already have an open ${type} ticket at <#${existing.channelId}>.`)], components: [] });
    }

    const modals = {
      support: () => {
        const m = new ModalBuilder().setCustomId('ticket_modal_support').setTitle('Support Ticket');
        m.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('help_needed').setLabel('What do you need help with?').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Describe your issue in detail...')),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tried').setLabel('Have you tried anything already?').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('Yes / No / What you tried')),
        );
        return m;
      },
      report: () => {
        const m = new ModalBuilder().setCustomId('ticket_modal_report').setTitle('Report a User');
        m.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Who are you reporting? (Username)').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('userid').setLabel('Their User ID').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Right click → Copy ID')),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Reason for report').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('details').setLabel('Explain in detail').setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('evidence').setLabel('Evidence links (optional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('Imgur / video links')),
        );
        return m;
      },
      claim: () => {
        const m = new ModalBuilder().setCustomId('ticket_modal_claim').setTitle('Giveaway Claim');
        m.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('prize').setLabel('What did you win?').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_time').setLabel('Are you claiming within claim time?').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Yes / No')),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('giveaway_link').setLabel('Giveaway message link').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Paste the link to the giveaway message')),
        );
        return m;
      },
      appeal: () => {
        const m = new ModalBuilder().setCustomId('ticket_modal_appeal').setTitle('Appeal');
        m.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('punishment').setLabel('What were you punished for?').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('unfair').setLabel('Why do you believe it was unfair?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('promise').setLabel('What will you do differently?').setStyle(TextInputStyle.Short).setRequired(true)),
        );
        return m;
      },
      other: () => {
        const m = new ModalBuilder().setCustomId('ticket_modal_other').setTitle('Other Ticket');
        m.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('subject').setLabel('Subject').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('details').setLabel('Details').setStyle(TextInputStyle.Paragraph).setRequired(true)),
        );
        return m;
      },
    };

    return interaction.showModal(modals[type]());
  }

  // Modal submitted — create ticket channel
  if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
    const type     = interaction.customId.replace('ticket_modal_', '');
    const fields   = {};
    interaction.fields.fields.forEach((v, k) => { fields[k] = v.value; });

    const typeEmojis = { support: '🛠️', report: '🚨', claim: '🎁', appeal: '⚖️', other: '📩' };
    const emoji      = typeEmojis[type] || '🎫';

    let category = guild.channels.cache.find(c => c.name === 'Tickets' && c.type === 4);
    if (!category) {
      category = await guild.channels.create({ name: 'Tickets', type: 4 }).catch(() => null);
    }

    const overwrites = [
      { id: guild.id, deny: ['ViewChannel'] },
      { id: user.id,  allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
    ];
    if (guildData.staffRoleId) overwrites.push({ id: guildData.staffRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });

    const channel = await guild.channels.create({
      name: `${emoji.replace(/\uFE0F/g, '')}│${type}-${user.username}`.substring(0, 100),
      type: 0,
      parent: category?.id,
      permissionOverwrites: overwrites,
    });

    const ticketId = `TKT-${nanoid(6).toUpperCase()}`;
    await Ticket.create({ ticketId, channelId: channel.id, userId: user.id, guildId, type, modalFields: fields, status: 'open' });

    const fieldLines = Object.entries(fields).map(([k, v]) => ({ name: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), value: v }));
    const embed = makeEmbed({
      color: COLORS.PRIMARY,
      title: `${emoji} ${type.charAt(0).toUpperCase() + type.slice(1)} Ticket`,
      description: `Ticket opened by <@${user.id}>\n**Ticket ID:** \`${ticketId}\``,
      fields: fieldLines,
      footer: `Click the button below to close this ticket`,
      timestamp: true,
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close_btn').setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ content: guildData.staffRoleId ? `<@&${guildData.staffRoleId}>` : undefined, embeds: [embed], components: [row] });
    return interaction.reply({ embeds: [successEmbed(`Your ticket has been created at ${channel}!`)], ephemeral: true });
  }

  // Close ticket button
  if (interaction.isButton() && interaction.customId === 'ticket_close_btn') {
    const ticket = await Ticket.findOne({ channelId: interaction.channelId, status: 'open' });
    if (!ticket) return interaction.reply({ embeds: [errorEmbed('This ticket is already closed.')], ephemeral: true });
    const isStaff = guildData.staffRoleId ? member.roles.cache.has(guildData.staffRoleId) : hasAdmin(member);
    if (ticket.userId !== user.id && !isStaff && !isOwner(user.id)) {
      return interaction.reply({ embeds: [errorEmbed('Only the ticket creator or staff can close this ticket.')], ephemeral: true });
    }
    await interaction.reply({ embeds: [infoEmbed('Closing ticket...')] });
    await closeTicket(ticket, interaction.channel, guild, guildData, client, user);
    return;
  }

  // Giveaway enter button
  if (interaction.isButton() && interaction.customId.startsWith('giveaway_enter_')) {
    const giveawayId = interaction.customId.replace('giveaway_enter_', '');
    const giveaway   = await Giveaway.findOne({ giveawayId, ended: false });
    if (!giveaway) return interaction.reply({ embeds: [errorEmbed('This giveaway has ended.')], ephemeral: true });

    const count = await getEntryCount(member, guildData);
    if (count === 0) return interaction.reply({ embeds: [errorEmbed('You are not eligible to enter this giveaway.')], ephemeral: true });
    if (giveaway.entries.includes(user.id)) return interaction.reply({ embeds: [warningEmbed('You have already entered this giveaway!')], ephemeral: true });

    const newEntries = [user.id, ...Array(count - 1).fill(user.id)];
    await Giveaway.findOneAndUpdate({ giveawayId }, { $push: { entries: { $each: newEntries } } });
    return interaction.reply({ embeds: [successEmbed(`You entered the giveaway${count > 1 ? ` with **${count} entries**` : ''}! Good luck 🎉`)], ephemeral: true });
  }

  // Eval confirm/cancel
  if (interaction.isButton() && interaction.customId.startsWith('eval_confirm_')) {
    if (!isOwner(user.id)) return interaction.reply({ embeds: [errorEmbed('Owner only.')], ephemeral: true });
    const code = interaction.message.embeds[0]?.description?.match(/```js\n([\s\S]+)\n```/)?.[1];
    if (!code) return interaction.update({ embeds: [errorEmbed('Could not retrieve code.')], components: [] });
    try {
      let result = eval(code);
      if (result instanceof Promise) result = await result;
      const output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
      return interaction.update({ embeds: [makeEmbed({ color: COLORS.SUCCESS, title: '✅ Eval Result', description: `\`\`\`js\n${output.substring(0, 1900)}\n\`\`\`` })], components: [] });
    } catch (e) {
      return interaction.update({ embeds: [makeEmbed({ color: COLORS.ERROR, title: '❌ Eval Error', description: `\`\`\`\n${e.message}\n\`\`\`` })], components: [] });
    }
  }

  if (interaction.isButton() && interaction.customId === 'eval_cancel') {
    return interaction.update({ embeds: [infoEmbed('Eval cancelled.')], components: [] });
  }

  // Warnings pagination
  if (interaction.isButton() && (interaction.customId.startsWith('warns_prev_') || interaction.customId.startsWith('warns_next_'))) {
    const parts    = interaction.customId.split('_');
    const dir      = parts[1];
    const targetId = parts[2];
    const curPage  = parseInt(parts[3]);
    const newPage  = dir === 'next' ? curPage + 1 : curPage - 1;
    const userData = await User.findOne({ userId: targetId, guildId });
    if (!userData) return interaction.update({ embeds: [errorEmbed('User not found.')], components: [] });
    const warns    = userData.warns;
    const { items, total } = paginate(warns, newPage, 5);
    const fields   = items.map(w => ({ name: `Warn #${warns.indexOf(w) + 1} — ID: ${w.warnId}`, value: `**Reason:** ${w.reason}\n**Moderator:** <@${w.moderatorId}>\n**Date:** <t:${Math.floor(new Date(w.timestamp).getTime() / 1000)}:R>` }));
    const target   = await client.users.fetch(targetId).catch(() => ({ tag: targetId }));
    const embed    = makeEmbed({ color: COLORS.WARNING, title: `⚠️ Warnings for ${target.tag || targetId}`, fields, footer: `Page ${newPage + 1}/${total} · ${warns.length} total warnings` });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`warns_prev_${targetId}_${newPage}`).setLabel('← Prev').setStyle(ButtonStyle.Secondary).setDisabled(newPage === 0),
      new ButtonBuilder().setCustomId(`warns_next_${targetId}_${newPage}`).setLabel('Next →').setStyle(ButtonStyle.Primary).setDisabled(newPage >= total - 1),
    );
    return interaction.update({ embeds: [embed], components: [row] });
  }
}

module.exports = { commandDefs, handleCommand, handleInteraction, HELP_CATEGORIES };
