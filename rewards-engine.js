"use strict";

// Canonical 365-day streak plan supplied by RBLXTools.  XP is intentionally
// stored as the approved curve rather than calculated in the browser.
const DAILY_STREAK_XP = "50,51,53,56,58,61,64,67,71,74,78,82,86,90,94,99,103,108,112,117,122,127,131,137,142,147,152,157,163,168,174,179,185,191,197,203,208,214,220,227,233,239,245,251,258,264,271,277,284,290,297,304,310,317,324,331,338,345,352,359,366,373,380,387,394,402,409,416,424,431,439,446,454,461,469,477,484,492,500,508,516,523,531,539,547,555,563,571,580,588,596,604,612,621,629,637,646,654,662,671,679,688,696,705,713,722,731,739,748,757,766,774,783,792,801,810,819,828,837,846,855,864,873,882,891,900,910,919,928,937,947,956,965,975,984,994,1003,1012,1022,1031,1041,1051,1060,1070,1079,1089,1099,1109,1118,1128,1138,1148,1157,1167,1177,1187,1197,1207,1217,1227,1237,1247,1257,1267,1277,1287,1297,1307,1318,1328,1338,1348,1359,1369,1379,1389,1400,1410,1421,1431,1441,1452,1462,1473,1483,1494,1504,1515,1525,1536,1547,1557,1568,1579,1589,1600,1611,1622,1632,1643,1654,1665,1676,1687,1697,1708,1719,1730,1741,1752,1763,1774,1785,1796,1807,1819,1830,1841,1852,1863,1874,1885,1897,1908,1919,1930,1942,1953,1964,1976,1987,1998,2010,2021,2033,2044,2056,2067,2079,2090,2102,2113,2125,2136,2148,2160,2171,2183,2194,2206,2218,2230,2241,2253,2265,2277,2288,2300,2312,2324,2336,2348,2360,2371,2383,2395,2407,2419,2431,2443,2455,2467,2479,2491,2503,2516,2528,2540,2552,2564,2576,2588,2601,2613,2625,2637,2650,2662,2674,2686,2699,2711,2724,2736,2748,2761,2773,2786,2798,2810,2823,2835,2848,2860,2873,2885,2898,2911,2923,2936,2948,2961,2974,2986,2999,3012,3024,3037,3050,3063,3075,3088,3101,3114,3126,3139,3152,3165,3178,3191,3204,3217,3229,3242,3255,3268,3281,3294,3307,3320,3333,3346,3359,3372,3386,3399,3412,3425,3438,3451,3464,3478,3491,3504,3517,3530,3544,3557,3570,3583,3597,3610,3623,3637,3650".split(",").map(Number);
const DAILY_STREAK_BONUSES = "1p2,4p50,7l7,9c10,11p50,14t50,18c10,21l3,24p50,25p50,27c10,28t50,30r7,33p126,35p50,36c10,39p50,42t50,45l15,49p50,53p50,54c10,56t75,57p189,60r10,63c10,66p50,67p50,70t75,72c10,75l20,77p50,81c10,84t75,87p50,90r14,91p50,93p252,95p50,98t75,100c15,105p50,109p50,112t75,117p315,119p50,120r20,123p50,126t75,130c15,133p50,137p50,140t100,147p50,150r30,151p50,153p378,154t100,160c15,161p50,165p50,168t100,175p50,177p504,179p50,180r30,182t100,189p50,193p50,196t100,200c15,203p50,207p618,210r60,213t100,217p50,221p50,224t100,231p50,235p50,237p631,238t100,240r40,245p50,249p50,252t100,259p50,263p50,266t100,267p757,270r90,273p50,277p50,280c20,283t100,287p50,291p50,294t100,297p883,300r50,301p50,305p50,308t100,315p50,319p50,320c20,322t100,327p1009,329p50,330r180,333p50,336t100,343p50,347p50,350c25,353t100,357p50,362p1788,363t100,364p50,365r365";
const DAILY_STREAK_BONUS_BY_DAY = DAILY_STREAK_BONUSES.split(",").reduce((all, token) => {
  const match = token.match(/^(\d+)([plrtc])(\d+)$/);
  if (match) all[Number(match[1])] = { type: match[2], amount: Number(match[3]) };
  return all;
}, {});

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
    if (!state.members[id]) state.members[id] = { lifetimeXp: 0, currentStreak: 0, longestStreak: 0, lastQualifyingActivityDate: null, lastDailyRewardDate: null, completedQuestKeys: [], createdAt: iso(), updatedAt: iso() };
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

  function getDailyReward(member, membershipMultiplier = 1) {
    const day = Math.max(1, Math.min(365, Number(member.currentStreak || 1)));
    const bonus = DAILY_STREAK_BONUS_BY_DAY[day] || null;
    const multiplier = membershipMultiplier === 2 ? 2 : membershipMultiplier === 1.5 ? 1.5 : 1;
    return {
      day,
      xp: Math.round((DAILY_STREAK_XP[day - 1] || 0) * multiplier),
      baseXp: DAILY_STREAK_XP[day - 1] || 0,
      multiplier,
      bonus: bonus ? { ...bonus, amount: (bonus.type === "p" || bonus.type === "t") ? Math.round(bonus.amount * multiplier) : bonus.amount } : null,
    };
  }

  function getDailyStreak(userId, membershipMultiplier = 1) {
    const state = getState();
    const member = memberFor(state, userId);
    const today = utcDay();
    const reward = getDailyReward(member, membershipMultiplier);
    saveState(state);
    const startDay = reward.day;
    const window = Array.from({ length: 14 }, (_, index) => {
      const calendarDay = ((startDay - 1 + index) % 365) + 1;
      const baseXp = DAILY_STREAK_XP[calendarDay - 1] || 0;
      const rawBonus = DAILY_STREAK_BONUS_BY_DAY[calendarDay] || null;
      return { day: calendarDay, xp: Math.round(baseXp * reward.multiplier), baseXp, bonus: rawBonus ? { ...rawBonus, amount: (rawBonus.type === "p" || rawBonus.type === "t") ? Math.round(rawBonus.amount * reward.multiplier) : rawBonus.amount } : null };
    });
    return { ...reward, window, currentStreak: member.currentStreak || 0, longestStreak: member.longestStreak || 0, available: member.lastDailyRewardDate !== today, claimedToday: member.lastDailyRewardDate === today };
  }

  function claimDailyStreak(userId, membershipMultiplier = 1) {
    const state = getState();
    const member = memberFor(state, userId);
    const today = utcDay();
    if (member.lastDailyRewardDate === today) {
      const error = new Error("Today’s streak reward has already been claimed."); error.statusCode = 409; throw error;
    }
    // Claiming is the daily check-in. A member should never lose day one just
    // because the background /auth/me refresh has not finished yet.
    if (member.lastQualifyingActivityDate !== today) {
      const yesterday = new Date(now().getTime() - 86400000).toISOString().slice(0, 10);
      member.currentStreak = member.lastQualifyingActivityDate === yesterday ? member.currentStreak + 1 : 1;
      member.longestStreak = Math.max(member.longestStreak, member.currentStreak);
      member.lastQualifyingActivityDate = today;
    }
    const reward = getDailyReward(member, membershipMultiplier);
    const xp = award(state, { userId, sourceKey: `daily-streak:${userId}:${today}`, action: "daily_streak", title: `Day ${reward.day} daily streak`, amount: reward.xp, note: `${reward.multiplier}x membership reward multiplier`, metadata: { day: reward.day, baseXp: reward.baseXp, multiplier: reward.multiplier } });
    if (!xp.awarded) {
      const error = new Error("Today’s streak reward has already been claimed."); error.statusCode = 409; throw error;
    }
    member.lastDailyRewardDate = today;
    completeQuests(state, userId);
    saveState(state);
    return { ...reward, overview: buildOverviewFromState(state, userId) };
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

  return { defaultConfig: clone(DEFAULT_CONFIG), getOverview: (userId) => { const state = getState(); const result = buildOverviewFromState(state, userId); saveState(state); return result; }, getDailyStreak, claimDailyStreak, recordActivity, recordPurchase, markPurchaseReversed, releaseMatureCashback, getConfig: () => getState().config, setConfig: (config) => { const state = getState(); state.config = config; saveState(state); return state.config; } };
}

module.exports = { createRewardsEngine };
