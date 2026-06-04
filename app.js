require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const {
  randomUUID,
  randomBytes,
  createHmac,
  timingSafeEqual,
  scryptSync,
} = require("crypto");
const { mkdtemp, writeFile, rm } = require("fs/promises");
const path = require("path");
const { tmpdir } = require("os");
const { Server } = require("socket.io");
const obj2gltf = require("obj2gltf");
let draco3d = null;
let stripeClient = null;

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const httpServer = createServer(app);
const ROBLOSECURITY = process.env.ROBLOSECURITY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const AUTH_USERS_TABLE = process.env.AUTH_USERS_TABLE || "member_accounts";
const MODERATION_ACTIONS_TABLE = process.env.MODERATION_ACTIONS_TABLE || "member_moderation_actions";
const DEVICE_LINKS_TABLE = process.env.DEVICE_LINKS_TABLE || "member_device_links";
const AUTH_JWT_SECRET = String(process.env.AUTH_JWT_SECRET || "");
const STRIPE_SECRET_KEY = String(process.env.STRIPE_SECRET_KEY || "");
const STRIPE_PRICE_ID = String(process.env.STRIPE_PRICE_ID || "");
const STRIPE_WEBHOOK_SECRET = String(process.env.STRIPE_WEBHOOK_SECRET || "");
const APP_BASE_URL = String(process.env.APP_BASE_URL || "https://www.rblxtools.net");
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "")
  .split(",")
  .map((value) => String(value || "").trim())
  .filter(Boolean);
const ADMIN_USER_EMAILS = (process.env.ADMIN_USER_EMAILS || "")
  .split(",")
  .map((value) => String(value || "").trim().toLowerCase())
  .filter(Boolean);
const DEFAULT_COMPLIMENTARY_PLUS_DAYS = 14;
const MAX_COMPLIMENTARY_PLUS_DAYS = 3650;
const MAX_CHAT_TIMEOUT_SECONDS = 3650 * 24 * 60 * 60;
const AUTH_JWT_TTL_DAYS = Math.max(
  1,
  Number.parseInt(process.env.AUTH_JWT_TTL_DAYS || "30", 10) || 30
);
let dracoDecoderModulePromise = null;

try {
  draco3d = require("draco3d");
} catch (_error) {
  draco3d = null;
}

try {
  if (STRIPE_SECRET_KEY) {
    stripeClient = require("stripe")(STRIPE_SECRET_KEY);
  }
} catch (_error) {
  stripeClient = null;
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (
      !origin ||
      origin === "null" ||
      allowedOrigins.length === 0 ||
      allowedOrigins.includes("*") ||
      allowedOrigins.includes(origin)
    ) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-RBLX-Display-Name", "X-RBLX-Username", "X-RBLX-User-Email"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    assertStripeWebhookConfigured();

    const signature = req.headers["stripe-signature"];
    const event = stripeClient.webhooks.constructEvent(
      req.body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        if (session.mode === "subscription" && session.metadata && session.metadata.appUserId) {
          const customerId =
            typeof session.customer === "string"
              ? session.customer
              : session.customer && session.customer.id
                ? session.customer.id
                : null;

          if (customerId) {
            await updateAuthUserFields(session.metadata.appUserId, {
              stripe_customer_id: customerId,
            });
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscriptionStateFromStripeSubscription(event.data.object);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer && invoice.customer.id
              ? invoice.customer.id
              : null;

        if (customerId) {
          const updatedUser = await setBillingAccessForCustomer(customerId, {
            premium_active: true,
            plan: "plus",
            stripe_subscription_status: "active",
          });

        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer && invoice.customer.id
              ? invoice.customer.id
              : null;

        if (customerId) {
          await setBillingAccessForCustomer(customerId, {
            premium_active: false,
            plan: "free",
            stripe_subscription_status: "past_due",
          });
        }
        break;
      }

      default:
        break;
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("POST /stripe/webhook failed:", error.message);
    return res.status(error.statusCode || 400).send(`Webhook Error: ${error.message}`);
  }
});
app.use(express.json({ limit: "12mb" }));

const io = new Server(httpServer, {
  cors: corsOptions,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000
  }
});

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

async function supabaseRequest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error: ${text}`);
  }

  if (res.status === 204) {
    return null;
  }

  const text = await res.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Supabase returned invalid JSON: ${error.message}`);
  }
}

function isAuthStorageConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY && AUTH_JWT_SECRET);
}

function assertAuthStorageConfigured() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const error = new Error("Supabase auth storage is not configured.");
    error.statusCode = 500;
    throw error;
  }

  if (!AUTH_JWT_SECRET) {
    const error = new Error("AUTH_JWT_SECRET is missing.");
    error.statusCode = 500;
    throw error;
  }
}

function getSanitizedAppBaseUrl() {
  const sanitizedBase = APP_BASE_URL.endsWith("/")
    ? APP_BASE_URL.slice(0, -1)
    : APP_BASE_URL;
  return sanitizedBase;
}

function isGoogleAuthConfigured() {
  return Boolean(GOOGLE_CLIENT_ID);
}

function buildGoogleAuthConfig() {
  return {
    enabled: isGoogleAuthConfigured(),
    clientId: GOOGLE_CLIENT_ID || null,
  };
}

function getSafePortalReturnUrl() {
  return `${getSanitizedAppBaseUrl()}/account`;
}

function getSafeCheckoutSuccessUrl() {
  return `${getSafePortalReturnUrl()}?checkout=success`;
}

function getSafeCheckoutCancelUrl() {
  return `${getSafePortalReturnUrl()}?checkout=cancelled`;
}

function assertStripePortalConfigured() {
  if (!STRIPE_SECRET_KEY || !stripeClient) {
    const error = new Error("Stripe customer portal is not configured.");
    error.statusCode = 500;
    throw error;
  }
}

function assertStripeCheckoutConfigured() {
  assertStripePortalConfigured();

  if (!STRIPE_PRICE_ID) {
    const error = new Error("Stripe checkout is not configured.");
    error.statusCode = 500;
    throw error;
  }
}

function assertStripeWebhookConfigured() {
  assertStripePortalConfigured();

  if (!STRIPE_WEBHOOK_SECRET) {
    const error = new Error("Stripe webhook is not configured.");
    error.statusCode = 500;
    throw error;
  }
}

function isPremiumStatus(status) {
  return ["active", "trialing"].includes(String(status || "").toLowerCase());
}

function getPlanForSubscriptionStatus(status) {
  return isPremiumStatus(status) ? "plus" : "free";
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function createAuthToken(user) {
  const membership = getEffectiveMembership(user);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    plan: membership.plan,
    premium: membership.premiumActive,
    iat: nowSeconds,
    exp: nowSeconds + AUTH_JWT_TTL_DAYS * 24 * 60 * 60,
  };

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", AUTH_JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyAuthToken(token) {
  const parts = String(token || "").split(".");

  if (parts.length !== 3) {
    const error = new Error("Invalid token format.");
    error.statusCode = 401;
    throw error;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const expectedSignature = createHmac("sha256", AUTH_JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const providedSignatureBuffer = Buffer.from(encodedSignature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    providedSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)
  ) {
    const error = new Error("Invalid token signature.");
    error.statusCode = 401;
    throw error;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (_error) {
    const error = new Error("Token payload is invalid.");
    error.statusCode = 401;
    throw error;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < nowSeconds) {
    const error = new Error("Token has expired.");
    error.statusCode = 401;
    throw error;
  }

  return payload;
}

function getBearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function getRequestActivityHeader(req, headerName, maxLength) {
  const rawValue = req && req.headers ? req.headers[headerName] : "";
  return cleanText(rawValue, maxLength);
}

function getRequestActivityParam(req, paramName, maxLength) {
  const rawValue = req && req.query ? req.query[paramName] : "";
  return cleanText(rawValue, maxLength);
}

function getRequestActivityEmailName(req) {
  const headerValue = cleanText(
    req?.headers?.["x-rblx-user-email"] || req?.headers?.["x-user-email"] || "",
    120
  );
  return headerValue ? String(headerValue).split("@")[0].trim() : "";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validateAuthEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateAuthPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 72;
}

function getRequestDeviceId(req) {
  return cleanText(
    (req && req.headers && (req.headers["x-rblx-device-id"] || req.headers["x-device-id"])) || "",
    120
  );
}

function getPayloadDeviceId(payload) {
  return cleanText(
    payload?.deviceId ||
    payload?.browserId ||
    payload?.clientId,
    120
  );
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const [, salt, expectedHash] = parts;
  const actualHash = scryptSync(password, salt, 64).toString("hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(actualHash, "hex");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function parseComplimentaryStatus(value) {
  const raw = String(value || "").trim();
  if (!raw.toLowerCase().startsWith("complimentary_until:")) {
    return null;
  }

  const expiresAt = raw.slice("complimentary_until:".length).trim();
  const expiresDate = expiresAt ? new Date(expiresAt) : null;
  if (!expiresDate || Number.isNaN(expiresDate.getTime())) {
    return null;
  }

  return {
    raw,
    expiresAt,
    expiresDate,
    active: expiresDate.getTime() > Date.now(),
  };
}

function getEffectiveMembership(row) {
  const complimentary = parseComplimentaryStatus(row?.stripe_subscription_status);
  if (complimentary) {
    return {
      premiumActive: complimentary.active,
      plan: complimentary.active ? "plus" : "free",
      stripeSubscriptionStatus: complimentary.active ? "complimentary" : "expired",
      complimentaryExpiresAt: complimentary.expiresAt,
      complimentaryActive: complimentary.active,
    };
  }

  return {
    premiumActive: Boolean(row?.premium_active),
    plan: row?.plan || "free",
    stripeSubscriptionStatus: row?.stripe_subscription_status || null,
    complimentaryExpiresAt: null,
    complimentaryActive: false,
  };
}

function buildPublicUser(row) {
  const membership = getEffectiveMembership(row);
  return {
    id: row.id,
    email: row.email,
    isAdmin: isAdminUser(row),
    plan: membership.plan,
    premiumActive: membership.premiumActive,
    stripeCustomerId: row.stripe_customer_id || null,
    stripeSubscriptionStatus: membership.stripeSubscriptionStatus,
    complimentaryExpiresAt: membership.complimentaryExpiresAt,
    complimentaryActive: membership.complimentaryActive,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function buildAuthTablePath(query = "") {
  return `/rest/v1/${AUTH_USERS_TABLE}${query}`;
}

function parseIsoDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isModerationActionActive(action) {
  if (!action || action.active === false) {
    return false;
  }

  const expiresAt = parseIsoDate(action.expires_at || action.expiresAt);
  if (!expiresAt) {
    return true;
  }

  return expiresAt.getTime() > Date.now();
}

function getModerationReasonText(action) {
  return cleanText(action?.reason || action?.note || "", 280);
}

function getModerationActionType(action) {
  return cleanText(action?.action_type || action?.type, 80).toLowerCase();
}

function buildTablePath(tableName, query = "") {
  return `/rest/v1/${tableName}${query}`;
}

async function getAuthUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const rows = await supabaseRequest(
    buildAuthTablePath(`?email=eq.${encodeURIComponent(normalizedEmail)}&select=*`)
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function getAuthUserById(userId) {
  const rows = await supabaseRequest(
    buildAuthTablePath(`?id=eq.${encodeURIComponent(userId)}&select=*`)
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function createAuthUser(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const nowIso = new Date().toISOString();
  const payload = {
    id: randomUUID(),
    email: normalizedEmail,
    password_hash: hashPassword(password),
    plan: "free",
    premium_active: false,
    stripe_customer_id: null,
    stripe_subscription_status: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const rows = await supabaseRequest(buildAuthTablePath(), {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (Array.isArray(rows) && rows[0]) {
    return rows[0];
  }

  if (rows && typeof rows === "object") {
    return rows;
  }

  return payload;
}

async function tryPersistGoogleIdentity(userId, googleProfile) {
  if (!googleProfile || !userId) {
    return null;
  }

  try {
    return await updateAuthUserFields(userId, {
      google_id: googleProfile.googleId || null,
      auth_provider: "google",
      google_picture_url: googleProfile.picture || null,
      google_email_verified: Boolean(googleProfile.emailVerified),
    });
  } catch (error) {
    console.warn("Could not persist Google identity fields:", error.message);
    return null;
  }
}

async function updateAuthUserLoginStamp(userId) {
  const nowIso = new Date().toISOString();
  await supabaseRequest(buildAuthTablePath(`?id=eq.${encodeURIComponent(userId)}`), {
    method: "PATCH",
    body: JSON.stringify({
      updated_at: nowIso,
      last_login_at: nowIso,
    }),
  });
}

async function updateAuthUserFields(userId, fields) {
  const payload = {
    ...fields,
    updated_at: new Date().toISOString(),
  };

  const rows = await supabaseRequest(buildAuthTablePath(`?id=eq.${encodeURIComponent(userId)}`), {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function getDeviceLinksForUser(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return [];
  }

  const rows = await supabaseRequest(
    buildTablePath(
      DEVICE_LINKS_TABLE,
      `?user_id=eq.${encodeURIComponent(normalizedUserId)}&select=*`
    )
  ).catch(() => []);

  return Array.isArray(rows) ? rows : [];
}

async function getDeviceLinksForDevice(deviceId) {
  const normalizedDeviceId = String(deviceId || "").trim();
  if (!normalizedDeviceId) {
    return [];
  }

  const rows = await supabaseRequest(
    buildTablePath(
      DEVICE_LINKS_TABLE,
      `?device_id=eq.${encodeURIComponent(normalizedDeviceId)}&select=*`
    )
  ).catch(() => []);

  return Array.isArray(rows) ? rows : [];
}

async function linkDeviceToUser(user, deviceId) {
  const normalizedUserId = String(user?.id || "").trim();
  const normalizedEmail = normalizeEmail(user?.email);
  const normalizedDeviceId = String(deviceId || "").trim();

  if (!normalizedUserId || !normalizedDeviceId) {
    return null;
  }

  const existingLinks = await getDeviceLinksForDevice(normalizedDeviceId);
  const existingLink = existingLinks.find((row) => String(row.user_id || "").trim() === normalizedUserId) || null;
  const nowIso = new Date().toISOString();

  if (existingLink) {
    const rows = await supabaseRequest(
      buildTablePath(DEVICE_LINKS_TABLE, `?id=eq.${encodeURIComponent(existingLink.id)}`),
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          user_email: normalizedEmail || null,
          last_seen_at: nowIso,
          updated_at: nowIso,
        }),
      }
    ).catch(() => []);

    return Array.isArray(rows) && rows[0] ? rows[0] : existingLink;
  }

  const rows = await supabaseRequest(buildTablePath(DEVICE_LINKS_TABLE), {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: randomUUID(),
      user_id: normalizedUserId,
      user_email: normalizedEmail || null,
      device_id: normalizedDeviceId,
      created_at: nowIso,
      updated_at: nowIso,
      last_seen_at: nowIso,
    }),
  }).catch(() => []);

  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function getModerationActionsByUser(user) {
  const normalizedUserId = String(user?.id || "").trim();
  const normalizedEmail = normalizeEmail(user?.email);
  let rows = [];

  if (normalizedUserId) {
    rows = rows.concat(
      await supabaseRequest(
        buildTablePath(MODERATION_ACTIONS_TABLE, `?user_id=eq.${encodeURIComponent(normalizedUserId)}&select=*`)
      ).catch(() => [])
    );
  }

  if (normalizedEmail) {
    rows = rows.concat(
      await supabaseRequest(
        buildTablePath(MODERATION_ACTIONS_TABLE, `?user_email=eq.${encodeURIComponent(normalizedEmail)}&select=*`)
      ).catch(() => [])
    );
  }

  const seenIds = new Set();
  return rows.filter((row) => {
    const id = String(row?.id || "");
    if (!id || seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
}

async function getModerationActionsByDevice(deviceId) {
  const normalizedDeviceId = String(deviceId || "").trim();
  if (!normalizedDeviceId) {
    return [];
  }

  const rows = await supabaseRequest(
    buildTablePath(MODERATION_ACTIONS_TABLE, `?device_id=eq.${encodeURIComponent(normalizedDeviceId)}&select=*`)
  ).catch(() => []);

  return Array.isArray(rows) ? rows : [];
}

async function deactivateModerationAction(actionId) {
  const normalizedActionId = String(actionId || "").trim();
  if (!normalizedActionId) {
    return null;
  }

  const rows = await supabaseRequest(
    buildTablePath(MODERATION_ACTIONS_TABLE, `?id=eq.${encodeURIComponent(normalizedActionId)}`),
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        active: false,
        updated_at: new Date().toISOString(),
      }),
    }
  ).catch(() => []);

  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function summarizeModerationForTarget(user, deviceId = "") {
  const userActions = user ? await getModerationActionsByUser(user) : [];
  const deviceActions = deviceId ? await getModerationActionsByDevice(deviceId) : [];
  const actions = userActions.concat(deviceActions);
  const activeActions = [];

  for (const action of actions) {
    if (isModerationActionActive(action)) {
      activeActions.push(action);
      continue;
    }

    if (action?.active !== false && action?.id) {
      await deactivateModerationAction(action.id).catch(() => null);
    }
  }

  let websiteBlacklisted = false;
  let websiteBlacklistReason = "";
  let chatBanned = false;
  let chatBanReason = "";
  let chatTimeoutUntil = null;
  let chatTimeoutReason = "";

  activeActions.forEach((action) => {
    const type = getModerationActionType(action);
    const reason = getModerationReasonText(action);
    const expiresAt = parseIsoDate(action.expires_at || action.expiresAt);

    if (type === "site_blacklist_account" || type === "site_blacklist_device") {
      websiteBlacklisted = true;
      if (!websiteBlacklistReason && reason) websiteBlacklistReason = reason;
    }

    if (type === "chat_ban") {
      chatBanned = true;
      if (!chatBanReason && reason) chatBanReason = reason;
    }

    if (type === "chat_timeout" && expiresAt) {
      if (!chatTimeoutUntil || expiresAt.getTime() > new Date(chatTimeoutUntil).getTime()) {
        chatTimeoutUntil = expiresAt.toISOString();
        chatTimeoutReason = reason;
      }
    }
  });

  return {
    websiteBlacklisted,
    websiteBlacklistReason,
    chatBanned,
    chatBanReason,
    chatTimeoutUntil,
    chatTimeoutReason,
    activeActions: activeActions.map((action) => ({
      id: action.id,
      type: getModerationActionType(action),
      reason: getModerationReasonText(action),
      expiresAt: action.expires_at || null,
      deviceId: action.device_id || null,
      createdAt: action.created_at || null,
    })),
  };
}

async function createModerationAction(action) {
  const nowIso = new Date().toISOString();
  const payload = {
    id: randomUUID(),
    user_id: action.userId || null,
    user_email: action.userEmail || null,
    device_id: action.deviceId || null,
    action_type: action.actionType,
    reason: action.reason || null,
    note: action.note || null,
    active: true,
    expires_at: action.expiresAt || null,
    admin_user_id: action.adminUserId || null,
    admin_email: action.adminEmail || null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const rows = await supabaseRequest(buildTablePath(MODERATION_ACTIONS_TABLE), {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });

  return Array.isArray(rows) && rows[0] ? rows[0] : payload;
}

async function clearModerationActionsForTarget(actionType, user, options = {}) {
  const normalizedType = String(actionType || "").trim().toLowerCase();
  const includeDevices = Boolean(options.includeDevices);
  const deviceRows = includeDevices && user?.id ? await getDeviceLinksForUser(user.id) : [];
  const linkedDeviceIds = deviceRows
    .map((row) => String(row.device_id || "").trim())
    .filter(Boolean);

  const allActions = (await getModerationActionsByUser(user)).concat(
    ...(await Promise.all(linkedDeviceIds.map((deviceId) => getModerationActionsByDevice(deviceId))))
  );

  const seen = new Set();
  const matchingActions = allActions.filter((action) => {
    const id = String(action?.id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    const type = getModerationActionType(action);
    if (type !== normalizedType) return false;
    if (action.active === false) return false;
    return true;
  });

  await Promise.all(matchingActions.map((action) => deactivateModerationAction(action.id).catch(() => null)));
  return matchingActions.length;
}

async function deleteAuthUser(userId) {
  const rows = await supabaseRequest(buildAuthTablePath(`?id=eq.${encodeURIComponent(userId)}`), {
    method: "DELETE",
    headers: {
      Prefer: "return=representation",
    },
  });

  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function cancelStripeCustomerSubscriptions(customerId) {
  if (!stripeClient || !customerId) {
    return;
  }

  const subscriptions = await stripeClient.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  const items = Array.isArray(subscriptions?.data) ? subscriptions.data : [];
  for (const subscription of items) {
    const status = String(subscription?.status || "").toLowerCase();
    if (["canceled", "incomplete_expired"].includes(status)) {
      continue;
    }

    try {
      await stripeClient.subscriptions.cancel(subscription.id);
    } catch (error) {
      console.warn(`Could not cancel subscription ${subscription.id}:`, error.message);
    }
  }

  try {
    await stripeClient.customers.del(customerId);
  } catch (error) {
    console.warn(`Could not delete Stripe customer ${customerId}:`, error.message);
  }
}

async function getAuthUserByStripeCustomerId(customerId) {
  const normalizedCustomerId = String(customerId || "").trim();
  if (!normalizedCustomerId) {
    return null;
  }

  const rows = await supabaseRequest(
    buildAuthTablePath(
      `?stripe_customer_id=eq.${encodeURIComponent(normalizedCustomerId)}&select=*`
    )
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function getOrCreateStripeCustomerForUser(user) {
  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  const customer = await stripeClient.customers.create({
    email: user.email,
    metadata: {
      appUserId: user.id,
    },
  });

  await updateAuthUserFields(user.id, {
    stripe_customer_id: customer.id,
  });

  return customer.id;
}

async function syncSubscriptionStateForUser(userId, customerId, subscriptionStatus) {
  return updateAuthUserFields(userId, {
    stripe_customer_id: customerId || null,
    stripe_subscription_status: subscriptionStatus || null,
  });
}

async function syncSubscriptionStateFromStripeSubscription(subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer && subscription.customer.id
        ? subscription.customer.id
        : "";

  if (!customerId) {
    return null;
  }

  let user = await getAuthUserByStripeCustomerId(customerId);

  if (!user && subscription.metadata && subscription.metadata.appUserId) {
    user = await getAuthUserById(subscription.metadata.appUserId);
  }

  if (!user) {
    return null;
  }

  if (String(subscription.status || "").toLowerCase() === "canceled") {
    return updateAuthUserFields(user.id, {
      stripe_customer_id: customerId,
      stripe_subscription_status: subscription.status || null,
      premium_active: false,
      plan: "free",
    });
  }

  return syncSubscriptionStateForUser(user.id, customerId, subscription.status || null);
}

async function setBillingAccessForCustomer(customerId, updates) {
  const user = await getAuthUserByStripeCustomerId(customerId);
  if (!user) {
    return null;
  }

  return updateAuthUserFields(user.id, {
    stripe_customer_id: customerId,
    ...updates,
  });
}

async function requireAuthenticatedUser(req) {
  assertAuthStorageConfigured();

  const token = getBearerToken(req);
  if (!token) {
    const error = new Error("Missing bearer token.");
    error.statusCode = 401;
    throw error;
  }

  const payload = verifyAuthToken(token);
  const user = await getAuthUserById(payload.sub);

  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 401;
    throw error;
  }

  return user;
}

async function tryGetAuthenticatedUser(req) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return null;
    }

    const payload = verifyAuthToken(token);
    const user = await getAuthUserById(payload.sub);
    return user || null;
  } catch (_error) {
    return null;
  }
}

async function verifyGoogleIdToken(idToken) {
  if (!isGoogleAuthConfigured()) {
    const error = new Error("Google sign-in is not configured.");
    error.statusCode = 500;
    throw error;
  }

  const token = String(idToken || "").trim();
  if (!token) {
    const error = new Error("Google credential is required.");
    error.statusCode = 400;
    throw error;
  }

  let response;
  try {
    response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  } catch (_error) {
    const error = new Error("Could not verify Google sign-in.");
    error.statusCode = 502;
    throw error;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok || !payload) {
    const error = new Error("Google sign-in could not be verified.");
    error.statusCode = 401;
    throw error;
  }

  const validIssuer = payload.iss === "accounts.google.com" || payload.iss === "https://accounts.google.com";
  if (!validIssuer) {
    const error = new Error("Google sign-in issuer is invalid.");
    error.statusCode = 401;
    throw error;
  }

  if (String(payload.aud || "").trim() !== GOOGLE_CLIENT_ID) {
    const error = new Error("Google sign-in is for the wrong app.");
    error.statusCode = 401;
    throw error;
  }

  const email = normalizeEmail(payload.email);
  if (!validateAuthEmail(email)) {
    const error = new Error("Google account email is invalid.");
    error.statusCode = 400;
    throw error;
  }

  const emailVerified = String(payload.email_verified || "").toLowerCase() === "true";
  if (!emailVerified) {
    const error = new Error("Your Google email must be verified before signing in.");
    error.statusCode = 401;
    throw error;
  }

  return {
    googleId: String(payload.sub || "").trim(),
    email,
    emailVerified,
    name: String(payload.name || payload.given_name || "").trim() || null,
    picture: String(payload.picture || "").trim() || null,
  };
}

async function getAuthenticatedSocketUser(payload) {
  assertAuthStorageConfigured();

  const token = cleanText(
    payload?.authToken ||
    payload?.token ||
    payload?.bearerToken,
    4096
  );

  if (!token) {
    return null;
  }

  try {
    const decoded = verifyAuthToken(token);
    if (!decoded?.sub) {
      return null;
    }

    return await getAuthUserById(decoded.sub);
  } catch (_error) {
    return null;
  }
}

async function buildChatMemberProfile(payload) {
  const sanitizedProfile = sanitizeChatMemberProfile(payload);
  const authenticatedUser = await getAuthenticatedSocketUser(payload);

  if (!authenticatedUser) {
    return sanitizedProfile;
  }

  const membership = getEffectiveMembership(authenticatedUser);
  const fallbackName = String(authenticatedUser.email || "")
    .split("@")[0]
    .trim();
  const sanitizedDisplayName = cleanText(sanitizedProfile.displayName, displayNameLength);
  const sanitizedUsername = cleanText(sanitizedProfile.username, usernameLength);

  return {
    ...sanitizedProfile,
    userId: authenticatedUser.id,
    displayName: sanitizedDisplayName && !/^guest$/i.test(sanitizedDisplayName)
      ? sanitizedDisplayName
      : (fallbackName || "Member"),
    username: sanitizedUsername && !/^guest$/i.test(sanitizedUsername)
      ? sanitizedUsername
      : (fallbackName || "Member"),
    bio: cleanText(sanitizedProfile.bio, chatBioLength),
    isPlus: membership.premiumActive,
    isGuest: false,
    plan: membership.plan,
  };
}

function syncChatMemberProfile(currentProfile, payload) {
  return sanitizeChatMemberProfile({
    displayName: payload?.displayName || payload?.name || currentProfile?.displayName,
    username: payload?.username || currentProfile?.username,
    userId: payload?.userId || currentProfile?.userId,
    avatarUrl: payload?.avatarUrl || currentProfile?.avatarUrl,
    bio: payload?.bio || currentProfile?.bio,
    isPlus: typeof payload?.isPlus === "boolean" ? payload.isPlus : currentProfile?.isPlus,
    isGuest: typeof payload?.isGuest === "boolean" ? payload.isGuest : currentProfile?.isGuest,
    plan: payload?.plan || currentProfile?.plan,
    favoriteTools: Array.isArray(payload?.favoriteTools)
      ? payload.favoriteTools
      : currentProfile?.favoriteTools,
  });
}

function isAdminUser(user) {
  if (!user || typeof user !== "object") {
    return false;
  }

  const userId = String(user.id || "").trim();
  const userEmail = String(user.email || "").trim().toLowerCase();

  return (
    (userId && ADMIN_USER_IDS.includes(userId)) ||
    (userEmail && ADMIN_USER_EMAILS.includes(userEmail))
  );
}

async function requireAdminUser(req) {
  const user = await requireAuthenticatedUser(req);

  if (!ADMIN_USER_IDS.length && !ADMIN_USER_EMAILS.length) {
    const error = new Error("Admin allowlist is not configured.");
    error.statusCode = 500;
    throw error;
  }

  if (!isAdminUser(user)) {
    const error = new Error("This account is not allowed to use the admin panel.");
    error.statusCode = 403;
    throw error;
  }

  return user;
}

async function getAuthUserByIdentifier(identifier) {
  const raw = String(identifier || "").trim();
  if (!raw) {
    return null;
  }

  if (raw.includes("@")) {
    return getAuthUserByEmail(raw);
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(raw)) {
    return null;
  }

  return getAuthUserById(raw);
}

async function grantComplimentaryPlusToUser(userId, days) {
  const targetUser = await getAuthUserByIdentifier(userId);
  if (!targetUser) {
    const error = new Error("No member account was found for that Plus grant.");
    error.statusCode = 404;
    throw error;
  }

  const safeDays = Number.isFinite(days)
    ? Math.max(1, Math.min(days, MAX_COMPLIMENTARY_PLUS_DAYS))
    : DEFAULT_COMPLIMENTARY_PLUS_DAYS;
  const expiresAt = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString();

  const updatedUser = await updateAuthUserFields(targetUser.id, {
    premium_active: true,
    plan: "plus",
    stripe_subscription_status: "complimentary_until:" + expiresAt,
  });
  if (!updatedUser) {
    const error = new Error("Could not save the complimentary Plus grant.");
    error.statusCode = 500;
    throw error;
  }

  return {
    user: updatedUser,
    days: safeDays,
    expiresAt,
  };
}

async function removePlusFromUser(userId) {
  const targetUser = await getAuthUserByIdentifier(userId);
  if (!targetUser) {
    const error = new Error("No member account was found for that Plus removal.");
    error.statusCode = 404;
    throw error;
  }

  const updatedUser = await updateAuthUserFields(targetUser.id, {
    premium_active: false,
    plan: "free",
    stripe_subscription_status: "admin_removed",
  });
  if (!updatedUser) {
    const error = new Error("Could not save the Plus removal.");
    error.statusCode = 500;
    throw error;
  }

  return updatedUser;
}

function normalizeCouponCode(value) {
  return String(value || "").trim().toUpperCase();
}

async function getPromotionCodeByCode(code) {
  assertStripePortalConfigured();

  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) {
    const error = new Error("Coupon code is required.");
    error.statusCode = 400;
    throw error;
  }

  const promotionCodes = await stripeClient.promotionCodes.list({
    code: normalizedCode,
    active: true,
    limit: 1,
    expand: ["data.coupon"],
  });

  return Array.isArray(promotionCodes?.data) && promotionCodes.data[0]
    ? promotionCodes.data[0]
    : null;
}

function buildCouponStatusPayload(promotionCode) {
  if (!promotionCode) {
    return null;
  }

  const coupon = promotionCode.coupon || {};
  const promoMaxRedemptions = Number.isFinite(promotionCode.max_redemptions)
    ? promotionCode.max_redemptions
    : null;
  const couponMaxRedemptions = Number.isFinite(coupon.max_redemptions)
    ? coupon.max_redemptions
    : null;
  const maxRedemptions = promoMaxRedemptions ?? couponMaxRedemptions;
  const timesRedeemed = Number.isFinite(promotionCode.times_redeemed)
    ? promotionCode.times_redeemed
    : 0;
  const remainingUses = maxRedemptions === null
    ? null
    : Math.max(0, maxRedemptions - timesRedeemed);
  const expiresAtUnix = Number.isFinite(promotionCode.expires_at)
    ? promotionCode.expires_at
    : Number.isFinite(coupon.redeem_by)
      ? coupon.redeem_by
      : null;

  return {
    ok: true,
    code: promotionCode.code || null,
    active: Boolean(promotionCode.active),
    remainingUses,
    usesLeft: remainingUses,
    maxRedemptions,
    timesRedeemed,
    expiresAt: expiresAtUnix ? new Date(expiresAtUnix * 1000).toISOString() : null,
    expiresAtUnix,
    coupon: {
      id: coupon.id || null,
      name: coupon.name || null,
      percentOff: Number.isFinite(coupon.percent_off) ? coupon.percent_off : null,
      amountOff: Number.isFinite(coupon.amount_off) ? coupon.amount_off : null,
      duration: coupon.duration || null,
      remainingUses,
      maxRedemptions,
      timesRedeemed,
      redeemBy: Number.isFinite(coupon.redeem_by)
        ? new Date(coupon.redeem_by * 1000).toISOString()
        : null,
    },
  };
}

async function getUsageCounts() {
  try {
    const today = getTodayDate();
    const rows = await supabaseRequest("/rest/v1/usage_counter?id=eq.1&select=*");

    if (!rows.length) {
      return { today: 0, total: 0 };
    }

    const row = rows[0];
    const total = Number(row.total) || 0;

    if (row.updated_date !== today) {
      await supabaseRequest("/rest/v1/usage_counter?id=eq.1", {
        method: "PATCH",
        body: JSON.stringify({
          today: 0,
          updated_date: today,
        }),
      });

      return { today: 0, total };
    }

    return {
      today: Number(row.today) || 0,
      total,
    };
  } catch (error) {
    console.error("getUsageCounts failed:", error.message);
    return { today: 0, total: 0 };
  }
}

async function getDailyUsage() {
  const counts = await getUsageCounts();
  return counts.today;
}

async function incrementUsageCounts() {
  const today = getTodayDate();
  const counts = await getUsageCounts();
  const nextToday = counts.today + 1;
  const nextTotal = counts.total + 1;

  await supabaseRequest("/rest/v1/usage_counter?id=eq.1", {
    method: "PATCH",
    body: JSON.stringify({
      today: nextToday,
      total: nextTotal,
      updated_date: today,
    }),
  });

  return {
    today: nextToday,
    total: nextTotal,
  };
}

async function safeIncrementDailyUsage() {
  try {
    await incrementUsageCounts();
  } catch (error) {
    console.error("Usage counter failed:", error.message);
  }
}

/* ✅ NOTIFICATION / LOG SYSTEM */
function extractTemplateId(text) {
  const patterns = [
    /<Content name="ShirtTemplate">[\s\S]*?<url>https?:\/\/www\.roblox\.com\/asset\/\?id=(\d+)<\/url>/i,
    /<Content name="PantsTemplate">[\s\S]*?<url>https?:\/\/www\.roblox\.com\/asset\/\?id=(\d+)<\/url>/i,
    /<url>https?:\/\/www\.roblox\.com\/asset\/\?id=(\d+)<\/url>/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function extractTextureId(text) {
  const patterns = [
    /<Content name="TextureId">[\s\S]*?<url>([\s\S]*?)<\/url>[\s\S]*?<\/Content>/i,
    /<Content name="ColorMap">[\s\S]*?<url>([\s\S]*?)<\/url>[\s\S]*?<\/Content>/i,
    /<Content name="Texture">[\s\S]*?<url>([\s\S]*?)<\/url>[\s\S]*?<\/Content>/i,
    /<string name="TextureID">([\s\S]*?)<\/string>/i,
    /<string name="TextureId">([\s\S]*?)<\/string>/i,
    /<string name="ColorMap">([\s\S]*?)<\/string>/i,
    /TextureId[\s\S]{0,500}?(?:rbxassetid:\/\/|asset\/\?id=)(\d+)/i,
    /ColorMap[\s\S]{0,500}?(?:rbxassetid:\/\/|asset\/\?id=)(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const id = extractAssetIdFromUrl(match[1] || match[0]);
    if (id) return id;
  }

  return null;
}

function extractReferencedAssetIds(text) {
  const ids = new Set();
  const patterns = [
    /rbxassetid:\/\/(\d+)/gi,
    /asset\/\?id=(\d+)/gi,
    /[?&]id=(\d+)/gi,
    /<url>(\d+)<\/url>/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const candidate = match[1];
      if (candidate) ids.add(candidate);
    }
  }

  const directTextureId = extractTextureId(text);
  if (directTextureId) ids.add(directTextureId);

  const directMeshId = extractMeshId(text);
  if (directMeshId) ids.add(directMeshId);

  return Array.from(ids);
}

function extractMeshId(text) {
  const contentMeshMatch = text.match(
    /<Content name="MeshId">[\s\S]*?<url>([\s\S]*?)<\/url>[\s\S]*?<\/Content>/i
  );

  if (contentMeshMatch) {
    const id = extractAssetIdFromUrl(contentMeshMatch[1]);
    if (id) return id;
  }

  const meshIdPropertyMatch = text.match(
    /<string name="MeshId">([\s\S]*?)<\/string>/i
  );

  if (meshIdPropertyMatch) {
    const id = extractAssetIdFromUrl(meshIdPropertyMatch[1]);
    if (id) return id;
  }

  const nearbyMeshMatch = text.match(
    /MeshId[\s\S]{0,500}?(?:rbxassetid:\/\/|asset\/\?id=)(\d+)/i
  );

  if (nearbyMeshMatch) return nearbyMeshMatch[1];

  return null;
}

function extractAssetIdFromUrl(value) {
  const text = String(value || "");
  const match = text.match(/(?:rbxassetid:\/\/|asset\/\?id=|[?&]id=)(\d+)/i);
  return match ? match[1] : null;
}

function extractPlayableAnimationId(text) {
  const source = String(text || "");
  const patterns = [
    /<url>(\d+)<\/url>/i,
    /rbxassetid:\/\/(\d+)/i,
    /asset\/\?id=(\d+)/i,
    /[?&]id=(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function looksLikeClassicClothingAsset(text) {
  return /<Item class="Shirt"/i.test(text) || /<Item class="Pants"/i.test(text);
}

function isAuthRequiredResponse(text) {
  return /Authentication required to access Asset/i.test(text);
}

function detectImageMime(contentType, buffer) {
  if (contentType && contentType.startsWith("image/")) return contentType;

  if (!buffer || buffer.length < 4) return null;

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "image/gif";
  }

  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

function guessRobloxAssetFileExtension(contentType, buffer) {
  const normalizedType = String(contentType || "").toLowerCase();
  const textStart = buffer.subarray(0, Math.min(buffer.length, 128)).toString("utf8").trimStart();
  const asciiStart = buffer.subarray(0, Math.min(buffer.length, 32)).toString("ascii");

  if (normalizedType.includes("xml") || textStart.startsWith("<roblox")) {
    return "rbxmx";
  }

  if (normalizedType.includes("json") || textStart.startsWith("{")) {
    return "json";
  }

  if (asciiStart.startsWith("version ")) {
    return "mesh";
  }

  return "rbxm";
}

function describeAnimationAsset(buffer) {
  const textStart = buffer.subarray(0, Math.min(buffer.length, 2048)).toString("utf8");

  if (/KeyframeSequence/i.test(textStart)) {
    return "Keyframe Sequence";
  }

  if (/Animation/i.test(textStart)) {
    return "Animation Asset";
  }

  return "Animation Ready";
}

function detectAudioMime(contentType, buffer) {
  const normalizedType = String(contentType || "").toLowerCase();
  if (normalizedType.startsWith("audio/")) return normalizedType;

  if (!buffer || buffer.length < 4) return null;

  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x41 &&
    buffer[10] === 0x56 &&
    buffer[11] === 0x45
  ) {
    return "audio/wav";
  }

  if (
    buffer[0] === 0x49 &&
    buffer[1] === 0x44 &&
    buffer[2] === 0x33
  ) {
    return "audio/mpeg";
  }

  if (
    buffer[0] === 0xff &&
    (buffer[1] & 0xe0) === 0xe0
  ) {
    return "audio/mpeg";
  }

  if (
    buffer[0] === 0x4f &&
    buffer[1] === 0x67 &&
    buffer[2] === 0x67 &&
    buffer[3] === 0x53
  ) {
    return "audio/ogg";
  }

  if (
    buffer.length >= 12 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return "audio/mp4";
  }

  return null;
}

function audioExtensionFromMime(mime) {
  const normalized = String(mime || "").toLowerCase();
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("mp4") || normalized.includes("aac")) return "m4a";
  return "audio";
}

function extractRobloxAssetIdFromInput(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  if (/^[0-9]+$/.test(text)) {
    return text;
  }

  const urlMatch = text.match(
    /(?:\/(?:library|audio|catalog|store\/asset)\/|[?&]id=|rbxassetid:\/\/)(\d+)/i
  );
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  const fallbackMatch = text.match(/(\d{4,})/);
  return fallbackMatch?.[1] || "";
}

function buildRelativeAudioRouteUrl(req, assetId, extraParams = {}) {
  const routePath = req.path === "/audio" ? "/audio" : "/api/audio";
  const params = new URLSearchParams();
  params.set("id", assetId);

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  return routePath + "?" + params.toString();
}

async function fetchJson(url, options = {}) {
  const headers = {
    "User-Agent": "roblox-template-api/1.0",
  };

  if (options.includeCookie && ROBLOSECURITY) {
    headers.Cookie = `.ROBLOSECURITY=${ROBLOSECURITY}`;
  }

  const response = await fetch(url, {
    redirect: "follow",
    headers,
  });

  if (!response.ok) {
    return null;
  }

  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

function normalizeRobloxMediaKind(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized || normalized === "auto") return "";
  if (["game", "games", "place", "places", "experience", "experiences"].includes(normalized)) return "game";
  if (["badge", "badges"].includes(normalized)) return "badge";
  if (["gamepass", "game-pass", "game_pass", "pass", "gamepasses", "game-passes"].includes(normalized)) return "gamepass";
  if (["group", "groups", "community", "communities"].includes(normalized)) return "group";
  if (["asset", "assets", "catalog", "library"].includes(normalized)) return "asset";
  if (["bundle", "bundles"].includes(normalized)) return "bundle";
  if (["outfit", "outfits"].includes(normalized)) return "outfit";
  if (["user", "users", "avatar", "headshot", "profile"].includes(normalized)) return "user";
  if (["developerproduct", "developer-product", "developer_product", "product", "products"].includes(normalized)) return "developerproduct";

  return "";
}

function tryParseAbsoluteUrl(value) {
  try {
    return new URL(String(value || "").trim());
  } catch (_error) {
    return null;
  }
}

function extractRobloxMediaId(value) {
  const parsedUrl = tryParseAbsoluteUrl(value);
  const fallbackText = String(value || "").trim();
  const queryId = parsedUrl?.searchParams?.get("id");

  if (queryId && /^[0-9]+$/.test(queryId)) {
    return {
      id: queryId,
      input: fallbackText,
    };
  }

  const pathName = String(parsedUrl?.pathname || fallbackText).toLowerCase();
  const matchers = [
    /\/games\/(\d+)/i,
    /\/badges\/(\d+)/i,
    /\/developer-products\/(\d+)/i,
    /\/game-pass(?:es)?\/(\d+)/i,
    /\/(?:communities|groups)\/(\d+)/i,
    /\/(?:catalog|library|store\/asset)\/(\d+)/i,
    /\/bundles\/(\d+)/i,
    /\/outfits\/(\d+)/i,
    /\/users\/(\d+)/i,
  ];

  for (const matcher of matchers) {
    const match = pathName.match(matcher);
    if (match?.[1]) {
      return {
        id: match[1],
        input: fallbackText,
      };
    }
  }

  const firstLongId = fallbackText.match(/(\d{4,})/);
  if (firstLongId?.[1]) {
    return {
      id: firstLongId[1],
      input: fallbackText,
    };
  }

  return {
    id: "",
    input: fallbackText,
  };
}

function normalizeRobloxMediaInput(rawInput, rawKind) {
  const cleanInput = String(rawInput || "").trim();
  const explicitKind = normalizeRobloxMediaKind(rawKind);

  if (/^[0-9]+$/.test(cleanInput)) {
    return {
      id: cleanInput,
      kind: explicitKind,
      input: cleanInput,
    };
  }

  const inferred = extractRobloxMediaId(cleanInput);
  return {
    id: inferred.id,
    kind: explicitKind,
    input: cleanInput,
  };
}

function buildMediaDownloadUrl(req, queryParams = {}) {
  const params = new URLSearchParams();

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  params.set("download", "1");
  return "/media?" + params.toString();
}

function createMediaItem(req, baseQuery, item) {
  const mediaKey = cleanText(item.mediaKey || item.label || item.kind || "media", 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    kind: item.kind,
    label: item.label,
    imageUrl: item.imageUrl,
    sourceUrl: item.sourceUrl || "",
    width: item.width || null,
    height: item.height || null,
    fileName: item.fileName || "",
    mediaKey,
    downloadUrl: buildMediaDownloadUrl(req, {
      ...baseQuery,
      mediaKey,
    }),
  };
}

function flattenMediaResults(results = []) {
  return results.flatMap((result) =>
    Array.isArray(result.items)
      ? result.items.map((item) => ({
          ...item,
          resultKind: result.kind,
          resultTitle: result.title,
          resultId: result.id,
        }))
      : []
  );
}

function selectMediaItemForDownload(results, mediaKey) {
  const allItems = flattenMediaResults(results);
  if (!allItems.length) return null;

  if (!mediaKey) {
    return allItems[0];
  }

  return allItems.find((item) => item.mediaKey === mediaKey) || null;
}

function getSafeMediaFileName(value, fallback) {
  const baseName = sanitizeBaseFileName(value || fallback, fallback);
  return baseName || fallback;
}

function inferImageExtensionFromUrl(url, mime) {
  const mimeExtension = imageExtensionFromMime(mime);
  if (mimeExtension && mimeExtension !== "png") {
    return mimeExtension;
  }

  const match = String(url || "").match(/\.([a-z0-9]{3,4})(?:[?#]|$)/i);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }

  return mimeExtension || "png";
}

function isAllowedRobloxMediaUrl(value) {
  const parsedUrl = tryParseAbsoluteUrl(value);
  if (!parsedUrl) return false;

  const hostname = String(parsedUrl.hostname || "").toLowerCase();
  return (
    hostname.endsWith(".roblox.com") ||
    hostname === "roblox.com" ||
    hostname.endsWith(".rbxcdn.com") ||
    hostname === "rbxcdn.com"
  );
}

async function resolvePlaceUniverseId(placeId) {
  const payload = await fetchJson(
    "https://games.roblox.com/v1/games/multiget-place-details?placeIds=" + encodeURIComponent(placeId),
    { includeCookie: true }
  );

  const details = Array.isArray(payload) ? payload[0] : Array.isArray(payload?.data) ? payload.data[0] : null;
  if (!details?.universeId) {
    return null;
  }

  return {
    universeId: String(details.universeId),
    placeId: String(details.placeId || placeId),
    name: cleanText(details.name || details.universeName || "Game", 120) || "Game",
  };
}

async function resolveGameMedia(req, placeId, options = {}) {
  const maxThumbnails = Math.max(1, Math.min(10, Number.parseInt(options.maxThumbnails || "10", 10) || 10));
  const placeDetails = await resolvePlaceUniverseId(placeId);
  if (!placeDetails) {
    return null;
  }

  const iconPayload = await fetchJson(
    "https://thumbnails.roblox.com/v1/games/icons?universeIds=" +
      encodeURIComponent(placeDetails.universeId) +
      "&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false"
  );
  const iconUrl = iconPayload?.data?.[0]?.imageUrl || "";

  const thumbnailPayload = await fetchJson(
    "https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=" +
      encodeURIComponent(placeDetails.universeId) +
      "&countPerUniverse=" +
      encodeURIComponent(maxThumbnails) +
      "&defaults=true&size=768x432&format=Png&isCircular=false"
  );
  const thumbnailItems = Array.isArray(thumbnailPayload?.data?.[0]?.thumbnails)
    ? thumbnailPayload.data[0].thumbnails
    : [];

  const items = [];
  const baseQuery = {
    id: placeId,
    kind: "game",
    maxThumbnails,
  };

  if (iconUrl) {
    items.push(
      createMediaItem(req, baseQuery, {
        kind: "game-icon",
        label: "Game Icon",
        imageUrl: iconUrl,
        fileName: `game-icon-${placeId}.png`,
      })
    );
  }

  thumbnailItems
    .filter((thumbnail) => thumbnail?.imageUrl)
    .forEach((thumbnail, index) => {
      items.push(
        createMediaItem(req, baseQuery, {
          kind: "game-thumbnail",
          label: `Game Thumbnail ${index + 1}`,
          imageUrl: thumbnail.imageUrl,
          fileName: `game-thumbnail-${placeId}-${index + 1}.png`,
        })
      );
    });

  if (!items.length) {
    return null;
  }

  return {
    kind: "game",
    id: placeId,
    title: placeDetails.name,
    items,
  };
}

async function resolveSimpleThumbnailResult(req, id, kind, title, endpoint, queryKey, itemLabel, filePrefix) {
  return resolveSizedThumbnailResult(
    req,
    id,
    kind,
    title,
    endpoint,
    queryKey,
    itemLabel,
    filePrefix,
    "512x512"
  );
}

async function resolveSizedThumbnailResult(
  req,
  id,
  kind,
  title,
  endpoint,
  queryKey,
  itemLabel,
  filePrefix,
  size
) {
  const payload = await fetchJson(
    endpoint +
      "?" +
      queryKey +
      "=" +
      encodeURIComponent(id) +
      "&returnPolicy=PlaceHolder&size=" +
      encodeURIComponent(size) +
      "&format=Png&isCircular=false"
  );
  const imageUrl = payload?.data?.[0]?.imageUrl || "";
  if (!imageUrl) {
    return null;
  }

  return {
    kind,
    id,
    title,
    items: [
      createMediaItem(req, { id, kind }, {
        kind,
        label: itemLabel,
        imageUrl,
        fileName: `${filePrefix}-${id}.png`,
      }),
    ],
  };
}

async function resolveBadgeMedia(req, badgeId) {
  return resolveSizedThumbnailResult(
    req,
    badgeId,
    "badge",
    "Badge",
    "https://thumbnails.roblox.com/v1/badges/icons",
    "badgeIds",
    "Badge Icon",
    "badge-icon",
    "150x150"
  );
}

async function resolveGamePassMedia(req, gamePassId) {
  return resolveSizedThumbnailResult(
    req,
    gamePassId,
    "gamepass",
    "Game Pass",
    "https://thumbnails.roblox.com/v1/game-passes",
    "gamePassIds",
    "Game Pass Icon",
    "gamepass-icon",
    "150x150"
  );
}

async function resolveGroupMedia(req, groupId) {
  return resolveSizedThumbnailResult(
    req,
    groupId,
    "group",
    "Group",
    "https://thumbnails.roblox.com/v1/groups/icons",
    "groupIds",
    "Group Icon",
    "group-icon",
    "150x150"
  );
}

async function resolveAssetMedia(req, assetId) {
  return resolveSimpleThumbnailResult(
    req,
    assetId,
    "asset",
    "Asset",
    "https://thumbnails.roblox.com/v1/assets",
    "assetIds",
    "Asset Thumbnail",
    "asset-thumbnail"
  );
}

async function resolveBundleMedia(req, bundleId) {
  return resolveSizedThumbnailResult(
    req,
    bundleId,
    "bundle",
    "Bundle",
    "https://thumbnails.roblox.com/v1/bundles/thumbnails",
    "bundleIds",
    "Bundle Thumbnail",
    "bundle-thumbnail",
    "420x420"
  );
}

async function resolveOutfitMedia(req, outfitId) {
  return resolveSizedThumbnailResult(
    req,
    outfitId,
    "outfit",
    "Outfit",
    "https://thumbnails.roblox.com/v1/users/outfits",
    "userOutfitIds",
    "Outfit Thumbnail",
    "outfit-thumbnail",
    "420x420"
  );
}

async function resolveDeveloperProductMedia(req, productId) {
  return resolveSizedThumbnailResult(
    req,
    productId,
    "developerproduct",
    "Developer Product",
    "https://thumbnails.roblox.com/v1/developer-products/icons",
    "developerProductIds",
    "Developer Product Icon",
    "developer-product-icon",
    "150x150"
  );
}

async function resolveUserMedia(req, userId) {
  const payload = await fetchJson(
    "https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=" +
      encodeURIComponent(userId) +
      "&size=720x720&format=Png&isCircular=false"
  );
  const imageUrl = payload?.data?.[0]?.imageUrl || "";
  if (!imageUrl) {
    return null;
  }

  return {
    kind: "user",
    id: userId,
    title: "User",
    items: [
      createMediaItem(req, { id: userId, kind: "user" }, {
        kind: "user",
        label: "Avatar Headshot",
        imageUrl,
        fileName: `user-headshot-${userId}.png`,
      }),
    ],
  };
}

async function resolveRobloxMedia(req, id, kind, options = {}) {
  const normalizedKind = normalizeRobloxMediaKind(kind);
  const resolvers = {
    game: () => resolveGameMedia(req, id, options),
    badge: () => resolveBadgeMedia(req, id),
    developerproduct: () => resolveDeveloperProductMedia(req, id),
    gamepass: () => resolveGamePassMedia(req, id),
    group: () => resolveGroupMedia(req, id),
    asset: () => resolveAssetMedia(req, id),
    bundle: () => resolveBundleMedia(req, id),
    outfit: () => resolveOutfitMedia(req, id),
    user: () => resolveUserMedia(req, id),
  };

  if (!normalizedKind) {
    return [];
  }

  const result = await resolvers[normalizedKind]?.();
  return result ? [result] : [];
}

async function getRobloxAssetThumbnailUrl(assetId) {
  try {
    const url =
      "https://thumbnails.roblox.com/v1/assets?assetIds=" +
      encodeURIComponent(assetId) +
      "&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "roblox-template-api/1.0",
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const imageUrl = payload?.data?.[0]?.imageUrl;
    return imageUrl || null;
  } catch (_error) {
    return null;
  }
}

function buildRelativeAnimationDownloadUrl(req, assetId) {
  const routePath = req.path === "/animation" ? "/animation" : "/api/animation";
  const params = new URLSearchParams();
  params.set("id", assetId);
  params.set("download", "1");

  const requestedDisplayName = getRequestActivityHeader(req, "x-rblx-activity-displayname", 80);
  const requestedUsername = getRequestActivityHeader(req, "x-rblx-activity-username", 80);
  const requestedAvatarUrl = getRequestActivityHeader(req, "x-rblx-activity-avatarurl", 500);
  const requestedPlan = getRequestActivityHeader(req, "x-rblx-activity-plan", 20);
  const requestedUserId = getRequestActivityHeader(req, "x-rblx-activity-userid", 120);
  const requestedIsPlus = String(req?.headers?.["x-rblx-activity-isplus"] || "").trim().toLowerCase() === "true";

  if (requestedDisplayName) params.set("activityDisplayName", requestedDisplayName);
  if (requestedUsername) params.set("activityUsername", requestedUsername);
  if (requestedAvatarUrl) params.set("activityAvatarUrl", requestedAvatarUrl);
  if (requestedPlan) params.set("activityPlan", requestedPlan);
  if (requestedUserId) params.set("activityUserId", requestedUserId);
  if (requestedIsPlus) params.set("activityIsPlus", "true");

  return routePath + "?" + params.toString();
}

async function fetchBuffer(url) {
  const headers = {
    "User-Agent": "roblox-template-api/1.0",
  };

  if (ROBLOSECURITY) {
    headers.Cookie = `.ROBLOSECURITY=${ROBLOSECURITY}`;
  }

  const response = await fetch(url, {
    redirect: "follow",
    headers,
  });

  const buffer = Buffer.from(await response.arrayBuffer());

  return { response, buffer };
}

async function resolveImageAssetFromRobloxAsset(startId, options = {}) {
  const maxDepth = Number.isFinite(options.maxDepth) ? options.maxDepth : 4;
  const visited = new Set();
  const queue = [{ id: startId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current?.id || visited.has(current.id) || current.depth > maxDepth) {
      continue;
    }

    visited.add(current.id);

    const assetFetch = await fetchBuffer(`https://assetdelivery.roblox.com/v1/asset/?id=${current.id}`);
    const assetType = assetFetch.response.headers.get("content-type") || "";
    const imageMime = detectImageMime(assetType, assetFetch.buffer);

    if (imageMime) {
      return {
        assetId: current.id,
        mime: imageMime,
        buffer: assetFetch.buffer,
        response: assetFetch.response,
      };
    }

    const assetText = assetFetch.buffer.toString("utf8");

    if (isAuthRequiredResponse(assetText)) {
      const authError = new Error("Roblox blocked access. Add ROBLOSECURITY cookie.");
      authError.code = 403;
      throw authError;
    }

    const referencedIds = extractReferencedAssetIds(assetText);

    for (const nextId of referencedIds) {
      if (!visited.has(nextId)) {
        queue.push({ id: nextId, depth: current.depth + 1 });
      }
    }
  }

  return null;
}

async function resolveMeshAssetFromRobloxAsset(startId, options = {}) {
  const maxDepth = Number.isFinite(options.maxDepth) ? options.maxDepth : 5;
  const visited = new Set();
  const queue = [{ id: startId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current?.id || visited.has(current.id) || current.depth > maxDepth) {
      continue;
    }

    visited.add(current.id);

    const assetFetch = await fetchBuffer(`https://assetdelivery.roblox.com/v1/asset/?id=${current.id}`);
    const directVersion = assetFetch.buffer.subarray(0, 16).toString("ascii");

    if (directVersion.startsWith("version ")) {
      return {
        assetId: current.id,
        buffer: assetFetch.buffer,
        response: assetFetch.response,
      };
    }

    const assetText = assetFetch.buffer.toString("utf8");

    if (isAuthRequiredResponse(assetText)) {
      const authError = new Error("Roblox blocked access. Add ROBLOSECURITY cookie.");
      authError.code = 403;
      throw authError;
    }

    const directMeshId = extractMeshId(assetText);
    if (directMeshId && !visited.has(directMeshId)) {
      queue.unshift({ id: directMeshId, depth: current.depth + 1 });
    }

    const referencedIds = extractReferencedAssetIds(assetText);

    for (const nextId of referencedIds) {
      if (!visited.has(nextId)) {
        queue.push({ id: nextId, depth: current.depth + 1 });
      }
    }
  }

  return null;
}

function imageExtensionFromMime(mime) {
  const normalized = String(mime || "").toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  if (normalized.includes("bmp")) return "bmp";
  return "png";
}

function sanitizeBaseFileName(value, fallback = "baked-model") {
  const cleaned = String(value || "")
    .trim()
    .replace(/\.[^.]+$/i, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return cleaned || fallback;
}

function buildBakedMaterialFile(textureFileName) {
  return [
    "newmtl BakedMaterial",
    "Ka 1.000000 1.000000 1.000000",
    "Kd 1.000000 1.000000 1.000000",
    "Ks 0.000000 0.000000 0.000000",
    "d 1.0",
    "illum 2",
    "map_Kd " + textureFileName,
  ].join("\n");
}

function buildBakedObjText(objText, mtlFileName) {
  const cleaned = String(objText || "")
    .replace(/^mtllib\s+.*$/gm, "")
    .replace(/^usemtl\s+.*$/gm, "")
    .trim();

  return [
    "mtllib " + mtlFileName,
    "usemtl BakedMaterial",
    cleaned,
    "",
  ].join("\n");
}

async function parseRobloxMeshToObj(buffer, sourceId) {
  const versionEnd = buffer.indexOf(0x0a);

  if (versionEnd < 0) {
    throw new Error("Mesh version header was not found");
  }

  const version = buffer.subarray(0, versionEnd).toString("ascii").trim();

  if (version === "version 1.00" || version === "version 1.01") {
    return parseAsciiRobloxMesh(buffer, version, sourceId);
  }

  if (version === "version 2.00") {
    return parseBinaryRobloxMeshV2(buffer, version, versionEnd + 1, sourceId);
  }

  if (version === "version 3.00" || version === "version 3.01") {
    return parseBinaryRobloxMeshV3(buffer, version, versionEnd + 1, sourceId);
  }

  if (version === "version 4.00" || version === "version 4.01" || version === "version 5.00") {
    return parseBinaryRobloxMeshV4OrV5(buffer, version, versionEnd + 1, sourceId);
  }

  if (version === "version 6.00" || version === "version 7.00") {
    return parseChunkedRobloxMesh(buffer, version, versionEnd + 1, sourceId);
  }

  throw new Error(`Unsupported Roblox mesh format: ${version}`);
}

function parseAsciiRobloxMesh(buffer, version, sourceId) {
  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/);
  const faceCount = Number.parseInt(lines[1], 10);

  if (!Number.isFinite(faceCount) || faceCount <= 0) {
    throw new Error("Invalid ASCII mesh face count");
  }

  const vectorMatches = text.matchAll(/\[([^\]]+)\]/g);
  const vectors = Array.from(vectorMatches, (match) =>
    match[1].split(",").map((value) => Number.parseFloat(value.trim()))
  );

  if (vectors.length < faceCount * 9) {
    throw new Error("ASCII mesh data is incomplete");
  }

  const vertices = [];
  const normals = [];
  const uvs = [];
  const faces = [];
  const scale = version === "version 1.00" ? 0.5 : 1;

  for (let faceIndex = 0; faceIndex < faceCount; faceIndex += 1) {
    const face = [];

    for (let corner = 0; corner < 3; corner += 1) {
      const base = faceIndex * 9 + corner * 3;
      const position = vectors[base];
      const normal = vectors[base + 1];
      const uv = vectors[base + 2];

      vertices.push([position[0] * scale, position[1] * scale, position[2] * scale]);
      normals.push([normal[0], normal[1], normal[2]]);
      uvs.push([uv[0], 1 - uv[1]]);
      face.push(vertices.length);
    }

    faces.push(face);
  }

  return buildObj({ vertices, normals, uvs, faces, sourceId });
}

function parseBinaryRobloxMeshV2(buffer, version, offset, sourceId) {
  if (offset + 12 > buffer.length) {
    throw new Error("Binary mesh header is incomplete");
  }

  const headerSize = buffer.readUInt16LE(offset);
  const vertexSize = buffer.readUInt8(offset + 2);
  const faceSize = buffer.readUInt8(offset + 3);
  const vertexCount = buffer.readUInt32LE(offset + 4);
  const faceCount = buffer.readUInt32LE(offset + 8);

  if (
    headerSize < 12 ||
    vertexSize < 32 ||
    faceSize < 6 ||
    vertexCount <= 0 ||
    faceCount <= 0 ||
    vertexCount > 1000000 ||
    faceCount > 1000000
  ) {
    throw new Error("Binary mesh header values are invalid");
  }

  return parseVertexFaceBlock({
    buffer,
    version,
    sourceId,
    vertexOffset: offset + headerSize,
    vertexSize,
    vertexCount,
    faceSize,
    faceCount,
  });
}

function parseBinaryRobloxMeshV3(buffer, version, offset, sourceId) {
  if (offset + 16 > buffer.length) {
    throw new Error("Binary mesh v3 header is incomplete");
  }

  const headerSize = buffer.readUInt16LE(offset);
  const vertexSize = buffer.readUInt8(offset + 2);
  const faceSize = buffer.readUInt8(offset + 3);
  const lodOffsetSize = buffer.readUInt16LE(offset + 4);
  const lodOffsetCount = buffer.readUInt16LE(offset + 6);
  const vertexCount = buffer.readUInt32LE(offset + 8);
  const totalFaceCount = buffer.readUInt32LE(offset + 12);

  if (
    headerSize < 16 ||
    vertexSize < 32 ||
    faceSize < 6 ||
    lodOffsetSize !== 4 ||
    vertexCount <= 0 ||
    totalFaceCount <= 0
  ) {
    throw new Error("Binary mesh v3 header values are invalid");
  }

  const vertexOffset = offset + headerSize;
  const faceOffset = vertexOffset + vertexCount * vertexSize;
  const lodOffset = faceOffset + totalFaceCount * faceSize;
  const lodOffsets = readLodOffsets(buffer, lodOffset, lodOffsetCount);
  const faceCount = getMainLodFaceCount(totalFaceCount, lodOffsets);

  return parseVertexFaceBlock({
    buffer,
    version,
    sourceId,
    vertexOffset,
    vertexSize,
    vertexCount,
    faceSize,
    faceCount,
  });
}

function parseBinaryRobloxMeshV4OrV5(buffer, version, offset, sourceId) {
  const minHeaderSize = version === "version 5.00" ? 32 : 24;

  if (offset + minHeaderSize > buffer.length) {
    throw new Error("Binary mesh v4/v5 header is incomplete");
  }

  const headerSize = buffer.readUInt16LE(offset);
  const vertexCount = buffer.readUInt32LE(offset + 4);
  const totalFaceCount = buffer.readUInt32LE(offset + 8);
  const lodOffsetCount = buffer.readUInt16LE(offset + 12);
  const boneCount = buffer.readUInt16LE(offset + 14);

  if (
    headerSize < minHeaderSize ||
    vertexCount <= 0 ||
    totalFaceCount <= 0 ||
    vertexCount > 1000000 ||
    totalFaceCount > 1000000
  ) {
    throw new Error("Binary mesh v4/v5 header values are invalid");
  }

  const vertexSize = 40;
  const faceSize = 12;
  const vertexOffset = offset + headerSize;
  const skinningSize = boneCount > 0 ? vertexCount * 8 : 0;
  const faceOffset = vertexOffset + vertexCount * vertexSize + skinningSize;
  const lodOffset = faceOffset + totalFaceCount * faceSize;
  const lodOffsets = readLodOffsets(buffer, lodOffset, lodOffsetCount);
  const faceCount = getMainLodFaceCount(totalFaceCount, lodOffsets);

  return parseVertexFaceBlock({
    buffer,
    version,
    sourceId,
    vertexOffset,
    vertexSize,
    vertexCount,
    faceSize,
    faceCount,
  });
}

async function parseChunkedRobloxMesh(buffer, version, offset, sourceId) {
  let cursor = offset;

  while (cursor + 16 <= buffer.length) {
    const chunkType = buffer.subarray(cursor, cursor + 8).toString("ascii").replace(/\0/g, "");
    const chunkVersion = buffer.readUInt32LE(cursor + 8);
    const chunkSize = buffer.readUInt32LE(cursor + 12);
    const chunkOffset = cursor + 16;
    const nextChunk = chunkOffset + chunkSize;

    if (chunkSize < 0 || nextChunk > buffer.length) {
      throw new Error("Chunked mesh data is incomplete");
    }

    if (chunkType === "COREMESH") {
      return parseCoreMeshChunk(buffer, version, chunkVersion, chunkOffset, chunkSize, sourceId);
    }

    cursor = nextChunk;
  }

  throw new Error("COREMESH chunk was not found");
}

async function parseCoreMeshChunk(buffer, version, chunkVersion, offset, chunkSize, sourceId) {
  if (chunkSize < 8) {
    throw new Error("COREMESH chunk is too small");
  }

  if (chunkVersion === 2) {
    return decodeDracoCoreMesh(buffer, version, offset, chunkSize, sourceId);
  }

  const vertexCount = buffer.readUInt32LE(offset);
  const vertexSize = 40;
  const faceSize = 12;
  const vertexOffset = offset + 4;
  const faceCountOffset = vertexOffset + vertexCount * vertexSize;

  if (faceCountOffset + 4 > offset + chunkSize) {
    throw new Error("COREMESH vertex data is incomplete");
  }

  const faceCount = buffer.readUInt32LE(faceCountOffset);

  return parseVertexFaceBlock({
    buffer,
    version: `${version} COREMESH v${chunkVersion}`,
    sourceId,
    vertexOffset,
    vertexSize,
    vertexCount,
    faceOffset: faceCountOffset + 4,
    faceSize,
    faceCount,
  });
}

async function getDracoDecoderModule() {
  if (!draco3d) {
    throw new Error("Draco decoder is not installed. Run npm install draco3d.");
  }

  if (!dracoDecoderModulePromise) {
    dracoDecoderModulePromise = draco3d.createDecoderModule({});
  }

  return dracoDecoderModulePromise;
}

async function decodeDracoCoreMesh(buffer, version, offset, chunkSize, sourceId) {
  if (chunkSize < 4) {
    throw new Error("Draco COREMESH chunk is too small");
  }

  const dracoSize = buffer.readUInt32LE(offset);
  const dracoOffset = offset + 4;

  if (dracoSize <= 0 || dracoOffset + dracoSize > offset + chunkSize) {
    throw new Error("Draco bitstream is incomplete");
  }

  const decoderModule = await getDracoDecoderModule();
  const decoder = new decoderModule.Decoder();
  const decoderBuffer = new decoderModule.DecoderBuffer();
  const dracoBytes = buffer.subarray(dracoOffset, dracoOffset + dracoSize);

  decoderBuffer.Init(new Int8Array(dracoBytes), dracoBytes.length);

  const geometryType = decoder.GetEncodedGeometryType(decoderBuffer);

  if (geometryType !== decoderModule.TRIANGULAR_MESH) {
    decoderModule.destroy(decoderBuffer);
    decoderModule.destroy(decoder);
    throw new Error("Draco stream is not a triangular mesh");
  }

  const mesh = new decoderModule.Mesh();
  const status = decoder.DecodeBufferToMesh(decoderBuffer, mesh);

  if (!status.ok() || mesh.ptr === 0) {
    const message = status.error_msg ? status.error_msg() : "Unknown Draco decode error";
    decoderModule.destroy(mesh);
    decoderModule.destroy(decoderBuffer);
    decoderModule.destroy(decoder);
    throw new Error(`Draco decode failed: ${message}`);
  }

  try {
    const vertices = readDracoFloatAttribute(decoderModule, decoder, mesh, 0, 3);
    const normals = readDracoFloatAttribute(decoderModule, decoder, mesh, 1, 3, vertices.length);
    const uvs = readDracoFloatAttribute(decoderModule, decoder, mesh, 2, 2, vertices.length, true);
    const faces = readDracoFaces(decoderModule, decoder, mesh);

    return buildObj({
      vertices,
      normals,
      uvs,
      faces,
      sourceId,
      version: `${version} Draco`,
    });
  } finally {
    decoderModule.destroy(mesh);
    decoderModule.destroy(decoderBuffer);
    decoderModule.destroy(decoder);
  }
}

function readDracoFloatAttribute(
  decoderModule,
  decoder,
  mesh,
  uniqueId,
  components,
  fallbackCount = 0,
  flipV = false
) {
  const attribute = decoder.GetAttributeByUniqueId(mesh, uniqueId);

  if (!attribute || attribute.ptr === 0) {
    return Array.from({ length: fallbackCount }, () =>
      components === 2 ? [0, 0] : [0, 0, 0]
    );
  }

  const values = new decoderModule.DracoFloat32Array();
  decoder.GetAttributeFloatForAllPoints(mesh, attribute, values);

  const output = [];
  const pointCount = mesh.num_points();

  for (let point = 0; point < pointCount; point += 1) {
    const item = [];

    for (let component = 0; component < components; component += 1) {
      let value = values.GetValue(point * components + component);
      if (flipV && component === 1) value = 1 - value;
      item.push(value);
    }

    output.push(item);
  }

  decoderModule.destroy(values);
  return output;
}

function readDracoFaces(decoderModule, decoder, mesh) {
  const faces = [];
  const face = new decoderModule.DracoInt32Array();

  for (let index = 0; index < mesh.num_faces(); index += 1) {
    decoder.GetFaceFromMesh(mesh, index, face);
    faces.push([
      face.GetValue(0) + 1,
      face.GetValue(1) + 1,
      face.GetValue(2) + 1,
    ]);
  }

  decoderModule.destroy(face);
  return faces;
}

function readLodOffsets(buffer, offset, count) {
  const offsets = [];

  for (let index = 0; index < count; index += 1) {
    const cursor = offset + index * 4;
    if (cursor + 4 > buffer.length) break;
    offsets.push(buffer.readUInt32LE(cursor));
  }

  return offsets;
}

function getMainLodFaceCount(totalFaceCount, lodOffsets) {
  if (lodOffsets.length > 1 && lodOffsets[1] > 0 && lodOffsets[1] <= totalFaceCount) {
    return lodOffsets[1];
  }

  return totalFaceCount;
}

function parseVertexFaceBlock({
  buffer,
  version,
  sourceId,
  vertexOffset,
  vertexSize,
  vertexCount,
  faceOffset,
  faceSize,
  faceCount,
}) {
  const resolvedFaceOffset = faceOffset || vertexOffset + vertexCount * vertexSize;
  const faceBytes = faceCount * faceSize;

  if (resolvedFaceOffset + faceBytes > buffer.length) {
    throw new Error("Binary mesh data is incomplete");
  }

  const vertices = [];
  const normals = [];
  const uvs = [];
  const faces = [];

  for (let index = 0; index < vertexCount; index += 1) {
    const base = vertexOffset + index * vertexSize;

    vertices.push([
      buffer.readFloatLE(base),
      buffer.readFloatLE(base + 4),
      buffer.readFloatLE(base + 8),
    ]);

    normals.push([
      buffer.readFloatLE(base + 12),
      buffer.readFloatLE(base + 16),
      buffer.readFloatLE(base + 20),
    ]);

    uvs.push([
      buffer.readFloatLE(base + 24),
      1 - buffer.readFloatLE(base + 28),
    ]);
  }

  for (let index = 0; index < faceCount; index += 1) {
    const base = resolvedFaceOffset + index * faceSize;

    if (faceSize >= 12) {
      faces.push([
        buffer.readUInt32LE(base) + 1,
        buffer.readUInt32LE(base + 4) + 1,
        buffer.readUInt32LE(base + 8) + 1,
      ]);
    } else {
      faces.push([
        buffer.readUInt16LE(base) + 1,
        buffer.readUInt16LE(base + 2) + 1,
        buffer.readUInt16LE(base + 4) + 1,
      ]);
    }
  }

  return buildObj({ vertices, normals, uvs, faces, sourceId, version });
}

function buildObj({ vertices, normals, uvs, faces, sourceId, version }) {
  const lines = [
    `# Exported by RBLX Tools`,
    `# Roblox source asset: ${sourceId}`,
  ];

  if (version) {
    lines.push(`# Roblox mesh format: ${version}`);
  }

  lines.push("o rblxtools_ugc_mesh");

  for (const vertex of vertices) {
    lines.push(`v ${formatObjNumber(vertex[0])} ${formatObjNumber(vertex[1])} ${formatObjNumber(vertex[2])}`);
  }

  for (const uv of uvs) {
    lines.push(`vt ${formatObjNumber(uv[0])} ${formatObjNumber(uv[1])}`);
  }

  for (const normal of normals) {
    lines.push(`vn ${formatObjNumber(normal[0])} ${formatObjNumber(normal[1])} ${formatObjNumber(normal[2])}`);
  }

  for (const face of faces) {
    lines.push(`f ${face.map((index) => `${index}/${index}/${index}`).join(" ")}`);
  }

  return `${lines.join("\n")}\n`;
}

function formatObjNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return Number.parseFloat(value.toFixed(6)).toString();
}

function describeAssetBuffer(buffer) {
  const firstText = buffer.subarray(0, Math.min(buffer.length, 96)).toString("utf8");
  const ascii = buffer.subarray(0, Math.min(buffer.length, 32)).toString("ascii");

  return {
    bytes: buffer.length,
    asciiStart: ascii.replace(/[^\x20-\x7E]/g, "."),
    looksLikeMesh: ascii.startsWith("version "),
    looksLikeXml: firstText.trimStart().startsWith("<"),
    looksLikeJson: firstText.trimStart().startsWith("{"),
    looksLikeBinaryModel: ascii.startsWith("<roblox!") || ascii.includes("rbxm"),
  };
}

app.get("/api", async (_req, res) => {
  const counts = await getUsageCounts();

  res.json({
    status: "API Running",
    templatesGeneratedToday: counts.today,
    templatesGeneratedTotal: counts.total,
    usageEndpoint: "/usage",
    audioEndpoint: "/audio?id=ROBLOX_AUDIO_ID",
    mediaEndpoint: "/media?id=ROBLOX_ID_OR_URL",
    templateEndpoint: "/template?id=ROBLOX_ID",
    developerAssetEndpoint: "/developer-asset?id=ROBLOX_ASSET_ID",
    ugcObjEndpoint: "/ugc-obj?id=ROBLOX_UGC_ID",
    ugcTextureEndpoint: "/ugc-texture?id=ROBLOX_UGC_ID",
    authSignupEndpoint: "/auth/signup",
    authLoginEndpoint: "/auth/login",
    authGoogleEndpoint: "/auth/google",
    authGoogleConfigEndpoint: "/auth/google/config",
    authMeEndpoint: "/auth/me",
    authCheckoutEndpoint: "/auth/create-checkout-session",
    authPortalEndpoint: "/auth/create-portal-session",
    stripeWebhookEndpoint: "/stripe/webhook",
  });
});

app.get("/usage", async (_req, res) => {
  const counts = await getUsageCounts();
  res.json({
    today: counts.today,
    total: counts.total,
  });
});

app.get("/debug/auth-status", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    roblosecurityPresent: Boolean(ROBLOSECURITY),
    roblosecurityLength: ROBLOSECURITY ? ROBLOSECURITY.length : 0,
    allowedOriginsConfigured: allowedOrigins.length,
  });
});

app.get("/auth/google/config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  return res.json({
    ok: true,
    ...buildGoogleAuthConfig(),
  });
});

app.post("/auth/signup", async (req, res) => {
  try {
    assertAuthStorageConfigured();

    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!validateAuthEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    if (!validateAuthPassword(password)) {
      return res.status(400).json({
        error: "Password must be between 8 and 72 characters.",
      });
    }

    const existingUser = await getAuthUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "An account already exists for that email." });
    }

    const createdUser = await createAuthUser(email, password);
    const token = createAuthToken(createdUser);

    return res.status(201).json({
      ok: true,
      token,
      user: buildPublicUser(createdUser),
    });
  } catch (error) {
    console.error("POST /auth/signup failed:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not create that account.",
    });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    assertAuthStorageConfigured();

    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!validateAuthEmail(email) || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await getAuthUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }

    await updateAuthUserLoginStamp(user.id);
    const freshUser = (await getAuthUserById(user.id)) || user;
    const token = createAuthToken(freshUser);

    return res.json({
      ok: true,
      token,
      user: buildPublicUser(freshUser),
    });
  } catch (error) {
    console.error("POST /auth/login failed:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not log in.",
    });
  }
});

app.post("/auth/google", async (req, res) => {
  try {
    assertAuthStorageConfigured();

    const googleProfile = await verifyGoogleIdToken(req.body?.idToken);
    let user = await getAuthUserByEmail(googleProfile.email);

    if (!user) {
      const generatedPassword = randomBytes(24).toString("hex");
      user = await createAuthUser(googleProfile.email, generatedPassword);
    }

    const persistedGoogleUser = await tryPersistGoogleIdentity(user.id, googleProfile);
    if (persistedGoogleUser) {
      user = persistedGoogleUser;
    }

    await updateAuthUserLoginStamp(user.id);
    const freshUser = (await getAuthUserById(user.id)) || user;
    const token = createAuthToken(freshUser);

    return res.json({
      ok: true,
      token,
      user: buildPublicUser(freshUser),
      authProvider: "google",
    });
  } catch (error) {
    console.error("POST /auth/google failed:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not sign in with Google.",
    });
  }
});

app.get("/auth/me", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const deviceId = getRequestDeviceId(req);
    if (deviceId) {
      await linkDeviceToUser(user, deviceId).catch(() => null);
    }
    const moderation = await summarizeModerationForTarget(user, deviceId);
    return res.json({
      ok: true,
      user: buildPublicUser(user),
      moderation,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not load the current user.",
    });
  }
});

app.get("/auth/device-status", async (req, res) => {
  try {
    const deviceId = getRequestDeviceId(req);
    const moderation = await summarizeModerationForTarget(null, deviceId);
    return res.json({
      ok: true,
      deviceId: deviceId || null,
      moderation,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not load device moderation status.",
    });
  }
});

app.get("/auth/premium-status", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const membership = getEffectiveMembership(user);
    return res.json({
      ok: true,
      premiumActive: membership.premiumActive,
      plan: membership.plan,
      stripeSubscriptionStatus: membership.stripeSubscriptionStatus,
      complimentaryExpiresAt: membership.complimentaryExpiresAt,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not load premium status.",
    });
  }
});

app.post("/auth/change-password", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required." });
    }

    if (!verifyPassword(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    if (!validateAuthPassword(newPassword)) {
      return res.status(400).json({
        error: "New password must be between 8 and 72 characters.",
      });
    }

    if (verifyPassword(newPassword, user.password_hash)) {
      return res.status(400).json({
        error: "Choose a new password that is different from the current password.",
      });
    }

    const updatedUser = await updateAuthUserFields(user.id, {
      password_hash: hashPassword(newPassword),
    });

    return res.json({
      ok: true,
      changed: true,
      user: buildPublicUser(updatedUser || user),
    });
  } catch (error) {
    console.error("POST /auth/change-password failed:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not change password.",
    });
  }
});

app.post("/auth/delete-account", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);

    if (user.stripe_customer_id) {
      await cancelStripeCustomerSubscriptions(user.stripe_customer_id);
    }

    await deleteAuthUser(user.id);

    return res.json({
      ok: true,
      deleted: true,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not delete this account.",
    });
  }
});

app.get("/admin/member-lookup", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const query = String(req.query?.q || "").trim();

    if (!query) {
      return res.status(400).json({ error: "A user ID or email is required." });
    }

    const targetUser = await getAuthUserByIdentifier(query);
    if (!targetUser) {
      return res.status(404).json({ error: "No member was found for that ID or email." });
    }
    const moderation = await summarizeModerationForTarget(targetUser);
    const deviceLinks = await getDeviceLinksForUser(targetUser.id);

    return res.json({
      ok: true,
      admin: buildPublicUser(adminUser),
      member: buildPublicUser(targetUser),
      moderation,
      deviceCount: deviceLinks.length,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not look up that member.",
    });
  }
});

app.post("/admin/grant-plus", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const targetIdentifier = String(req.body?.userId || req.body?.email || req.body?.target || "").trim();
    const note = cleanText(req.body?.note, 160);
    const requestedDays = Number.parseInt(String(req.body?.days || DEFAULT_COMPLIMENTARY_PLUS_DAYS), 10);
    const days = Number.isFinite(requestedDays)
      ? Math.max(1, Math.min(requestedDays, MAX_COMPLIMENTARY_PLUS_DAYS))
      : DEFAULT_COMPLIMENTARY_PLUS_DAYS;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    if (!targetIdentifier) {
      return res.status(400).json({ error: "A user ID or email is required." });
    }

    const targetUser = await getAuthUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      return res.status(404).json({ error: "No member was found for that ID or email." });
    }

    const grantResult = await grantComplimentaryPlusToUser(targetUser.id, days);
    const updatedUser = grantResult.user;

    console.log(
      "[ADMIN GRANT PLUS]",
      JSON.stringify({
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        targetId: targetUser.id,
        targetEmail: targetUser.email,
        days: grantResult.days,
        expiresAt: grantResult.expiresAt,
        note: note || "",
        grantedAt: new Date().toISOString(),
      })
    );

    emitModerationLog(defaultChatRoom, getActionTargetLabel(targetUser) + " received " + grantResult.days + " days of complimentary Plus.");
    return res.json({
      ok: true,
      message: "Complimentary Plus granted for " + grantResult.days + " days.",
      member: buildPublicUser(updatedUser || targetUser),
      days: grantResult.days,
      expiresAt: grantResult.expiresAt,
      grantedBy: {
        id: adminUser.id,
        email: adminUser.email,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not grant complimentary Plus.",
    });
  }
});

app.post("/admin/remove-plus", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const targetIdentifier = String(req.body?.userId || req.body?.email || req.body?.target || "").trim();
    const note = cleanText(req.body?.note, 160);

    if (!targetIdentifier) {
      return res.status(400).json({ error: "A user ID or email is required." });
    }

    const targetUser = await getAuthUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      return res.status(404).json({ error: "No member was found for that ID or email." });
    }

    const updatedUser = await removePlusFromUser(targetUser.id);

    console.log(
      "[ADMIN REMOVE PLUS]",
      JSON.stringify({
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        targetId: targetUser.id,
        targetEmail: targetUser.email,
        note: note || "",
        removedAt: new Date().toISOString(),
      })
    );

    emitModerationLog(defaultChatRoom, "Complimentary Plus was removed from " + getActionTargetLabel(targetUser) + ".");
    return res.json({
      ok: true,
      message: "Plus access removed successfully.",
      member: buildPublicUser(updatedUser || targetUser),
      removedBy: {
        id: adminUser.id,
        email: adminUser.email,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not remove Plus access.",
    });
  }
});

app.post("/admin/site-blacklist", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const targetIdentifier = String(req.body?.userId || req.body?.email || req.body?.target || "").trim();
    const note = cleanText(req.body?.note, 160);
    const reason = cleanText(req.body?.reason || "Website access revoked.", 280);

    if (!targetIdentifier) {
      return res.status(400).json({ error: "A user ID or email is required." });
    }

    const targetUser = await getAuthUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      return res.status(404).json({ error: "No member was found for that ID or email." });
    }

    await createModerationAction({
      userId: targetUser.id,
      userEmail: normalizeEmail(targetUser.email),
      actionType: "site_blacklist_account",
      reason,
      note,
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
    });

    const deviceLinks = await getDeviceLinksForUser(targetUser.id);
    const uniqueDeviceIds = Array.from(new Set(deviceLinks.map((row) => String(row.device_id || "").trim()).filter(Boolean)));
    await Promise.all(uniqueDeviceIds.map((deviceId) => createModerationAction({
      userId: targetUser.id,
      userEmail: normalizeEmail(targetUser.email),
      deviceId,
      actionType: "site_blacklist_device",
      reason,
      note,
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
    }).catch(() => null)));

    const moderation = await summarizeModerationForTarget(targetUser);
    await refreshModerationStateForConnectedUser(targetUser);
    emitModerationLog(defaultChatRoom, getActionTargetLabel(targetUser) + " was blocked from the website.");
    return res.json({
      ok: true,
      message: "Website blacklist applied.",
      member: buildPublicUser(targetUser),
      moderation,
      deviceCount: uniqueDeviceIds.length,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not apply the website blacklist.",
    });
  }
});

app.post("/admin/clear-site-blacklist", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const targetIdentifier = String(req.body?.userId || req.body?.email || req.body?.target || "").trim();

    if (!targetIdentifier) {
      return res.status(400).json({ error: "A user ID or email is required." });
    }

    const targetUser = await getAuthUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      return res.status(404).json({ error: "No member was found for that ID or email." });
    }

    const clearedAccount = await clearModerationActionsForTarget("site_blacklist_account", targetUser);
    const clearedDevices = await clearModerationActionsForTarget("site_blacklist_device", targetUser, { includeDevices: true });
    const moderation = await summarizeModerationForTarget(targetUser);
    await refreshModerationStateForConnectedUser(targetUser);
    emitModerationLog(defaultChatRoom, "Website block cleared for " + getActionTargetLabel(targetUser) + ".");

    return res.json({
      ok: true,
      message: "Website blacklist removed.",
      member: buildPublicUser(targetUser),
      moderation,
      clearedCount: clearedAccount + clearedDevices,
      clearedBy: {
        id: adminUser.id,
        email: adminUser.email,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not clear the website blacklist.",
    });
  }
});

app.post("/admin/chat-timeout", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const targetIdentifier = String(req.body?.userId || req.body?.email || req.body?.target || "").trim();
    const note = cleanText(req.body?.note, 160);
    const reason = cleanText(req.body?.reason || "Chat timed out by moderation.", 280);
    const days = Math.max(0, Number.parseInt(String(req.body?.days || "0"), 10) || 0);
    const hours = Math.max(0, Number.parseInt(String(req.body?.hours || "0"), 10) || 0);
    const minutes = Math.max(0, Number.parseInt(String(req.body?.minutes || "0"), 10) || 0);
    const durationSeconds = Math.min(MAX_CHAT_TIMEOUT_SECONDS, (days * 24 * 60 * 60) + (hours * 60 * 60) + (minutes * 60));

    if (!targetIdentifier) {
      return res.status(400).json({ error: "A user ID or email is required." });
    }

    if (!durationSeconds) {
      return res.status(400).json({ error: "Set at least one minute, hour, or day for the timeout." });
    }

    const targetUser = await getAuthUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      return res.status(404).json({ error: "No member was found for that ID or email." });
    }

    await clearModerationActionsForTarget("chat_timeout", targetUser);
    const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    await createModerationAction({
      userId: targetUser.id,
      userEmail: normalizeEmail(targetUser.email),
      actionType: "chat_timeout",
      reason,
      note,
      expiresAt,
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
    });

    const moderation = await summarizeModerationForTarget(targetUser);
    updateRecentMessagesForUser(defaultChatRoom, targetUser.id, (message) => ({
      ...message,
      moderationChatBanned: false,
      moderationTimeoutUntil: moderation.chatTimeoutUntil || null,
      moderationTimeoutReason: reason,
    }));
    await refreshModerationStateForConnectedUser(targetUser);
    emitModerationLog(
      defaultChatRoom,
      getActionTargetLabel(targetUser) + " was timed out for " + formatDurationLabel(durationSeconds) + "."
    );
    return res.json({
      ok: true,
      message: "Chat timeout applied.",
      member: buildPublicUser(targetUser),
      moderation,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not apply the chat timeout.",
    });
  }
});

app.post("/admin/clear-chat-timeout", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const targetIdentifier = String(req.body?.userId || req.body?.email || req.body?.target || "").trim();
    if (!targetIdentifier) {
      return res.status(400).json({ error: "A user ID or email is required." });
    }

    const targetUser = await getAuthUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      return res.status(404).json({ error: "No member was found for that ID or email." });
    }

    const clearedCount = await clearModerationActionsForTarget("chat_timeout", targetUser);
    const moderation = await summarizeModerationForTarget(targetUser);
    updateRecentMessagesForUser(defaultChatRoom, targetUser.id, (message) => ({
      ...message,
      moderationTimeoutUntil: null,
      moderationTimeoutReason: "",
    }));
    await refreshModerationStateForConnectedUser(targetUser);
    emitModerationLog(defaultChatRoom, "Chat timeout cleared for " + getActionTargetLabel(targetUser) + ".");
    return res.json({
      ok: true,
      message: "Chat timeout cleared.",
      member: buildPublicUser(targetUser),
      moderation,
      clearedCount,
      clearedBy: {
        id: adminUser.id,
        email: adminUser.email,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not clear the chat timeout.",
    });
  }
});

app.post("/admin/chat-ban", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const targetIdentifier = String(req.body?.userId || req.body?.email || req.body?.target || "").trim();
    const note = cleanText(req.body?.note, 160);
    const reason = cleanText(req.body?.reason || "Chat banned by moderation.", 280);

    if (!targetIdentifier) {
      return res.status(400).json({ error: "A user ID or email is required." });
    }

    const targetUser = await getAuthUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      return res.status(404).json({ error: "No member was found for that ID or email." });
    }

    await clearModerationActionsForTarget("chat_ban", targetUser);
    await createModerationAction({
      userId: targetUser.id,
      userEmail: normalizeEmail(targetUser.email),
      actionType: "chat_ban",
      reason,
      note,
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
    });

    const moderation = await summarizeModerationForTarget(targetUser);
    updateRecentMessagesForUser(defaultChatRoom, targetUser.id, (message) => ({
      ...message,
      moderationChatBanned: true,
    }));
    await refreshModerationStateForConnectedUser(targetUser);
    emitModerationLog(defaultChatRoom, getActionTargetLabel(targetUser) + " was chat banned.");
    return res.json({
      ok: true,
      message: "Chat ban applied.",
      member: buildPublicUser(targetUser),
      moderation,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not apply the chat ban.",
    });
  }
});

app.post("/admin/clear-chat-ban", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const targetIdentifier = String(req.body?.userId || req.body?.email || req.body?.target || "").trim();
    if (!targetIdentifier) {
      return res.status(400).json({ error: "A user ID or email is required." });
    }

    const targetUser = await getAuthUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      return res.status(404).json({ error: "No member was found for that ID or email." });
    }

    const clearedCount = await clearModerationActionsForTarget("chat_ban", targetUser);
    const moderation = await summarizeModerationForTarget(targetUser);
    updateRecentMessagesForUser(defaultChatRoom, targetUser.id, (message) => ({
      ...message,
      moderationChatBanned: false,
    }));
    await refreshModerationStateForConnectedUser(targetUser);
    emitModerationLog(defaultChatRoom, "Chat ban cleared for " + getActionTargetLabel(targetUser) + ".");
    return res.json({
      ok: true,
      message: "Chat ban cleared.",
      member: buildPublicUser(targetUser),
      moderation,
      clearedCount,
      clearedBy: {
        id: adminUser.id,
        email: adminUser.email,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not clear the chat ban.",
    });
  }
});

app.post("/admin/create-claim-drop", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const room = cleanText(req.body?.room || defaultChatRoom, 40) || defaultChatRoom;
    const daysRaw = Number.parseInt(String(req.body?.days || DEFAULT_COMPLIMENTARY_PLUS_DAYS), 10);
    const maxClaimsRaw = Number.parseInt(String(req.body?.maxClaims || 1), 10);
    const expiresSecondsRaw = Number.parseInt(String(req.body?.expiresSeconds || 60), 10);

    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(daysRaw, MAX_COMPLIMENTARY_PLUS_DAYS)) : DEFAULT_COMPLIMENTARY_PLUS_DAYS;
    const maxClaims = Number.isFinite(maxClaimsRaw) ? Math.max(1, Math.min(maxClaimsRaw, 500)) : 1;
    const expiresSeconds = Number.isFinite(expiresSecondsRaw) ? Math.max(1, Math.min(expiresSecondsRaw, 86400)) : 60;
    const title = cleanText(req.body?.title, 60) || "Claim Free Plus";
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();
    const adminDisplayName = cleanText(req.body?.displayName || adminUser.email?.split("@")[0] || "Admin", displayNameLength) || "Admin";
    const adminUsername = cleanText(req.body?.username || adminDisplayName, usernameLength) || adminDisplayName;
    const adminAvatarUrl = cleanText(req.body?.avatarUrl, 500);

    const state = getRoomSpecialState(room);
    if (state.claimDropTimeout) {
      clearTimeout(state.claimDropTimeout);
      state.claimDropTimeout = null;
    }
    state.claimDrop = {
      id: randomUUID(),
      title,
      days,
      maxClaims,
      expiresAt,
      createdAt: new Date().toISOString(),
      claimedBy: [],
      createdBy: {
        id: adminUser.id,
        email: adminUser.email,
        displayName: adminDisplayName,
        username: adminUsername,
        avatarUrl: adminAvatarUrl,
      },
    };
    state.claimDropTimeout = setTimeout(() => {
      finalizeClaimDrop(room, "expired");
    }, expiresSeconds * 1000);

    const message = createChatRoomMessage({
      userId: adminUser.id,
      displayName: adminDisplayName,
      username: adminUsername,
      avatarUrl: adminAvatarUrl,
      isPlus: true,
      isGuest: false,
      plan: "plus",
      favoriteTools: [],
    }, {
      text: adminDisplayName + " started a claimable Plus drop in chat.",
      specialType: "claimDrop",
      claimDrop: state.claimDrop,
    });

    pushRoomMessage(room, message);
    emitRoomSpecials(room);

    return res.json({
      ok: true,
      message: "Claimable Plus drop sent into live chat.",
      claimDrop: serializeClaimDrop(state.claimDrop),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not create the claimable Plus drop.",
    });
  }
});

app.post("/admin/start-chat-rain", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const room = cleanText(req.body?.room || defaultChatRoom, 40) || defaultChatRoom;
    const daysRaw = Number.parseInt(String(req.body?.days || DEFAULT_COMPLIMENTARY_PLUS_DAYS), 10);
    const winnersRaw = Number.parseInt(String(req.body?.winnersCount || 1), 10);
    const durationSecondsRaw = Number.parseInt(String(req.body?.durationSeconds || 300), 10);

    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(daysRaw, MAX_COMPLIMENTARY_PLUS_DAYS)) : DEFAULT_COMPLIMENTARY_PLUS_DAYS;
    const winnersCount = Number.isFinite(winnersRaw) ? Math.max(1, Math.min(winnersRaw, 100)) : 1;
    const durationSeconds = Number.isFinite(durationSecondsRaw) ? Math.max(1, Math.min(durationSecondsRaw, 604800)) : 300;
    const title = cleanText(req.body?.title, 60) || "Chat Rain";
    const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    const adminDisplayName = cleanText(req.body?.displayName || adminUser.email?.split("@")[0] || "Admin", displayNameLength) || "Admin";
    const adminUsername = cleanText(req.body?.username || adminDisplayName, usernameLength) || adminDisplayName;
    const adminAvatarUrl = cleanText(req.body?.avatarUrl, 500);

    const state = getRoomSpecialState(room);
    if (state.rainTimeout) {
      clearTimeout(state.rainTimeout);
      state.rainTimeout = null;
    }

    state.chatRain = {
      id: randomUUID(),
      title,
      days,
      winnersCount,
      expiresAt,
      createdAt: new Date().toISOString(),
      participants: [],
      winners: [],
      ended: false,
      createdBy: {
        id: adminUser.id,
        email: adminUser.email,
        displayName: adminDisplayName,
        username: adminUsername,
        avatarUrl: adminAvatarUrl,
      },
    };

    state.rainTimeout = setTimeout(() => {
      finalizeChatRain(room, "completed").catch((error) => {
        console.error("Finalize chat rain failed:", error.message);
      });
    }, durationSeconds * 1000);

    emitSpecialAnnouncement(
      room,
      adminDisplayName + " started a live chat rain for " + winnersCount + " Plus winner" + (winnersCount === 1 ? "" : "s") + "."
    );
    emitRoomSpecials(room);

    return res.json({
      ok: true,
      message: "Chat rain started.",
      chatRain: serializeChatRain(state.chatRain),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not start the chat rain.",
    });
  }
});

app.get("/coupon-status", async (req, res) => {
  try {
    const code = normalizeCouponCode(req.query.code);

    if (!code) {
      return res.status(400).json({ error: "Coupon code is required." });
    }

    const promotionCode = await getPromotionCodeByCode(code);

    if (!promotionCode) {
      return res.status(404).json({ error: "Coupon code was not found." });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.json(buildCouponStatusPayload(promotionCode));
  } catch (error) {
    console.error("GET /coupon-status failed:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not load coupon status.",
    });
  }
});

app.post("/auth/create-checkout-session", async (req, res) => {
  try {
    assertStripeCheckoutConfigured();
    const user = await requireAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomerForUser(user);

    const checkoutSession = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: getSafeCheckoutSuccessUrl(),
      cancel_url: getSafeCheckoutCancelUrl(),
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: {
        appUserId: user.id,
      },
      subscription_data: {
        metadata: {
          appUserId: user.id,
        },
      },
    });

    return res.json({
      ok: true,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error("POST /auth/create-checkout-session failed:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not create a Stripe checkout session.",
    });
  }
});

app.post("/auth/create-portal-session", async (req, res) => {
  try {
    assertStripePortalConfigured();
    const user = await requireAuthenticatedUser(req);

    if (!user.stripe_customer_id) {
      return res.status(400).json({
        error: "This account does not have a Stripe customer linked yet.",
      });
    }

    const returnUrl = getSafePortalReturnUrl();
    const portalSession = await stripeClient.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: returnUrl,
    });

    return res.json({
      ok: true,
      url: portalSession.url,
    });
  } catch (error) {
    console.error("POST /auth/create-portal-session failed:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not create a Stripe portal session.",
    });
  }
});

app.post("/tool-activity", async (req, res) => {
  try {
    const toolKey = normalizeToolActivityKey(req.body?.tool || req.body?.toolKey || "");
    const toolLabel = allowedToolActivityLabels[toolKey];
    const user = await tryGetAuthenticatedUser(req);
    const actorDisplayName = getToolActivityActorName(
      user,
      req.body?.displayName || req.body?.username || getRequestActivityEmailName(req)
    );

    if (!toolLabel) {
      return res.status(400).json({
        error: "That tool activity is not supported.",
      });
    }

    emitToolActivity(defaultChatRoom, toolKey, actorDisplayName);
    return res.json({
      ok: true,
      tool: toolKey,
      label: toolLabel,
      displayName: actorDisplayName,
    });
  } catch (error) {
    console.error("POST /tool-activity failed:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not post tool activity.",
    });
  }
});

app.get("/media", async (req, res) => {
  const rawInput = String(req.query.input || req.query.url || req.query.id || "").trim();
  const rawKind = String(req.query.kind || "").trim();
  const mediaKey = cleanText(req.query.mediaKey, 120)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "");
  const maxThumbnails = Math.max(1, Math.min(10, Number.parseInt(req.query.maxThumbnails || "10", 10) || 10));
  const normalized = normalizeRobloxMediaInput(rawInput, rawKind);

  if (!normalized.id || !/^[0-9]+$/.test(normalized.id)) {
    return res.status(400).json({
      error: "Enter a valid Roblox ID or Roblox URL.",
    });
  }

  if (!normalized.kind) {
    return res.status(400).json({
      error: "Choose a media type before fetching Roblox media.",
    });
  }

  try {
    const results = await resolveRobloxMedia(req, normalized.id, normalized.kind, {
      maxThumbnails,
    });

    if (!results.length) {
      return res.status(404).json({
        error: "No Roblox media was found for that ID yet. Try a different URL or choose a specific media type.",
      });
    }

    const shouldDownload =
      req.query.download === "1" ||
      String(req.query.format || "").trim().toLowerCase() === "file";

    if (shouldDownload) {
      const selectedItem = selectMediaItemForDownload(results, mediaKey);
      if (!selectedItem || !selectedItem.imageUrl || !isAllowedRobloxMediaUrl(selectedItem.imageUrl)) {
        return res.status(404).json({
          error: "That media file could not be downloaded.",
        });
      }

      const imageFetch = await fetchBuffer(selectedItem.imageUrl);
      const mime = detectImageMime(imageFetch.response.headers.get("content-type") || "", imageFetch.buffer);
      const extension = inferImageExtensionFromUrl(selectedItem.imageUrl, mime);
      const safeName = getSafeMediaFileName(
        selectedItem.fileName || `${selectedItem.resultKind}-${selectedItem.resultId}-${selectedItem.label}`,
        "roblox-media"
      );

      await safeIncrementDailyUsage();

      res.setHeader("Content-Type", mime || "application/octet-stream");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.${extension}"`);
      res.setHeader("X-Roblox-Media-Kind", selectedItem.resultKind || normalized.kind || "media");

      return res.send(imageFetch.buffer);
    }

    await emitToolActivityForRequest(req, "media-downloader", getRequestActivityParam(req, "displayName", displayNameLength));

    return res.json({
      ok: true,
      input: normalized.input,
      id: normalized.id,
      kind: normalized.kind,
      results,
    });
  } catch (error) {
    console.error("Media fetch failed:", error);
    return res.status(500).json({
      error: error?.message || "Could not fetch Roblox media right now.",
    });
  }
});


app.get("/template", async (req, res) => {
  const id = String(req.query.id || "").trim();

  if (!/^[0-9]+$/.test(id)) {
    return res.status(400).json({ error: "Invalid or missing asset id" });
  }

  try {
    const firstUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${id}`;
    const firstFetch = await fetchBuffer(firstUrl);
    const firstType = firstFetch.response.headers.get("content-type") || "";
    const firstImageMime = detectImageMime(firstType, firstFetch.buffer);

    if (firstImageMime) {
      await safeIncrementDailyUsage();
      await emitToolActivityForRequest(req, "template-downloader", getRequestActivityParam(req, "displayName", displayNameLength));

      res.setHeader("Content-Type", firstImageMime);
      res.setHeader("Cache-Control", "no-store");

      return res.send(firstFetch.buffer);
    }

    const bodyText = firstFetch.buffer.toString("utf8");

    if (isAuthRequiredResponse(bodyText)) {
      return res.status(403).json({
        error: "Roblox blocked access. Add ROBLOSECURITY cookie.",
      });
    }

    const templateId = extractTemplateId(bodyText);

    if (!templateId) {
      const classicHint = looksLikeClassicClothingAsset(bodyText)
        ? "Roblox returned a clothing asset, but no template image could be resolved."
        : "That ID does not appear to be a classic shirt or classic pants asset.";

      return res.status(404).json({
        error: `${classicHint} Only classic shirts and classic pants have templates.`,
      });
    }

    const secondUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${templateId}`;
    const secondFetch = await fetchBuffer(secondUrl);
    const secondType = secondFetch.response.headers.get("content-type") || "";
    const secondImageMime = detectImageMime(secondType, secondFetch.buffer);

    if (!secondFetch.response.ok || !secondImageMime) {
      return res.status(404).json({
        error: "Template image was not found",
      });
    }

    await safeIncrementDailyUsage();
    await emitToolActivityForRequest(req, "template-downloader", getRequestActivityParam(req, "displayName", displayNameLength));

    res.setHeader("Content-Type", secondImageMime);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Roblox-Template-Id", templateId);

    return res.send(secondFetch.buffer);
  } catch (error) {
    console.error("Template fetch failed:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/developer-asset", async (req, res) => {
  const inputId = extractRobloxAssetIdFromInput(req.query.id || req.query.url || req.query.input || "");
  const id = String(inputId || "").trim();

  if (!/^[0-9]+$/.test(id)) {
    return res.status(400).json({ error: "Enter a valid Roblox developer marketplace asset ID." });
  }

  try {
    const assetUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${id}`;
    const assetFetch = await fetchBuffer(assetUrl);
    const bodyText = assetFetch.buffer.toString("utf8");

    if (isAuthRequiredResponse(bodyText)) {
      return res.status(403).json({
        error: "Roblox blocked access. Add ROBLOSECURITY cookie.",
      });
    }

    if (!assetFetch.response.ok) {
      return res.status(404).json({
        error: "That Roblox asset pack could not be downloaded.",
      });
    }

    const extension = guessRobloxAssetFileExtension(
      assetFetch.response.headers.get("content-type") || "",
      assetFetch.buffer
    );

    if (extension !== "rbxm" && extension !== "rbxmx") {
      return res.status(404).json({
        error: "That ID does not appear to be a downloadable Roblox model or asset pack.",
      });
    }

    await safeIncrementDailyUsage();
    await emitToolActivityForRequest(req, "developer-asset-downloader", getRequestActivityParam(req, "displayName", displayNameLength));

    res.setHeader("Content-Type", extension === "rbxmx" ? "application/xml; charset=utf-8" : "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `attachment; filename="roblox-dev-asset-${id}.${extension}"`);
    res.setHeader("X-Roblox-Asset-Extension", extension);

    return res.send(assetFetch.buffer);
  } catch (error) {
    console.error("Developer asset fetch failed:", error);
    return res.status(500).json({
      error: "Could not download that Roblox asset pack right now.",
    });
  }
});

app.get("/ugc-texture", async (req, res) => {
  const id = String(req.query.id || "").trim();

  if (!/^[0-9]+$/.test(id)) {
    return res.status(400).json({ error: "Invalid or missing UGC asset id" });
  }

  try {
    const textureAsset = await resolveImageAssetFromRobloxAsset(id, { maxDepth: 5 });

    if (!textureAsset) {
      return res.status(404).json({
        error: "No texture image was found in that UGC asset.",
      });
    }

    await safeIncrementDailyUsage();
    await emitToolActivityForRequest(req, "texture-baker", getRequestActivityParam(req, "displayName", displayNameLength));

    res.setHeader("Content-Type", textureAsset.mime);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Roblox-Texture-Id", textureAsset.assetId);

    return res.send(textureAsset.buffer);
  } catch (error) {
    console.error("UGC texture fetch failed:", error);
    if (error?.code === 403) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({
      error: error?.message || "Could not fetch a texture for that UGC asset.",
    });
  }
});

app.post("/ugc-bake-glb", async (req, res) => {
  const assetId = String(req.body?.assetId || "").trim();
  const objText = String(req.body?.objText || "");
  const requestedFileName = String(req.body?.fileName || "").trim();

  if (!/^[0-9]+$/.test(assetId)) {
    return res.status(400).json({ error: "Invalid or missing UGC asset id" });
  }

  if (!objText.trim()) {
    return res.status(400).json({ error: "Missing OBJ model text" });
  }

  if (!/^(\s*#.*\n|\s*mtllib\s+.*\n|\s*o\s+.*\n|\s*v\s+[-0-9.eE]+\s+[-0-9.eE]+\s+[-0-9.eE]+)/m.test(objText)) {
    return res.status(400).json({ error: "Uploaded OBJ data does not look valid" });
  }

  let tempDir = null;

  try {
    const textureAsset = await resolveImageAssetFromRobloxAsset(assetId, { maxDepth: 5 });

    if (!textureAsset) {
      return res.status(404).json({
        error: "No texture image was found in that UGC asset.",
      });
    }

    const baseName = sanitizeBaseFileName(requestedFileName || `roblox-ugc-${assetId}`);
    const textureExtension = imageExtensionFromMime(textureAsset.mime);
    const textureFileName = `texture-${textureAsset.assetId}.${textureExtension}`;
    const mtlFileName = "baked-material.mtl";
    const objFileName = `${baseName}.obj`;
    const bakedObjText = buildBakedObjText(objText, mtlFileName);
    const bakedMtlText = buildBakedMaterialFile(textureFileName);

    tempDir = await mkdtemp(path.join(tmpdir(), "rblx-bake-"));

    const objPath = path.join(tempDir, objFileName);
    const mtlPath = path.join(tempDir, mtlFileName);
    const texturePath = path.join(tempDir, textureFileName);

    await writeFile(objPath, bakedObjText, "utf8");
    await writeFile(mtlPath, bakedMtlText, "utf8");
    await writeFile(texturePath, textureAsset.buffer);

    const glbBuffer = await obj2gltf(objPath, {
      binary: true,
    });

    await safeIncrementDailyUsage();
    await emitToolActivityForRequest(req, "texture-baker", cleanText(req.body?.displayName || req.body?.username || "", displayNameLength));

    res.setHeader("Content-Type", "model/gltf-binary");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.glb"`);
    res.setHeader("X-Roblox-Texture-Id", textureAsset.assetId);

    return res.send(Buffer.isBuffer(glbBuffer) ? glbBuffer : Buffer.from(glbBuffer));
  } catch (error) {
    console.error("UGC GLB bake failed:", error);
    if (error?.code === 403) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({
      error: error?.message || "Could not bake this UGC model to GLB.",
    });
  } finally {
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("GLB bake temp cleanup failed:", cleanupError.message);
      }
    }
  }
});


async function handleAnimationRequest(req, res) {
  const id = String(req.query.id || "").trim();

  if (!/^[0-9]+$/.test(id)) {
    return res.status(400).json({ error: "Invalid or missing animation asset id" });
  }

  try {
    const assetUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${id}`;
    const assetFetch = await fetchBuffer(assetUrl);
    const contentType = assetFetch.response.headers.get("content-type") || "application/octet-stream";
    const bodyText = assetFetch.buffer.toString("utf8");
    const playableAnimationId = extractPlayableAnimationId(bodyText);

    if (isAuthRequiredResponse(bodyText)) {
      return res.status(403).json({
        error: "Roblox blocked access. Add ROBLOSECURITY cookie.",
      });
    }

    if (!assetFetch.response.ok) {
      return res.status(404).json({
        error: "Animation asset was not found",
      });
    }

    const extension = guessRobloxAssetFileExtension(contentType, assetFetch.buffer);
    const fileName = `roblox-animation-${id}.${extension}`;
    const download = req.query.download === "1" || req.query.format === "file";

    if (download) {
      await safeIncrementDailyUsage();

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("X-Roblox-Asset-Id", id);

      return res.send(assetFetch.buffer);
    }

    const thumbnailUrl = await getRobloxAssetThumbnailUrl(id);
    await emitToolActivityForRequest(req, "animation-spoofer", getRequestActivityParam(req, "displayName", displayNameLength));

    return res.json({
      type: describeAnimationAsset(assetFetch.buffer),
      title: "Animation Preview Loaded",
      subtitle: "Animation asset resolved successfully. Use the download button to grab the file from this server.",
      assetId: id,
      playableAnimationId,
      fileName,
      thumbnailUrl,
      downloadUrl: buildRelativeAnimationDownloadUrl(req, id),
      catalogUrl: `https://www.roblox.com/catalog/${id}`,
      studioUri: `rbxassetid://${id}`,
    });
  } catch (error) {
    console.error("Animation fetch failed:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

app.get("/api/animation", handleAnimationRequest);
app.get("/animation", handleAnimationRequest);

async function handleAudioRequest(req, res) {
  const rawInput = String(req.query.input || req.query.url || req.query.id || "").trim();
  const id = extractRobloxAssetIdFromInput(rawInput);

  if (!/^[0-9]+$/.test(id)) {
    return res.status(400).json({ error: "Invalid or missing Roblox audio asset id" });
  }

  try {
    const assetUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${id}`;
    const assetFetch = await fetchBuffer(assetUrl);
    const contentType = assetFetch.response.headers.get("content-type") || "application/octet-stream";
    const audioMime = detectAudioMime(contentType, assetFetch.buffer);
    const bodyText = assetFetch.buffer.toString("utf8");

    if (isAuthRequiredResponse(bodyText)) {
      return res.status(403).json({
        error: "Roblox blocked access. Add ROBLOSECURITY cookie.",
      });
    }

    if (!assetFetch.response.ok || !audioMime) {
      return res.status(404).json({
        error: "Audio asset was not found or could not be downloaded.",
      });
    }

    const extension = audioExtensionFromMime(audioMime);
    const fileName = `roblox-audio-${id}.${extension}`;
    const download = req.query.download === "1" || String(req.query.format || "").trim().toLowerCase() === "file";
    const stream = req.query.stream === "1";

    if (download || stream) {
      if (download) {
        await safeIncrementDailyUsage();
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      }

      res.setHeader("Content-Type", audioMime);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Roblox-Asset-Id", id);

      return res.send(assetFetch.buffer);
    }

    const thumbnailUrl = await getRobloxAssetThumbnailUrl(id);
    await emitToolActivityForRequest(req, "audio-downloader", getRequestActivityParam(req, "displayName", displayNameLength));

    return res.json({
      ok: true,
      type: "Audio Asset",
      title: "Audio Ready",
      subtitle: "Audio asset resolved successfully. Preview it below or download the file from this server.",
      assetId: id,
      fileName,
      mime: audioMime,
      thumbnailUrl,
      streamUrl: buildRelativeAudioRouteUrl(req, id, { stream: "1" }),
      downloadUrl: buildRelativeAudioRouteUrl(req, id, { download: "1" }),
      catalogUrl: `https://www.roblox.com/library/${id}`,
      studioUri: `rbxassetid://${id}`,
    });
  } catch (error) {
    console.error("Audio fetch failed:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

app.get("/api/audio", handleAudioRequest);
app.get("/audio", handleAudioRequest);

app.get("/ugc-obj", async (req, res) => {
  const id = String(req.query.id || "").trim();

  if (!/^[0-9]+$/.test(id)) {
    return res.status(400).json({ error: "Invalid or missing UGC asset id" });
  }

  try {
    const assetUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${id}`;
    const assetFetch = await fetchBuffer(assetUrl);
    const assetText = assetFetch.buffer.toString("utf8");
    const debug = req.query.debug === "1";

    if (isAuthRequiredResponse(assetText)) {
      return res.status(403).json({
        error: "Roblox blocked access. Add ROBLOSECURITY cookie.",
      });
    }

    const directVersion = assetFetch.buffer.subarray(0, 16).toString("ascii");
    const meshAsset = directVersion.startsWith("version ")
      ? {
          assetId: id,
          buffer: assetFetch.buffer,
          response: assetFetch.response,
        }
      : await resolveMeshAssetFromRobloxAsset(id, { maxDepth: 5 });

    if (!meshAsset?.assetId || !meshAsset?.buffer) {
      if (debug) {
        return res.status(404).json({
          error: "No mesh id found",
          asset: describeAssetBuffer(assetFetch.buffer),
        });
      }

      return res.status(404).json({
        error: "No downloadable mesh was found in that UGC asset. Try the catalog item ID or the mesh asset ID.",
      });
    }

    const meshId = meshAsset.assetId;

    let meshObj;

    try {
      meshObj = await parseRobloxMeshToObj(meshAsset.buffer, id);
    } catch (error) {
      if (debug) {
        return res.status(500).json({
          error: error.message,
          asset: describeAssetBuffer(assetFetch.buffer),
          mesh: describeAssetBuffer(meshAsset.buffer),
          meshId,
        });
      }
      throw error;
    }

    await safeIncrementDailyUsage();
    await emitToolActivityForRequest(req, "ugc-downloader", getRequestActivityParam(req, "displayName", displayNameLength));

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `attachment; filename="rblxtools-ugc-${id}.obj"`);
    res.setHeader("X-Roblox-Mesh-Id", meshId);

    return res.send(meshObj);
  } catch (error) {
    console.error("UGC OBJ fetch failed:", error);
    return res.status(500).json({
      error: "Could not convert this UGC item to OBJ. Some Roblox mesh formats may not be supported yet.",
    });
  }
});

// ------------------------------
// LIVE CHAT
// ------------------------------
const rooms = new Map();
const recentMessages = new Map();
const roomSpecials = new Map();
const maxRecentMessages = 50;
const maxMessageLength = 500;
const displayNameLength = 24;
const usernameLength = 32;
const favoriteToolLength = 32;
const chatBioLength = 150;
const defaultChatRoom = "rblxtools-main";

function getRoomSpecialState(room) {
  if (!roomSpecials.has(room)) {
    roomSpecials.set(room, {
      claimDrop: null,
      claimDropTimeout: null,
      chatRain: null,
      rainTimeout: null,
    });
  }

  return roomSpecials.get(room);
}

function serializeClaimDrop(drop) {
  if (!drop) return null;

  const remainingClaims = Math.max(0, drop.maxClaims - drop.claimedBy.length);
  return {
    id: drop.id,
    title: drop.title,
    days: drop.days,
    maxClaims: drop.maxClaims,
    remainingClaims,
    expiresAt: drop.expiresAt,
    createdAt: drop.createdAt,
    createdBy: drop.createdBy
      ? {
          id: drop.createdBy.id,
          email: drop.createdBy.email,
          displayName: drop.createdBy.displayName,
          username: drop.createdBy.username,
          avatarUrl: drop.createdBy.avatarUrl,
        }
      : null,
    ended: Boolean(drop.ended),
    claimedBy: drop.claimedBy.map((entry) => ({
      userId: entry.userId,
      username: entry.username,
      displayName: entry.displayName,
      claimedAt: entry.claimedAt,
    })),
  };
}

function updateRecentClaimDropMessages(room, drop) {
  const history = recentMessages.get(room) || [];
  if (!history.length) {
    return;
  }

  const serialized = serializeClaimDrop(drop);
  const nextHistory = history.map((message) => {
    if (!message || message.specialType !== "claimDrop") {
      return message;
    }

    return {
      ...message,
      claimDrop: serialized,
    };
  });

  recentMessages.set(room, nextHistory.slice(-maxRecentMessages));
  io.to(room).emit("chat-history", recentMessages.get(room) || []);
}

function serializeChatRain(rain) {
  if (!rain) return null;

  return {
    id: rain.id,
    title: rain.title,
    days: rain.days,
    winnersCount: rain.winnersCount,
    expiresAt: rain.expiresAt,
    createdAt: rain.createdAt,
    createdBy: rain.createdBy
      ? {
          id: rain.createdBy.id,
          email: rain.createdBy.email,
          displayName: rain.createdBy.displayName,
          username: rain.createdBy.username,
          avatarUrl: rain.createdBy.avatarUrl,
        }
      : null,
    participantCount: rain.participants.length,
    participants: rain.participants.map((entry) => ({
      userId: entry.userId,
      username: entry.username,
      displayName: entry.displayName,
      joinedAt: entry.joinedAt,
    })),
    ended: Boolean(rain.ended),
    winners: (rain.winners || []).map((entry) => ({
      userId: entry.userId,
      username: entry.username,
      displayName: entry.displayName,
      expiresAt: entry.expiresAt || null,
    })),
  };
}

function emitRoomSpecials(room) {
  const state = getRoomSpecialState(room);
  io.to(room).emit("room-specials", {
    serverNow: new Date().toISOString(),
    claimDrop: serializeClaimDrop(state.claimDrop),
    chatRain: serializeChatRain(state.chatRain),
  });
}

function finalizeClaimDrop(room, reason = "expired") {
  const state = getRoomSpecialState(room);
  const drop = state.claimDrop;
  if (!drop) {
    return null;
  }

  if (state.claimDropTimeout) {
    clearTimeout(state.claimDropTimeout);
    state.claimDropTimeout = null;
  }

  const hadClaims = Array.isArray(drop.claimedBy) && drop.claimedBy.length > 0;
  drop.ended = true;
  updateRecentClaimDropMessages(room, drop);
  state.claimDrop = null;
  emitRoomSpecials(room);

  if (reason === "expired" && !hadClaims) {
    emitSpecialAnnouncement(room, "No one claimed the Plus drop before it ended.");
  }

  return drop;
}

function createChatRoomMessage(profile, payload = {}) {
  return {
    id: randomUUID(),
    text: cleanText(payload.text, maxMessageLength),
    name: profile.displayName,
    displayName: profile.displayName,
    username: profile.username,
    userId: profile.userId,
    avatarUrl: profile.avatarUrl,
    bio: cleanText(profile.bio, chatBioLength),
    isPlus: profile.isPlus,
    isGuest: profile.isGuest,
    plan: profile.plan,
    favoriteTools: profile.favoriteTools,
    replyTo: sanitizeReplyPayload(payload.replyTo),
    system: Boolean(payload.system),
    moderationChatBanned: Boolean(payload.moderationChatBanned || profile.moderationChatBanned),
    moderationTimeoutUntil: payload.moderationTimeoutUntil || profile.moderationTimeoutUntil || null,
    moderationTimeoutReason: cleanText(payload.moderationTimeoutReason || profile.moderationTimeoutReason, 280),
    specialType: payload.specialType || "",
    claimDrop: payload.claimDrop ? serializeClaimDrop(payload.claimDrop) : null,
    createdAt: new Date().toISOString(),
  };
}

function pushRoomMessage(room, message) {
  const history = recentMessages.get(room) || [];
  history.push(message);
  recentMessages.set(room, history.slice(-maxRecentMessages));
  io.to(room).emit("chat-message", message);
}

function emitSpecialAnnouncement(room, text) {
  const message = createChatRoomMessage({
    userId: "system",
    displayName: "RBLXTools Bot",
    username: "rblxtools-bot",
    avatarUrl: "",
    isPlus: false,
    isGuest: false,
    plan: "free",
    favoriteTools: [],
  }, {
    text,
    system: true,
  });

  pushRoomMessage(room, message);
}

const allowedToolActivityLabels = {
  "template-downloader": "Template Downloader",
  "developer-asset-downloader": "Developer Asset Downloader",
  "background-changer": "Background Changer",
  "ugc-downloader": "UGC Downloader",
  "media-downloader": "Media Downloader",
  "audio-downloader": "Audio Downloader",
  "texture-baker": "Texture Baker",
  "animation-spoofer": "Animation Spoofer",
};

function normalizeToolActivityKey(value) {
  return cleanText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getToolActivityActorName(user, fallbackDisplayName) {
  const fallback = cleanText(fallbackDisplayName, displayNameLength);
  if (fallback) {
    return fallback;
  }

  if (user) {
    return getActionTargetLabel(user);
  }

  return "Guest";
}

async function emitToolActivityForRequest(req, toolKey, fallbackDisplayName) {
  const user = await tryGetAuthenticatedUser(req);
  const displayNameHeader = getRequestActivityHeader(req, "x-rblx-display-name", displayNameLength);
  const usernameHeader = getRequestActivityHeader(req, "x-rblx-username", usernameLength);
  const emailNameHeader = getRequestActivityEmailName(req);
  const actorDisplayName = getToolActivityActorName(
    user,
    fallbackDisplayName || displayNameHeader || usernameHeader || emailNameHeader
  );

  return emitToolActivity(defaultChatRoom, toolKey, actorDisplayName);
}

function emitToolActivity(room, toolKey, actorDisplayName) {
  const normalizedToolKey = normalizeToolActivityKey(toolKey);
  const toolLabel = allowedToolActivityLabels[normalizedToolKey];
  if (!toolLabel) {
    return null;
  }

  const message = createChatRoomMessage({
    userId: "tool-activity",
    displayName: actorDisplayName || "Guest",
    username: actorDisplayName || "Guest",
    avatarUrl: "",
    isPlus: false,
    isGuest: false,
    plan: "free",
    favoriteTools: [],
  }, {
    text: toolLabel,
    system: false,
    specialType: "toolActivity",
  });

  pushRoomMessage(room || defaultChatRoom, message);
  return message;
}

function getActionTargetLabel(user) {
  const emailName = String(user?.email || "").split("@")[0].trim();
  return cleanText(user?.display_name || user?.displayName || user?.username || user?.name || emailName || user?.id || "Member", displayNameLength) || "Member";
}

function formatDurationLabel(totalSeconds) {
  const safeSeconds = Math.max(0, Number.parseInt(String(totalSeconds || 0), 10) || 0);
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const parts = [];

  if (days) parts.push(days + "d");
  if (hours) parts.push(hours + "h");
  if (minutes) parts.push(minutes + "m");
  if (!parts.length) parts.push("0m");

  return parts.join(" ");
}

function updateRecentMessagesForUser(room, userId, updater) {
  if (!room || !userId || typeof updater !== "function") {
    return;
  }

  const history = recentMessages.get(room) || [];
  if (!history.length) {
    return;
  }

  const nextHistory = history.map((message) => {
    if (!message || String(message.userId || "") !== String(userId)) {
      return message;
    }

    return updater({ ...message }) || message;
  });

  recentMessages.set(room, nextHistory.slice(-maxRecentMessages));
  io.to(room).emit("chat-history", recentMessages.get(room) || []);
}

async function refreshModerationStateForConnectedUser(targetUser) {
  if (!targetUser?.id || !io?.sockets?.sockets) {
    return;
  }

  const refreshes = [];
  io.sockets.sockets.forEach((socket) => {
    if (!socket?.data || String(socket.data.currentUserId || "") !== String(targetUser.id)) {
      return;
    }

    refreshes.push(
      summarizeModerationForTarget(targetUser, socket.data.currentDeviceId || "")
        .then((moderation) => {
          socket.emit("moderation-state", moderation);
        })
        .catch(() => null)
    );
  });

  await Promise.all(refreshes);
}

function emitModerationLog(room, text) {
  emitSpecialAnnouncement(room || defaultChatRoom, text);
}

function updateConnectedMemberProfile(room, userId, updater) {
  const users = rooms.get(room);
  if (!users || !userId || typeof updater !== "function") {
    return false;
  }

  let updated = false;
  users.forEach((profile, socketId) => {
    if (!profile || profile.userId !== userId) {
      return;
    }

    const nextProfile = updater({ ...profile }) || profile;
    users.set(socketId, nextProfile);
    updated = true;
  });

  if (updated) {
    io.to(room).emit("room-users", getUsers(room));
  }

  return updated;
}

function emitToUserInRoom(room, userId, eventName, payload) {
  const users = rooms.get(room);
  if (!users || !userId) {
    return 0;
  }

  let sent = 0;
  users.forEach((profile, socketId) => {
    if (!profile || profile.userId !== userId) {
      return;
    }

    const targetSocket = io.sockets.sockets.get(socketId);
    if (!targetSocket) {
      return;
    }

    targetSocket.emit(eventName, payload);
    sent += 1;
  });

  return sent;
}

async function finalizeChatRain(room, reason = "completed") {
  const state = getRoomSpecialState(room);
  const rain = state.chatRain;
  if (!rain || rain.ended) {
    return null;
  }

  rain.ended = true;
  if (state.rainTimeout) {
    clearTimeout(state.rainTimeout);
    state.rainTimeout = null;
  }

  const shuffled = [...rain.participants].sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, Math.max(1, Math.min(rain.winnersCount, shuffled.length)));
  const grantedWinners = [];

  for (const winner of winners) {
    try {
      const grantResult = await grantComplimentaryPlusToUser(winner.userId, rain.days);
      updateConnectedMemberProfile(room, winner.userId, (profile) => ({
        ...profile,
        isPlus: true,
        plan: "plus",
      }));
      emitToUserInRoom(room, winner.userId, "special-action-result", {
        type: "chat-rain",
        ok: true,
        awarded: true,
        message: "You won chat rain and received Plus for " + grantResult.days + " days.",
        days: grantResult.days,
        expiresAt: grantResult.expiresAt,
      });
      grantedWinners.push({
        userId: winner.userId,
        username: winner.username,
        displayName: winner.displayName,
        expiresAt: grantResult.expiresAt,
      });
    } catch (error) {
      console.error("Chat rain grant failed:", error.message);
    }
  }

  rain.winners = grantedWinners;
  if (grantedWinners.length) {
    grantedWinners.forEach((winner) => {
      emitSpecialAnnouncement(
        room,
        winner.displayName + " just won a Plus subscription from chat rain."
      );
    });
  } else {
    emitSpecialAnnouncement(room, "Chat rain ended with no valid winners.");
  }

  emitRoomSpecials(room);

  if (reason === "completed" || reason === "cancelled") {
    setTimeout(() => {
      const latestState = getRoomSpecialState(room);
      if (latestState.chatRain && latestState.chatRain.id === rain.id) {
        latestState.chatRain = null;
        emitRoomSpecials(room);
      }
    }, 20000);
  }

  return rain;
}

io.on("connection", (socket) => {
  let currentRoom = null;
  let memberProfile = createDefaultChatMemberProfile();
  let authenticatedUser = null;
  let currentDeviceId = "";

  socket.on("join-room", async (payload = {}) => {
    const { room = "main" } = payload || {};
    const cleanRoom = cleanText(room, 40) || "main";
    currentDeviceId = getPayloadDeviceId(payload);
    authenticatedUser = await getAuthenticatedSocketUser(payload);
    socket.data.currentDeviceId = currentDeviceId || "";
    socket.data.currentUserId = authenticatedUser?.id || "";

    if (authenticatedUser && currentDeviceId) {
      await linkDeviceToUser(authenticatedUser, currentDeviceId).catch(() => null);
    }

    const moderation = await summarizeModerationForTarget(authenticatedUser, currentDeviceId);
    socket.emit("moderation-state", moderation);
    if (moderation.websiteBlacklisted) {
      socket.emit("special-action-result", {
        type: "site-blacklist",
        ok: false,
        error: moderation.websiteBlacklistReason || "This device is blocked from using the website.",
      });
      return;
    }

    memberProfile = await buildChatMemberProfile(payload);
    currentRoom = cleanRoom;

    socket.join(currentRoom);
    addUser(currentRoom, socket.id, memberProfile);

    socket.emit("chat-history", recentMessages.get(currentRoom) || []);
    emitRoomSpecials(currentRoom);
    io.to(currentRoom).emit("room-users", getUsers(currentRoom));
  });

  socket.on("chat-message", async (payload = {}) => {
    if (!currentRoom) return;

    const moderation = await summarizeModerationForTarget(authenticatedUser, currentDeviceId);
    socket.emit("moderation-state", moderation);
    if (moderation.websiteBlacklisted) {
      socket.emit("special-action-result", {
        type: "site-blacklist",
        ok: false,
        error: moderation.websiteBlacklistReason || "This device is blocked from using the website.",
      });
      return;
    }

    if (moderation.chatBanned) {
      socket.emit("special-action-result", {
        type: "chat-ban",
        ok: false,
        error: moderation.chatBanReason || "You are banned from chat.",
      });
      return;
    }

    if (moderation.chatTimeoutUntil && new Date(moderation.chatTimeoutUntil).getTime() > Date.now()) {
      socket.emit("special-action-result", {
        type: "chat-timeout",
        ok: false,
        error: "You are timed out from chat until " + new Date(moderation.chatTimeoutUntil).toLocaleString() + ".",
        expiresAt: moderation.chatTimeoutUntil,
      });
      return;
    }

    const cleanMessage = cleanText(payload.text, maxMessageLength);
    if (!cleanMessage) return;

    memberProfile = syncChatMemberProfile(memberProfile, payload);
    addUser(currentRoom, socket.id, memberProfile);

    const message = createChatRoomMessage(memberProfile, {
      text: cleanMessage,
      replyTo: payload.replyTo,
    });

    pushRoomMessage(currentRoom, message);
  });

  socket.on("claim-plus-drop", async () => {
    if (!currentRoom) return;

    const state = getRoomSpecialState(currentRoom);
    const drop = state.claimDrop;
    if (!drop) {
      socket.emit("special-action-result", {
        type: "claim-drop",
        ok: false,
        error: "There is no active Plus drop right now.",
      });
      return;
    }

    if (new Date(drop.expiresAt).getTime() <= Date.now()) {
      finalizeClaimDrop(currentRoom, "expired");
      socket.emit("special-action-result", {
        type: "claim-drop",
        ok: false,
        error: "That Plus drop already expired.",
      });
      return;
    }

    if (!memberProfile.userId || memberProfile.isGuest) {
      socket.emit("special-action-result", {
        type: "claim-drop",
        ok: false,
        error: "You need a real account to claim Plus.",
      });
      return;
    }

    if (memberProfile.isPlus || String(memberProfile.plan || "").toLowerCase() === "plus") {
      socket.emit("special-action-result", {
        type: "claim-drop",
        ok: false,
        error: "You already own Plus.",
      });
      return;
    }

    if (drop.claimedBy.some((entry) => entry.userId === memberProfile.userId)) {
      socket.emit("special-action-result", {
        type: "claim-drop",
        ok: false,
        error: "You already claimed this Plus drop.",
      });
      return;
    }

    if (drop.claimedBy.length >= drop.maxClaims) {
      finalizeClaimDrop(currentRoom, "claimed-out");
      socket.emit("special-action-result", {
        type: "claim-drop",
        ok: false,
        error: "That Plus drop is already fully claimed.",
      });
      return;
    }

    try {
      const grantResult = await grantComplimentaryPlusToUser(memberProfile.userId, drop.days);
      memberProfile.isPlus = true;
      memberProfile.plan = "plus";
      updateConnectedMemberProfile(currentRoom, memberProfile.userId, (profile) => ({
        ...profile,
        isPlus: true,
        plan: "plus",
      }));
      drop.claimedBy.push({
        userId: memberProfile.userId,
        username: memberProfile.username,
        displayName: memberProfile.displayName,
        claimedAt: new Date().toISOString(),
      });
      updateRecentClaimDropMessages(currentRoom, drop);

      socket.emit("special-action-result", {
        type: "claim-drop",
        ok: true,
        message: "You claimed Plus for " + grantResult.days + " days.",
        awarded: true,
        days: grantResult.days,
        expiresAt: grantResult.expiresAt,
      });
      emitSpecialAnnouncement(
        currentRoom,
        memberProfile.displayName + " just claimed a Plus subscription for " + grantResult.days + " days."
      );

      if (drop.claimedBy.length >= drop.maxClaims) {
        finalizeClaimDrop(currentRoom, "claimed-out");
      } else {
        emitRoomSpecials(currentRoom);
      }
    } catch (error) {
      socket.emit("special-action-result", {
        type: "claim-drop",
        ok: false,
        error: "Could not claim Plus right now.",
      });
    }
  });

  socket.on("join-chat-rain", () => {
    if (!currentRoom) return;

    const state = getRoomSpecialState(currentRoom);
    const rain = state.chatRain;
    if (!rain || rain.ended) {
      socket.emit("special-action-result", {
        type: "chat-rain",
        ok: false,
        error: "There is no active chat rain right now.",
      });
      return;
    }

    if (new Date(rain.expiresAt).getTime() <= Date.now()) {
      finalizeChatRain(currentRoom, "completed").catch((error) => {
        console.error("Finalize expired chat rain failed:", error.message);
      });
      socket.emit("special-action-result", {
        type: "chat-rain",
        ok: false,
        error: "That chat rain already ended.",
      });
      return;
    }

    if (!memberProfile.userId || memberProfile.isGuest) {
      socket.emit("special-action-result", {
        type: "chat-rain",
        ok: false,
        error: "You need a real account to join chat rain.",
      });
      return;
    }

    if (memberProfile.isPlus || String(memberProfile.plan || "").toLowerCase() === "plus") {
      socket.emit("special-action-result", {
        type: "chat-rain",
        ok: false,
        error: "You already own Plus.",
      });
      return;
    }

    if (rain.participants.some((entry) => entry.userId === memberProfile.userId)) {
      socket.emit("special-action-result", {
        type: "chat-rain",
        ok: false,
        error: "You already joined this chat rain.",
      });
      return;
    }

    rain.participants.push({
      userId: memberProfile.userId,
      username: memberProfile.username,
      displayName: memberProfile.displayName,
      joinedAt: new Date().toISOString(),
    });
    emitSpecialAnnouncement(currentRoom, memberProfile.displayName + " has joined chat rain.");

    socket.emit("special-action-result", {
      type: "chat-rain",
      ok: true,
      message: "You joined the chat rain.",
      joined: true,
      participantCount: rain.participants.length,
    });

    emitRoomSpecials(currentRoom);
  });

  socket.on("disconnect", () => {
    if (!currentRoom) return;

    removeUser(currentRoom, socket.id);
    io.to(currentRoom).emit("room-users", getUsers(currentRoom));
  });
});

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function createDefaultChatMemberProfile() {
  return {
    userId: "",
    displayName: "Guest",
    username: "Guest",
    avatarUrl: "",
    bio: "",
    isPlus: false,
    isGuest: true,
    plan: "guest",
    favoriteTools: [],
  };
}

function sanitizeFavoriteTools(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanText(item, favoriteToolLength))
    .filter(Boolean)
    .slice(0, 5);
}

function sanitizeChatMemberProfile(payload) {
  const displayName = cleanText(
    payload.displayName || payload.name || payload.username || "Guest",
    displayNameLength
  ) || "Guest";
  const username = cleanText(payload.username || displayName, usernameLength) || displayName;
  const userId = cleanText(payload.userId || username, 80) || username;
  const avatarUrl = cleanText(payload.avatarUrl, 500);
  const bio = cleanText(payload.bio, chatBioLength);
  const isPlus = Boolean(payload.isPlus);
  const isGuest = Boolean(payload.isGuest) || /^guest-/i.test(displayName);
  const favoriteTools = sanitizeFavoriteTools(payload.favoriteTools);
  const planValue = cleanText(payload.plan, 24).toLowerCase();
  const plan = isGuest ? "guest" : (planValue || (isPlus ? "plus" : "free"));

  return {
    userId,
    displayName,
    username,
    avatarUrl,
    bio,
    isPlus,
    isGuest,
    plan,
    favoriteTools,
  };
}

function sanitizeReplyPayload(replyTo) {
  if (!replyTo || typeof replyTo !== "object") {
    return null;
  }

  const id = cleanText(replyTo.id, 80);
  const displayName = cleanText(replyTo.displayName || replyTo.name, displayNameLength);
  const username = cleanText(replyTo.username || replyTo.displayName || replyTo.name, usernameLength);
  const text = cleanText(replyTo.text, 120);

  if (!id || !displayName || !username || !text) {
    return null;
  }

  return { id, displayName, username, text };
}

function addUser(room, socketId, profile) {
  if (!rooms.has(room)) rooms.set(room, new Map());
  rooms.get(room).set(socketId, profile);
}

function removeUser(room, socketId) {
  const users = rooms.get(room);
  if (!users) return;

  users.delete(socketId);
  if (users.size === 0) rooms.delete(room);
}

function getUsers(room) {
  return Array.from(rooms.get(room)?.values() || []).map((profile) => ({
    displayName: profile.displayName,
    username: profile.username,
    userId: profile.userId,
    avatarUrl: profile.avatarUrl,
    bio: cleanText(profile.bio, chatBioLength),
    plan: profile.plan,
    isPlus: profile.isPlus,
    isGuest: profile.isGuest,
  }));
}

const STATIC_ROOT = __dirname;


app.use((req, res, next) => {
  const requestedPath = String(req.path || "");
  if (
    req.method === "GET" &&
    requestedPath.endsWith(".html")
  ) {
    const cleanPath = requestedPath === "/index.html"
      ? "/"
      : requestedPath.replace(/\.html$/i, "");
    const queryIndex = req.originalUrl.indexOf("?");
    const querySuffix = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
    return res.redirect(301, cleanPath + querySuffix);
  }

  return next();
});

app.use(express.static(STATIC_ROOT, { extensions: ["html"] }));

app.get("/", (_req, res) => {
  res.sendFile(path.join(STATIC_ROOT, "index.html"));
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


