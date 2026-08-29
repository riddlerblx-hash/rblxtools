require("dotenv").config();

const express = require("express");
const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
} = require("discord.js");

const app = express();

const PORT = Number.parseInt(process.env.SUPPORT_BOT_PORT || "3051", 10) || 3051;
const DISCORD_BOT_TOKEN = String(process.env.DISCORD_BOT_TOKEN || "").trim();
const DISCORD_GUILD_ID = String(process.env.DISCORD_GUILD_ID || "").trim();
const DISCORD_STAFF_ROLE_ID = String(process.env.DISCORD_STAFF_ROLE_ID || "").trim();
const DISCORD_TICKET_CATEGORY_ID = String(process.env.DISCORD_TICKET_CATEGORY_ID || "1513556168360988842").trim();
const DISCORD_TICKET_LOG_CHANNEL_ID = String(process.env.DISCORD_TICKET_LOG_CHANNEL_ID || "").trim();
const DISCORD_PAYMENTS_CHANNEL_ID = String(process.env.DISCORD_PAYMENTS_CHANNEL_ID || "1516011658055647323").trim();
const DISCORD_PAYMENT_CATEGORY_ID = String(process.env.DISCORD_PAYMENT_CATEGORY_ID || "1513556168360988842").trim();
const SUPPORT_BOT_SECRET = String(process.env.SUPPORT_BOT_SECRET || "").trim();
const SUPPORT_STAFF_MENTION = String(
  process.env.SUPPORT_STAFF_MENTION || (DISCORD_STAFF_ROLE_ID ? `<@&${DISCORD_STAFF_ROLE_ID}>` : "")
).trim();

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const LOG_CHANNEL_FALLBACK_NAME = "ticket-logs";
const CLOSE_BUTTON_ID = "ticket:close";
const TRANSCRIPT_BUTTON_ID = "ticket:transcript";
const DELETE_BUTTON_ID = "ticket:delete";
const PURCHASE_BUTTON_ID = "payment:purchase";
const CLOSED_NAME_PREFIX = "closed-";
const PAYMENT_PANEL_CHANNEL_FALLBACK_NAMES = ["robux-payments", "payments", "payment-tickets"];
const PAYMENT_PANEL_SIGNATURE = "RBLXTOOLS_PAYMENT_PANEL_V1";
const PAYMENT_TICKET_NAME_PREFIX = "payment";

const TICKET_REASON_LABELS = {
  website_bug: "🐞 Website Bug",
  live_chat_issue: "💬 Live Chat Issue",
  membership_issue: "💎 Membership Issue",
  billing_issue: "💳 Billing / Purchase Issue",
  user_report: "🚨 Report A Member",
  other: "🧩 Other Reason",
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

let loginError = null;
const clientReadyPromise = new Promise((resolve) => {
  client.once(Events.ClientReady, resolve);
});

if (DISCORD_BOT_TOKEN) {
  client.login(DISCORD_BOT_TOKEN).catch((error) => {
    loginError = error;
    console.error("[support-bot] discord login failed:", error.message);
  });
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`[support-bot] Discord ready as ${readyClient.user.tag}`);
  syncPaymentsPanel().catch((error) => {
    console.error("[support-bot] payments panel sync failed:", error.message);
  });
});

app.use(express.json({ limit: "6mb" }));

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

function sanitizeTicketName(input) {
  return String(input || "support")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "support";
}

function makeTicketChannelName(category, reporterUserId) {
  const date = new Date();
  const stamp = `${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const suffix = String(reporterUserId || "user").replace(/[^0-9a-z]/gi, "").slice(-6) || "report";
  return `${sanitizeTicketName(category)}-${stamp}-${suffix}`.slice(0, 95);
}

function makePaymentTicketName(userId) {
  const date = new Date();
  const stamp = `${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const suffix = String(userId || "buyer").replace(/[^0-9a-z]/gi, "").slice(-6) || "buyer";
  return `${PAYMENT_TICKET_NAME_PREFIX}-${stamp}-${suffix}`.slice(0, 95);
}

function formatField(value, fallback = "Not provided") {
  const text = String(value || "").trim();
  return text || fallback;
}

function chunkText(value, maxLength = 1000) {
  const text = String(value || "").trim();
  if (!text) {
    return ["Not provided"];
  }
  if (text.length <= maxLength) {
    return [text];
  }
  const parts = [];
  let cursor = 0;
  while (cursor < text.length) {
    parts.push(text.slice(cursor, cursor + maxLength));
    cursor += maxLength;
  }
  return parts;
}

function parseAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") {
    return null;
  }
  const base64 = String(attachment.base64 || "").trim();
  if (!base64) {
    return null;
  }
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) {
    return null;
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    const error = new Error("Attachment is too large for Discord ticket upload.");
    error.statusCode = 400;
    throw error;
  }
  return {
    buffer,
    name: String(attachment.name || "support-attachment.bin").trim() || "support-attachment.bin",
    type: String(attachment.type || "application/octet-stream").trim() || "application/octet-stream",
  };
}

function buildSupportEmbeds(report) {
  const detailChunks = chunkText(report.details, 1000);
  const fields = [
    {
      name: "📝 Reason",
      value: formatField(report.categoryLabel || TICKET_REASON_LABELS[report.category] || report.category),
      inline: true,
    },
    {
      name: "🆔 Reporter User ID",
      value: formatField(report.reporter?.userId),
      inline: true,
    },
    {
      name: "📧 Reporter Email",
      value: formatField(report.reporter?.email),
      inline: true,
    },
    {
      name: "🙂 Reporter Name",
      value: formatField(report.reporter?.displayName),
      inline: true,
    },
  ];

  if (report.reportedUserId) {
    fields.push({
      name: "🚨 Reported User ID",
      value: formatField(report.reportedUserId),
      inline: true,
    });
  }

  if (report.pageUrl) {
    fields.push({
      name: "🌐 Page URL",
      value: formatField(report.pageUrl),
      inline: false,
    });
  }

  fields.push({
    name: "⏰ Submitted At",
    value: formatField(report.submittedAt),
    inline: true,
  });

  if (report.userAgent) {
    fields.push({
      name: "🖥️ User Agent",
      value: formatField(report.userAgent).slice(0, 1000),
      inline: false,
    });
  }

  const embeds = [
    new EmbedBuilder()
      .setTitle(`🎫 New Support Ticket: ${report.categoryLabel || TICKET_REASON_LABELS[report.category] || "Support Report"}`)
      .setColor(0x57f287)
      .addFields(
        ...fields,
        {
          name: "📄 Report Details",
          value: detailChunks[0],
          inline: false,
        }
      ),
  ];

  for (let index = 1; index < detailChunks.length; index += 1) {
    embeds.push(
      new EmbedBuilder()
        .setTitle(`📄 Report Details (${index + 1})`)
        .setColor(0x57f287)
        .setDescription(detailChunks[index])
    );
  }

  return embeds;
}

function buildOpenTicketRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CLOSE_BUTTON_ID).setStyle(ButtonStyle.Danger).setEmoji("🔒").setLabel("Close Ticket")
  );
}

function buildClosedTicketRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(TRANSCRIPT_BUTTON_ID).setStyle(ButtonStyle.Secondary).setEmoji("🧾").setLabel("Save Transcript"),
    new ButtonBuilder().setCustomId(DELETE_BUTTON_ID).setStyle(ButtonStyle.Danger).setEmoji("🗑️").setLabel("Delete Ticket")
  );
}

function buildDisabledClosedRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CLOSE_BUTTON_ID}:done`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("✅")
      .setLabel("Ticket Closed")
      .setDisabled(true)
  );
}

function buildRobuxMembershipPricing() {
  return [
    "🩶 **Plus Membership**",
    "• Monthly — Game Pass: **378 Robux / month**",
    "• Monthly — Roblox Plus: **264 Robux / month**",
    "• Annual — Game Pass: **3,759 Robux / year**",
    "• Annual — Roblox Plus: **2,631 Robux / year**",
    "",
    "👑 **Pro Membership**",
    "• Monthly — Game Pass: **1,882 Robux / month**",
    "• Monthly — Roblox Plus: **1,317 Robux / month**",
    "• Annual — Game Pass: **31,572 Robux / year**",
    "• Annual — Roblox Plus: **15,804 Robux / year**",
  ];
}

function buildPaymentsPanelEmbed() {
  return new EmbedBuilder()
    .setTitle("💸 Robux Payments")
    .setColor(0xf1c40f)
    .setDescription(
      [
        "✨ Make payments with **Robux** for website subscriptions and future purchases.",
        "",
        "📦 **Membership prices**",
        ...buildRobuxMembershipPricing(),
        "",
        "📌 **Why Robux prices can be higher**",
        "DevEx rates, Roblox taxes, and payout loss mean Robux pricing may cost more than normal cash pricing.",
        "",
        "⚠️ **Payments only**",
        "This ticket system is only for purchases and payment questions. Website support and reports are not handled here. Use the website support/report system instead.",
      ].join("\n")
    )
    .addFields({
      name: "🧾 What this is for",
      value: "Use the button below, then tell us the membership, billing period (monthly or annual), and whether you are paying through a Game Pass or Roblox Plus.",
      inline: false,
    })
    .setFooter({ text: PAYMENT_PANEL_SIGNATURE });
}

function buildSupportEmbedsV2(report) {
  const detailChunks = chunkText(report.details, 1000);
  const fields = [
    { name: "Reason", value: formatField(report.categoryLabel || TICKET_REASON_LABELS[report.category] || report.category), inline: true },
    { name: "Reporter User ID", value: formatField(report.reporter?.userId), inline: true },
    { name: "Reporter Email", value: formatField(report.reporter?.email), inline: true },
    { name: "Discord Username", value: formatField(report.reporter?.discordUsername), inline: true },
    { name: "Reporter Name", value: formatField(report.reporter?.displayName), inline: true },
  ];

  if (report.reportedUserId) {
    fields.push({ name: "Reported User ID", value: formatField(report.reportedUserId), inline: true });
  }
  if (report.pageUrl) {
    fields.push({ name: "Page URL", value: formatField(report.pageUrl), inline: false });
  }
  fields.push({ name: "Submitted At", value: formatField(report.submittedAt), inline: true });
  if (report.userAgent) {
    fields.push({ name: "User Agent", value: formatField(report.userAgent).slice(0, 1000), inline: false });
  }

  const embeds = [
    new EmbedBuilder()
      .setTitle(`New Support Ticket: ${report.categoryLabel || TICKET_REASON_LABELS[report.category] || "Support Report"}`)
      .setColor(0x57f287)
      .addFields(...fields, {
        name: "Report Details",
        value: detailChunks[0],
        inline: false,
      }),
  ];

  for (let index = 1; index < detailChunks.length; index += 1) {
    embeds.push(
      new EmbedBuilder()
        .setTitle(`Report Details (${index + 1})`)
        .setColor(0x57f287)
        .setDescription(detailChunks[index])
    );
  }

  return embeds;
}

function buildPaymentsPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(PURCHASE_BUTTON_ID).setStyle(ButtonStyle.Success).setEmoji("🛒").setLabel("Make a Purchase")
  );
}

function buildPaymentTicketEmbed(interaction) {
  return new EmbedBuilder()
    .setTitle("💸 New Robux Payment Request")
    .setColor(0x2ecc71)
    .setDescription(
      [
        "Thanks for opening a payment ticket.",
        "",
        "🛍️ **Available right now**",
        ...buildRobuxMembershipPricing(),
        "",
        "📨 Tell us the membership, monthly or annual billing, and whether you are using a Game Pass or Roblox Plus.",
        "⚠️ Support reports are not handled here. If you need support, submit it on the website instead.",
      ].join("\n")
    )
    .addFields(
      { name: "Buyer", value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
      { name: "Opened At", value: new Date().toISOString(), inline: false }
    );
}

async function ensureDiscordClient() {
  requireEnv("DISCORD_BOT_TOKEN", DISCORD_BOT_TOKEN);
  requireEnv("DISCORD_GUILD_ID", DISCORD_GUILD_ID);
  requireEnv("DISCORD_STAFF_ROLE_ID", DISCORD_STAFF_ROLE_ID);
  requireEnv("DISCORD_TICKET_CATEGORY_ID", DISCORD_TICKET_CATEGORY_ID);

  if (loginError) {
    throw loginError;
  }
  if (client.isReady()) {
    return client;
  }
  await Promise.race([
    clientReadyPromise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Discord bot is still connecting. Try again in a moment.")), 10000);
    }),
  ]);
  if (loginError) {
    throw loginError;
  }
  return client;
}

async function getGuild() {
  const readyClient = await ensureDiscordClient();
  const guild =
    readyClient.guilds.cache.get(DISCORD_GUILD_ID) || (await readyClient.guilds.fetch(DISCORD_GUILD_ID).catch(() => null));
  if (!guild) {
    throw new Error("Could not access the configured Discord server.");
  }
  return guild;
}

async function findLogChannel(guild) {
  if (DISCORD_TICKET_LOG_CHANNEL_ID) {
    const byId = guild.channels.cache.get(DISCORD_TICKET_LOG_CHANNEL_ID) || (await guild.channels.fetch(DISCORD_TICKET_LOG_CHANNEL_ID).catch(() => null));
    if (byId && byId.isTextBased()) {
      return byId;
    }
  }

  const cached = guild.channels.cache.find(
    (channel) => channel && channel.name === LOG_CHANNEL_FALLBACK_NAME && channel.type === ChannelType.GuildText
  );
  if (cached) {
    return cached;
  }

  const channels = await guild.channels.fetch();
  const fetched = channels.find(
    (channel) => channel && channel.name === LOG_CHANNEL_FALLBACK_NAME && channel.type === ChannelType.GuildText
  );
  if (fetched) {
    return fetched;
  }

  throw new Error(`Could not find the "${LOG_CHANNEL_FALLBACK_NAME}" log channel. Add DISCORD_TICKET_LOG_CHANNEL_ID or create that channel.`);
}

async function findPaymentsChannel(guild) {
  if (DISCORD_PAYMENTS_CHANNEL_ID) {
    const byId =
      guild.channels.cache.get(DISCORD_PAYMENTS_CHANNEL_ID) ||
      (await guild.channels.fetch(DISCORD_PAYMENTS_CHANNEL_ID).catch(() => null));
    if (byId && byId.isTextBased()) {
      return byId;
    }
  }

  const cached = guild.channels.cache.find(
    (channel) =>
      channel &&
      channel.type === ChannelType.GuildText &&
      PAYMENT_PANEL_CHANNEL_FALLBACK_NAMES.includes(String(channel.name || "").toLowerCase())
  );
  if (cached) {
    return cached;
  }

  const channels = await guild.channels.fetch();
  const fetched = channels.find(
    (channel) =>
      channel &&
      channel.type === ChannelType.GuildText &&
      PAYMENT_PANEL_CHANNEL_FALLBACK_NAMES.includes(String(channel.name || "").toLowerCase())
  );
  if (fetched) {
    return fetched;
  }

  throw new Error("Could not find the Robux payments channel. Add DISCORD_PAYMENTS_CHANNEL_ID or create a robux-payments channel.");
}

async function createTicketChannel(report) {
  const guild = await getGuild();
  const everyoneRole = guild.roles.everyone;

  return guild.channels.create({
    name: makeTicketChannelName(report.category, report.reporter?.userId),
    type: ChannelType.GuildText,
    parent: DISCORD_TICKET_CATEGORY_ID,
    topic: `Support report: ${report.categoryLabel || report.category || "support"} | Reporter ${formatField(report.reporter?.userId)}`,
    permissionOverwrites: [
      {
        id: everyoneRole.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: DISCORD_STAFF_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ],
  });
}

async function findExistingPaymentTicket(guild, userId) {
  const channels = await guild.channels.fetch();
  return (
    channels.find((channel) => {
      if (!channel || channel.type !== ChannelType.GuildText) {
        return false;
      }
      const name = String(channel.name || "");
      const topic = String(channel.topic || "");
      return !name.startsWith(CLOSED_NAME_PREFIX) && name.startsWith(`${PAYMENT_TICKET_NAME_PREFIX}-`) && topic.includes(`Buyer ${userId}`);
    }) || null
  );
}

async function createPaymentTicketChannel(interaction) {
  const guild = await getGuild();
  const existing = await findExistingPaymentTicket(guild, interaction.user.id);
  if (existing) {
    return existing;
  }

  const everyoneRole = guild.roles.everyone;
  return guild.channels.create({
    name: makePaymentTicketName(interaction.user.id),
    type: ChannelType.GuildText,
    parent: DISCORD_PAYMENT_CATEGORY_ID,
    topic: `Payment ticket | Buyer ${interaction.user.id}`,
    permissionOverwrites: [
      {
        id: everyoneRole.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: DISCORD_STAFF_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ],
  });
}

async function syncPaymentsPanel() {
  const guild = await getGuild();
  const channel = await findPaymentsChannel(guild);
  const recentMessages = await channel.messages.fetch({ limit: 25 }).catch(() => null);
  const existingPanel = recentMessages
    ? recentMessages.find(
        (message) =>
          message.author?.id === client.user?.id &&
          message.components.some((row) => row.components.some((component) => component.customId === PURCHASE_BUTTON_ID))
      )
    : null;

  const payload = {
    content: "💸 Robux payments and subscription purchases only.",
    embeds: [buildPaymentsPanelEmbed()],
    components: [buildPaymentsPanelRow()],
  };

  if (existingPanel) {
    await existingPanel.edit(payload);
    return existingPanel;
  }

  return channel.send(payload);
}

async function postTicketMessage(channel, report) {
  const attachment = parseAttachment(report.attachment);
  const payload = {
    content: `${SUPPORT_STAFF_MENTION || ""} 🎉 New website support ticket created.`.trim(),
    embeds: buildSupportEmbedsV2(report),
    components: [buildOpenTicketRow()],
  };

  if (attachment) {
    payload.files = [new AttachmentBuilder(attachment.buffer, { name: attachment.name, contentType: attachment.type })];
  }

  return channel.send(payload);
}

function verifySecret(req, res, next) {
  if (!SUPPORT_BOT_SECRET) {
    return next();
  }
  const incoming = String(req.headers["x-support-secret"] || "").trim();
  if (incoming !== SUPPORT_BOT_SECRET) {
    return res.status(403).json({ error: "Invalid support bot secret." });
  }
  return next();
}

function validateReportBody(report) {
  if (!report || typeof report !== "object") {
    throw new Error("Missing support report payload.");
  }
  if (String(report.type || "").trim() !== "support-report") {
    throw new Error("Unsupported support report type.");
  }
  if (!String(report.details || "").trim()) {
    const error = new Error("Support report details are required.");
    error.statusCode = 400;
    throw error;
  }
  if (!String(report.reporter?.userId || "").trim()) {
    const error = new Error("Reporter user ID is required.");
    error.statusCode = 400;
    throw error;
  }
}

function isStaffInteraction(interaction) {
  if (!interaction.inGuild() || !interaction.member) {
    return false;
  }
  if (interaction.member.permissions?.has(PermissionFlagsBits.ManageChannels)) {
    return true;
  }
  if (interaction.member.roles && "cache" in interaction.member.roles) {
    return interaction.member.roles.cache.has(DISCORD_STAFF_ROLE_ID);
  }
  return false;
}

async function fetchAllMessages(channel) {
  const allMessages = [];
  let before;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) {
      break;
    }
    allMessages.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) {
      break;
    }
  }

  return allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

async function buildTranscript(channel) {
  const messages = await fetchAllMessages(channel);
  const lines = [];

  lines.push(`Ticket Transcript for #${channel.name}`);
  lines.push(`Channel ID: ${channel.id}`);
  lines.push(`Generated At: ${new Date().toISOString()}`);
  lines.push("");

  for (const message of messages) {
    const timestamp = new Date(message.createdTimestamp).toISOString();
    const author = message.author ? `${message.author.tag} (${message.author.id})` : "Unknown Author";
    const content = message.content || "";
    lines.push(`[${timestamp}] ${author}: ${content || "[no text content]"}`);

    if (message.attachments.size) {
      for (const attachment of message.attachments.values()) {
        lines.push(`  Attachment: ${attachment.name || "file"} - ${attachment.url}`);
      }
    }
    if (message.embeds.length) {
      lines.push(`  Embeds: ${message.embeds.length}`);
    }
  }

  return Buffer.from(lines.join("\n"), "utf8");
}

async function postTranscriptToLogs(interaction) {
  const guild = await getGuild();
  const logChannel = await findLogChannel(guild);
  const transcriptBuffer = await buildTranscript(interaction.channel);
  const transcriptName = `${interaction.channel.name}-transcript.txt`;

  await logChannel.send({
    content: `🧾 Transcript saved from <#${interaction.channel.id}> by ${interaction.user}.`,
    embeds: [
      new EmbedBuilder()
        .setTitle("🧾 Ticket Transcript Saved")
        .setColor(0x5865f2)
        .addFields(
          { name: "Channel", value: `<#${interaction.channel.id}>`, inline: true },
          { name: "Saved By", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
          { name: "Saved At", value: new Date().toISOString(), inline: true }
        ),
    ],
    files: [new AttachmentBuilder(transcriptBuffer, { name: transcriptName, contentType: "text/plain" })],
  });
}

async function logTicketDeletion(interaction) {
  const guild = await getGuild();
  const logChannel = await findLogChannel(guild);

  await logChannel.send({
    content: `🗑️ Ticket channel #${interaction.channel.name} was deleted by ${interaction.user}.`,
    embeds: [
      new EmbedBuilder()
        .setTitle("🗑️ Ticket Deleted")
        .setColor(0xed4245)
        .addFields(
          { name: "Channel Name", value: interaction.channel.name, inline: true },
          { name: "Deleted By", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
          { name: "Deleted At", value: new Date().toISOString(), inline: true }
        ),
    ],
  });
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) {
    return;
  }

  if (![CLOSE_BUTTON_ID, TRANSCRIPT_BUTTON_ID, DELETE_BUTTON_ID, PURCHASE_BUTTON_ID].includes(interaction.customId)) {
    return;
  }

  try {
    if (interaction.customId === PURCHASE_BUTTON_ID) {
      if (!interaction.inGuild()) {
        await interaction.reply({
          content: "⚠️ This purchase button only works inside the Discord server.",
          ephemeral: true,
        });
        return;
      }

      const channel = await createPaymentTicketChannel(interaction);
      const recentMessages = await channel.messages.fetch({ limit: 5 }).catch(() => null);
      const alreadyInitialized = recentMessages
        ? recentMessages.some((message) => message.author?.id === client.user?.id && message.embeds.some((embed) => embed.title === "💸 New Robux Payment Request"))
        : false;

      if (!alreadyInitialized) {
        await channel.send({
          content: `${SUPPORT_STAFF_MENTION} ${interaction.user}`.trim(),
          embeds: [buildPaymentTicketEmbed(interaction)],
          components: [buildOpenTicketRow()],
        });
      }

      await interaction.reply({
        content: `🛒 Your payment ticket is ready: <#${channel.id}>`,
        ephemeral: true,
      });
      return;
    }

    if (!isStaffInteraction(interaction)) {
      await interaction.reply({
        content: "⛔ Only staff can use ticket controls.",
        ephemeral: true,
      });
      return;
    }

    if (interaction.customId === CLOSE_BUTTON_ID) {
      if (!interaction.channel || !interaction.channel.isTextBased()) {
        await interaction.reply({ content: "Could not close this ticket channel.", ephemeral: true });
        return;
      }

      if (!interaction.channel.name.startsWith(CLOSED_NAME_PREFIX)) {
        const nextName = `${CLOSED_NAME_PREFIX}${interaction.channel.name}`.slice(0, 95);
        await interaction.channel.setName(nextName).catch(() => null);
      }

      await interaction.update({
        components: [buildDisabledClosedRow()],
      });

      await interaction.channel.send({
        content: "🔒 Ticket closed. What would you like to do next?",
        components: [buildClosedTicketRow()],
        embeds: [
          new EmbedBuilder()
            .setTitle("🔒 Ticket Closed")
            .setColor(0xfaa61a)
            .setDescription("Choose whether to save a transcript to the ticket logs channel or delete the ticket entirely."),
        ],
      });
      return;
    }

    if (interaction.customId === TRANSCRIPT_BUTTON_ID) {
      await interaction.deferReply({ ephemeral: true });
      await postTranscriptToLogs(interaction);
      await interaction.editReply("🧾 Transcript saved to the ticket logs channel.");
      return;
    }

    if (interaction.customId === DELETE_BUTTON_ID) {
      await interaction.deferReply({ ephemeral: true });
      await logTicketDeletion(interaction);
      await interaction.editReply("🗑️ Ticket deleted and logged.");
      setTimeout(() => {
        interaction.channel.delete(`Ticket deleted by ${interaction.user.tag}`).catch((error) => {
          console.error("[support-bot] ticket delete failed:", error.message);
        });
      }, 500);
    }
  } catch (error) {
    console.error("[support-bot] interaction failed:", error.message);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: `⚠️ ${error.message || "Ticket action failed."}`,
        ephemeral: true,
      }).catch(() => null);
    } else {
      await interaction.reply({
        content: `⚠️ ${error.message || "Ticket action failed."}`,
        ephemeral: true,
      }).catch(() => null);
    }
  }
});

app.get("/health", async (_req, res) => {
  try {
    requireEnv("DISCORD_BOT_TOKEN", DISCORD_BOT_TOKEN);
    requireEnv("DISCORD_GUILD_ID", DISCORD_GUILD_ID);
    requireEnv("DISCORD_STAFF_ROLE_ID", DISCORD_STAFF_ROLE_ID);
    requireEnv("DISCORD_TICKET_CATEGORY_ID", DISCORD_TICKET_CATEGORY_ID);
    await ensureDiscordClient();
    return res.json({ ok: true, service: "support-bot" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/support-report", verifySecret, async (req, res) => {
  try {
    validateReportBody(req.body);
    const channel = await createTicketChannel(req.body);
    await postTicketMessage(channel, req.body);

    return res.json({
      ok: true,
      destination: "discord-ticket-bot",
      channelId: channel.id,
      channelName: channel.name,
    });
  } catch (error) {
    console.error("[support-bot] support-report failed:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not create Discord support ticket.",
    });
  }
});

app.post("/payments/panel", verifySecret, async (_req, res) => {
  try {
    const message = await syncPaymentsPanel();
    return res.json({
      ok: true,
      destination: "discord-payments-panel",
      channelId: message.channelId,
      messageId: message.id,
    });
  } catch (error) {
    console.error("[support-bot] payments panel failed:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not sync the Robux payments panel.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`[support-bot] listening on port ${PORT}`);
});
