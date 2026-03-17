const mongoose = require('mongoose');

// ─── User ────────────────────────────────────────────────────────────────────
const warnSchema = new mongoose.Schema({
  warnId:      { type: String, required: true },
  reason:      { type: String, required: true },
  moderatorId: { type: String, required: true },
  timestamp:   { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  userId:       { type: String, required: true },
  guildId:      { type: String, required: true },
  xp:           { type: Number, default: 0 },
  level:        { type: Number, default: 0 },
  messageCount: { type: Number, default: 0 },
  warns:        [warnSchema],
}, { timestamps: true });
userSchema.index({ userId: 1, guildId: 1 }, { unique: true });

// ─── Guild ───────────────────────────────────────────────────────────────────
const welcomeEmbedSchema = new mongoose.Schema({
  enabled:       { type: Boolean, default: false },
  channelId:     { type: String,  default: null },
  outsideText:   { type: String,  default: '' },
  color:         { type: String,  default: '#7C3AED' },
  authorText:    { type: String,  default: '' },
  authorIconUrl: { type: String,  default: '' },
  title:         { type: String,  default: 'Welcome!' },
  description:   { type: String,  default: 'Welcome to {servername}, {user}! You are member #{memberjoin}.' },
  thumbnailUrl:  { type: String,  default: '{avatar}' },
  imageUrl:      { type: String,  default: '' },
  footerText:    { type: String,  default: 'Member #{memberjoin} · {members} total members' },
  footerIconUrl: { type: String,  default: '' },
  showTimestamp: { type: Boolean, default: true },
  fields:        [{ name: String, value: String, inline: { type: Boolean, default: false } }],
}, { _id: false });

const ticketPanelSchema = new mongoose.Schema({
  title:        { type: String, default: 'Support Tickets' },
  description:  { type: String, default: 'Need help? Click the button below to open a ticket.' },
  color:        { type: String, default: '#7C3AED' },
  thumbnailUrl: { type: String, default: '' },
  imageUrl:     { type: String, default: '' },
  buttonLabel:  { type: String, default: 'Create Ticket' },
  buttonEmoji:  { type: String, default: '🎫' },
}, { _id: false });

const guildSchema = new mongoose.Schema({
  guildId:            { type: String, required: true, unique: true },
  // Welcome
  welcomeEmbed:       { type: welcomeEmbedSchema, default: () => ({}) },
  autoRoleId:         { type: String, default: null },
  // Mod
  modLogChannelId:    { type: String, default: null },
  staffRoleId:        { type: String, default: null },
  // Tickets
  ticketCategoryId:   { type: String, default: null },
  ticketLogChannelId: { type: String, default: null },
  ticketPanel:        { type: ticketPanelSchema, default: () => ({}) },
  ticketTypes:        { type: Object, default: { support: true, report: true, claim: true, appeal: true, other: true } },
  ticketPingStaff:    { type: Boolean, default: true },
  ticketDmTranscript: { type: Boolean, default: true },
  ticketOnePerUser:   { type: Boolean, default: true },
  // Leveling
  levelingEnabled:    { type: Boolean, default: true },
  levelUpMessages:    { type: Boolean, default: true },
  xpMin:              { type: Number, default: 15 },
  xpMax:              { type: Number, default: 25 },
  xpCooldown:         { type: Number, default: 60 },
  levelRoles:         [{ level: Number, roleId: String }],
  // Message counting
  msgLogMode:         { type: String, default: 'blacklist', enum: ['blacklist', 'whitelist'] },
  msgBlacklist:       [String],
  msgWhitelist:       [String],
  // Anti-Raid
  antiRaidEnabled:    { type: Boolean, default: true },
  raidJoinCount:      { type: Number, default: 5 },
  raidJoinWindow:     { type: Number, default: 10 },
  raidAction:         { type: String, default: 'kick', enum: ['kick', 'ban', 'verify'] },
  raidNewAccDays:     { type: Number, default: 7 },
  raidNewAccFilter:   { type: Boolean, default: true },
  raidOwnerDm:        { type: Boolean, default: true },
  // Anti-Nuke
  antiNukeEnabled:    { type: Boolean, default: true },
  nukePunishment:     { type: String, default: 'both', enum: ['strip', 'ban', 'both'] },
  nukeWhitelist:      [String],
  nukeThresholds:     { type: Object, default: { channelDelete: 3, ban: 3, kick: 5, roleDelete: 2 } },
  // Giveaway
  giveawayBonusEntries: [{ roleId: String, entries: Number }],
  giveawayBlacklist:    [{ type: { type: String, enum: ['user','role'] }, id: String }],
  giveawayWhitelist:    [{ type: { type: String, enum: ['user','role'] }, id: String }],
  giveawayWhitelistMode:{ type: Boolean, default: false },
  // Maintenance
  maintenanceMode:    { type: Boolean, default: false },
}, { timestamps: true });

// ─── Ticket ───────────────────────────────────────────────────────────────────
const transcriptLineSchema = new mongoose.Schema({
  authorId:       String,
  authorUsername: String,
  content:        String,
  attachments:    [String],
  timestamp:      { type: Date, default: Date.now },
}, { _id: false });

const ticketSchema = new mongoose.Schema({
  ticketId:    { type: String, required: true },
  channelId:   { type: String, required: true },
  userId:      { type: String, required: true },
  guildId:     { type: String, required: true },
  type:        { type: String, required: true },
  modalFields: { type: Object, default: {} },
  status:      { type: String, default: 'open', enum: ['open', 'closed'] },
  transcript:  [transcriptLineSchema],
  createdAt:   { type: Date, default: Date.now },
  closedAt:    { type: Date, default: null },
});
ticketSchema.index({ channelId: 1 });
ticketSchema.index({ userId: 1, guildId: 1, type: 1, status: 1 });

// ─── Giveaway ─────────────────────────────────────────────────────────────────
const giveawaySchema = new mongoose.Schema({
  giveawayId:  { type: String, required: true, unique: true },
  guildId:     { type: String, required: true },
  channelId:   { type: String, required: true },
  messageId:   { type: String, default: null },
  prize:       { type: String, required: true },
  hostId:      { type: String, required: true },
  endsAt:      { type: Date, required: true },
  winnerCount: { type: Number, default: 1 },
  entries:     [String],
  winners:     [String],
  ended:       { type: Boolean, default: false },
  bonusEntries:{ type: Boolean, default: true },
}, { timestamps: true });

// ─── CustomCommand ────────────────────────────────────────────────────────────
const customCommandSchema = new mongoose.Schema({
  guildId:   { type: String, required: true },
  trigger:   { type: String, required: true },
  response:  { type: String, required: true },
  createdBy: { type: String, required: true },
}, { timestamps: true });
customCommandSchema.index({ guildId: 1, trigger: 1 }, { unique: true });

module.exports = {
  User:          mongoose.model('User', userSchema),
  Guild:         mongoose.model('Guild', guildSchema),
  Ticket:        mongoose.model('Ticket', ticketSchema),
  Giveaway:      mongoose.model('Giveaway', giveawaySchema),
  CustomCommand: mongoose.model('CustomCommand', customCommandSchema),
};
