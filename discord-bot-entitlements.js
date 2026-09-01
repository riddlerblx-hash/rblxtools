const fs = require("fs/promises");
const path = require("path");
const { tmpdir } = require("os");
const { randomBytes } = require("crypto");

const STATE_DIR = String(process.env.RBLXTOOLS_STATE_DIR || path.join(tmpdir(), "rblxtools-state")).trim();
const STORE_PATH = path.join(STATE_DIR, "discord-bot-entitlements.json");
const CLAIM_CODE_TTL_MS = 10 * 60 * 1000;
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
function getOwnerServer(store, appUserId) { const userId = String(appUserId || "").trim(); return Object.values(store.serversByGuildId).find((server) => String(server?.appUserId || "") === userId) || null; }
function normalizeRoleDailyLimits(value) {
  const byRoleId = new Map();
  (Array.isArray(value) ? value : []).forEach((entry) => {
    const roleId = String(entry?.roleId || "").trim();
    const dailyLimit = Number.parseInt(entry?.dailyLimit, 10);
    if (/^\d{15,22}$/.test(roleId) && Number.isFinite(dailyLimit) && dailyLimit >= 0 && dailyLimit <= 1000) byRoleId.set(roleId, dailyLimit);
  });
  return Array.from(byRoleId, ([roleId, dailyLimit]) => ({ roleId, dailyLimit }));
}

function buildDashboard(store, appUserId) {
  const userId = String(appUserId || "").trim();
  const subscription = store.unlimitedByAppUserId[userId] || null;
  const totalUses = purchasedUses(store, userId);
  const server = getOwnerServer(store, userId);
  const usedUses = Math.max(0, Number(server?.usedUses || 0));
  return {
    access: totalUses > 0 || isUnlimitedActive(subscription), mode: isUnlimitedActive(subscription) ? "unlimited" : totalUses > 0 ? "uses" : "locked",
    totalUses, usedUses, remainingUses: Math.max(0, totalUses - usedUses), subscription,
    server: server ? { guildId: server.guildId, guildName: server.guildName || "Discord server", claimedAt: server.claimedAt || null, perUserDailyLimit: Math.max(0, Number(server.perUserDailyLimit || 0)), roleDailyLimits: normalizeRoleDailyLimits(server.roleDailyLimits) } : null,
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

async function claimDiscordServer({ code, appUserId, guildId, guildName }) {
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
    server.guildName = String(guildName || server.guildName || "Discord server").slice(0, 120); server.claimedAt = server.claimedAt || new Date().toISOString(); server.perUserDailyLimit = Math.max(0, Number(server.perUserDailyLimit || 0)); server.roleDailyLimits = normalizeRoleDailyLimits(server.roleDailyLimits); server.updatedAt = new Date().toISOString();
    store.serversByGuildId[normalizedGuildId] = server; delete store.claimCodesByCode[normalizedCode]; return buildDashboard(store, userId);
  });
}

async function updateServerSettings({ appUserId, guildId, perUserDailyLimit, roleDailyLimits }) {
  const userId = String(appUserId || "").trim(); const normalizedGuildId = String(guildId || "").trim(); const limit = Number.parseInt(perUserDailyLimit, 10);
  if (!/^\d+$/.test(normalizedGuildId) || !Number.isFinite(limit) || limit < 0 || limit > 1000) { const error = new Error("Choose a daily user limit from 0 to 1,000. Use 0 for no per-user limit."); error.statusCode = 400; throw error; }
  if (!Array.isArray(roleDailyLimits) || roleDailyLimits.length > 6 || normalizeRoleDailyLimits(roleDailyLimits).length !== roleDailyLimits.length) { const error = new Error("Add up to 6 valid Discord role IDs with daily limits from 0 to 1,000."); error.statusCode = 400; throw error; }
  return updateStore((store) => { const server = store.serversByGuildId[normalizedGuildId]; if (!server || server.appUserId !== userId) { const error = new Error("You do not manage that Discord server."); error.statusCode = 403; throw error; } server.perUserDailyLimit = limit; server.roleDailyLimits = normalizeRoleDailyLimits(roleDailyLimits); server.updatedAt = new Date().toISOString(); return buildDashboard(store, userId); });
}

async function getDiscordServerAccess(guildId) {
  const normalizedGuildId = String(guildId || "").trim(); const store = await readStore(); const server = store.serversByGuildId[normalizedGuildId];
  if (!server) return { allowed: false, reason: "This Discord server has not been claimed in the RBLXTools Bot dashboard yet." };
  const dashboard = buildDashboard(store, server.appUserId);
  return dashboard.access ? { allowed: true, appUserId: server.appUserId, mode: dashboard.mode, server, dashboard } : { allowed: false, reason: "This server no longer has an active RBLXTools Bot entitlement." };
}

async function consumeDiscordServerUse({ guildId, discordUserId, discordRoleIds }) {
  const normalizedGuildId = String(guildId || "").trim(); const memberId = String(discordUserId || "").trim(); const memberRoleIds = new Set((Array.isArray(discordRoleIds) ? discordRoleIds : []).map((roleId) => String(roleId || "").trim()).filter((roleId) => /^\d{15,22}$/.test(roleId)));
  if (!/^\d+$/.test(normalizedGuildId) || !/^\d+$/.test(memberId)) throw new Error("Invalid Discord use request.");
  return updateStore((store) => {
    const server = store.serversByGuildId[normalizedGuildId]; if (!server) { const error = new Error("This server has not been claimed in the RBLXTools Bot dashboard."); error.statusCode = 403; throw error; }
    const dashboard = buildDashboard(store, server.appUserId); if (!dashboard.access) { const error = new Error("This server no longer has an active RBLXTools Bot entitlement."); error.statusCode = 403; throw error; }
    const dateKey = new Date().toISOString().slice(0, 10); const dailyCounts = server.dailyUserUseCounts && typeof server.dailyUserUseCounts === "object" ? server.dailyUserUseCounts : {}; Object.keys(dailyCounts).forEach((key) => { if (key !== dateKey) delete dailyCounts[key]; });
    const today = dailyCounts[dateKey] && typeof dailyCounts[dateKey] === "object" ? dailyCounts[dateKey] : {}; const alreadyUsed = Math.max(0, Number(today[memberId] || 0)); const matchingRoleLimit = normalizeRoleDailyLimits(server.roleDailyLimits).filter((entry) => memberRoleIds.has(entry.roleId)).reduce((highest, entry) => Math.max(highest, entry.dailyLimit), 0); const limit = Math.max(0, Number(server.perUserDailyLimit || 0), matchingRoleLimit);
    if (limit > 0 && alreadyUsed >= limit) { const error = new Error("You reached this server's daily RBLXTools command limit."); error.statusCode = 429; throw error; }
    if (dashboard.mode !== "unlimited" && dashboard.remainingUses < 1) { const error = new Error("This server has used all of its RBLXTools Bot credits."); error.statusCode = 402; throw error; }
    today[memberId] = alreadyUsed + 1; dailyCounts[dateKey] = today; server.dailyUserUseCounts = dailyCounts; if (dashboard.mode !== "unlimited") server.usedUses = Math.max(0, Number(server.usedUses || 0)) + 1; server.updatedAt = new Date().toISOString();
    const updated = buildDashboard(store, server.appUserId); return { mode: updated.mode, remainingUses: updated.remainingUses, dailyUserUses: today[memberId], dailyUserLimit: limit };
  });
}

module.exports = { claimDiscordServer, consumeDiscordServerUse, createServerClaimCode, getBotDashboard, getDiscordServerAccess, getPurchasedUses, getUnlimitedSubscription, grantPurchasedUses, isUnlimitedActive, setUnlimitedSubscription, updateServerSettings };
