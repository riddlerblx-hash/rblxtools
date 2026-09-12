const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const VALID_STATUS = new Set(["working", "expired", "unknown"]);
const VALID_VERIFICATION = new Set(["verified", "community_confirmed", "likely_working", "unconfirmed", "unknown"]);

function clean(value, max = 500) { return String(value || "").replace(/[<>]/g, "").trim().slice(0, max); }
function slugify(value) { return clean(value, 140).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function codeKey(value) { return clean(value, 160).toUpperCase(); }
function iso(value) { const date = value ? new Date(value) : new Date(); return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(); }

class CodesProvider {
  constructor() { this.id = "disabled"; this.enabled = false; this.attribution = null; }
  async getGames() { return []; }
  async getGameCodes() { return []; }
}

class DisabledRblxdbProvider extends CodesProvider {
  constructor() {
    super();
    this.id = "rblxdb";
    this.reason = "RBLXDB does not currently document a commercial game-codes API. This provider remains disabled until written permission and supported endpoint details are supplied.";
  }
}

function createCodesPlatform({ dataPath, provider = new DisabledRblxdbProvider() }) {
  const filePath = dataPath;
  function read() {
    try { const value = JSON.parse(fs.readFileSync(filePath, "utf8")); return { games: Array.isArray(value.games) ? value.games : [], codes: Array.isArray(value.codes) ? value.codes : [], importLog: Array.isArray(value.importLog) ? value.importLog : [] }; }
    catch (_) { return { games: [], codes: [], importLog: [] }; }
  }
  function write(value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); const temp = `${filePath}.${process.pid}.tmp`; fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n"); fs.renameSync(temp, filePath); }
  function publicGame(game, data) { const working = data.codes.filter((code) => code.gameId === game.id && code.status === "working").length; return { id: game.id, name: game.name, slug: game.slug, robloxUniverseId: game.robloxUniverseId || null, robloxPlaceId: game.robloxPlaceId || null, robloxUrl: game.robloxUrl || null, icon: game.iconUrl || null, description: game.description || "", workingCodeCount: working, lastUpdated: game.updatedAt }; }
  function getGame(slug) { const data = read(); const game = data.games.find((item) => item.slug === slugify(slug) && item.codesEnabled); if (!game) return null; const codes = data.codes.filter((item) => item.gameId === game.id); return { game: publicGame(game, data), workingCodes: codes.filter((item) => item.status === "working"), expiredCodes: codes.filter((item) => item.status === "expired"), lastUpdated: game.updatedAt, attribution: provider.attribution || null }; }
  return {
    provider,
    list({ search = "", limit = 20, page = 1 } = {}) { const data = read(); const query = clean(search, 100).toLowerCase(); const games = data.games.filter((game) => game.codesEnabled && (!query || `${game.name} ${game.slug}`.toLowerCase().includes(query))).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))); const size = Math.max(1, Math.min(Number(limit) || 20, 100)); const current = Math.max(1, Number(page) || 1); return { games: games.slice((current - 1) * size, current * size).map((game) => publicGame(game, data)), page: current, limit: size, total: games.length, provider: { id: provider.id, enabled: provider.enabled, reason: provider.reason || null } }; },
    getGame,
    upsertGame(input) { const data = read(); const slug = slugify(input.slug || input.name); if (!slug) throw new Error("A game name or slug is required."); let game = data.games.find((item) => item.slug === slug || (input.robloxUniverseId && item.robloxUniverseId === String(input.robloxUniverseId))); const now = new Date().toISOString(); if (!game) { game = { id: randomUUID(), createdAt: now }; data.games.push(game); } Object.assign(game, { name: clean(input.name, 140), slug, robloxUniverseId: clean(input.robloxUniverseId, 60) || null, robloxPlaceId: clean(input.robloxPlaceId, 60) || null, robloxUrl: clean(input.robloxUrl, 500) || null, iconUrl: clean(input.iconUrl, 500) || null, description: clean(input.description, 600), codesEnabled: input.codesEnabled !== false, updatedAt: now }); write(data); return game; },
    deleteGame(slug) { const data = read(); const index = data.games.findIndex((item) => item.slug === slugify(slug)); if (index < 0) return null; const [game] = data.games.splice(index, 1); data.codes = data.codes.filter((item) => item.gameId !== game.id); write(data); return game; },
    upsertCode(gameId, input) { const data = read(); const game = data.games.find((item) => item.id === gameId); if (!game) throw new Error("Game not found."); const code = clean(input.code, 160); const normalizedCode = codeKey(code); if (!normalizedCode) throw new Error("Code is required."); const now = new Date().toISOString(); let entry = data.codes.find((item) => item.gameId === gameId && item.normalizedCode === normalizedCode); if (!entry) { entry = { id: randomUUID(), gameId, normalizedCode, createdAt: now }; data.codes.push(entry); } const status = VALID_STATUS.has(input.status) ? input.status : "unknown"; Object.assign(entry, { code, reward: clean(input.reward, 300), status, verificationStatus: VALID_VERIFICATION.has(input.verificationStatus) ? input.verificationStatus : "unknown", source: clean(input.source, 100), sourceUrl: clean(input.sourceUrl, 500), addedAt: iso(input.addedAt), verifiedAt: input.verifiedAt ? iso(input.verifiedAt) : null, expiredAt: status === "expired" ? iso(input.expiredAt) : null, updatedAt: now }); game.updatedAt = now; write(data); return entry; },
    async sync() { const data = read(); const run = { id: randomUUID(), provider: provider.id, startedAt: new Date().toISOString(), status: provider.enabled ? "pending" : "disabled", message: provider.enabled ? "Provider sync not implemented." : provider.reason }; data.importLog.unshift(run); data.importLog = data.importLog.slice(0, 100); write(data); return run; }
  };
}

module.exports = { CodesProvider, DisabledRblxdbProvider, createCodesPlatform };
