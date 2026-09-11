const VALID_STATUS = new Set(["working", "expired", "unknown"]);
const VALID_VERIFICATION = new Set(["verified", "community_confirmed", "likely_working", "unconfirmed", "unknown"]);

function clean(value, max = 500) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, max);
}

function slugify(value) {
  return clean(value, 140).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizedCode(value) {
  return clean(value, 160).toUpperCase();
}

function iso(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function toGame(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    robloxUniverseId: row.roblox_universe_id || null,
    robloxPlaceId: row.roblox_place_id || null,
    robloxUrl: row.roblox_url || null,
    iconUrl: row.icon_url || null,
    description: row.description || "",
    codesEnabled: row.codes_enabled !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCode(row) {
  return {
    id: row.id,
    gameId: row.game_id,
    code: row.code,
    normalizedCode: row.normalized_code,
    reward: row.reward || "",
    status: row.status,
    verificationStatus: row.verification_status,
    source: row.source || "",
    sourceUrl: row.source_url || "",
    addedAt: row.added_at,
    verifiedAt: row.verified_at,
    expiredAt: row.expired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publicGame(game, codeRows) {
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    robloxUniverseId: game.robloxUniverseId,
    robloxPlaceId: game.robloxPlaceId,
    robloxUrl: game.robloxUrl,
    icon: game.iconUrl,
    description: game.description,
    workingCodeCount: codeRows.filter((code) => code.gameId === game.id && code.status === "working").length,
    lastUpdated: game.updatedAt,
  };
}

function buildInFilter(column, values) {
  return `${column}=${encodeURIComponent(`in.(${values.join(",")})`)}`;
}

function createSupabaseCodesStore({ request, isConfigured, fallback }) {
  const providerInfo = () => ({
    id: fallback.provider.id,
    enabled: fallback.provider.enabled,
    reason: fallback.provider.reason || null,
  });

  async function useDatabase(databaseAction, fallbackAction) {
    if (!isConfigured()) return fallbackAction();
    try {
      return await databaseAction();
    } catch (error) {
      // A database outage must not make existing public guides disappear.
      console.error("Codes Supabase request failed; using local fallback:", error.message);
      return fallbackAction();
    }
  }

  async function listFromDatabase({ search = "", limit = 20, page = 1 } = {}) {
    const query = clean(search, 100).toLowerCase();
    const size = Math.max(1, Math.min(Number(limit) || 20, 100));
    const current = Math.max(1, Number(page) || 1);
    const filters = ["codes_enabled=is.true"];
    if (query) filters.push(`or=${encodeURIComponent(`(name.ilike.*${query}*,slug.ilike.*${query}*)`)}`);
    const rows = await request(`/rest/v1/games?${filters.join("&")}&select=*&order=updated_at.desc`);
    const games = (Array.isArray(rows) ? rows : []).map(toGame);
    const pageGames = games.slice((current - 1) * size, current * size);
    const ids = pageGames.map((game) => game.id);
    const codeRows = ids.length
      ? await request(`/rest/v1/game_codes?${buildInFilter("game_id", ids)}&status=eq.working&select=game_id,status`)
      : [];
    const codes = (Array.isArray(codeRows) ? codeRows : []).map((row) => ({ gameId: row.game_id, status: row.status }));
    return { games: pageGames.map((game) => publicGame(game, codes)), page: current, limit: size, total: games.length, provider: providerInfo() };
  }

  async function getFromDatabase(slug) {
    const rows = await request(`/rest/v1/games?slug=eq.${encodeURIComponent(slugify(slug))}&codes_enabled=is.true&select=*&limit=1`);
    if (!Array.isArray(rows) || !rows[0]) return null;
    const game = toGame(rows[0]);
    const rowsForCodes = await request(`/rest/v1/game_codes?game_id=eq.${encodeURIComponent(game.id)}&select=*&order=created_at.desc`);
    const codes = (Array.isArray(rowsForCodes) ? rowsForCodes : []).map(toCode);
    return {
      game: publicGame(game, codes),
      workingCodes: codes.filter((code) => code.status === "working"),
      expiredCodes: codes.filter((code) => code.status === "expired"),
      lastUpdated: game.updatedAt,
      attribution: fallback.provider.attribution || null,
    };
  }

  async function upsertGame(input) {
    const requestedSlug = slugify(input.slug || input.name);
    const name = clean(input.name, 140);
    if (!requestedSlug || !name) throw new Error("A game name or slug is required.");
    const universeId = clean(input.robloxUniverseId, 60) || null;
    let slug = requestedSlug;
    if (universeId) {
      const matches = await request(`/rest/v1/games?roblox_universe_id=eq.${encodeURIComponent(universeId)}&select=slug&limit=1`);
      if (Array.isArray(matches) && matches[0]?.slug) slug = matches[0].slug;
    }
    const rows = await request("/rest/v1/games?on_conflict=slug", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        name,
        slug,
        roblox_universe_id: universeId,
        roblox_place_id: clean(input.robloxPlaceId, 60) || null,
        roblox_url: clean(input.robloxUrl, 500) || null,
        icon_url: clean(input.iconUrl, 500) || null,
        description: clean(input.description, 600),
        codes_enabled: input.codesEnabled !== false,
        updated_at: new Date().toISOString(),
      }),
    });
    return toGame(Array.isArray(rows) ? rows[0] : {});
  }

  async function upsertCode(gameId, input) {
    const code = clean(input.code, 160);
    const codeKey = normalizedCode(code);
    if (!codeKey) throw new Error("Code is required.");
    const status = VALID_STATUS.has(input.status) ? input.status : "unknown";
    const rows = await request("/rest/v1/game_codes?on_conflict=game_id,normalized_code", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        game_id: gameId,
        code,
        normalized_code: codeKey,
        reward: clean(input.reward, 300),
        status,
        verification_status: VALID_VERIFICATION.has(input.verificationStatus) ? input.verificationStatus : "unknown",
        source: clean(input.source, 100),
        source_url: clean(input.sourceUrl, 500),
        added_at: iso(input.addedAt),
        verified_at: input.verifiedAt ? iso(input.verifiedAt) : null,
        expired_at: status === "expired" ? iso(input.expiredAt) : null,
        updated_at: new Date().toISOString(),
      }),
    });
    await request(`/rest/v1/games?id=eq.${encodeURIComponent(gameId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ updated_at: new Date().toISOString() }),
    });
    return toCode(Array.isArray(rows) ? rows[0] : {});
  }

  return {
    provider: fallback.provider,
    list(input) { return useDatabase(() => listFromDatabase(input), () => fallback.list(input)); },
    getGame(slug) { return useDatabase(() => getFromDatabase(slug), () => fallback.getGame(slug)); },
    upsertGame(input) { return useDatabase(() => upsertGame(input), () => fallback.upsertGame(input)); },
    upsertCode(gameId, input) { return useDatabase(() => upsertCode(gameId, input), () => fallback.upsertCode(gameId, input)); },
    sync() { return fallback.sync(); },
  };
}

module.exports = { createSupabaseCodesStore };
