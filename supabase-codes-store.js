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
    const codeIds = codes.map((code) => code.id);
    const voteRows = codeIds.length
      ? await request(`/rest/v1/game_code_votes?${buildInFilter("game_code_id", codeIds)}&select=game_code_id,worked`)
      : [];
    const voteSummary = new Map();
    (Array.isArray(voteRows) ? voteRows : []).forEach((vote) => {
      const summary = voteSummary.get(vote.game_code_id) || { successVotes: 0, failureVotes: 0 };
      if (vote.worked) summary.successVotes += 1;
      else summary.failureVotes += 1;
      voteSummary.set(vote.game_code_id, summary);
    });
    codes.forEach((code) => {
      const summary = voteSummary.get(code.id) || { successVotes: 0, failureVotes: 0 };
      code.successVotes = summary.successVotes;
      code.failureVotes = summary.failureVotes;
      code.totalVotes = summary.successVotes + summary.failureVotes;
      code.successRate = code.totalVotes ? Math.round((summary.successVotes / code.totalVotes) * 100) : null;
    });
    const ratingRows = await request(`/rest/v1/game_ratings?game_id=eq.${encodeURIComponent(game.id)}&select=score`);
    const ratingCount = Array.isArray(ratingRows) ? ratingRows.length : 0;
    const ratingTotal = (Array.isArray(ratingRows) ? ratingRows : []).reduce((total, rating) => total + Number(rating.score || 0), 0);
    return {
      game: publicGame(game, codes),
      workingCodes: codes.filter((code) => code.status === "working"),
      expiredCodes: codes.filter((code) => code.status === "expired"),
      lastUpdated: game.updatedAt,
      communityRating: { average: ratingCount ? Math.round((ratingTotal / ratingCount) * 10) / 10 : null, count: ratingCount },
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

  async function submitCodeSubmission(gameId, input, user) {
    const code = clean(input.code, 160);
    if (!code) throw new Error("A code is required.");
    const rows = await request("/rest/v1/game_code_submissions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        game_id: gameId,
        code,
        reward: clean(input.reward, 300),
        source_url: clean(input.sourceUrl, 500),
        submitter_user_id: user.id,
        submitter_name: clean(user.display_name || user.username || user.email?.split("@")[0] || "Member", 80),
      }),
    });
    return Array.isArray(rows) ? rows[0] : null;
  }

  async function voteForCode(gameId, codeId, userId, worked) {
    const codeRows = await request(`/rest/v1/game_codes?id=eq.${encodeURIComponent(codeId)}&game_id=eq.${encodeURIComponent(gameId)}&select=id&limit=1`);
    if (!Array.isArray(codeRows) || !codeRows[0]) throw new Error("Code not found for this game.");
    await request("/rest/v1/game_code_votes?on_conflict=game_code_id,voter_user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ game_code_id: codeId, voter_user_id: userId, worked: Boolean(worked), updated_at: new Date().toISOString() }),
    });
    const votes = await request(`/rest/v1/game_code_votes?game_code_id=eq.${encodeURIComponent(codeId)}&select=worked`);
    const summary = (Array.isArray(votes) ? votes : []).reduce((result, vote) => {
      if (vote.worked) result.successVotes += 1;
      else result.failureVotes += 1;
      return result;
    }, { successVotes: 0, failureVotes: 0 });
    summary.totalVotes = summary.successVotes + summary.failureVotes;
    summary.successRate = summary.totalVotes ? Math.round((summary.successVotes / summary.totalVotes) * 100) : null;
    return summary;
  }

  async function listSubmissions(status = "pending") {
    const safeStatus = ["pending", "approved", "rejected"].includes(status) ? status : "pending";
    const rows = await request(`/rest/v1/game_code_submissions?status=eq.${safeStatus}&select=*&order=created_at.desc&limit=200`);
    return Array.isArray(rows) ? rows : [];
  }

  async function reviewSubmission(id, decision, adminUserId, note = "") {
    const status = decision === "approved" ? "approved" : "rejected";
    const rows = await request(`/rest/v1/game_code_submissions?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const submission = Array.isArray(rows) ? rows[0] : null;
    if (!submission) throw new Error("Submission not found.");
    if (submission.status !== "pending") throw new Error("This submission has already been reviewed.");
    let code = null;
    if (status === "approved") {
      code = await upsertCode(submission.game_id, {
        code: submission.code,
        reward: submission.reward,
        status: "working",
        verificationStatus: "unconfirmed",
        source: "Community submission approved by RBLXTools staff",
        sourceUrl: submission.source_url,
      });
    }
    await request(`/rest/v1/game_code_submissions?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status, reviewed_by_user_id: adminUserId, reviewed_at: new Date().toISOString(), review_note: clean(note, 500), updated_at: new Date().toISOString() }),
    });
    return { status, code };
  }

  async function rateGame(gameId, userId, score) {
    const existing = await request(`/rest/v1/game_ratings?game_id=eq.${encodeURIComponent(gameId)}&voter_user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`);
    if (Array.isArray(existing) && existing[0]) throw Object.assign(new Error("You have already rated this code guide."), { statusCode: 409 });
    await request("/rest/v1/game_ratings", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ game_id: gameId, voter_user_id: userId, score }),
    });
    const ratings = await request(`/rest/v1/game_ratings?game_id=eq.${encodeURIComponent(gameId)}&select=score`);
    const count = Array.isArray(ratings) ? ratings.length : 0;
    const total = (Array.isArray(ratings) ? ratings : []).reduce((sum, rating) => sum + Number(rating.score || 0), 0);
    return { average: count ? Math.round((total / count) * 10) / 10 : null, count };
  }

  return {
    provider: fallback.provider,
    list(input) { return useDatabase(() => listFromDatabase(input), () => fallback.list(input)); },
    getGame(slug) { return useDatabase(() => getFromDatabase(slug), () => fallback.getGame(slug)); },
    upsertGame(input) { return useDatabase(() => upsertGame(input), () => fallback.upsertGame(input)); },
    upsertCode(gameId, input) { return useDatabase(() => upsertCode(gameId, input), () => fallback.upsertCode(gameId, input)); },
    submitCodeSubmission(gameId, input, user) {
      if (!isConfigured()) throw new Error("Code submissions are not configured yet.");
      return submitCodeSubmission(gameId, input, user);
    },
    voteForCode(gameId, codeId, userId, worked) {
      if (!isConfigured()) throw new Error("Code voting is not configured yet.");
      return voteForCode(gameId, codeId, userId, worked);
    },
    listSubmissions(status) {
      if (!isConfigured()) throw new Error("Code submissions are not configured yet.");
      return listSubmissions(status);
    },
    reviewSubmission(id, decision, adminUserId, note) {
      if (!isConfigured()) throw new Error("Code submissions are not configured yet.");
      return reviewSubmission(id, decision, adminUserId, note);
    },
    rateGame(gameId, userId, score) {
      if (!isConfigured()) throw new Error("Code ratings are not configured yet.");
      return rateGame(gameId, userId, score);
    },
    sync() { return fallback.sync(); },
  };
}

module.exports = { createSupabaseCodesStore };
