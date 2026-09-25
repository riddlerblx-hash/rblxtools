"use strict";

// The rewards economy deliberately lives on the server.  Browsers only ever
// receive a projection of this state; they cannot submit XP, levels, or cash.
function createRewardsEngine({ readJsonFile, writeJsonFile, statePath, randomUUID, now = () => new Date() }) {
  const DEFAULT_CONFIG = {
    pendingCashbackDays: 14,
    xp: {
      dailyLogin: 5,
      eligibleToolUse: 2,
      aiGeneration: 2,
      purchasePerDollar: 25,
      referralSignup: 250,
      referralFirstPurchase: 500,
      streak30: 300,
    },
    limits: { eligibleToolUsesPerDay: 25, aiGenerationsPerDay: 25 },
    ranks: [
      { key: "builder", level: 1, name: "Builder", requiredXp: 0, cashbackPercent: 0, tone: "basic" },
      { key: "creator", level: 2, name: "Creator", requiredXp: 10000, cashbackPercent: 2, tone: "blue" },
      { key: "architect", level: 3, name: "Architect", requiredXp: 50000, cashbackPercent: 4, tone: "purple" },
      { key: "tycoon", level: 4, name: "Tycoon", requiredXp: 150000, cashbackPercent: 6, tone: "red" },
      { key: "mogul", level: 5, name: "Mogul", requiredXp: 500000, cashbackPercent: 8, tone: "gold" },
      { key: "rblx_icon", level: 6, name: "RBLX Icon", requiredXp: 1500000, cashbackPercent: 10, tone: "icon" },
    ],
    cashbackTiers: [
      { key: "bronze", name: "Bronze", requiredXp: 0, cashbackPercent: 0, tone: "bronze" },
      { key: "silver", name: "Silver", requiredXp: 10000, cashbackPercent: 2, tone: "silver" },
      { key: "gold", name: "Gold", requiredXp: 50000, cashbackPercent: 4, tone: "gold" },
      { key: "platinum", name: "Platinum", requiredXp: 150000, cashbackPercent: 6, tone: "platinum" },
      { key: "diamond", name: "Diamond", requiredXp: 500000, cashbackPercent: 8, tone: "diamond" },
      { key: "emerald", name: "Emerald", requiredXp: 1500000, cashbackPercent: 10, tone: "emerald" },
      { key: "obsidian", name: "Obsidian", requiredXp: 3000000, cashbackPercent: 11, tone: "obsidian" },
    ],
    quests: {
      daily: [
        { key: "daily_activity", title: "Show up & build", action: "daily_login", target: 1, xp: 5 },
        { key: "daily_tools", title: "Creator momentum", action: "eligible_tool_use", target: 3, xp: 20 },
        { key: "daily_ai", title: "AI spark", action: "ai_generation", target: 1, xp: 15 },
      ],
      weekly: [
        { key: "weekly_tools", title: "Creator grind", action: "eligible_tool_use", target: 10, xp: 150 },
        { key: "weekly_ai", title: "AI apprentice", action: "ai_generation", target: 5, xp: 100 },
        { key: "weekly_activity", title: "Keep building", action: "daily_login", target: 5, xp: 75 },
      ],
      milestone: [
        { key: "first_ai", title: "First AI asset", action: "ai_generation", target: 1, xp: 25 },
        { key: "first_purchase", title: "First purchase", action: "purchase", target: 1, xp: 100 },
        { key: "tools_100", title: "100 creator tools", action: "eligible_tool_use", target: 100, xp: 250 },
        { key: "ai_100", title: "100 AI assets", action: "ai_generation", target: 100, xp: 500 },
        { key: "streak_7", title: "7-day streak", action: "streak_days", target: 7, xp: 75 },
        { key: "streak_30", title: "30-day streak", action: "streak_days", target: 30, xp: 300 },
      ],
    },
    products: { default: { cashbackEligible: true, cashbackMultiplier: 1, purchaseXpMultiplier: 1 } },
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const iso = () => now().toISOString();
  const utcDay = (date = now()) => date.toISOString().slice(0, 10);
  const weekKey = (date = now()) => {
    const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
    return copy.getUTCFullYear() + "-W" + String(Math.ceil((((copy - yearStart) / 86400000) + 1) / 7)).padStart(2, "0");
  };
  const getState = () => {
    const raw = readJsonFile(statePath, {});
    return {
      version: 1,
      config: { ...clone(DEFAULT_CONFIG), ...(raw.config || {}) },
      members: raw.members && typeof raw.members === "object" ? raw.members : {},
      xpLedger: Array.isArray(raw.xpLedger) ? raw.xpLedger : [],
      cashbackLedger: Array.isArray(raw.cashbackLedger) ? raw.cashbackLedger : [],
    };
  };
  const saveState = (state) => writeJsonFile(statePath, {
    ...state,
    xpLedger: state.xpLedger.slice(-100000),
    cashbackLedger: state.cashbackLedger.slice(-100000),
  });
  const memberFor = (state, userId) => {
    const id = String(userId || "");
    if (!state.members[id]) state.members[id] = { lifetimeXp: 0, currentStreak: 0, longestStreak: 0, lastQualifyingActivityDate: null, completedQuestKeys: [], createdAt: iso(), updatedAt: iso() };
    return state.members[id];
  };
  const rankFor = (config, lifetimeXp) => config.ranks.slice().sort((a, b) => b.requiredXp - a.requiredXp).find((rank) => lifetimeXp >= rank.requiredXp) || config.ranks[0];
  const cashbackTierFor = (config, lifetimeXp) => {
    const tiers = Array.isArray(config.cashbackTiers) && config.cashbackTiers.length ? config.cashbackTiers : config.ranks;
    return tiers.slice().sort((a, b) => b.requiredXp - a.requiredXp).find((tier) => lifetimeXp >= tier.requiredXp) || tiers[0];
  };
  const eventCount = (state, userId, action, predicate = () => true) => state.xpLedger.filter((entry) => entry.userId === String(userId) && entry.action === action && entry.amount > 0 && predicate(entry)).length;

  function award(state, { userId, sourceKey, action, title, amount, note = "", metadata = {} }) {
    const value = Math.max(0, Math.round(Number(amount) || 0));
    if (!userId || !sourceKey || !action || value <= 0) return { awarded: false, entry: null };
    const existing = state.xpLedger.find((entry) => entry.sourceKey === String(sourceKey));
    if (existing) return { awarded: false, entry: existing };
    const member = memberFor(state, userId);
    const entry = { id: randomUUID(), userId: String(userId), sourceKey: String(sourceKey), action, title, amount: value, note, metadata, createdAt: iso() };
    state.xpLedger.push(entry);
    member.lifetimeXp += value;
    member.updatedAt = entry.createdAt;
    return { awarded: true, entry };
  }

  function completeQuests(state, userId) {
    const config = state.config;
    const member = memberFor(state, userId);
    const nowDate = now();
    const windows = [
      ["daily", utcDay(nowDate)],
      ["weekly", weekKey(nowDate)],
      ["milestone", "lifetime"],
    ];
    windows.forEach(([kind, window]) => {
      (config.quests?.[kind] || []).forEach((quest) => {
        const target = Math.max(1, Number(quest.target) || 1);
        const count = quest.action === "streak_days"
          ? Number(member.currentStreak || 0)
          : eventCount(state, userId, quest.action, (entry) => kind === "milestone" || (kind === "daily" ? entry.createdAt.slice(0, 10) === window : weekKey(new Date(entry.createdAt)) === window));
        const key = `quest:${kind}:${quest.key}:${window}`;
        if (count >= target && !state.xpLedger.some((entry) => entry.sourceKey === key)) award(state, { userId, sourceKey: key, action: "quest_reward", title: `${quest.title} completed`, amount: quest.xp, note: `${kind} quest`, metadata: { questKey: quest.key, kind, window } });
      });
    });
  }

  function recordActivity({ userId, sourceKey, action, title, amount, note = "", metadata = {}, limitKey = "" }) {
    const state = getState();
    const config = state.config;
    const member = memberFor(state, userId);
    const day = utcDay();
    if (limitKey) {
      const limit = Math.max(0, Number(config.limits?.[limitKey]) || 0);
      const used = eventCount(state, userId, action, (entry) => entry.createdAt.slice(0, 10) === day);
      if (limit && used >= limit) return { awarded: false, limited: true, overview: buildOverviewFromState(state, userId) };
    }
    const result = award(state, { userId, sourceKey, action, title, amount, note, metadata });
    if (result.awarded && action === "daily_login") {
      const yesterday = new Date(now().getTime() - 86400000).toISOString().slice(0, 10);
      if (member.lastQualifyingActivityDate !== day) {
        member.currentStreak = member.lastQualifyingActivityDate === yesterday ? member.currentStreak + 1 : 1;
        member.longestStreak = Math.max(member.longestStreak, member.currentStreak);
        member.lastQualifyingActivityDate = day;
      }
    }
    if (result.awarded) completeQuests(state, userId);
    saveState(state);
    return { ...result, overview: buildOverviewFromState(state, userId) };
  }

  function recordPurchase({ userId, sourceId, productType = "default", title, externalPaidCents, paymentIntentId = "", metadata = {} }) {
    const state = getState();
    const config = state.config;
    const cents = Math.max(0, Math.round(Number(externalPaidCents) || 0));
    if (!userId || !sourceId || !cents) return { awarded: false, cashback: null };
    const product = { ...config.products.default, ...(config.products[productType] || {}) };
    const xp = Math.floor((cents / 100) * Number(config.xp.purchasePerDollar || 0) * Math.max(0, Number(product.purchaseXpMultiplier ?? 1)));
    const xpResult = award(state, { userId, sourceKey: `purchase-xp:${sourceId}`, action: "purchase", title: `${title} purchase`, amount: xp, note: "Verified external payment", metadata: { sourceId, externalPaidCents: cents, productType } });
    const cashbackTier = cashbackTierFor(config, memberFor(state, userId).lifetimeXp);
    const rate = Math.max(0, Number(cashbackTier.cashbackPercent || 0)) / 100;
    const multiplier = product.cashbackEligible === false ? 0 : Math.max(0, Number(product.cashbackMultiplier ?? 1));
    const cashbackCents = Math.floor(cents * rate * multiplier + 1e-8);
    let cashback = state.cashbackLedger.find((entry) => entry.sourceId === String(sourceId));
    if (!cashback && cashbackCents > 0) {
      cashback = { id: randomUUID(), userId: String(userId), sourceId: String(sourceId), paymentIntentId: String(paymentIntentId || ""), productType, title: `${cashbackTier.cashbackPercent}% rake back — ${title}`, externalPaidCents: cents, cashbackCents, ratePercent: cashbackTier.cashbackPercent, multiplier, status: "pending", createdAt: iso(), availableAt: new Date(now().getTime() + Math.max(0, Number(config.pendingCashbackDays) || 0) * 86400000).toISOString(), metadata };
      state.cashbackLedger.push(cashback);
    }
    if (xpResult.awarded) completeQuests(state, userId);
    saveState(state);
    return { awarded: xpResult.awarded, cashback, overview: buildOverviewFromState(state, userId) };
  }

  function markPurchaseReversed({ sourceId = "", paymentIntentId = "", reason = "Payment reversed" }) {
    const state = getState();
    const matching = state.cashbackLedger.filter((entry) => (sourceId && entry.sourceId === String(sourceId)) || (paymentIntentId && entry.paymentIntentId === String(paymentIntentId)));
    matching.forEach((entry) => { if (entry.status === "pending") { entry.status = "reversed"; entry.reversedAt = iso(); entry.reversalReason = reason; } });
    if (matching.length) saveState(state);
    return matching;
  }

  function buildOverviewFromState(state, userId) {
    const config = state.config;
    const member = memberFor(state, userId);
    const rank = rankFor(config, member.lifetimeXp);
    const cashbackTier = cashbackTierFor(config, member.lifetimeXp);
    const ordered = config.ranks.slice().sort((a, b) => a.requiredXp - b.requiredXp);
    const currentIndex = ordered.findIndex((item) => item.key === rank.key);
    const nextRank = ordered[currentIndex + 1] || null;
    const createQuest = (kind, window) => (config.quests?.[kind] || []).map((quest) => {
      const amount = quest.action === "streak_days" ? member.currentStreak : eventCount(state, userId, quest.action, (entry) => kind === "milestone" || (kind === "daily" ? entry.createdAt.slice(0, 10) === window : weekKey(new Date(entry.createdAt)) === window));
      const key = `quest:${kind}:${quest.key}:${window}`;
      return { ...quest, progress: Math.min(Number(quest.target) || 1, amount), completed: state.xpLedger.some((entry) => entry.sourceKey === key) };
    });
    const cashbacks = state.cashbackLedger.filter((entry) => entry.userId === String(userId));
    return {
      rank, ranks: ordered, cashbackTier, cashbackTiers: (Array.isArray(config.cashbackTiers) && config.cashbackTiers.length ? config.cashbackTiers : config.ranks).slice().sort((a, b) => a.requiredXp - b.requiredXp), lifetimeXp: member.lifetimeXp, currentStreak: member.currentStreak, longestStreak: member.longestStreak, lastQualifyingActivityDate: member.lastQualifyingActivityDate,
      nextRank, xpToNextRank: nextRank ? Math.max(0, nextRank.requiredXp - member.lifetimeXp) : 0,
      quests: { daily: createQuest("daily", utcDay()), weekly: createQuest("weekly", weekKey()), milestone: createQuest("milestone", "lifetime") },
      cashback: { pendingCents: cashbacks.filter((entry) => entry.status === "pending").reduce((sum, entry) => sum + entry.cashbackCents, 0), availableCents: cashbacks.filter((entry) => entry.status === "available").reduce((sum, entry) => sum + entry.cashbackCents, 0), lifetimeCents: cashbacks.filter((entry) => entry.status !== "reversed").reduce((sum, entry) => sum + entry.cashbackCents, 0), ledger: cashbacks.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 50) },
      xpLedger: state.xpLedger.filter((entry) => entry.userId === String(userId)).slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 75),
    };
  }

  async function releaseMatureCashback(creditCashback) {
    const state = getState();
    const due = state.cashbackLedger.filter((entry) => entry.status === "pending" && Date.parse(entry.availableAt) <= now().getTime());
    for (const entry of due) {
      const result = await creditCashback(entry);
      if (result?.credited || result?.alreadyCredited) { entry.status = "available"; entry.creditedAt = iso(); }
    }
    if (due.length) saveState(state);
  }

  return { defaultConfig: clone(DEFAULT_CONFIG), getOverview: (userId) => { const state = getState(); const result = buildOverviewFromState(state, userId); saveState(state); return result; }, recordActivity, recordPurchase, markPurchaseReversed, releaseMatureCashback, getConfig: () => getState().config, setConfig: (config) => { const state = getState(); state.config = config; saveState(state); return state.config; } };
}

module.exports = { createRewardsEngine };
