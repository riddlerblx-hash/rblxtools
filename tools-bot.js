require("dotenv").config();

const {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");
const { claimDiscordLink, getDiscordLinkByUserId } = require("./discord-tools-links");

const token = String(process.env.RBLXTOOLS_TOOLS_BOT_TOKEN || "").trim();
const clientId = String(process.env.RBLXTOOLS_TOOLS_DISCORD_CLIENT_ID || "").trim();
const guildId = String(process.env.RBLXTOOLS_TOOLS_GUILD_ID || process.env.DISCORD_GUILD_ID || "1273360593318838382").trim();
const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const supabaseKey = String(process.env.SUPABASE_KEY || "").trim();
const authUsersTable = String(process.env.AUTH_USERS_TABLE || "member_accounts").trim();

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
].map((command) => command.toJSON());

function assertConfiguration() {
  const missing = [];
  if (!token) missing.push("RBLXTOOLS_TOOLS_BOT_TOKEN");
  if (!clientId) missing.push("RBLXTOOLS_TOOLS_DISCORD_CLIENT_ID");
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!supabaseKey) missing.push("SUPABASE_KEY");
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

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log("[tools-bot] registered commands in guild " + guildId);
}

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply({ ephemeral: true });

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
      await interaction.editReply("Available now: `/robux`. More RBLXTools commands will be added here as each website tool gets a Discord-safe workflow.");
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
