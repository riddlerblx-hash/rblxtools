require("dotenv").config();

const {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { claimDiscordLink, getDiscordLinkByUserId } = require("./discord-tools-links");

const token = String(process.env.RBLXTOOLS_TOOLS_BOT_TOKEN || "").trim();
const clientId = String(process.env.RBLXTOOLS_TOOLS_DISCORD_CLIENT_ID || "").trim();
// Keep this app isolated from the existing support bot's Discord server configuration.
const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const supabaseKey = String(process.env.SUPABASE_KEY || "").trim();
const authUsersTable = String(process.env.AUTH_USERS_TABLE || "member_accounts").trim();
const apiBaseUrl = String(process.env.RBLXTOOLS_TOOLS_API_BASE_URL || process.env.APP_BASE_URL || "https://www.rblxtools.net").trim().replace(/\/$/, "");
const discordToolsServiceSecret = String(process.env.DISCORD_TOOLS_SERVICE_SECRET || "").trim();
const MAX_DISCORD_DOWNLOAD_BYTES = 8 * 1024 * 1024;

const toolDefinitions = {
  clothing: { label: "Clothing", description: "Download a classic Roblox shirt or pants template." },
  ugc: { label: "UGC", description: "Download a Roblox UGC item as OBJ plus texture." },
  media: { label: "Media", description: "Download Roblox media for an asset ID." },
  audio: { label: "Audio", description: "Download a Roblox audio asset." },
  animations: { label: "Animations", description: "Download a Roblox animation asset." },
};

const currencyData = {
  USD: { symbol: "$", rate: 1, decimals: 2 }, BRL: { symbol: "R$", rate: 5.15, decimals: 2 }, GBP: { symbol: "GBP ", rate: 0.79, decimals: 2 }, EUR: { symbol: "EUR ", rate: 0.92, decimals: 2 }, CAD: { symbol: "C$", rate: 1.37, decimals: 2 }, MXN: { symbol: "MX$", rate: 17.1, decimals: 2 }, PHP: { symbol: "PHP ", rate: 57.2, decimals: 2 }, KRW: { symbol: "KRW ", rate: 1370, decimals: 0 }, AUD: { symbol: "A$", rate: 1.52, decimals: 2 },
};
const robuxPackages = [
  { usd: 4.99, web: 400, mobile: 320, premium: 440 }, { usd: 9.99, web: 800, mobile: 720, premium: 880 }, { usd: 19.99, web: 1700, mobile: 1500, premium: 1870 }, { usd: 49.99, web: 4500, mobile: 4000, premium: 4950 }, { usd: 99.99, web: 10000, mobile: 9000, premium: 11000 }, { usd: 199.99, web: 22500, mobile: 20000, premium: 24750 },
];

function currencyChoices() {
  return Object.keys(currencyData).map((code) => ({ name: code, value: code }));
}

const robuxCommand = new SlashCommandBuilder()
  .setName("robux")
  .setDescription("RBLXTools Robux calculator")
  .addSubcommand((subcommand) => subcommand.setName("tax").setDescription("Marketplace fee and take-home").addIntegerOption((option) => option.setName("listed").setDescription("Listed Robux price").setMinValue(0).setRequired(true)).addNumberOption((option) => option.setName("fee").setDescription("Fee percentage, default 30").setMinValue(0).setMaxValue(100)))
  .addSubcommand((subcommand) => subcommand.setName("list-price").setDescription("Price needed to receive target Robux").addIntegerOption((option) => option.setName("take-home").setDescription("Robux you want to keep").setMinValue(0).setRequired(true)).addNumberOption((option) => option.setName("fee").setDescription("Fee percentage, default 30").setMinValue(0).setMaxValue(100)))
  .addSubcommand((subcommand) => subcommand.setName("profit").setDescription("Profit margin after marketplace fee").addIntegerOption((option) => option.setName("cost").setDescription("Your production cost").setMinValue(0).setRequired(true)).addIntegerOption((option) => option.setName("listed").setDescription("Listed price").setMinValue(0).setRequired(true)).addNumberOption((option) => option.setName("fee").setDescription("Fee percentage, default 30").setMinValue(0).setMaxValue(100)))
  .addSubcommand((subcommand) => subcommand.setName("devex").setDescription("Estimate DevEx payout").addIntegerOption((option) => option.setName("earned").setDescription("Earned Robux").setMinValue(0).setRequired(true)).addStringOption((option) => option.setName("currency").setDescription("Payout currency, default USD").addChoices(...currencyChoices())).addStringOption((option) => option.setName("rate").setDescription("DevEx rate, default new").addChoices({ name: "New rate ($0.0038)", value: "new" }, { name: "Old rate ($0.0035)", value: "old" })))
  .addSubcommand((subcommand) => subcommand.setName("devex-eligibility").setDescription("Check a DevEx planning threshold").addIntegerOption((option) => option.setName("earned").setDescription("Earned Robux balance").setMinValue(0).setRequired(true)).addIntegerOption((option) => option.setName("threshold").setDescription("Threshold, default 30000").setMinValue(0)))
  .addSubcommand((subcommand) => subcommand.setName("price").setDescription("Estimate Robux package value").addNumberOption((option) => option.setName("amount").setDescription("Money amount or wanted Robux").setMinValue(0).setRequired(true)).addStringOption((option) => option.setName("mode").setDescription("Calculation direction").setRequired(true).addChoices({ name: "Money to Robux", value: "money" }, { name: "Robux to money", value: "robux" })).addStringOption((option) => option.setName("currency").setDescription("Currency, default USD").addChoices(...currencyChoices())).addStringOption((option) => option.setName("platform").setDescription("Platform, default web").addChoices({ name: "Web / PC", value: "web" }, { name: "Mobile", value: "mobile" })).addBooleanOption((option) => option.setName("premium").setDescription("Use Premium package value")))
  .addSubcommand((subcommand) => subcommand.setName("tax-compare").setDescription("Compare fee take-home amounts").addIntegerOption((option) => option.setName("listed").setDescription("Listed price").setMinValue(0).setRequired(true)).addNumberOption((option) => option.setName("custom-fee").setDescription("Additional custom fee, default 15").setMinValue(0).setMaxValue(100)))
  .addSubcommand((subcommand) => subcommand.setName("split").setDescription("Split Robux evenly after fee").addIntegerOption((option) => option.setName("total").setDescription("Total Robux").setMinValue(0).setRequired(true)).addIntegerOption((option) => option.setName("people").setDescription("People, 1-10").setMinValue(1).setMaxValue(10).setRequired(true)).addNumberOption((option) => option.setName("fee").setDescription("Fee percentage, default 30").setMinValue(0).setMaxValue(100)))
  .addSubcommand((subcommand) => subcommand.setName("commission").setDescription("Price a commission after fees").addIntegerOption((option) => option.setName("take-home").setDescription("Robux you want to keep").setMinValue(0).setRequired(true)).addNumberOption((option) => option.setName("fee").setDescription("Fee percentage, default 30").setMinValue(0).setMaxValue(100)))
  .addSubcommand((subcommand) => subcommand.setName("percentage-split").setDescription("Split Robux by percentages").addIntegerOption((option) => option.setName("total").setDescription("Total Robux").setMinValue(0).setRequired(true)).addStringOption((option) => option.setName("percentages").setDescription("Example: 50,30,20").setRequired(true)))
  .addSubcommand((subcommand) => subcommand.setName("group-payout").setDescription("Estimate group payouts").addIntegerOption((option) => option.setName("funds").setDescription("Available group funds").setMinValue(0).setRequired(true)).addIntegerOption((option) => option.setName("members").setDescription("Members").setMinValue(1).setMaxValue(20).setRequired(true)).addIntegerOption((option) => option.setName("reserve").setDescription("Robux to hold back, default 0").setMinValue(0)))
  .addSubcommand((subcommand) => subcommand.setName("tiers").setDescription("Build commission price tiers").addIntegerOption((option) => option.setName("base").setDescription("Starter take-home price").setMinValue(0).setRequired(true)).addStringOption((option) => option.setName("style").setDescription("Tier set, default art").addChoices({ name: "Art", value: "art" }, { name: "Development", value: "dev" }, { name: "GFX", value: "gfx" })).addNumberOption((option) => option.setName("fee").setDescription("Fee percentage, default 30").setMinValue(0).setMaxValue(100)))
  .addSubcommand((subcommand) => subcommand.setName("goal").setDescription("Calculate Robux remaining for a goal").addIntegerOption((option) => option.setName("after-tax").setDescription("Wanted after-tax Robux").setMinValue(0)).addNumberOption((option) => option.setName("devex-usd").setDescription("Wanted DevEx USD").setMinValue(0)).addIntegerOption((option) => option.setName("current").setDescription("Current Robux").setMinValue(0)))
  .addSubcommand((subcommand) => subcommand.setName("savings").setDescription("Estimate savings time").addIntegerOption((option) => option.setName("target").setDescription("Target Robux").setMinValue(0).setRequired(true)).addIntegerOption((option) => option.setName("current").setDescription("Current Robux").setMinValue(0).setRequired(true)).addIntegerOption((option) => option.setName("daily").setDescription("Robux gained per day").setMinValue(0).setRequired(true)).addIntegerOption((option) => option.setName("weekly-bonus").setDescription("Weekly bonus Robux, default 0").setMinValue(0)))
  .addSubcommand((subcommand) => subcommand.setName("sales-goal").setDescription("Calculate sales needed for a Robux target").addIntegerOption((option) => option.setName("target").setDescription("Target take-home Robux").setMinValue(0).setRequired(true)).addIntegerOption((option) => option.setName("price").setDescription("Price per sale").setMinValue(0).setRequired(true)).addNumberOption((option) => option.setName("fee").setDescription("Fee percentage, default 30").setMinValue(0).setMaxValue(100)))
  .addSubcommand((subcommand) => subcommand.setName("trade").setDescription("Estimate resale profit and break-even").addIntegerOption((option) => option.setName("buy").setDescription("What you paid").setMinValue(0).setRequired(true)).addIntegerOption((option) => option.setName("sell").setDescription("Expected listed sale price").setMinValue(0).setRequired(true)).addNumberOption((option) => option.setName("fee").setDescription("Fee percentage, default 30").setMinValue(0).setMaxValue(100)));

const commands = [
  new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your RBLXTools account with a one-time website code.")
    .addStringOption((option) => option.setName("code").setDescription("Code generated in RBLXTools Account Overview").setRequired(true)),
  new SlashCommandBuilder().setName("status").setDescription("Check your RBLXTools Discord link and plan."),
  new SlashCommandBuilder().setName("tools").setDescription("View the RBLXTools Discord tools available to Pro members."),
  new SlashCommandBuilder()
    .setName("claim-server")
    .setDescription("Claim this server for your purchased RBLXTools Bot uses.")
    .addStringOption((option) => option.setName("code").setDescription("Claim code from RBLXTools Account Overview").setRequired(true)),
  robuxCommand,
  ...Object.entries(toolDefinitions).map(([name, definition]) => {
    const command = new SlashCommandBuilder()
      .setName(name)
      .setDescription(definition.description)
      .addStringOption((option) => option
        .setName("asset-id")
        .setDescription("Put the Roblox asset ID here")
        .setRequired(true));
    if (name === "media") {
      command.addStringOption((option) => option
        .setName("media-type")
        .setDescription("Optional: asset, game, badge, group, gamepass, bundle...")
        .setRequired(false));
    }
    return command;
  }),
].map((command) => command.toJSON());

function assertConfiguration() {
  const missing = [];
  if (!token) missing.push("RBLXTOOLS_TOOLS_BOT_TOKEN");
  if (!clientId) missing.push("RBLXTOOLS_TOOLS_DISCORD_CLIENT_ID");
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!supabaseKey) missing.push("SUPABASE_KEY");
  if (!discordToolsServiceSecret) missing.push("DISCORD_TOOLS_SERVICE_SECRET");
  if (missing.length) throw new Error("Missing environment variables: " + missing.join(", "));
}

async function getLinkedMember(discordUserId) {
  const link = await getDiscordLinkByUserId(discordUserId);
  if (!link) return { link: null, member: null };
  const response = await fetch(
    supabaseUrl + "/rest/v1/" + encodeURIComponent(authUsersTable) + "?id=eq." + encodeURIComponent(link.appUserId) + "&select=id,email,plan,premium_active,plus_active",
    { headers: { apikey: supabaseKey, Authorization: "Bearer " + supabaseKey } }
  );
  if (!response.ok) throw new Error("Could not check the linked RBLXTools membership.");
  const rows = await response.json();
  return { link, member: Array.isArray(rows) ? rows[0] || null : null };
}

async function requirePro(interaction) {
  const result = await getLinkedMember(interaction.user.id);
  if (!result.link) {
    await interaction.editReply("Your Discord is not linked yet. In RBLXTools Account Overview, generate a Discord link code, then run `/link code:YOUR-CODE`.");
    return null;
  }
  if (!result.member || String(result.member.plan || "").toLowerCase() !== "pro") {
    await interaction.editReply("This Discord tool is for active RBLXTools Pro members. Your linked account is currently " + (result.member ? "on the " + String(result.member.plan || "free") + " plan." : "not available.") + "");
    return null;
  }
  return result.member;
}

function buildToolUrl(pathname, parameters) {
  const url = new URL(apiBaseUrl + pathname);
  Object.entries(parameters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function getToolRequestHeaders(discordUserId, guildId) {
  return {
    "X-RBLXTools-Tools-Secret": discordToolsServiceSecret,
    "X-RBLXTools-Discord-User-Id": String(discordUserId),
    "X-RBLXTools-Discord-Guild-Id": String(guildId || ""),
  };
}

function getAttachmentName(response, fallback) {
  const disposition = String(response.headers.get("content-disposition") || "");
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return String(match ? match[1] : fallback).replace(/[\\/:*?"<>|]+/g, "-").slice(0, 180);
}

async function getDownloadAttachment(url, fallbackName, discordUserId, guildId) {
  const response = await fetch(url, { headers: getToolRequestHeaders(discordUserId, guildId) });
  if (!response.ok) {
    let message = "The RBLXTools download could not be prepared.";
    try {
      const payload = await response.json();
      if (payload && payload.error) message = payload.error;
    } catch (_error) {}
    throw new Error(message);
  }

  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_DISCORD_DOWNLOAD_BYTES) throw new Error("This file is too large for Discord. Download it from the RBLXTools website instead.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error("RBLXTools returned an empty download.");
  if (bytes.length > MAX_DISCORD_DOWNLOAD_BYTES) throw new Error("This file is too large for Discord. Download it from the RBLXTools website instead.");
  return new AttachmentBuilder(bytes, { name: getAttachmentName(response, fallbackName) });
}

function normalizeMediaType(value) {
  const type = String(value || "asset").trim().toLowerCase().replace(/[^a-z]/g, "");
  const allowed = new Set(["asset", "game", "badge", "developerproduct", "gamepass", "group", "bundle", "outfit", "user"]);
  if (!allowed.has(type)) throw new Error("Media type must be asset, game, badge, developerproduct, gamepass, group, bundle, outfit, or user.");
  return type;
}

function clampFee(value) { return Math.max(0, Math.min(100, Number(value ?? 30))); }
function keepRate(fee) { return 1 - (clampFee(fee) / 100); }
function robux(value) { return "R$ " + Math.round(value).toLocaleString(); }
function percent(value) { return Number(value || 0).toFixed(1) + "%"; }
function money(value, currency) {
  const info = currencyData[currency] || currencyData.USD;
  return info.symbol + Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: info.decimals, maximumFractionDigits: info.decimals });
}
function getPackageRobux(pack, platform, premium) {
  // This follows the current website's package table; its temporary Premium bonus has expired.
  return platform === "mobile" ? pack.mobile : pack.web;
}
function optionNumber(interaction, name, fallback = 0) { return interaction.options.getNumber(name) ?? fallback; }
function optionInteger(interaction, name, fallback = 0) { return interaction.options.getInteger(name) ?? fallback; }

function calculateRobux(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const fee = optionNumber(interaction, "fee", 30);
  const rate = keepRate(fee);

  if (subcommand === "tax") {
    const listed = optionInteger(interaction, "listed"); const net = Math.floor(listed * rate);
    return "**Marketplace fee**\nListed: **" + robux(listed) + "**\nFee: **" + robux(listed - net) + "** (" + percent(fee) + ")\nYou receive: **" + robux(net) + "**\nPrice to keep " + robux(listed) + ": **" + (rate ? robux(Math.ceil(listed / rate)) : "Not possible") + "**";
  }
  if (subcommand === "list-price" || subcommand === "commission") {
    const target = optionInteger(interaction, "take-home"); const price = rate ? Math.ceil(target / rate) : 0;
    return "**" + (subcommand === "commission" ? "Commission price" : "Target price") + "**\nTarget take-home: **" + robux(target) + "**\nFee: **" + percent(fee) + "**\nCharge: **" + (rate ? robux(price) : "Not possible") + "**\nFee portion: **" + (rate ? robux(price - target) : "-") + "**";
  }
  if (subcommand === "profit") {
    const cost = optionInteger(interaction, "cost"); const listed = optionInteger(interaction, "listed"); const net = Math.floor(listed * rate); const profit = net - cost;
    return "**Profit margin**\nListed: **" + robux(listed) + "**\nNet after fee: **" + robux(net) + "**\nCost: **" + robux(cost) + "**\nProfit: **" + robux(profit) + "**\nMargin: **" + percent(listed ? (profit / listed) * 100 : 0) + "**";
  }
  if (subcommand === "devex") {
    const earned = optionInteger(interaction, "earned"); const currency = interaction.options.getString("currency") || "USD"; const devexRate = interaction.options.getString("rate") === "old" ? 0.0035 : 0.0038; const usd = earned * devexRate;
    return "**DevEx estimate**\nEarned: **" + robux(earned) + "**\nSelected payout: **" + money(usd * currencyData[currency].rate, currency) + "**\nUSD estimate: **" + money(usd, "USD") + "**\nOld rate: **" + money(earned * 0.0035, "USD") + "**\nNew rate: **" + money(earned * 0.0038, "USD") + "**";
  }
  if (subcommand === "devex-eligibility") {
    const earned = optionInteger(interaction, "earned"); const threshold = optionInteger(interaction, "threshold", 30000); const missing = Math.max(0, threshold - earned);
    return "**DevEx threshold planner**\nEarned: **" + robux(earned) + "**\nThreshold: **" + robux(threshold) + "**\nThreshold met: **" + (earned >= threshold ? "Yes" : "Not yet") + "**\nStill needed: **" + robux(missing) + "**\nProgress: **" + percent(threshold ? Math.min(100, earned / threshold * 100) : 0) + "**\n*Roblox makes the final eligibility decision.*";
  }
  if (subcommand === "price") {
    const amount = optionNumber(interaction, "amount"); const currency = interaction.options.getString("currency") || "USD"; const platform = interaction.options.getString("platform") || "web"; const premium = interaction.options.getBoolean("premium") === true; const mode = interaction.options.getString("mode"); const best = robuxPackages.reduce((winner, pack) => (getPackageRobux(pack, platform, premium) / pack.usd) > winner.value ? { pack, value: getPackageRobux(pack, platform, premium) / pack.usd } : winner, { pack: robuxPackages[0], value: 0 });
    if (mode === "robux") return "**Robux buying estimate**\nTarget: **" + robux(amount) + "**\nEstimated spend: **" + money(Math.max(best.pack.usd, amount / best.value * currencyData[currency].rate), currency) + "**\nMode: **" + (premium ? "Premium" : "Standard") + "**\nBest website package value: **" + best.value.toFixed(1) + " Robux/USD**";
    const budgetUsd = amount / currencyData[currency].rate; let remaining = budgetUsd; let total = 0; robuxPackages.slice().sort((a, b) => b.usd - a.usd).forEach((pack) => { const count = Math.floor(remaining / pack.usd); total += count * getPackageRobux(pack, platform, false); remaining -= count * pack.usd; });
    return "**Robux buying estimate**\nBudget: **" + money(amount, currency) + "**\nPlatform: **" + (platform === "mobile" ? "Mobile" : "Web / PC") + "**\nMode: **" + (premium ? "Premium" : "Standard") + "**\nEstimated Robux: **" + robux(total) + "**\nBest package value: **" + best.value.toFixed(1) + " Robux/USD**";
  }
  if (subcommand === "tax-compare") { const listed = optionInteger(interaction, "listed"); const custom = optionNumber(interaction, "custom-fee", 15); return "**Fee comparison for " + robux(listed) + "**\n0%: **" + robux(listed) + "**\n30%: **" + robux(Math.floor(listed * .7)) + "**\n40%: **" + robux(Math.floor(listed * .6)) + "**\n" + percent(custom) + ": **" + robux(Math.floor(listed * keepRate(custom))) + "**"; }
  if (subcommand === "split") { const total = optionInteger(interaction, "total"); const people = optionInteger(interaction, "people"); const after = Math.floor(total * rate); const each = Math.floor(after / people); return "**Equal split**\nAfter fee total: **" + robux(after) + "**\nPeople: **" + people + "**\nEach receives: **" + robux(each) + "**\nUndistributed: **" + robux(after - each * people) + "**"; }
  if (subcommand === "percentage-split") { const total = optionInteger(interaction, "total"); const values = interaction.options.getString("percentages").split(",").map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0); if (!values.length) throw new Error("Use comma-separated positive percentages, for example `50,30,20`."); const shares = values.map((item, index) => "Split " + (index + 1) + " (" + item + "%): **" + robux(Math.floor(total * item / 100)) + "**"); return "**Percentage split of " + robux(total) + "**\n" + shares.join("\n") + "\nTotal entered: **" + percent(values.reduce((sum, value) => sum + value, 0)) + "**"; }
  if (subcommand === "group-payout") { const funds = optionInteger(interaction, "funds"); const members = optionInteger(interaction, "members"); const reserve = optionInteger(interaction, "reserve"); const pool = Math.max(0, funds - reserve); const each = Math.floor(pool / members); return "**Group payout**\nPayout pool: **" + robux(pool) + "**\nPer member: **" + robux(each) + "**\nFunds left: **" + robux(funds - each * members) + "**"; }
  if (subcommand === "tiers") { const base = optionInteger(interaction, "base"); const style = interaction.options.getString("style") || "art"; const tiers = { art: [["Sketch", 1], ["Bust", 1.8], ["Half Body", 2.6], ["Full Body", 3.5]], dev: [["Bug Fix", 1], ["Small Feature", 2], ["System Build", 3.8], ["Large Commission", 5]], gfx: [["Icon", 1], ["Thumbnail", 1.7], ["Banner", 2.4], ["Full Promo Pack", 3.3]] }[style]; return "**Commission tiers**\n" + tiers.map(([name, multiplier]) => { const want = Math.round(base * multiplier); return name + ": charge **" + (rate ? robux(Math.ceil(want / rate)) : "Not possible") + "** to keep " + robux(want); }).join("\n"); }
  if (subcommand === "goal") { const after = optionInteger(interaction, "after-tax"); const usd = optionNumber(interaction, "devex-usd"); const current = optionInteger(interaction, "current"); const priceTarget = Math.ceil(after / .7); const devexTarget = Math.ceil(usd / .0038); const target = Math.max(after, devexTarget); return "**Goal planner**\nRemaining: **" + robux(Math.max(0, target - current)) + "**\nPrice to earn after-tax goal: **" + robux(priceTarget) + "**\nRobux for DevEx goal: **" + robux(devexTarget) + "**\nProgress: **" + percent(target ? Math.min(100, current / target * 100) : 0) + "**"; }
  if (subcommand === "savings") { const target = optionInteger(interaction, "target"); const current = optionInteger(interaction, "current"); const daily = optionInteger(interaction, "daily"); const bonus = optionInteger(interaction, "weekly-bonus"); const remaining = Math.max(0, target - current); const dailyEffective = daily + bonus / 7; return "**Savings tracker**\nRemaining: **" + robux(remaining) + "**\nDaily effective gain: **" + dailyEffective.toFixed(1) + " Robux**\nDays left: **" + (dailyEffective ? Math.ceil(remaining / dailyEffective) : 0) + "**\nWeeks left: **" + ((daily * 7 + bonus) ? Math.ceil(remaining / (daily * 7 + bonus)) : 0) + "**"; }
  if (subcommand === "sales-goal") { const target = optionInteger(interaction, "target"); const price = optionInteger(interaction, "price"); const perSale = Math.floor(price * rate); const sales = perSale ? Math.ceil(target / perSale) : 0; return "**Sales goal**\nTake-home per sale: **" + robux(perSale) + "**\nSales needed: **" + (perSale ? sales.toLocaleString() : "Not possible") + "**\nGross sales volume: **" + (perSale ? robux(sales * price) : "Not possible") + "**"; }
  if (subcommand === "trade") { const buy = optionInteger(interaction, "buy"); const sell = optionInteger(interaction, "sell"); const net = Math.floor(sell * rate); const profit = net - buy; return "**Trade estimate**\nNet sale: **" + robux(net) + "**\nProfit: **" + robux(profit) + "**\nBreak-even price: **" + (rate ? robux(Math.ceil(buy / rate)) : "Not possible") + "**\nROI: **" + percent(buy ? profit / buy * 100 : 0) + "**"; }
  throw new Error("That calculator option is not available yet.");
}

async function buildToolDownload(toolName, assetId, mediaType, discordUserId, guildId) {
  if (toolName === "clothing") {
    return { content: "**Clothing template ready** for Roblox ID `" + assetId + "`.", files: [await getDownloadAttachment(buildToolUrl("/template", { id: assetId }), "roblox-template-" + assetId + ".png", discordUserId, guildId)] };
  }
  if (toolName === "ugc") {
    const [model, texture] = await Promise.all([
      getDownloadAttachment(buildToolUrl("/ugc-obj", { id: assetId, mode: "ugc" }), "rblxtools-ugc-" + assetId + ".obj", discordUserId, guildId),
      getDownloadAttachment(buildToolUrl("/ugc-texture", { id: assetId }), "texture-" + assetId + ".png", discordUserId, guildId),
    ]);
    return { content: "**UGC package ready** for Roblox ID `" + assetId + "`. Keep the OBJ and texture together when importing.", files: [model, texture] };
  }
  if (toolName === "media") {
    const kind = normalizeMediaType(mediaType);
    return { content: "**Media ready** for Roblox ID `" + assetId + "` (`" + kind + "`).", files: [await getDownloadAttachment(buildToolUrl("/media", { input: assetId, kind, download: 1 }), "roblox-media-" + assetId + ".png", discordUserId, guildId)] };
  }
  if (toolName === "audio") {
    return { content: "**Audio ready** for Roblox ID `" + assetId + "`.", files: [await getDownloadAttachment(buildToolUrl("/audio", { input: assetId, download: 1 }), "roblox-audio-" + assetId, discordUserId, guildId)] };
  }
  if (toolName === "animations") {
    return { content: "**Animation ready** for Roblox ID `" + assetId + "`.", files: [await getDownloadAttachment(buildToolUrl("/animation", { id: assetId, download: 1 }), "roblox-animation-" + assetId + ".rbxm", discordUserId, guildId)] };
  }
  throw new Error("That RBLXTools command is not available yet.");
}

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log("[tools-bot] registered global commands");
}

async function callBotService(pathname, interaction, body) {
  const response = await fetch(apiBaseUrl + pathname, {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, getToolRequestHeaders(interaction.user.id, interaction.guildId)),
    body: JSON.stringify(body || {}),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "RBLXTools Bot could not verify this server.");
  return payload || {};
}

async function claimGuild(interaction) {
  if (!interaction.inGuild()) throw new Error("Run this command inside the Discord server you want to claim.");
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error("You need the Manage Server permission to claim this Discord server.");
  const alertChannels = getAlertChannels(interaction.guild);
  return callBotService("/discord-bot/service/claim-server", interaction, {
    code: interaction.options.getString("code", true), guildId: interaction.guildId, guildName: interaction.guild?.name || "Discord server", alertChannels,
  });
}

function getAlertChannels(guild) {
  return Array.from(guild?.channels?.cache?.values?.() || []).filter((channel) => channel?.isTextBased?.()).map((channel) => ({ id: channel.id, name: "#" + channel.name }));
}

async function syncAlertChannels(guild) {
  if (!guild) return;
  await callBotService("/discord-bot/service/sync-alert-channels", { user: { id: "0" }, guildId: guild.id }, { guildId: guild.id, alertChannels: getAlertChannels(guild) }).catch(() => null);
}

async function sendUsageAlert(interaction, usage) {
  if (!usage?.alertThreshold || !usage?.alertChannelId || !interaction.guild) return;
  const channel = await interaction.guild.channels.fetch(usage.alertChannelId).catch(() => null);
  if (!channel?.isTextBased?.()) return;
  await channel.send("RBLXTools Bot usage alert: this server has used **" + usage.alertThreshold + "%** of its available use pack.").catch(() => null);
}

function getInteractionRoleIds(interaction) {
  const cachedRoles = interaction.member?.roles?.cache;
  if (cachedRoles && typeof cachedRoles.keys === "function") return Array.from(cachedRoles.keys());
  return Array.isArray(interaction.member?.roles) ? interaction.member.roles.map((roleId) => String(roleId || "")) : [];
}

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;
  const isPrivateCommand = ["link", "status"].includes(interaction.commandName);
  await interaction.deferReply({ ephemeral: isPrivateCommand });

  if (toolDefinitions[interaction.commandName]) {
    try {
      if (!interaction.inGuild()) {
        await interaction.editReply("Run RBLXTools download commands in a server that has been claimed in the RBLXTools Bot dashboard.");
        return;
      }
      const usage = await callBotService("/discord-bot/service/consume-use", interaction, { guildId: interaction.guildId, discordRoleIds: getInteractionRoleIds(interaction), commandName: interaction.commandName });
      await sendUsageAlert(interaction, usage.usage);

      const assetId = String(interaction.options.getString("asset-id", true) || "").trim();
      if (!/^\d+$/.test(assetId)) {
        await interaction.editReply("Enter a valid numeric Roblox asset ID.");
        return;
      }

      const mediaType = interaction.commandName === "media" ? interaction.options.getString("media-type") : "";
      await interaction.editReply(await buildToolDownload(interaction.commandName, assetId, mediaType, interaction.user.id, interaction.guildId));
    } catch (error) {
      console.error("[tools-bot] tool download failed:", error);
      await interaction.editReply(error.message || "I could not prepare that RBLXTools download.");
    }
    return;
  }

  if (interaction.commandName === "link") {
    try {
      const link = await claimDiscordLink(interaction.options.getString("code", true), interaction.user);
      await interaction.editReply("Linked to RBLXTools successfully. Your Discord tools unlock automatically whenever this account has Pro.");
      console.log("[tools-bot] linked Discord " + interaction.user.id + " to RBLXTools " + link.appUserId);
    } catch (error) {
      await interaction.editReply(error.message || "That link code could not be used.");
    }
    return;
  }

  if (interaction.commandName === "claim-server") {
    try {
      var claimResult = await claimGuild(interaction);
      var serverName = claimResult?.dashboard?.server?.guildName || interaction.guild?.name || "this server";
      await interaction.editReply("Claimed **" + serverName + "**. Your server's RBLXTools Bot use balance is now active.");
    } catch (error) {
      await interaction.editReply(error.message || "This server could not be claimed.");
    }
    return;
  }

  try {
    const member = await requirePro(interaction);
    if (!member) return;

    if (interaction.commandName === "status") {
      await interaction.editReply("Your Discord is linked to an active RBLXTools Pro account. Discord tools are ready.");
      return;
    }
    if (interaction.commandName === "tools") {
      await interaction.editReply("Available: `/robux`, `/clothing`, `/ugc`, `/media`, `/audio`, and `/animations`. Each download command opens an asset-ID form, then sends the same downloadable output used by RBLXTools.");
      return;
    }
    if (interaction.commandName === "robux") {
      if (interaction.inGuild()) {
        const policy = await callBotService("/discord-bot/service/command-policy", interaction, { guildId: interaction.guildId, commandName: "robux" });
        if (policy.blocked) {
          await interaction.editReply("The /robux calculators have been disabled for this server by its RBLXTools Bot manager.");
          return;
        }
      }
      await interaction.editReply(calculateRobux(interaction));
    }
  } catch (error) {
    console.error("[tools-bot] command failed:", error);
    await interaction.editReply("I could not check your RBLXTools membership right now. Try again in a moment.");
  }
}

async function main() {
  assertConfiguration();
  await registerCommands();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once(Events.ClientReady, (readyClient) => { console.log("[tools-bot] ready as " + readyClient.user.tag); readyClient.guilds.cache.forEach((guild) => { syncAlertChannels(guild); }); });
  client.on(Events.InteractionCreate, handleInteraction);
  await client.login(token);
}

main().catch((error) => {
  console.error("[tools-bot] could not start:", error.message || error);
  process.exitCode = 1;
});
