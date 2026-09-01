const fs = require("fs/promises");
const path = require("path");
const { tmpdir } = require("os");
const { randomBytes } = require("crypto");

const STATE_DIR = String(process.env.RBLXTOOLS_STATE_DIR || path.join(tmpdir(), "rblxtools-state")).trim();
const STORE_PATH = path.join(STATE_DIR, "discord-bot-entitlements.json");
const CLAIM_CODE_TTL_MS = 10 * 60 * 1000;
const ACTIVITY_RETENTION_DAYS = 366;
const BOT_COMMANDS = ["clothing", "ugc", "media", "audio", "animations"];
let writeQueue = Promise.resolve();

function emptyStore() {
  return { unlimitedByAppUserId: {}, useCreditsByAppUserId: {}, processedUseCheckoutIds: {}, claimCodesByCode: {}, serversByGuildId: {} };
}

function normalizeStore(parsed) {
  const source = parsed && typeof parsed === "object" ? parsed : {};
  return {
    unlimitedByAppUserId: source.unlimitedByAppUserId && typeof source.unlimitedByAppUserId === "object" ? source.unlimitedByAppUserId : {},
    useCreditsByAppUserId: source.useCreditsByAppUserId && typeof source.useCreditsByAppUserId === "object" ? source.useCreditsByAppUserId : {},
    processedUseCheckoutIds: source.processedUseCheckoutIds && typeof source.processedUseCheckoutIds === "object" ? source.processedUseCheckoutIds : {},
    claimCodesByCode: source.claimCodesByCode && typeof source.claimCodesByCode === "object" ? source.claimCodesByCode : {},
    serversByGuildId: source.serversByGuildId && typeof source.serversByGuildId === "object" ? source.serversByGuildId : {},
  };
}

async function readStore() {
  try { return normalizeStore(JSON.parse(await fs.readFile(STORE_PATH, "utf8"))); }
  catch (error) { if (error && error.code === "ENOENT") return emptyStore(); throw error; }
}

async function updateStore(update) {
  const task = writeQueue.then(async () => {
    const store = await readStore();
    const result = await update(store);
    await fs.mkdir(STATE_DIR, { recursive: true });
    const temporaryPath = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(store, null, 2), "utf8");
    // PM2 runs the bot as root while LiteSpeed runs the website as nobody:nogroup.
    if (typeof process.getuid === "function" && process.getuid() === 0) await fs.chown(temporaryPath, 65534, 65534);
    await fs.chmod(temporaryPath, 0o660);
    await fs.rename(temporaryPath, STORE_PATH);
    return result;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

function toIsoFromUnix(value) { const seconds = Number(value || 0); return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null; }
function isUnlimitedActive(entry) { return ["active", "trialing"].includes(String(entry?.status || "").toLowerCase()); }
function purchasedUses(store, appUserId) { return Math.max(0, Number(store.useCreditsByAppUserId[String(appUserId || "").trim()] || 0)); }
function getOwnerServer(store, appUserId) { const userId = String(appUserId || "").trim(); return Object.values(store.serversByGuildId).find((server) => String(server?.appUserId || "") === userId && !server.unclaimedAt) || null; }
function normalizeRoleDailyLimits(value) {
  const byRoleId = new Map();
  (Array.isArray(value) ? value : []).forEach((entry) => {
    const roleId = String(entry?.roleId || "").trim();
    const dailyLimit = Number.parseInt(entry?.dailyLimit, 10);
    if (/^\d{15,22}$/.test(roleId) && Number.isFinite(dailyLimit) && dailyLimit >= 0 && dailyLimit <= 1000) byRoleId.set(roleId, dailyLimit);
  });
  return Array.from(byRoleId, ([roleId, dailyLimit]) => ({ roleId, dailyLimit }));
}
function normalizeBlockedCommands(value) { return Array.from(new Set((Array.isArray(value) ? value : []).map((name) => String(name || "").trim().toLowerCase()).filter((name) => BOT_COMMANDS.includes(name)))); }
function normalizeAlertThresholds(value) { return Array.from(new Set((Array.isArray(value) ? value : [75, 90, 100]).map((item) => Number.parseInt(item, 10)).filter((item) => [50, 75, 90, 100].includes(item)))).sort((a, b) => a - b); }
function normalizeAlertChannels(value) { return Array.from(new Map((Array.isArray(value) ? value : []).map((channel) => [String(channel?.id || "").trim(), { id: String(channel?.id || "").trim(), name: String(channel?.name || "Discord channel").trim().slice(0, 100) }]).filter(([id]) => /^\d{15,22}$/.test(id))).values()); }
function addAudit(server, action, detail) { const audit = Array.isArray(server.auditLog) ? server.auditLog : []; audit.unshift({ action, detail: String(detail || "").slice(0, 180), at: new Date().toISOString() }); server.auditLog = audit.slice(0, 60); }
function trimActivity(server) { const activity = server.activityByDate && typeof server.activityByDate === "object" ? server.activityByDate : {}; const cutoff = new Date(Date.now() - ACTIVITY_RETENTION_DAYS * 86400000).toISOString().slice(0, 10); Object.keys(activity).forEach((day) => { if (day < cutoff) delete activity[day]; }); server.activityByDate = activity; return activity; }

function buildDashboard(store, appUserId) {
  const userId = String(appUserId || "").trim();
  const subscription = store.unlimitedByAppUserId[userId] || null;
  const totalUses = purchasedUses(store, userId);
  const server = getOwnerServer(store, userId);
  const usedUses = Math.max(0, Number(server?.usedUses || 0));
  return {
    access: totalUses > 0 || isUnlimitedActive(subscription), mode: isUnlimitedActive(subscription) ? "unlimited" : totalUses > 0 ? "uses" : "locked",
    totalUses, usedUses, remainingUses: Math.max(0, totalUses - usedUses), subscription,
    server: server ? { guildId: server.guildId, guildName: server.guildName || "Discord server", claimedAt: server.claimedAt || null, perUserDailyLimit: Math.max(0, Number(server.perUserDailyLimit || 0)), roleDailyLimits: normalizeRoleDailyLimits(server.roleDailyLimits), paused: Boolean(server.paused), blockedCommands: normalizeBlockedCommands(server.blockedCommands), alertsEnabled: Boolean(server.alertsEnabled), alertThresholds: normalizeAlertThresholds(server.alertThresholds), alertChannelId: String(server.alertChannelId || ""), alertChannels: normalizeAlertChannels(server.alertChannels), activityByDate: trimActivity(server), auditLog: Array.isArray(server.auditLog) ? server.auditLog.slice(0, 30) : [], dailyUserUseCounts: server.dailyUserUseCounts || {} } : null,
  };
}

function makeClaimCode(store) { let code = ""; do { code = randomBytes(5).toString("hex").toUpperCase(); } while (store.claimCodesByCode[code]); return code; }
function cleanupClaimCodes(store) { const now = Date.now(); Object.keys(store.claimCodesByCode).forEach((code) => { if (Date.parse(store.claimCodesByCode[code]?.expiresAt || "") <= now) delete store.claimCodesByCode[code]; }); }

async function setUnlimitedSubscription(subscription, appUserId) {
  const userId = String(appUserId || subscription?.metadata?.appUserId || "").trim();
  if (!userId) throw new Error("A RBLXTools account is required for the Discord bot subscription.");
  return updateStore((store) => {
    const customerId = typeof subscription?.customer === "string" ? subscription.customer : String(subscription?.customer?.id || "").trim();
    const entry = { appUserId: userId, stripeSubscriptionId: String(subscription?.id || "").trim(), stripeCustomerId: customerId, status: String(subscription?.status || "inactive").trim().toLowerCase(), currentPeriodEndAt: toIsoFromUnix(subscription?.current_period_end), cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end), updatedAt: new Date().toISOString() };
    store.unlimitedByAppUserId[userId] = entry;
    return entry;
  });
}

async function getUnlimitedSubscription(appUserId) { const userId = String(appUserId || "").trim(); return userId ? (await readStore()).unlimitedByAppUserId[userId] || null : null; }
async function grantPurchasedUses(session) {
  const userId = String(session?.metadata?.appUserId || "").trim(); const sessionId = String(session?.id || "").trim(); const uses = Number.parseInt(session?.metadata?.discordBotUses, 10);
  if (!userId || !sessionId || !Number.isFinite(uses) || uses < 5 || uses > 50000 || uses % 5 !== 0) throw new Error("Discord bot use checkout metadata is invalid.");
  return updateStore((store) => { if (store.processedUseCheckoutIds[sessionId]) return purchasedUses(store, userId); store.useCreditsByAppUserId[userId] = purchasedUses(store, userId) + uses; store.processedUseCheckoutIds[sessionId] = { appUserId: userId, uses, processedAt: new Date().toISOString() }; return purchasedUses(store, userId); });
}
async function getPurchasedUses(appUserId) { const userId = String(appUserId || "").trim(); return userId ? purchasedUses(await readStore(), userId) : 0; }
async function getBotDashboard(appUserId) { return buildDashboard(await readStore(), appUserId); }

async function createServerClaimCode(appUserId) {
  const userId = String(appUserId || "").trim();
  return updateStore((store) => {
    if (!buildDashboard(store, userId).access) { const error = new Error("Purchase server uses or activate Unlimited before claiming a server."); error.statusCode = 403; throw error; }
    cleanupClaimCodes(store); const code = makeClaimCode(store); const expiresAt = new Date(Date.now() + CLAIM_CODE_TTL_MS).toISOString();
    store.claimCodesByCode[code] = { appUserId: userId, expiresAt, createdAt: new Date().toISOString() }; return { code, expiresAt };
  });
}

async function claimDiscordServer({ code, appUserId, guildId, guildName, alertChannels }) {
  const normalizedCode = String(code || "").trim().toUpperCase(); const userId = String(appUserId || "").trim(); const normalizedGuildId = String(guildId || "").trim();
  if (!normalizedCode || !userId || !/^\d+$/.test(normalizedGuildId)) throw new Error("Invalid server claim request.");
  return updateStore((store) => {
    cleanupClaimCodes(store); const claim = store.claimCodesByCode[normalizedCode];
    if (!claim || claim.appUserId !== userId) { const error = new Error("That server claim code is invalid or expired."); error.statusCode = 403; throw error; }
    const dashboard = buildDashboard(store, userId);
    if (!dashboard.access) { const error = new Error("This account no longer has an active Discord Bot entitlement."); error.statusCode = 403; throw error; }
    const existing = store.serversByGuildId[normalizedGuildId];
    if (existing && existing.appUserId !== userId) { const error = new Error("This Discord server is already claimed by another RBLXTools account."); error.statusCode = 409; throw error; }
    if (dashboard.server && dashboard.server.guildId !== normalizedGuildId) { const error = new Error("This purchase is already assigned to another Discord server."); error.statusCode = 409; throw error; }
    const server = existing || { guildId: normalizedGuildId, appUserId: userId, usedUses: 0, dailyUserUseCounts: {} };
    server.guildName = String(guildName || server.guildName || "Discord server").slice(0, 120); server.claimedAt = server.claimedAt || new Date().toISOString(); server.unclaimedAt = null; server.perUserDailyLimit = Math.max(0, Number(server.perUserDailyLimit || 0)); server.roleDailyLimits = normalizeRoleDailyLimits(server.roleDailyLimits); server.alertChannels = normalizeAlertChannels(alertChannels); if (!server.alertChannels.some((channel) => channel.id === String(server.alertChannelId || ""))) server.alertChannelId = ""; addAudit(server, "claimed", "Server claimed"); server.updatedAt = new Date().toISOString();
    store.serversByGuildId[normalizedGuildId] = server; delete store.claimCodesByCode[normalizedCode]; return buildDashboard(store, userId);
  });
}

async function updateServerSettings({ appUserId, guildId, perUserDailyLimit, roleDailyLimits }) {
  const userId = String(appUserId || "").trim(); const normalizedGuildId = String(guildId || "").trim(); const limit = Number.parseInt(perUserDailyLimit, 10);
  if (!/^\d+$/.test(normalizedGuildId) || !Number.isFinite(limit) || limit < 0 || limit > 1000) { const error = new Error("Choose a daily user limit from 0 to 1,000. Use 0 for no per-user limit."); error.statusCode = 400; throw error; }
  if (!Array.isArray(roleDailyLimits) || roleDailyLimits.length > 6 || normalizeRoleDailyLimits(roleDailyLimits).length !== roleDailyLimits.length) { const error = new Error("Add up to 6 valid Discord role IDs with daily limits from 0 to 1,000."); error.statusCode = 400; throw error; }
  return updateStore((store) => { const server = store.serversByGuildId[normalizedGuildId]; if (!server || server.appUserId !== userId || server.unclaimedAt) { const error = new Error("You do not manage that Discord server."); error.statusCode = 403; throw error; } server.perUserDailyLimit = limit; server.roleDailyLimits = normalizeRoleDailyLimits(roleDailyLimits); addAudit(server, "limits_updated", "Daily use limits updated"); server.updatedAt = new Date().toISOString(); return buildDashboard(store, userId); });
}

async function updateServerControls({ appUserId, guildId, paused, blockedCommands, alertsEnabled, alertThresholds, alertChannelId }) {
  const userId = String(appUserId || "").trim(); const normalizedGuildId = String(guildId || "").trim();
  if (!/^\d+$/.test(normalizedGuildId) || !Array.isArray(blockedCommands) || !Array.isArray(alertThresholds) || normalizeBlockedCommands(blockedCommands).length !== blockedCommands.length) { const error = new Error("Invalid bot controls."); error.statusCode = 400; throw error; }
  return updateStore((store) => { const server = store.serversByGuildId[normalizedGuildId]; if (!server || server.appUserId !== userId || server.unclaimedAt) { const error = new Error("You do not manage that Discord server."); error.statusCode = 403; throw error; } const selectedChannelId = String(alertChannelId || "").trim(); const channels = normalizeAlertChannels(server.alertChannels); if (Boolean(alertsEnabled) && (!channels.some((channel) => channel.id === selectedChannelId) || !normalizeAlertThresholds(alertThresholds).length)) { const error = new Error("Choose an alert channel and at least one alert threshold."); error.statusCode = 400; throw error; } server.paused = Boolean(paused); server.blockedCommands = normalizeBlockedCommands(blockedCommands); server.alertsEnabled = Boolean(alertsEnabled); server.alertThresholds = normalizeAlertThresholds(alertThresholds); server.alertChannelId = server.alertsEnabled ? selectedChannelId : ""; addAudit(server, server.paused ? "paused" : "resumed", server.paused ? "Downloads paused" : "Downloads resumed"); addAudit(server, "alerts_updated", server.alertsEnabled ? "Usage alerts enabled" : "Usage alerts disabled"); server.updatedAt = new Date().toISOString(); return buildDashboard(store, userId); });
}
async function syncDiscordServerChannels({ guildId, alertChannels }) {
  const normalizedGuildId = String(guildId || "").trim();
  if (!/^\d+$/.test(normalizedGuildId)) return null;
  return updateStore((store) => { const server = store.serversByGuildId[normalizedGuildId]; if (!server || server.unclaimedAt) return null; server.alertChannels = normalizeAlertChannels(alertChannels); if (!server.alertChannels.some((channel) => channel.id === String(server.alertChannelId || ""))) server.alertChannelId = ""; server.updatedAt = new Date().toISOString(); return true; });
}
async function resetMemberDailyUse({ appUserId, guildId, discordUserId }) { const userId = String(appUserId || "").trim(); const normalizedGuildId = String(guildId || "").trim(); const memberId = String(discordUserId || "").trim(); if (!/^\d+$/.test(normalizedGuildId) || !/^\d{15,22}$/.test(memberId)) { const error = new Error("Enter a valid Discord user ID."); error.statusCode = 400; throw error; } return updateStore((store) => { const server = store.serversByGuildId[normalizedGuildId]; if (!server || server.appUserId !== userId || server.unclaimedAt) { const error = new Error("You do not manage that Discord server."); error.statusCode = 403; throw error; } const day = new Date().toISOString().slice(0, 10); if (server.dailyUserUseCounts?.[day]) delete server.dailyUserUseCounts[day][memberId]; addAudit(server, "member_reset", "Reset daily use for " + memberId); return buildDashboard(store, userId); }); }
async function unclaimServer({ appUserId, guildId }) { const userId = String(appUserId || "").trim(); const normalizedGuildId = String(guildId || "").trim(); return updateStore((store) => { const server = store.serversByGuildId[normalizedGuildId]; if (!server || server.appUserId !== userId || server.unclaimedAt) { const error = new Error("You do not manage that Discord server."); error.statusCode = 403; throw error; } server.unclaimedAt = new Date().toISOString(); server.paused = true; addAudit(server, "unclaimed", "Server unclaimed for transfer"); return buildDashboard(store, userId); }); }

async function getDiscordServerAccess(guildId) {
  const normalizedGuildId = String(guildId || "").trim(); const store = await readStore(); const server = store.serversByGuildId[normalizedGuildId];
  if (!server) return { allowed: false, reason: "This Discord server has not been claimed in the RBLXTools Bot dashboard yet." };
  const dashboard = buildDashboard(store, server.appUserId);
  return dashboard.access ? { allowed: true, appUserId: server.appUserId, mode: dashboard.mode, server, dashboard } : { allowed: false, reason: "This server no longer has an active RBLXTools Bot entitlement." };
}

async function consumeDiscordServerUse({ guildId, discordUserId, discordRoleIds, commandName }) {
  const normalizedGuildId = String(guildId || "").trim(); const memberId = String(discordUserId || "").trim(); const memberRoleIds = new Set((Array.isArray(discordRoleIds) ? discordRoleIds : []).map((roleId) => String(roleId || "").trim()).filter((roleId) => /^\d{15,22}$/.test(roleId)));
  if (!/^\d+$/.test(normalizedGuildId) || !/^\d+$/.test(memberId)) throw new Error("Invalid Discord use request.");
  return updateStore((store) => {
    const server = store.serversByGuildId[normalizedGuildId]; if (!server || server.unclaimedAt) { const error = new Error("This server has not been claimed in the RBLXTools Bot dashboard."); error.statusCode = 403; throw error; }
    const dashboard = buildDashboard(store, server.appUserId); if (!dashboard.access) { const error = new Error("This server no longer has an active RBLXTools Bot entitlement."); error.statusCode = 403; throw error; }
    const command = String(commandName || "").trim().toLowerCase(); if (server.paused) { const error = new Error("RBLXTools downloads are currently paused for this server."); error.statusCode = 403; throw error; } if (normalizeBlockedCommands(server.blockedCommands).includes(command)) { const error = new Error("This RBLXTools command has been disabled for this server."); error.statusCode = 403; throw error; }
    const dateKey = new Date().toISOString().slice(0, 10); const dailyCounts = server.dailyUserUseCounts && typeof server.dailyUserUseCounts === "object" ? server.dailyUserUseCounts : {}; Object.keys(dailyCounts).forEach((key) => { if (key !== dateKey) delete dailyCounts[key]; });
    const today = dailyCounts[dateKey] && typeof dailyCounts[dateKey] === "object" ? dailyCounts[dateKey] : {}; const alreadyUsed = Math.max(0, Number(today[memberId] || 0)); const matchingRoleLimit = normalizeRoleDailyLimits(server.roleDailyLimits).filter((entry) => memberRoleIds.has(entry.roleId)).reduce((highest, entry) => Math.max(highest, entry.dailyLimit), 0); const limit = Math.max(0, Number(server.perUserDailyLimit || 0), matchingRoleLimit);
    if (limit > 0 && alreadyUsed >= limit) { const error = new Error("You reached this server's daily RBLXTools command limit."); error.statusCode = 429; throw error; }
    if (dashboard.mode !== "unlimited" && dashboard.remainingUses < 1) { const error = new Error("This server has used all of its RBLXTools Bot credits."); error.statusCode = 402; throw error; }
    today[memberId] = alreadyUsed + 1; dailyCounts[dateKey] = today; server.dailyUserUseCounts = dailyCounts; const activity = trimActivity(server); const dayActivity = activity[dateKey] || { uses: 0, users: {}, commands: {} }; dayActivity.uses = Number(dayActivity.uses || 0) + 1; dayActivity.users[memberId] = Number(dayActivity.users[memberId] || 0) + 1; dayActivity.commands[command] = Number(dayActivity.commands[command] || 0) + 1; activity[dateKey] = dayActivity; if (dashboard.mode !== "unlimited") server.usedUses = Math.max(0, Number(server.usedUses || 0)) + 1; server.updatedAt = new Date().toISOString();
    const updated = buildDashboard(store, server.appUserId); const percentUsed = updated.mode === "unlimited" ? 0 : Math.floor(updated.usedUses / Math.max(1, updated.totalUses) * 100); const reachedAlert = Boolean(server.alertsEnabled) ? normalizeAlertThresholds(server.alertThresholds).filter((threshold) => percentUsed >= threshold).pop() || null : null; const sentAlerts = server.alertsSentByDate && typeof server.alertsSentByDate === "object" ? server.alertsSentByDate : {}; Object.keys(sentAlerts).forEach((key) => { if (key !== dateKey) delete sentAlerts[key]; }); const sentToday = sentAlerts[dateKey] && typeof sentAlerts[dateKey] === "object" ? sentAlerts[dateKey] : {}; const alertThreshold = reachedAlert && !sentToday[reachedAlert] ? reachedAlert : null; if (alertThreshold) sentToday[alertThreshold] = true; sentAlerts[dateKey] = sentToday; server.alertsSentByDate = sentAlerts; return { mode: updated.mode, remainingUses: updated.remainingUses, dailyUserUses: today[memberId], dailyUserLimit: limit, alertThreshold, alertChannelId: alertThreshold ? String(server.alertChannelId || "") : "", percentUsed };
  });
}

module.exports = { claimDiscordServer, consumeDiscordServerUse, createServerClaimCode, getBotDashboard, getDiscordServerAccess, getPurchasedUses, getUnlimitedSubscription, grantPurchasedUses, isUnlimitedActive, setUnlimitedSubscription, updateServerSettings, updateServerControls, syncDiscordServerChannels, resetMemberDailyUse, unclaimServer };
