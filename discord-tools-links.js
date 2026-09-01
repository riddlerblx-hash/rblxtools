const { randomBytes } = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { tmpdir } = require("os");

const STATE_DIR = String(process.env.RBLXTOOLS_STATE_DIR || path.join(tmpdir(), "rblxtools-state")).trim();
const STORE_PATH = path.join(STATE_DIR, "discord-tools-links.json");
const CODE_TTL_MS = 10 * 60 * 1000;
let writeQueue = Promise.resolve();

function emptyStore() {
  return { codes: {}, links: {} };
}

async function readStore() {
  try {
    const parsed = JSON.parse(await fs.readFile(STORE_PATH, "utf8"));
    return {
      codes: parsed && parsed.codes && typeof parsed.codes === "object" ? parsed.codes : {},
      links: parsed && parsed.links && typeof parsed.links === "object" ? parsed.links : {},
    };
  } catch (error) {
    if (error && error.code === "ENOENT") return emptyStore();
    throw error;
  }
}

function purgeExpiredCodes(store) {
  const now = Date.now();
  Object.keys(store.codes).forEach((code) => {
    if (!store.codes[code] || Number(store.codes[code].expiresAt || 0) <= now) delete store.codes[code];
  });
}

async function updateStore(update) {
  const task = writeQueue.then(async () => {
    const store = await readStore();
    purgeExpiredCodes(store);
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

function makeCode(store) {
  let code = "";
  do {
    code = randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g).join("-");
  } while (store.codes[code]);
  return code;
}

async function createDiscordLinkCode(appUserId) {
  const userId = String(appUserId || "").trim();
  if (!userId) throw new Error("A RBLXTools account is required.");
  return updateStore((store) => {
    Object.keys(store.codes).forEach((code) => {
      if (store.codes[code] && store.codes[code].appUserId === userId) delete store.codes[code];
    });
    const code = makeCode(store);
    const expiresAt = Date.now() + CODE_TTL_MS;
    store.codes[code] = { appUserId: userId, expiresAt };
    return { code, expiresAt };
  });
}

async function claimDiscordLink(codeValue, discordUser) {
  const code = String(codeValue || "").trim().toUpperCase();
  const discordUserId = String(discordUser && discordUser.id || "").trim();
  if (!code || !discordUserId) throw new Error("A valid link code and Discord account are required.");
  return updateStore((store) => {
    const pending = store.codes[code];
    if (!pending || Number(pending.expiresAt || 0) <= Date.now()) {
      const error = new Error("That link code has expired. Generate a new one on RBLXTools.");
      error.code = "LINK_CODE_EXPIRED";
      throw error;
    }
    Object.keys(store.links).forEach((id) => {
      if (id === discordUserId || store.links[id].appUserId === pending.appUserId) delete store.links[id];
    });
    const linkedAt = new Date().toISOString();
    const link = {
      appUserId: pending.appUserId,
      discordUserId,
      discordUsername: String(discordUser.username || "Discord member").trim().slice(0, 100),
      linkedAt,
    };
    store.links[discordUserId] = link;
    delete store.codes[code];
    return link;
  });
}

async function getDiscordLinkByUserId(discordUserId) {
  const id = String(discordUserId || "").trim();
  if (!id) return null;
  const store = await readStore();
  purgeExpiredCodes(store);
  return store.links[id] || null;
}

async function getDiscordLinkByAppUserId(appUserId) {
  const id = String(appUserId || "").trim();
  if (!id) return null;
  const store = await readStore();
  purgeExpiredCodes(store);
  return Object.values(store.links).find((link) => link && link.appUserId === id) || null;
}

async function unlinkDiscordAccount(appUserId) {
  const id = String(appUserId || "").trim();
  if (!id) return false;
  return updateStore((store) => {
    let removed = false;
    Object.keys(store.links).forEach((discordUserId) => {
      if (store.links[discordUserId] && store.links[discordUserId].appUserId === id) {
        delete store.links[discordUserId];
        removed = true;
      }
    });
    return removed;
  });
}

module.exports = {
  claimDiscordLink,
  createDiscordLinkCode,
  getDiscordLinkByAppUserId,
  getDiscordLinkByUserId,
  unlinkDiscordAccount,
};
