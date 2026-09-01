const fs = require("fs/promises");
const path = require("path");
const { tmpdir } = require("os");

const STATE_DIR = String(process.env.RBLXTOOLS_STATE_DIR || path.join(tmpdir(), "rblxtools-state")).trim();
const STORE_PATH = path.join(STATE_DIR, "discord-bot-entitlements.json");
let writeQueue = Promise.resolve();

function emptyStore() {
  return { unlimitedByAppUserId: {}, useCreditsByAppUserId: {}, processedUseCheckoutIds: {} };
}

async function readStore() {
  try {
    const parsed = JSON.parse(await fs.readFile(STORE_PATH, "utf8"));
    return {
      unlimitedByAppUserId: parsed && parsed.unlimitedByAppUserId && typeof parsed.unlimitedByAppUserId === "object"
        ? parsed.unlimitedByAppUserId
        : {},
      useCreditsByAppUserId: parsed && parsed.useCreditsByAppUserId && typeof parsed.useCreditsByAppUserId === "object"
        ? parsed.useCreditsByAppUserId
        : {},
      processedUseCheckoutIds: parsed && parsed.processedUseCheckoutIds && typeof parsed.processedUseCheckoutIds === "object"
        ? parsed.processedUseCheckoutIds
        : {},
    };
  } catch (error) {
    if (error && error.code === "ENOENT") return emptyStore();
    throw error;
  }
}

async function updateStore(update) {
  const task = writeQueue.then(async () => {
    const store = await readStore();
    const result = await update(store);
    await fs.mkdir(STATE_DIR, { recursive: true });
    const temporaryPath = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(store, null, 2), "utf8");
    await fs.rename(temporaryPath, STORE_PATH);
    return result;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

function toIsoFromUnix(value) {
  const seconds = Number(value || 0);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

async function setUnlimitedSubscription(subscription, appUserId) {
  const userId = String(appUserId || subscription?.metadata?.appUserId || "").trim();
  if (!userId) throw new Error("A RBLXTools account is required for the Discord bot subscription.");
  return updateStore((store) => {
    const customerId = typeof subscription?.customer === "string"
      ? subscription.customer
      : String(subscription?.customer?.id || "").trim();
    const entry = {
      appUserId: userId,
      stripeSubscriptionId: String(subscription?.id || "").trim(),
      stripeCustomerId: customerId,
      status: String(subscription?.status || "inactive").trim().toLowerCase(),
      currentPeriodEndAt: toIsoFromUnix(subscription?.current_period_end),
      cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
      updatedAt: new Date().toISOString(),
    };
    store.unlimitedByAppUserId[userId] = entry;
    return entry;
  });
}

async function getUnlimitedSubscription(appUserId) {
  const userId = String(appUserId || "").trim();
  if (!userId) return null;
  const store = await readStore();
  return store.unlimitedByAppUserId[userId] || null;
}

function isUnlimitedActive(entry) {
  return ["active", "trialing"].includes(String(entry?.status || "").toLowerCase());
}

async function grantPurchasedUses(session) {
  const userId = String(session?.metadata?.appUserId || "").trim();
  const sessionId = String(session?.id || "").trim();
  const uses = Number.parseInt(session?.metadata?.discordBotUses, 10);
  if (!userId || !sessionId || !Number.isFinite(uses) || uses < 5 || uses > 50000 || uses % 5 !== 0) {
    throw new Error("Discord bot use checkout metadata is invalid.");
  }
  return updateStore((store) => {
    if (store.processedUseCheckoutIds[sessionId]) return store.useCreditsByAppUserId[userId] || 0;
    const total = Math.max(0, Number(store.useCreditsByAppUserId[userId] || 0)) + uses;
    store.useCreditsByAppUserId[userId] = total;
    store.processedUseCheckoutIds[sessionId] = { appUserId: userId, uses, processedAt: new Date().toISOString() };
    return total;
  });
}

async function getPurchasedUses(appUserId) {
  const userId = String(appUserId || "").trim();
  if (!userId) return 0;
  const store = await readStore();
  return Math.max(0, Number(store.useCreditsByAppUserId[userId] || 0));
}

module.exports = {
  getUnlimitedSubscription,
  getPurchasedUses,
  grantPurchasedUses,
  isUnlimitedActive,
  setUnlimitedSubscription,
};
