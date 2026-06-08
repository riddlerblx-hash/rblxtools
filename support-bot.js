require("dotenv").config();

const express = require("express");

const app = express();

const PORT = Number.parseInt(process.env.SUPPORT_BOT_PORT || "3051", 10) || 3051;
const DISCORD_BOT_TOKEN = String(process.env.DISCORD_BOT_TOKEN || "").trim();
const DISCORD_GUILD_ID = String(process.env.DISCORD_GUILD_ID || "").trim();
const DISCORD_STAFF_ROLE_ID = String(process.env.DISCORD_STAFF_ROLE_ID || "").trim();
const DISCORD_TICKET_CATEGORY_ID = String(process.env.DISCORD_TICKET_CATEGORY_ID || "").trim();
const SUPPORT_BOT_SECRET = String(process.env.SUPPORT_BOT_SECRET || "").trim();
const SUPPORT_STAFF_MENTION = String(
  process.env.SUPPORT_STAFF_MENTION || (DISCORD_STAFF_ROLE_ID ? `<@&${DISCORD_STAFF_ROLE_ID}>` : "")
).trim();

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const DISCORD_API_BASE = "https://discord.com/api/v10";
const TICKET_REASON_LABELS = {
  website_bug: "Website Bug",
  live_chat_issue: "Live Chat Issue",
  membership_issue: "Membership Issue",
  billing_issue: "Billing / Purchase Issue",
  user_report: "Report A Member",
  other: "Other Reason",
};

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

async function discordRequest(path, options = {}) {
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Discord API ${response.status}: ${errorText || response.statusText}`);
    error.statusCode = 502;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function createTicketChannel(report) {
  const payload = {
    name: makeTicketChannelName(report.category, report.reporter?.userId),
    type: 0,
    parent_id: DISCORD_TICKET_CATEGORY_ID,
    topic: `Support report: ${report.categoryLabel || report.category || "support"} | Reporter ${formatField(report.reporter?.userId)}`,
    permission_overwrites: [
      {
        id: DISCORD_GUILD_ID,
        type: 0,
        deny: "1024",
      },
      {
        id: DISCORD_STAFF_ROLE_ID,
        type: 0,
        allow: "1024",
      },
    ],
  };

  return discordRequest(`/guilds/${encodeURIComponent(DISCORD_GUILD_ID)}/channels`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function buildEmbeds(report) {
  const detailChunks = chunkText(report.details, 1000);
  const fields = [
    {
      name: "Reason",
      value: formatField(report.categoryLabel || TICKET_REASON_LABELS[report.category] || report.category),
      inline: true,
    },
    {
      name: "Reporter User ID",
      value: formatField(report.reporter?.userId),
      inline: true,
    },
    {
      name: "Reporter Email",
      value: formatField(report.reporter?.email),
      inline: true,
    },
    {
      name: "Reporter Name",
      value: formatField(report.reporter?.displayName),
      inline: true,
    },
  ];

  if (report.reportedUserId) {
    fields.push({
      name: "Reported User ID",
      value: formatField(report.reportedUserId),
      inline: true,
    });
  }

  if (report.pageUrl) {
    fields.push({
      name: "Page URL",
      value: formatField(report.pageUrl),
      inline: false,
    });
  }

  fields.push({
    name: "Submitted At",
    value: formatField(report.submittedAt),
    inline: true,
  });

  if (report.userAgent) {
    fields.push({
      name: "User Agent",
      value: formatField(report.userAgent).slice(0, 1000),
      inline: false,
    });
  }

  const embeds = [
    {
      title: `New Support Ticket: ${report.categoryLabel || TICKET_REASON_LABELS[report.category] || "Support Report"}`,
      color: 0x57f287,
      fields: [
        ...fields,
        {
          name: "Report Details",
          value: detailChunks[0],
          inline: false,
        },
      ],
    },
  ];

  for (let index = 1; index < detailChunks.length; index += 1) {
    embeds.push({
      title: `Report Details (${index + 1})`,
      color: 0x57f287,
      description: detailChunks[index],
    });
  }

  return embeds;
}

async function postTicketMessage(channelId, report) {
  const attachment = parseAttachment(report.attachment);
  const embeds = buildEmbeds(report);
  const content = `${SUPPORT_STAFF_MENTION || ""} New website support ticket created.`.trim();

  if (attachment) {
    const form = new FormData();
    form.append(
      "payload_json",
      JSON.stringify({
        content,
        embeds,
      })
    );
    form.append("files[0]", new Blob([attachment.buffer], { type: attachment.type }), attachment.name);
    return discordRequest(`/channels/${encodeURIComponent(channelId)}/messages`, {
      method: "POST",
      body: form,
    });
  }

  return discordRequest(`/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content,
      embeds,
    }),
  });
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

app.get("/health", (_req, res) => {
  try {
    requireEnv("DISCORD_BOT_TOKEN", DISCORD_BOT_TOKEN);
    requireEnv("DISCORD_GUILD_ID", DISCORD_GUILD_ID);
    requireEnv("DISCORD_STAFF_ROLE_ID", DISCORD_STAFF_ROLE_ID);
    requireEnv("DISCORD_TICKET_CATEGORY_ID", DISCORD_TICKET_CATEGORY_ID);
    return res.json({ ok: true, service: "support-bot" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/support-report", verifySecret, async (req, res) => {
  try {
    requireEnv("DISCORD_BOT_TOKEN", DISCORD_BOT_TOKEN);
    requireEnv("DISCORD_GUILD_ID", DISCORD_GUILD_ID);
    requireEnv("DISCORD_STAFF_ROLE_ID", DISCORD_STAFF_ROLE_ID);
    requireEnv("DISCORD_TICKET_CATEGORY_ID", DISCORD_TICKET_CATEGORY_ID);

    validateReportBody(req.body);

    const channel = await createTicketChannel(req.body);
    await postTicketMessage(channel.id, req.body);

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

app.listen(PORT, () => {
  console.log(`[support-bot] listening on port ${PORT}`);
});
