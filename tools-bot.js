require("dotenv").config();

const {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  AttachmentBuilder,
} = require("discord.js");
const { claimDiscordLink, getDiscordLinkByUserId } = require("./discord-tools-links");

const token = String(process.env.RBLXTOOLS_TOOLS_BOT_TOKEN || "").trim();
const clientId = String(process.env.RBLXTOOLS_TOOLS_DISCORD_CLIENT_ID || "").trim();
// Keep this app isolated from the existing support bot's Discord server configuration.
const guildId = String(process.env.RBLXTOOLS_TOOLS_GUILD_ID || "1273360593318838382").trim();
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

const commands = [
  new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your RBLXTools account with a one-time website code.")
    .addStringOption((option) => option.setName("code").setDescription("Code generated in RBLXTools Account Overview").setRequired(true)),
  new SlashCommandBuilder().setName("status").setDescription("Check your RBLXTools Discord link and plan."),
  new SlashCommandBuilder().setName("tools").setDescription("View the RBLXTools Discord tools available to Pro members."),
  new SlashCommandBuilder()
    .setName("robux")
    .setDescription("Calculate Roblox marketplace fees and take-home Robux.")
    .addIntegerOption((option) => option.setName("amount").setDescription("Listed Robux amount").setMinValue(0).setRequired(true))
    .addNumberOption((option) => option.setName("fee").setDescription("Marketplace fee percentage").setMinValue(0).setMaxValue(100).setRequired(false)),
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

function getToolRequestHeaders(discordUserId) {
  return {
    "X-RBLXTools-Tools-Secret": discordToolsServiceSecret,
    "X-RBLXTools-Discord-User-Id": String(discordUserId),
  };
}

function getAttachmentName(response, fallback) {
  const disposition = String(response.headers.get("content-disposition") || "");
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return String(match ? match[1] : fallback).replace(/[\\/:*?"<>|]+/g, "-").slice(0, 180);
}

async function getDownloadAttachment(url, fallbackName, discordUserId) {
  const response = await fetch(url, { headers: getToolRequestHeaders(discordUserId) });
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

async function buildToolDownload(toolName, assetId, mediaType, discordUserId) {
  if (toolName === "clothing") {
    return { content: "**Clothing template ready** for Roblox ID `" + assetId + "`.", files: [await getDownloadAttachment(buildToolUrl("/template", { id: assetId }), "roblox-template-" + assetId + ".png", discordUserId)] };
  }
  if (toolName === "ugc") {
    const [model, texture] = await Promise.all([
      getDownloadAttachment(buildToolUrl("/ugc-obj", { id: assetId, mode: "ugc" }), "rblxtools-ugc-" + assetId + ".obj", discordUserId),
      getDownloadAttachment(buildToolUrl("/ugc-texture", { id: assetId }), "texture-" + assetId + ".png", discordUserId),
    ]);
    return { content: "**UGC package ready** for Roblox ID `" + assetId + "`. Keep the OBJ and texture together when importing.", files: [model, texture] };
  }
  if (toolName === "media") {
    const kind = normalizeMediaType(mediaType);
    return { content: "**Media ready** for Roblox ID `" + assetId + "` (`" + kind + "`).", files: [await getDownloadAttachment(buildToolUrl("/media", { input: assetId, kind, download: 1 }), "roblox-media-" + assetId + ".png", discordUserId)] };
  }
  if (toolName === "audio") {
    return { content: "**Audio ready** for Roblox ID `" + assetId + "`.", files: [await getDownloadAttachment(buildToolUrl("/audio", { input: assetId, download: 1 }), "roblox-audio-" + assetId, discordUserId)] };
  }
  if (toolName === "animations") {
    return { content: "**Animation ready** for Roblox ID `" + assetId + "`.", files: [await getDownloadAttachment(buildToolUrl("/animation", { id: assetId, download: 1 }), "roblox-animation-" + assetId + ".rbxm", discordUserId)] };
  }
  throw new Error("That RBLXTools command is not available yet.");
}

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log("[tools-bot] registered commands in guild " + guildId);
}

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply({ ephemeral: true });

  if (toolDefinitions[interaction.commandName]) {
    try {
      const member = await requirePro(interaction);
      if (!member) return;

      const assetId = String(interaction.options.getString("asset-id", true) || "").trim();
      if (!/^\d+$/.test(assetId)) {
        await interaction.editReply("Enter a valid numeric Roblox asset ID.");
        return;
      }

      const mediaType = interaction.commandName === "media" ? interaction.options.getString("media-type") : "";
      await interaction.editReply(await buildToolDownload(interaction.commandName, assetId, mediaType, interaction.user.id));
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
      const amount = interaction.options.getInteger("amount", true);
      const fee = interaction.options.getNumber("fee") ?? 30;
      const feeRobux = Math.floor(amount * (fee / 100));
      const takeHome = Math.max(0, amount - feeRobux);
      await interaction.editReply("**Robux fee estimate**\nListed: **R$ " + amount.toLocaleString() + "**\nFee (" + fee + "%): **R$ " + feeRobux.toLocaleString() + "**\nYou receive: **R$ " + takeHome.toLocaleString() + "**");
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
  client.once(Events.ClientReady, (readyClient) => console.log("[tools-bot] ready as " + readyClient.user.tag));
  client.on(Events.InteractionCreate, handleInteraction);
  await client.login(token);
}

main().catch((error) => {
  console.error("[tools-bot] could not start:", error.message || error);
  process.exitCode = 1;
});
