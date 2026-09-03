require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { createServer } = require("http");
const {
  randomUUID,
  randomBytes,
  createHmac,
  timingSafeEqual,
  scryptSync,
} = require("crypto");
const { mkdtemp, writeFile, rm } = require("fs/promises");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { tmpdir } = require("os");
const { Server } = require("socket.io");
const obj2gltf = require("obj2gltf");
let draco3d = null;
let stripeClient = null;
let openaiClient = null;
let sharpLib = null;
let openaiUploadHelpers = null;

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { installSiteOpsFeature } = require("./site-ops-feature");
const {
  createDiscordLinkCode,
  getDiscordLinkByAppUserId,
  getDiscordLinkByUserId,
  unlinkDiscordAccount,
} = require("./discord-tools-links");
const {
  claimDiscordServer,
  consumeDiscordServerUse,
  createServerClaimCode,
  getAccountOverviewPreference,
  getBotDashboard,
  getDiscordServerAccess,
  getDiscordServerCommandPolicy,
  getDiscordServerUsageSummary,
  getUnlimitedSubscription,
  getPurchasedUses,
  grantComplimentaryUnlimited,
  grantComplimentaryUses,
  grantPurchasedUses,
  isUnlimitedActive,
  setAccountOverviewPreference,
  setUnlimitedSubscription,
  updateServerSettings,
  updateServerControls,
  syncDiscordServerChannels,
  setDiscordServerUsageCounter,
  resetMemberDailyUse,
  unclaimServer,
} = require("./discord-bot-entitlements");

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);
const AUTH_COOKIE_NAME = "rblxtools_auth_token";
const ROBLOSECURITY = process.env.ROBLOSECURITY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const AUTH_USERS_TABLE = process.env.AUTH_USERS_TABLE || "member_accounts";
const AI_TOKEN_PURCHASES_TABLE = process.env.AI_TOKEN_PURCHASES_TABLE || "ai_token_purchases";
// LiteSpeed serves the site directory read-only. Keep small application state outside it.
const RBLXTOOLS_STATE_DIR = String(process.env.RBLXTOOLS_STATE_DIR || path.join(tmpdir(), "rblxtools-state")).trim();
const MEMBER_REWARDS_PATH = path.join(RBLXTOOLS_STATE_DIR, "member-rewards.json");
const REFERRAL_PROGRAM_PATH = path.join(RBLXTOOLS_STATE_DIR, "referral-program.json");
const REFERRAL_COMMISSION_RATE = 0.05;
const REFERRAL_PENDING_MS = 14 * 24 * 60 * 60 * 1000;
const REFERRAL_MINIMUM_PAYOUT_CENTS = 1000;
const AI_THUMBNAIL_HISTORY_TABLE = process.env.AI_THUMBNAIL_HISTORY_TABLE || "ai_thumbnail_history";
const AI_THUMBNAIL_HISTORY_PATH = path.join(__dirname, "ai-thumbnail-history.json");
const AI_THUMBNAIL_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MODERATION_ACTIONS_TABLE = process.env.MODERATION_ACTIONS_TABLE || "member_moderation_actions";
const DEVICE_LINKS_TABLE = process.env.DEVICE_LINKS_TABLE || "member_device_links";
const AUTH_JWT_SECRET = String(process.env.AUTH_JWT_SECRET || "");
const STRIPE_SECRET_KEY = String(process.env.STRIPE_SECRET_KEY || "");
const STRIPE_PRICE_ID = String(process.env.STRIPE_PRICE_ID || "");
const STRIPE_PRO_PRODUCT_ID = String(process.env.STRIPE_PRO_PRODUCT_ID || "prod_V9rw4G9vIzpnZb").trim();
const STRIPE_DISCORD_BOT_UNLIMITED_MONTHLY_PRICE_ID = String(process.env.STRIPE_DISCORD_BOT_UNLIMITED_MONTHLY_PRICE_ID || "price_1UB5KVGrZOEMBkuuQa6uAinu").trim();
const STRIPE_DISCORD_BOT_UNLIMITED_ANNUAL_PRICE_ID = "price_1UB5XiGrZOEMBkuuO9ptA9mB";
const STRIPE_DISCORD_BOT_UNLIMITED_PRICE_IDS = new Set([STRIPE_DISCORD_BOT_UNLIMITED_MONTHLY_PRICE_ID, STRIPE_DISCORD_BOT_UNLIMITED_ANNUAL_PRICE_ID].filter(Boolean));
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
const OWNER_STRIPE_PIN = "0212";
const DISCORD_SUPPORT_WEBHOOK_URL = String(process.env.DISCORD_SUPPORT_WEBHOOK_URL || process.env.SUPPORT_DISCORD_WEBHOOK_URL || "").trim();
const SUPPORT_BOT_ENDPOINT = String(process.env.SUPPORT_BOT_ENDPOINT || "").trim();
const SUPPORT_BOT_SECRET = String(process.env.SUPPORT_BOT_SECRET || "").trim();
const DISCORD_TOOLS_SERVICE_SECRET = String(process.env.DISCORD_TOOLS_SERVICE_SECRET || "").trim();
const DISCORD_TOOLS_BOT_CLIENT_ID = String(process.env.RBLXTOOLS_TOOLS_DISCORD_CLIENT_ID || "").trim();
const SUPPORT_STAFF_MENTION = String(process.env.SUPPORT_STAFF_MENTION || "").trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
// Keep the Meshy credential exclusively on the server. Never send it to a browser.
const MESHY_API_KEY = String(process.env.MESHY_API_KEY || "").trim();
const MESHY_API_BASE_URL = "https://api.meshy.ai/openapi";
const UGC_SOURCE_IMAGE_TTL_MS = 60 * 60 * 1000;
const ugcSourceImages = new Map();
// Preview tasks are short-lived. Keep the paid generation settings here so a
// refinement cannot be requested for a different account or without textures.
const ugcGenerationCharges = new Map();
const MAX_SUPPORT_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_CHAT_TIMEOUT_SECONDS = 3650 * 24 * 60 * 60;
const AI_CLOTHING_OUTPUT_WIDTH = 585;
const AI_CLOTHING_OUTPUT_HEIGHT = 559;
const AI_CLOTHING_MODEL = "gpt-image-2";
const AI_CLOTHING_GENERATION_SIZE = "832x800";
const AI_THUMBNAIL_OUTPUT_WIDTH = 1280;
const AI_THUMBNAIL_OUTPUT_HEIGHT = 720;
const AI_THUMBNAIL_GENERATION_SIZE = "1536x1024";
const MAX_AI_THUMBNAIL_REFERENCE_IMAGES = 3;
const MAX_AI_THUMBNAIL_REFERENCE_BYTES = 2 * 1024 * 1024;
const MAX_AI_CLOTHING_REFERENCE_IMAGES = 3;
const AI_TOKEN_DEFAULT_BALANCE = 0;
const AI_THUMBNAIL_TOKEN_COST = 1;
const AI_THUMBNAIL_FREE_REFERENCES = 3;
const AI_THUMBNAIL_PRO_REFERENCES = 6;
const PRO_MONTHLY_AI_TOKEN_CREDITS = 20;
const PRO_ANNUAL_AI_TOKEN_CREDITS = 240;
const AI_TOKEN_PACKAGES = [
  { key: "20", tokens: 20, priceCents: 379, currency: "usd", productId: String(process.env.STRIPE_AI_TOKENS_PRODUCT_20 || "prod_V9siwVVdZ6u716").trim(), priceId: String(process.env.STRIPE_AI_TOKENS_PRICE_20 || "price_1U9YwwGrZOEMBkuuGypX9VtO").trim() },
  { key: "45", tokens: 45, priceCents: 599, currency: "usd", productId: String(process.env.STRIPE_AI_TOKENS_PRODUCT_45 || "prod_V9Y889mVAR74WR").trim() },
  { key: "130", tokens: 130, priceCents: 1449, currency: "usd", productId: String(process.env.STRIPE_AI_TOKENS_PRODUCT_130 || "prod_V9YGsNXs9IXcrX").trim() },
  { key: "245", tokens: 245, priceCents: 2499, currency: "usd", productId: String(process.env.STRIPE_AI_TOKENS_PRODUCT_245 || "prod_V9YK5x1FI50wj2").trim() },
  { key: "500", tokens: 500, priceCents: 4799, currency: "usd", productId: String(process.env.STRIPE_AI_TOKENS_PRODUCT_500 || "prod_V9shFwrlWrEAqI").trim(), priceId: String(process.env.STRIPE_AI_TOKENS_PRICE_500 || "price_1U9YvtGrZOEMBkuuETfZlZaG").trim() },
];
const AI_SLEEVE_REFERENCE_PATHS = {
  long: path.join(__dirname, "assets", "ai-rig", "Long Sleeve Reference.png"),
  short: path.join(__dirname, "assets", "ai-rig", "Short Sleeve Reference.png"),
  sleeveless: path.join(__dirname, "assets", "ai-rig", "Sleeveless Reference.png"),
};
const AI_PANTS_REFERENCE_PATHS = {
  "30": path.join(__dirname, "assets", "ai-rig", "30%.png"),
  "80": path.join(__dirname, "assets", "ai-rig", "80%.png"),
  "100": path.join(__dirname, "assets", "ai-rig", "100%.png"),
};
const AUTH_JWT_TTL_DAYS = Math.max(
  1,
  Number.parseInt(process.env.AUTH_JWT_TTL_DAYS || "30", 10) || 30
);
const OPTIONAL_AUTH_USER_COLUMNS = new Set([
  "plus_active",
  "membership_source",
  "plus_days_total",
  "plus_expires_at",
  "plus_current_period_start_at",
  "plus_current_period_end_at",
  "stripe_days_total",
  "stripe_current_period_start_at",
  "stripe_current_period_end_at",
]);
const missingOptionalAuthUserColumns = new Set();
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

function getOpenAIClient() {
  if (openaiClient) return openaiClient;
  const OpenAI = require("openai");
  openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  return openaiClient;
}

function assertMeshyConfigured() {
  if (!MESHY_API_KEY) {
    const error = new Error("AI UGC Studio is not configured. Add MESHY_API_KEY to the server environment.");
    error.statusCode = 503;
    throw error;
  }
}

function cleanMeshyTaskId(value) {
  const taskId = String(value || "").trim();
  if (!/^[a-zA-Z0-9-]{8,120}$/.test(taskId)) {
    const error = new Error("That Meshy task ID is not valid.");
    error.statusCode = 400;
    throw error;
  }
  return taskId;
}

function getUGCGenerationTokenCost({ assetType, inputMode, withTexture }) {
  // RBLXTools uses a 3x multiplier over the provider credit cost.
  const isGameAsset = assetType === "game";
  const isImageInput = inputMode === "image";
  const baseCost = isImageInput ? 15 : isGameAsset ? 30 : 15;
  return baseCost + (withTexture ? 30 : 0);
}

async function restoreAITokens(userId, amount) {
  const latestUser = await getAuthUserById(userId).catch(() => null);
  return updateAuthUserFields(userId, {
    ai_token_balance: getAITokenBalance(latestUser) + Math.max(0, Number.parseInt(amount, 10) || 0),
  });
}

async function requestMeshy(pathname, options = {}) {
  assertMeshyConfigured();
  const response = await fetch(MESHY_API_BASE_URL + pathname, {
    method: options.method || "GET",
    headers: {
      Authorization: "Bearer " + MESHY_API_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      (payload && (payload.message || payload.error?.message || payload.error)) ||
      "The 3D generation service could not process this request."
    );
    error.statusCode = response.status === 401 || response.status === 403 ? 502 : response.status;
    throw error;
  }
  return payload || {};
}

async function prepareRobloxGLBDownload(glbBuffer, maxTriangles, maxTextureSize) {
  const { NodeIO } = require("@gltf-transform/core");
  const io = new NodeIO();
  const document = await io.readBinary(glbBuffer);
  let largestMeshTriangles = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    let meshTriangles = 0;
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const positions = primitive.getAttribute("POSITION");
      const pointCount = indices ? indices.getCount() : positions ? positions.getCount() : 0;
      meshTriangles += Math.floor(pointCount / 3);
    }
    largestMeshTriangles = Math.max(largestMeshTriangles, meshTriangles);
  }
  if (largestMeshTriangles > maxTriangles) {
    const error = new Error(`This model has ${largestMeshTriangles.toLocaleString()} triangles in one mesh, above the Roblox ${maxTriangles.toLocaleString()} triangle limit. Generate another version before downloading.`);
    error.statusCode = 422;
    throw error;
  }
  const sharp = getSharp();
  for (const texture of document.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const metadata = await sharp(image).metadata();
    if ((metadata.width || 0) <= maxTextureSize && (metadata.height || 0) <= maxTextureSize) continue;
    const resized = await sharp(image)
      .resize({ width: maxTextureSize, height: maxTextureSize, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    texture.setImage(resized).setMimeType("image/png");
  }
  return { buffer: Buffer.from(await io.writeBinary(document)), largestMeshTriangles };
}

function storeUGCSourceImage(dataUrl) {
  const match = String(dataUrl || "").trim().match(/^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i);
  if (!match) {
    const error = new Error("Upload a PNG, JPG, or WebP image.");
    error.statusCode = 400;
    throw error;
  }
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    const error = new Error("The UGC reference image must be 5 MB or smaller.");
    error.statusCode = 400;
    throw error;
  }
  const id = randomUUID();
  const expiresAt = Date.now() + UGC_SOURCE_IMAGE_TTL_MS;
  ugcSourceImages.set(id, { buffer, type: match[1].toLowerCase(), expiresAt });
  for (const [key, entry] of ugcSourceImages) {
    if (!entry || Number(entry.expiresAt || 0) <= Date.now()) ugcSourceImages.delete(key);
  }
  return `${APP_BASE_URL}/ai/ugc/source/${encodeURIComponent(id)}`;
}

function getOpenAIUploadHelpers() {
  if (openaiUploadHelpers) return openaiUploadHelpers;
  openaiUploadHelpers = require("openai/uploads");
  return openaiUploadHelpers;
}

function getSharp() {
  if (sharpLib) return sharpLib;
  sharpLib = require("sharp");
  return sharpLib;
}

function isAIClothingConfigured() {
  return Boolean(OPENAI_API_KEY);
}

function assertAIClothingConfigured() {
  if (!isAIClothingConfigured()) {
    const error = new Error("AI clothing generation is not configured yet.");
    error.statusCode = 500;
    throw error;
  }
}

function normalizeAIClothingGarmentType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "pants" ||
    normalized === "full_outfit" ||
    normalized === "matching_shirts" ||
    normalized === "matching_pants" ||
    normalized === "matching_outfits"
  ) {
    return normalized;
  }
  return "shirt";
}

function normalizeAIClothingGender(value) {
  return String(value || "").trim().toLowerCase() === "female" ? "female" : "male";
}

function getAIBaseTemplateType(garmentType) {
  return normalizeAIClothingGarmentType(garmentType) === "pants" ? "pants" : "shirt";
}

function cleanAIClothingText(value, maxLength = 1200) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

async function buildAIClothingReferenceMask({ blankTemplateBuffer, referenceTemplateBuffer }) {
  const sharp = getSharp();
  const resizeOptions = {
    fit: "fill",
    kernel: "nearest",
  };
  const [blank, reference] = await Promise.all([
    sharp(blankTemplateBuffer)
      .resize(AI_CLOTHING_OUTPUT_WIDTH, AI_CLOTHING_OUTPUT_HEIGHT, resizeOptions)
      .ensureAlpha()
      .raw()
      .toBuffer(),
    sharp(referenceTemplateBuffer)
      .resize(AI_CLOTHING_OUTPUT_WIDTH, AI_CLOTHING_OUTPUT_HEIGHT, resizeOptions)
      .ensureAlpha()
      .raw()
      .toBuffer(),
  ]);
  const alpha = Buffer.alloc(AI_CLOTHING_OUTPUT_WIDTH * AI_CLOTHING_OUTPUT_HEIGHT);

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    const offset = pixel * 4;
    const blankIsPanel = blank[offset] > 245 && blank[offset + 1] > 245 && blank[offset + 2] > 245;
    const referenceIsPink = reference[offset] > 220 && reference[offset + 1] < 120 && reference[offset + 2] > 180;
    alpha[pixel] = blankIsPanel && !referenceIsPink ? 255 : 0;
  }

  return alpha;
}

async function buildAIClothingCleanGuide({ referenceTemplateBuffer, mask }) {
  const width = AI_CLOTHING_OUTPUT_WIDTH;
  const height = AI_CLOTHING_OUTPUT_HEIGHT;
  const total = width * height;
  const referencePixels = await getSharp()(referenceTemplateBuffer)
    .resize(width, height, { fit: "fill", kernel: "nearest" })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const guidePixels = Buffer.alloc(total * 4);
  const visited = new Uint8Array(total);

  const neighbours = (pixel, visit) => {
    const x = pixel % width;
    if (x > 0) visit(pixel - 1);
    if (x < width - 1) visit(pixel + 1);
    if (pixel >= width) visit(pixel - width);
    if (pixel < total - width) visit(pixel + width);
  };

  for (let start = 0; start < total; start += 1) {
    if (mask[start] !== 255 || visited[start]) continue;
    const component = [];
    const queue = [start];
    const colors = new Map();
    visited[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const pixel = queue[cursor];
      const offset = pixel * 4;
      component.push(pixel);
      const red = referencePixels[offset];
      const green = referencePixels[offset + 1];
      const blue = referencePixels[offset + 2];
      const isWhiteGuideMark = red > 235 && green > 235 && blue > 235;
      const isDarkGuideMark = red < 45 && green < 45 && blue < 45;
      if (!isWhiteGuideMark && !isDarkGuideMark) {
        const key = `${red},${green},${blue}`;
        colors.set(key, (colors.get(key) || 0) + 1);
      }
      neighbours(pixel, (next) => {
        if (mask[next] !== 255 || visited[next]) return;
        visited[next] = 1;
        queue.push(next);
      });
    }
    let selectedColor = "70,150,220";
    let selectedCount = -1;
    colors.forEach((count, color) => {
      if (count > selectedCount) {
        selectedColor = color;
        selectedCount = count;
      }
    });
    const [red, green, blue] = selectedColor.split(",").map(Number);
    component.forEach((pixel) => {
      const offset = pixel * 4;
      guidePixels[offset] = red;
      guidePixels[offset + 1] = green;
      guidePixels[offset + 2] = blue;
      guidePixels[offset + 3] = 255;
    });
  }

  return getSharp()(guidePixels, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();
}

function removeAIClothingWhiteArtifacts(pixels, mask, preserveWhite) {
  if (preserveWhite) return pixels;
  const width = AI_CLOTHING_OUTPUT_WIDTH;
  const height = AI_CLOTHING_OUTPUT_HEIGHT;
  const total = width * height;
  const white = new Uint8Array(total);
  const repair = new Uint8Array(total);
  const visited = new Uint8Array(total);
  const neighbours = (pixel, visit) => {
    const x = pixel % width;
    if (x > 0) visit(pixel - 1);
    if (x < width - 1) visit(pixel + 1);
    if (pixel >= width) visit(pixel - width);
    if (pixel < total - width) visit(pixel + width);
  };

  for (let pixel = 0; pixel < total; pixel += 1) {
    const offset = pixel * 4;
    white[pixel] = mask[pixel] === 255
      && pixels[offset + 3] > 8
      && pixels[offset] > 238
      && pixels[offset + 1] > 238
      && pixels[offset + 2] > 238 ? 1 : 0;
  }

  for (let start = 0; start < total; start += 1) {
    if (!white[start] || visited[start]) continue;
    const component = [];
    const queue = [start];
    visited[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const pixel = queue[cursor];
      component.push(pixel);
      neighbours(pixel, (next) => {
        if (!white[next] || visited[next]) return;
        visited[next] = 1;
        queue.push(next);
      });
    }
    if (component.length >= 48) component.forEach((pixel) => { repair[pixel] = 1; });
  }

  if (!repair.some(Boolean)) return pixels;
  const source = new Int32Array(total);
  source.fill(-1);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  let fallback = -1;
  for (let pixel = 0; pixel < total; pixel += 1) {
    if (mask[pixel] !== 255 || white[pixel]) continue;
    source[pixel] = pixel;
    queue[tail++] = pixel;
    if (fallback < 0) fallback = pixel;
  }
  while (head < tail) {
    const pixel = queue[head++];
    neighbours(pixel, (next) => {
      if (mask[next] !== 255 || source[next] >= 0) return;
      source[next] = source[pixel];
      queue[tail++] = next;
    });
  }
  for (let pixel = 0; pixel < total; pixel += 1) {
    if (!repair[pixel]) continue;
    const nearest = source[pixel] >= 0 ? source[pixel] : fallback;
    if (nearest < 0) continue;
    const target = pixel * 4;
    const origin = nearest * 4;
    pixels[target] = pixels[origin];
    pixels[target + 1] = pixels[origin + 1];
    pixels[target + 2] = pixels[origin + 2];
  }
  return pixels;
}

function assertAIThumbnailConfigured() {
  if (!OPENAI_API_KEY) {
    const error = new Error("AI thumbnail generation is not configured yet.");
    error.statusCode = 500;
    throw error;
  }
}

function cleanAIThumbnailText(value, maxLength = 240) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function parseAIReferenceImages(rawReferences, maxReferences = AI_THUMBNAIL_FREE_REFERENCES, namePrefix = "reference") {
  if (!Array.isArray(rawReferences)) return [];
  if (rawReferences.length > maxReferences) {
    const error = new Error(`Use up to ${maxReferences} reference images.`);
    error.statusCode = 400;
    throw error;
  }
  return rawReferences.map((rawReference, index) => {
    const dataUrl = String(rawReference || "").trim();
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i);
    if (!match) {
      const error = new Error(`Reference image ${index + 1} must be a PNG, JPG, or WebP image.`);
      error.statusCode = 400;
      throw error;
    }
    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length || buffer.length > MAX_AI_THUMBNAIL_REFERENCE_BYTES) {
      const error = new Error(`Each reference image must be ${MAX_AI_THUMBNAIL_REFERENCE_BYTES / (1024 * 1024)} MB or smaller.`);
      error.statusCode = 400;
      throw error;
    }
    const extension = match[1].toLowerCase() === "image/png" ? "png" : match[1].toLowerCase() === "image/webp" ? "webp" : "jpg";
    return { buffer, type: match[1].toLowerCase(), name: `${namePrefix}-${index + 1}.${extension}` };
  });
}

async function generateAIThumbnail(payload) {
  assertAIThumbnailConfigured();
  const prompt = cleanAIThumbnailText(payload.prompt, 2000);
  if (!prompt) {
    const error = new Error("Tell us what you want in the thumbnail first.");
    error.statusCode = 400;
    throw error;
  }
  const isPro = Boolean(payload.isPro);
  const references = parseAIReferenceImages(
    payload.references,
    isPro ? AI_THUMBNAIL_PRO_REFERENCES : AI_THUMBNAIL_FREE_REFERENCES,
    "thumbnail-reference"
  );
  const aspectRatio = isPro ? String(payload.aspectRatio || "16:9") : "16:9";
  const outputQuality = isPro ? String(payload.outputQuality || "standard") : "standard";
  const aspectConfig = {
    "16:9": { generationSize: "1536x1024", width: outputQuality === "1080p" ? 1920 : 1280, height: outputQuality === "1080p" ? 1080 : 720 },
    "1:1": { generationSize: "1024x1024", width: outputQuality === "1080p" ? 1080 : 1024, height: outputQuality === "1080p" ? 1080 : 1024 },
    "9:16": { generationSize: "1024x1536", width: outputQuality === "1080p" ? 1080 : 720, height: outputQuality === "1080p" ? 1920 : 1280 },
    "4:5": { generationSize: "1024x1536", width: outputQuality === "1080p" ? 1080 : 864, height: outputQuality === "1080p" ? 1350 : 1080 },
  }[aspectRatio] || null;
  if (!aspectConfig) {
    const error = new Error("Choose a supported thumbnail aspect ratio.");
    error.statusCode = 400;
    throw error;
  }
  let generation;
  if (references.length) {
    const { toFile } = getOpenAIUploadHelpers();
    const uploads = await Promise.all(references.map((reference) => toFile(
      Readable.from([reference.buffer]),
      reference.name,
      { type: reference.type }
    )));
    generation = await getOpenAIClient().images.edit({
      model: AI_CLOTHING_MODEL,
      image: uploads,
      prompt,
      size: aspectConfig.generationSize,
    });
  } else {
    generation = await getOpenAIClient().images.generate({
      model: AI_CLOTHING_MODEL,
      prompt,
      size: aspectConfig.generationSize,
    });
  }
  const generatedBase64 = generation?.data?.[0]?.b64_json || "";
  if (!generatedBase64) {
    const error = new Error("OpenAI did not return a thumbnail image.");
    error.statusCode = 502;
    throw error;
  }
  const sharp = getSharp();
  const outputBuffer = await sharp(Buffer.from(generatedBase64, "base64"))
    .resize(aspectConfig.width, aspectConfig.height, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
  return {
    outputBuffer,
    outputBase64: outputBuffer.toString("base64"),
    outputMime: "image/png",
    outputWidth: aspectConfig.width,
    outputHeight: aspectConfig.height,
    model: AI_CLOTHING_MODEL,
    promptPreview: prompt,
  };
}

function buildAIThumbnailHistoryRecord(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: String(row.id || ""),
    prompt: String(row.prompt || ""),
    references: Array.isArray(row.reference_images) ? row.reference_images : [],
    imageDataUrl: String(row.image_data_url || ""),
    downloadFileName: String(row.download_filename || "rblxtools-ai-thumbnail.png"),
    feedback: ["like", "dislike"].includes(String(row.feedback || "")) ? String(row.feedback) : "",
    createdAt: row.created_at || null,
  };
}

function pruneAIThumbnailHistory(items, now = Date.now()) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => {
      const timestamp = Date.parse(String(item?.createdAt || item?.created_at || ""));
      return item?.id && Number.isFinite(timestamp) && timestamp >= now - AI_THUMBNAIL_HISTORY_RETENTION_MS;
    })
    .sort((left, right) => Date.parse(String(right.createdAt || 0)) - Date.parse(String(left.createdAt || 0)))
    .slice(0, 50);
}

function readPersistentAIThumbnailHistory() {
  try {
    if (!fs.existsSync(AI_THUMBNAIL_HISTORY_PATH)) return { users: {} };
    const payload = JSON.parse(fs.readFileSync(AI_THUMBNAIL_HISTORY_PATH, "utf8"));
    const users = payload && typeof payload.users === "object" && payload.users ? payload.users : {};
    let changed = false;
    Object.keys(users).forEach((userId) => {
      const pruned = pruneAIThumbnailHistory(users[userId]);
      if (pruned.length !== (Array.isArray(users[userId]) ? users[userId].length : 0)) changed = true;
      users[userId] = pruned;
    });
    const result = { users };
    if (changed) fs.writeFileSync(AI_THUMBNAIL_HISTORY_PATH, JSON.stringify(result) + "\n", "utf8");
    return result;
  } catch (error) {
    console.error("[AI THUMBNAIL HISTORY] Could not read local backup:", error.message);
    return { users: {} };
  }
}

function writePersistentAIThumbnailHistory(payload) {
  try {
    fs.writeFileSync(AI_THUMBNAIL_HISTORY_PATH, JSON.stringify(payload) + "\n", "utf8");
  } catch (error) {
    console.error("[AI THUMBNAIL HISTORY] Could not write local backup:", error.message);
  }
}

function getPersistentAIThumbnailHistory(userId) {
  const payload = readPersistentAIThumbnailHistory();
  return pruneAIThumbnailHistory(payload.users[String(userId)] || []);
}

function savePersistentAIThumbnailHistory(userId, item) {
  if (!item?.id) return;
  const payload = readPersistentAIThumbnailHistory();
  const key = String(userId);
  const previous = Array.isArray(payload.users[key]) ? payload.users[key] : [];
  payload.users[key] = pruneAIThumbnailHistory([item, ...previous.filter((entry) => String(entry?.id) !== String(item.id))]);
  writePersistentAIThumbnailHistory(payload);
}

function updatePersistentAIThumbnailHistory(userId, historyId, updates) {
  const payload = readPersistentAIThumbnailHistory();
  const key = String(userId);
  const previous = Array.isArray(payload.users[key]) ? payload.users[key] : [];
  payload.users[key] = previous.map((item) => String(item?.id) === String(historyId) ? { ...item, ...updates } : item);
  writePersistentAIThumbnailHistory(payload);
}

function deletePersistentAIThumbnailHistory(userId, historyId) {
  const payload = readPersistentAIThumbnailHistory();
  const key = String(userId);
  payload.users[key] = (Array.isArray(payload.users[key]) ? payload.users[key] : [])
    .filter((item) => String(item?.id) !== String(historyId));
  writePersistentAIThumbnailHistory(payload);
}

async function saveAIThumbnailHistory(userId, payload) {
  const fallback = {
    id: `local-${randomUUID()}`,
    prompt: cleanAIThumbnailText(payload.prompt, 2000),
    references: Array.isArray(payload.references) ? payload.references : [],
    imageDataUrl: String(payload.imageDataUrl || ""),
    downloadFileName: cleanAIThumbnailText(payload.downloadFileName, 180) || "rblxtools-ai-thumbnail.png",
    feedback: "",
    createdAt: new Date().toISOString(),
  };
  let item = fallback;
  try {
    const rows = await supabaseRequest(buildTablePath(AI_THUMBNAIL_HISTORY_TABLE), {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        prompt: fallback.prompt,
        reference_images: fallback.references,
        image_data_url: fallback.imageDataUrl,
        download_filename: fallback.downloadFileName,
      }),
    });
    const saved = Array.isArray(rows) ? buildAIThumbnailHistoryRecord(rows[0]) : null;
    if (saved) item = saved;
  } catch (error) {
    console.warn("Could not save AI thumbnail history to Supabase; using local backup:", error.message);
  }
  savePersistentAIThumbnailHistory(userId, item);
  return item;
}

function buildAIClothingPrompt(input = {}) {
  const garmentType = normalizeAIClothingGarmentType(input.garmentType || input.templateKey);
  const gender = normalizeAIClothingGender(input.gender);
  const optionLabel = {
    shirt: "Shirts",
    pants: "Pants",
    full_outfit: "Full Outfit",
    matching_outfits: "Matching Outfit",
  }[garmentType];
  const includesTop = garmentType !== "pants";
  const includesPants = garmentType !== "shirt";
  const style = cleanAIClothingText(input.styleDirection, 160);
  const palette = cleanAIClothingText(input.colorPalette, 200);
  const vibe = cleanAIClothingText(input.audience, 200);
  const footwear = cleanAIClothingText(input.footwear, 120);
  const userPrompt = cleanAIClothingText(input.userPrompt || input.prompt, 1200);
  const negativePrompt = cleanAIClothingText(input.negativePrompt, 700);
  const styleName = cleanAIClothingText(input.styleName, 60);
  const requestedSleeveLength = String(input.resolvedSleeveLength || input.sleeveLength || "").trim().toLowerCase();
  const requestedPantsLength = String(input.resolvedPantsLength || input.pantsLength || "").trim();
  const resolvedSleeveLength = includesTop && ["long", "short", "sleeveless"].includes(requestedSleeveLength)
    ? requestedSleeveLength
    : "long";
  const resolvedPantsLength = includesPants && ["30", "80", "100"].includes(requestedPantsLength)
    ? requestedPantsLength
    : "100";
  return {
    garmentType,
    gender,
    templateKey: garmentType,
    templateLabel: optionLabel,
    templateInstruction: includesTop && includesPants
      ? "Create coordinated shirt and pants textures that read as one complete outfit."
      : (includesTop ? "Create a wearable shirt texture with a cohesive torso and sleeves." : "Create a wearable pants texture with cohesive lower-body panels."),
    sleeveLength: resolvedSleeveLength,
    pantsLength: resolvedPantsLength,
    style,
    palette,
    vibe,
    footwear,
    userPrompt,
    negativePrompt,
    styleName,
    promptPreview: [
      "Create a wearable Roblox clothing texture for the supplied Roblox character UV template.",
      `Clothing option: ${optionLabel}.`,
      `Gender styling: ${gender}.`,
      includesTop && includesPants
        ? "Generate a coordinated shirt texture and pants texture for one complete Roblox outfit."
        : (includesTop ? "Generate one wearable Roblox shirt texture." : "Generate one wearable Roblox pants texture."),
      "The pink #FF30F8 guide markers are transparency-only zones: leave them completely empty.",
      `Design brief: ${userPrompt || "Create a polished, high-detail Roblox clothing design with readable front, back, sleeve, and leg zones."}.`,
      style ? `Art direction: ${style}.` : "",
      palette ? `Color palette: ${palette}.` : "",
      vibe ? `Target vibe: ${vibe}.` : "",
      footwear ? `Shoes / socks: ${footwear}.` : "",
      negativePrompt ? `Preferred exclusions: ${negativePrompt}.` : "",
    ].filter(Boolean).join(" "),
  };
}

function buildAIClothingVariantPrompt(basePrompt, variant = {}) {
  const templateType = variant.templateType === "pants" ? "pants" : "shirt";
  const isTop = templateType === "shirt";
  return [
    "Create a clean wearable Roblox clothing texture on the supplied Roblox character UV template.",
    `Return only a wearable clothing texture at exactly ${AI_CLOTHING_OUTPUT_WIDTH} x ${AI_CLOTHING_OUTPUT_HEIGHT} pixels.`,
    `The working image may be generated at ${AI_CLOTHING_GENERATION_SIZE}, but the final design must map cleanly back into the supplied panel layout size.`,
    `Input image 1 is the selected ${isTop ? `${basePrompt.sleeveLength}-sleeve` : `${basePrompt.pantsLength}% lower-body`} reference. Study it pixel-for-pixel and build the completed 585 x 559 Roblox texture from its exact panel coverage. Every pink #FF30F8 guide zone is a strict no-material area.`,
    `Clothing option: ${basePrompt.templateLabel}.`,
    `Gender styling: ${basePrompt.gender}.`,
    basePrompt.templateInstruction,
    isTop
      ? "Follow the selected sleeve reference exactly for every torso and arm panel. The reference's garment boundary is final: fill only its shirt and sleeve islands, and leave its wrist, hand, and every pink or unmarked arm area completely transparent so the Roblox rig remains visible below the cuffs."
      : "Follow the selected lower-body reference exactly and leave all non-pants areas empty.",
    "Pink #FF30F8 is not a color to render. Keep every transparent or pink-marked zone fully transparent, with no fabric, material, graphics, shadows, cuffs, or accessories.",
    "Use the selected reference only to study garment coverage and transparency. Do not copy its guide colors, labels, or markings into the clothing design.",
    "DO NOT overflow artwork across a UV island boundary. Keep the canvas outside mapped panels transparent and keep each garment panel filled only with its intended clothing artwork.",
    "Do not leave white seams, white blocks, white spots, blank patches, guide letters, or direction labels anywhere in the generated garment zones unless the user explicitly asks for them.",
    "Make this a catalog-ready Roblox texture with readable panels and a cohesive front and back.",
    `Design brief: ${basePrompt.userPrompt || "Create a polished, high-detail Roblox clothing design with readable front, back, sleeve, and leg zones."}.`,
    basePrompt.style ? `Art direction: ${basePrompt.style}.` : "",
    basePrompt.palette ? `Color palette: ${basePrompt.palette}.` : "",
    basePrompt.vibe ? `Target vibe: ${basePrompt.vibe}.` : "",
    basePrompt.footwear ? `Shoes / socks: ${basePrompt.footwear}. Apply this only to lower-leg and ankle regions.` : "",
    basePrompt.styleName ? `Preset style tag: ${basePrompt.styleName}.` : "",
    basePrompt.negativePrompt ? `Preferred exclusions: ${basePrompt.negativePrompt}.` : "",
  ].filter(Boolean).join(" ");
}

function buildAIClothingGenerationPlan(basePrompt) {
  if (basePrompt.garmentType === "shirt") {
    return [{ key: "shirt", label: "Shirt", templateType: "shirt" }];
  }
  if (basePrompt.garmentType === "pants") {
    return [{ key: "pants", label: "Pants", templateType: "pants" }];
  }
  return [
    { key: "shirt", label: "Matching Shirt", templateType: "shirt" },
    { key: "pants", label: "Matching Pants", templateType: "pants" },
  ];
}

async function generateAIClothingImage({ templateType, enhancedPrompt, sleeveLength, pantsLength, references = [], preserveWhite = false }) {
  assertAIClothingConfigured();
  const promptText = cleanAIClothingText(enhancedPrompt, 6000);
  if (!promptText) {
    const error = new Error("A clothing prompt is required before generation.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedTemplateType = templateType === "pants" ? "pants" : "shirt";
  const resolvedSleeveReferenceKey =
    normalizedTemplateType === "shirt"
      ? (sleeveLength === "short" || sleeveLength === "sleeveless" ? sleeveLength : "long")
      : "";
  const resolvedPantsReferenceKey =
    normalizedTemplateType === "pants"
      ? (pantsLength === "30" || pantsLength === "80" ? pantsLength : "100")
      : "";
  const referenceTemplatePath = normalizedTemplateType === "shirt"
    ? AI_SLEEVE_REFERENCE_PATHS[resolvedSleeveReferenceKey]
    : AI_PANTS_REFERENCE_PATHS[resolvedPantsReferenceKey];
  const blankTemplateName = "Blank Template.png";
  const blankTemplatePath = path.join(__dirname, "assets", "ai-rig", blankTemplateName);
  const { toFile } = getOpenAIUploadHelpers();
  await Promise.all([
    fs.promises.access(blankTemplatePath, fs.constants.R_OK),
    fs.promises.access(referenceTemplatePath, fs.constants.R_OK),
  ]);
  const sharp = getSharp();
  const [blankTemplateBuffer, referenceTemplateBuffer] = await Promise.all([
    fs.promises.readFile(blankTemplatePath),
    fs.promises.readFile(referenceTemplatePath),
  ]);
  const referenceMask = await buildAIClothingReferenceMask({
    blankTemplateBuffer,
    referenceTemplateBuffer,
  });
  const sleeveGuideUpload = await toFile(Readable.from([referenceTemplateBuffer]), path.basename(referenceTemplatePath), {
    type: "image/png",
  });
  const userReferenceUploads = await Promise.all(references.map((reference) => toFile(
    Readable.from([reference.buffer]),
    reference.name,
    { type: reference.type }
  )));

  const generation = await getOpenAIClient().images.edit({
    model: AI_CLOTHING_MODEL,
    image: [sleeveGuideUpload].concat(userReferenceUploads),
    prompt: `${promptText} Study input image 1, ${path.basename(referenceTemplatePath)}, pixel-for-pixel as the selected coverage and wrist-clearance reference, then build the completed Roblox ${normalizedTemplateType} texture from that exact map at 585 x 559 pixels.${normalizedTemplateType === "shirt" && resolvedSleeveReferenceKey === "long" ? " Long Sleeve Reference.png is mandatory for this long-sleeve request." : ""}${userReferenceUploads.length ? " The remaining input images are user style references only: use their colors, motifs, materials, and overall aesthetic, but never copy their shape or layout over the Roblox UV guide." : ""} Pink #FF30F8 in the selected reference means no material: keep those matching zones fully transparent with no fabric, material, graphics, shadows, cuffs, or accessories. Do not copy reference guide colors, labels, or markings into the output. Do not create white seams, white blocks, white spots, blank patches, guide letters, or direction labels in garment zones unless the user explicitly requests them. Return only the completed 585 x 559 Roblox texture based on the selected reference.`,
    size: AI_CLOTHING_GENERATION_SIZE,
  });

  const generatedBase64 = generation && generation.data && generation.data[0] && generation.data[0].b64_json
    ? generation.data[0].b64_json
    : "";

  if (!generatedBase64) {
    const error = new Error("OpenAI did not return an image for this clothing request.");
    error.statusCode = 502;
    throw error;
  }

  const generatedBuffer = Buffer.from(generatedBase64, "base64");
  const generatedPixels = await sharp(generatedBuffer)
    .ensureAlpha()
    .resize(AI_CLOTHING_OUTPUT_WIDTH, AI_CLOTHING_OUTPUT_HEIGHT, {
      fit: "fill",
      // Avoid blending transparent source pixels into UV island edges.
      kernel: "nearest",
    })
    .raw()
    .toBuffer();
  const finalPixels = removeAIClothingWhiteArtifacts(generatedPixels, referenceMask, preserveWhite);
  for (let pixel = 0; pixel < referenceMask.length; pixel += 1) {
    finalPixels[pixel * 4 + 3] = referenceMask[pixel];
  }
  const finalArtBuffer = await sharp(finalPixels, {
    raw: {
      width: AI_CLOTHING_OUTPUT_WIDTH,
      height: AI_CLOTHING_OUTPUT_HEIGHT,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
  return {
    outputBuffer: finalArtBuffer,
    outputMime: "image/png",
    outputBase64: finalArtBuffer.toString("base64"),
    outputWidth: AI_CLOTHING_OUTPUT_WIDTH,
    outputHeight: AI_CLOTHING_OUTPUT_HEIGHT,
    sourceGenerationSize: AI_CLOTHING_GENERATION_SIZE,
    model: AI_CLOTHING_MODEL,
    templateType: normalizedTemplateType,
  };
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

        if (
          session.mode === "payment" &&
          session.payment_status === "paid" &&
          session.metadata?.aiTokenQuantity
        ) {
          await grantAITokensFromStripeCheckout(session);
        }

        if (session.mode === "payment" && session.payment_status === "paid" && session.metadata?.productType === "discord_bot_uses") {
          await grantPurchasedUses(session);
        }

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

        if (session.payment_status === "paid") {
          recordReferralCommissionFromCheckout(session);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        if (isDiscordBotUnlimitedSubscription(subscription)) {
          await setUnlimitedSubscription(subscription);
        } else {
          await syncSubscriptionStateFromStripeSubscription(subscription);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        if (isDiscordBotUnlimitedInvoice(invoice)) {
          break;
        }
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer && invoice.customer.id
              ? invoice.customer.id
              : null;

        if (customerId) {
          const synced = await syncLatestStripeSubscriptionForCustomer(customerId);
          if (!synced) {
            await setBillingAccessForCustomer(customerId, buildMembershipStorageFields({
              premiumActive: true,
              plan: "plus",
              stripeSubscriptionStatus: "active",
              membershipSource: "stripe",
            }));
          }
        }
        await grantProTokensFromStripeInvoice(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        if (isDiscordBotUnlimitedInvoice(invoice)) {
          break;
        }
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer && invoice.customer.id
              ? invoice.customer.id
              : null;

        if (customerId) {
          const synced = await syncLatestStripeSubscriptionForCustomer(customerId);
          if (!synced) {
            await setBillingAccessForCustomer(customerId, buildMembershipStorageFields({
              premiumActive: false,
              plan: "free",
              stripeSubscriptionStatus: "past_due",
              membershipSource: "stripe",
            }));
          }
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
app.use(cookieParser());
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
  return `${getSafePortalReturnUrl()}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
}

function getSafeCheckoutCancelUrl() {
  return `${getSafePortalReturnUrl()}?checkout=cancelled`;
}

function getSafeAiTokenStoreSuccessUrl() {
  return `${getSanitizedAppBaseUrl()}/ai-tokens?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
}

function getSafeAiTokenStoreCancelUrl() {
  return `${getSanitizedAppBaseUrl()}/ai-tokens?checkout=cancelled`;
}

function getSafeDiscordBotStoreSuccessUrl() {
  return `${getSanitizedAppBaseUrl()}/discord-bot?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
}

function getSafeDiscordBotStoreCancelUrl() {
  return `${getSanitizedAppBaseUrl()}/discord-bot?checkout=cancelled`;
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

function assertDiscordBotUnlimitedCheckoutConfigured() {
  assertStripePortalConfigured();
  if (!STRIPE_DISCORD_BOT_UNLIMITED_PRICE_IDS.size) {
    const error = new Error("The Discord Bot Unlimited Stripe price is not configured yet.");
    error.statusCode = 503;
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

function normalizeMembershipPlan(value) {
  return String(value || "").trim().toLowerCase() === "pro" ? "pro" : "plus";
}

function isProMember(user) {
  return String(user?.plan || "").trim().toLowerCase() === "pro";
}

function isPlusPlan(plan) {
  return String(plan || "").trim().toLowerCase() === "plus";
}

function getAIThumbnailHistoryLimit(membership) {
  return String(membership?.plan || "").toLowerCase() === "pro" ? 30 : membership?.premiumActive ? 10 : 3;
}

function getStripeSubscriptionPlan(subscription) {
  const metadataPlan = String(subscription?.metadata?.plan || "").trim().toLowerCase();
  const items = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
  const hasProProduct = items.some((item) => {
    const product = item?.price?.product;
    const productId = typeof product === "string" ? product : product?.id;
    return Boolean(STRIPE_PRO_PRODUCT_ID && productId === STRIPE_PRO_PRODUCT_ID);
  });
  return metadataPlan === "pro" || hasProProduct ? "pro" : "plus";
}

function getAITokenBalance(user) {
  const parsed = Number.parseInt(user?.ai_token_balance, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : AI_TOKEN_DEFAULT_BALANCE;
}

function getAITokenPackage(packageKey) {
  return AI_TOKEN_PACKAGES.find((item) => item.key === String(packageKey || "").trim()) || null;
}

function readJsonFile(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) return fallbackValue;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : fallbackValue;
  } catch (_error) {
    return fallbackValue;
  }
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = filePath + ".tmp";
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2) + "\n", "utf8");
  fs.renameSync(tempPath, filePath);
}

function readReferralProgram() {
  const state = readJsonFile(REFERRAL_PROGRAM_PATH, { referrals: [], attributions: [], commissions: [], payoutRequests: [] });
  return {
    referrals: Array.isArray(state.referrals) ? state.referrals : [],
    attributions: Array.isArray(state.attributions) ? state.attributions : [],
    commissions: Array.isArray(state.commissions) ? state.commissions : [],
    payoutRequests: Array.isArray(state.payoutRequests) ? state.payoutRequests : [],
  };
}

function writeReferralProgram(state) {
  writeJsonFile(REFERRAL_PROGRAM_PATH, {
    referrals: (state.referrals || []).slice(-10000),
    attributions: (state.attributions || []).slice(-25000),
    commissions: (state.commissions || []).slice(-25000),
    payoutRequests: (state.payoutRequests || []).slice(-10000),
  });
}

function normalizeReferralCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
}

function getOrCreateReferral(state, userId) {
  const normalizedUserId = String(userId || "").trim();
  let referral = state.referrals.find((entry) => String(entry.userId || "") === normalizedUserId);
  if (referral) return referral;
  let code = "";
  do { code = "RBLX" + randomBytes(4).toString("hex").toUpperCase(); }
  while (state.referrals.some((entry) => entry.code === code));
  referral = { id: randomUUID(), userId: normalizedUserId, code, createdAt: new Date().toISOString() };
  state.referrals.push(referral);
  return referral;
}

function refreshReferralCommissionAvailability(state, now = Date.now()) {
  let changed = false;
  state.commissions.forEach((commission) => {
    if (commission.status !== "pending" || !commission.availableAt) return;
    if (Date.parse(commission.availableAt) <= now) { commission.status = "available"; changed = true; }
  });
  return changed;
}

function getReferralDashboard(userId) {
  const state = readReferralProgram();
  const now = Date.now();
  const hadReferral = state.referrals.some((entry) => String(entry.userId || "") === String(userId || ""));
  const referral = getOrCreateReferral(state, userId);
  const changed = refreshReferralCommissionAvailability(state, now);
  if (changed || !hadReferral) writeReferralProgram(state);
  const commissions = state.commissions.filter((entry) => String(entry.referrerUserId || "") === String(userId || ""));
  const sum = (status) => commissions.filter((entry) => entry.status === status).reduce((total, entry) => total + Math.max(0, Number(entry.amountCents) || 0), 0);
  const referrals = state.attributions.filter((entry) => String(entry.referrerUserId || "") === String(userId || "")).length;
  const availableCents = sum("available");
  return {
    code: referral.code,
    link: getSanitizedAppBaseUrl() + "/?ref=" + encodeURIComponent(referral.code),
    commissionRate: REFERRAL_COMMISSION_RATE * 100,
    referredMembers: referrals,
    pendingCents: sum("pending"),
    availableCents,
    requestedCents: sum("requested"),
    paidCents: sum("paid"),
    minimumPayoutCents: REFERRAL_MINIMUM_PAYOUT_CENTS,
    payoutRequests: state.payoutRequests.filter((entry) => String(entry.userId || "") === String(userId || "")).slice(-8).reverse(),
  };
}

function recordReferralCommissionFromCheckout(session) {
  const code = normalizeReferralCode(session?.metadata?.referralCode);
  const buyerUserId = String(session?.metadata?.appUserId || session?.client_reference_id || "").trim();
  const checkoutSessionId = String(session?.id || "").trim();
  const amountCents = Math.max(0, Number(session?.amount_total) || 0);
  if (!code || !buyerUserId || !checkoutSessionId || !amountCents) return null;
  const state = readReferralProgram();
  if (state.commissions.some((entry) => String(entry.checkoutSessionId || "") === checkoutSessionId)) return null;
  if (state.attributions.some((entry) => String(entry.buyerUserId || "") === buyerUserId)) return null;
  const referral = state.referrals.find((entry) => entry.code === code);
  if (!referral || String(referral.userId || "") === buyerUserId) return null;
  const now = Date.now();
  const commission = {
    id: randomUUID(), checkoutSessionId, buyerUserId, referrerUserId: referral.userId, code,
    amountCents: Math.round(amountCents * REFERRAL_COMMISSION_RATE), currency: String(session?.currency || "usd").toLowerCase(),
    status: "pending", createdAt: new Date(now).toISOString(), availableAt: new Date(now + REFERRAL_PENDING_MS).toISOString(),
  };
  state.attributions.push({ id: randomUUID(), buyerUserId, referrerUserId: referral.userId, code, createdAt: commission.createdAt });
  state.commissions.push(commission);
  writeReferralProgram(state);
  return commission;
}

function readMemberRewards() {
  const state = readJsonFile(MEMBER_REWARDS_PATH, { rewards: [] });
  return { rewards: Array.isArray(state.rewards) ? state.rewards : [] };
}

function writeMemberRewards(state) {
  writeJsonFile(MEMBER_REWARDS_PATH, { rewards: (Array.isArray(state?.rewards) ? state.rewards : []).slice(-5000) });
}

function buildMemberReward(reward, now = Date.now()) {
  return {
    id: String(reward.id || ""),
    title: String(reward.title || "A RBLXTools reward is waiting"),
    note: String(reward.note || ""),
    rewardType: String(reward.rewardType || "plus"),
    amount: Math.max(0, Number(reward.amount) || 0),
    availableAt: reward.availableAt || null,
    claimDelayMs: Math.max(0, Date.parse(reward.availableAt || "") - now),
  };
}

function createMemberReward({ userId, title, note, rewardType, amount, adminUser }) {
  const state = readMemberRewards();
  const reward = {
    id: randomUUID(), userId: String(userId || ""),
    title: cleanText(title, 100) || "You've received a RBLXTools reward!",
    note: cleanText(note, 500), rewardType: rewardType === "pro" ? "pro" : rewardType === "tokens" ? "tokens" : "plus",
    amount: Math.max(0, Number(amount) || 0), createdAt: new Date().toISOString(),
    availableAt: null, claimedAt: null, adminUserId: String(adminUser?.id || ""),
  };
  state.rewards.push(reward);
  writeMemberRewards(state);
  return buildMemberReward(reward);
}

function getPendingMemberRewards(userId) {
  const state = readMemberRewards();
  const now = Date.now(); let changed = false;
  const rewards = state.rewards.filter((reward) => String(reward.userId || "") === String(userId || "") && !reward.claimedAt).map((reward) => {
    // Correct rewards created by the earlier client-clock timer implementation.
    if (!reward.availableAt || Date.parse(reward.availableAt) > now + 10000) { reward.availableAt = new Date(now + 5000).toISOString(); changed = true; }
    return buildMemberReward(reward, now);
  });
  if (changed) writeMemberRewards(state);
  return rewards;
}

function claimMemberReward(userId, rewardId) {
  const state = readMemberRewards();
  const reward = state.rewards.find((item) => String(item.id || "") === String(rewardId || "") && String(item.userId || "") === String(userId || ""));
  if (!reward || reward.claimedAt) { const error = new Error("That reward is no longer available."); error.statusCode = 404; throw error; }
  if (!reward.availableAt || Date.parse(reward.availableAt) > Date.now()) { const error = new Error("Please take a moment to read your reward note first."); error.statusCode = 429; throw error; }
  reward.claimedAt = new Date().toISOString(); writeMemberRewards(state); return buildMemberReward(reward);
}

function getPublicAITokenPackages() {
  return AI_TOKEN_PACKAGES.map((item) => ({
    key: item.key,
    title: item.title || "",
    description: item.description || "AI generation credits",
    tokens: item.tokens,
    priceCents: item.priceCents,
    currency: item.currency || "usd",
    configured: Boolean(item.productId),
    available: true,
    unavailableReason: "",
  }));
}

async function resolveAITokenPackagePrice(packageDefinition) {
  const configuredPriceId = String(packageDefinition?.priceId || "").trim();
  if (configuredPriceId) {
    const configuredPrice = await stripeClient.prices.retrieve(configuredPriceId);
    if (!configuredPrice?.active) {
      const error = new Error("This AI token Stripe price is inactive. Activate the price before accepting purchases.");
      error.statusCode = 503;
      throw error;
    }
    const configuredProductId = getStripePriceProductId(configuredPrice);
    if (packageDefinition.productId && configuredProductId && configuredProductId !== packageDefinition.productId) {
      const error = new Error("This AI token Stripe price does not belong to the configured product.");
      error.statusCode = 503;
      throw error;
    }
    if (configuredProductId) {
      const configuredProduct = await stripeClient.products.retrieve(configuredProductId);
      if (!configuredProduct?.active) {
        const error = new Error("This AI token Stripe product is inactive. Activate the product before accepting purchases.");
        error.statusCode = 503;
        throw error;
      }
    }
    return configuredPriceId;
  }

  const product = await stripeClient.products.retrieve(packageDefinition.productId);
  if (!product?.active) {
    const error = new Error("This AI token product is inactive in Stripe. Activate it before accepting purchases.");
    error.statusCode = 503;
    throw error;
  }

  let priceId = typeof product?.default_price === "string"
    ? product.default_price
    : String(product?.default_price?.id || "").trim();

  if (priceId) {
    const defaultPrice = await stripeClient.prices.retrieve(priceId);
    if (!defaultPrice?.active) priceId = "";
  }

  if (!priceId) {
    const prices = await stripeClient.prices.list({
      product: packageDefinition.productId,
      active: true,
      limit: 1,
    });
    priceId = String(prices?.data?.[0]?.id || "").trim();
  }

  if (!priceId) {
    const error = new Error("This AI token product does not have an active Stripe price.");
    error.statusCode = 503;
    throw error;
  }

  return priceId;
}

function normalizeBillingInterval(value) {
  return String(value || "").trim().toLowerCase() === "year" ? "year" : "month";
}

function serializeMembershipPrice(price) {
  return price && price.id ? {
    id: String(price.id),
    unitAmount: Number(price.unit_amount || 0),
    currency: String(price.currency || "usd"),
    interval: String(price.recurring?.interval || "month"),
  } : null;
}

async function getRecurringProductPrices(productId) {
  if (!productId) {
    const error = new Error("This membership product is not configured yet.");
    error.statusCode = 503;
    throw error;
  }
  const prices = await stripeClient.prices.list({
    product: productId,
    active: true,
    type: "recurring",
    limit: 100,
  });
  return Array.isArray(prices?.data) ? prices.data.filter((item) => item?.recurring) : [];
}

async function resolveRecurringProductPrice(productId, billingInterval) {
  const interval = normalizeBillingInterval(billingInterval);
  const prices = await getRecurringProductPrices(productId);
  const price = prices.find((item) => item?.recurring?.interval === interval);
  if (!price?.id) {
    const error = new Error("This membership product needs an active " + interval + " Stripe price.");
    error.statusCode = 503;
    throw error;
  }
  return String(price.id);
}

async function resolvePlusRecurringPrice(billingInterval) {
  const interval = normalizeBillingInterval(billingInterval);
  if (interval === "month") return STRIPE_PRICE_ID;
  const monthlyPrice = await stripeClient.prices.retrieve(STRIPE_PRICE_ID);
  const product = monthlyPrice?.product;
  const productId = typeof product === "string" ? product : String(product?.id || "").trim();
  return resolveRecurringProductPrice(productId, interval);
}

function extractMissingSupabaseColumnName(error) {
  const message = String(error && error.message || "");
  const match = message.match(/column\s+"([^"]+)"/i);
  return match && match[1] ? String(match[1]).trim() : "";
}

function filterOptionalAuthColumns(fields) {
  if (!fields || typeof fields !== "object") {
    return fields;
  }

  const next = {};
  Object.keys(fields).forEach((key) => {
    if (missingOptionalAuthUserColumns.has(key)) {
      return;
    }
    next[key] = fields[key];
  });
  return next;
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

function getAuthCookieSecureFlag(req) {
  if (process.env.NODE_ENV === "production") return true;
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  if (forwardedProto.includes("https")) return true;
  return Boolean(req.secure);
}

function getAuthCookieDomain(req) {
  const host = String(req.headers?.host || "").split(":")[0].trim().toLowerCase();
  if (host === "rblxtools.net" || host.endsWith(".rblxtools.net")) {
    return ".rblxtools.net";
  }
  return undefined;
}

function getAuthCookieBaseOptions(req) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: getAuthCookieSecureFlag(req),
    path: "/",
  };
}

function getAuthCookieOptions(req) {
  const domain = getAuthCookieDomain(req);
  const options = getAuthCookieBaseOptions(req);
  if (domain) options.domain = domain;
  return options;
}

function setAuthCookie(req, res, token) {
  res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieBaseOptions(req));
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...getAuthCookieOptions(req),
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

function clearAuthCookie(req, res) {
  res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieBaseOptions(req));
  res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions(req));
}

function getBearerToken(req) {
  const cookieToken = String(req.cookies?.[AUTH_COOKIE_NAME] || "").trim();
  if (cookieToken) return cookieToken;
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}
function parseCookieHeader(cookieHeader) {
  const source = String(cookieHeader || "").trim();
  if (!source) return {};
  return source.split(";").reduce((acc, entry) => {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex < 0) return acc;
    const key = entry.slice(0, separatorIndex).trim();
    if (!key) return acc;
    const value = entry.slice(separatorIndex + 1).trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function getSocketBearerToken(socket, payload) {
  const payloadToken = cleanText(
    payload?.authToken ||
    payload?.token ||
    payload?.bearerToken,
    4096
  );
  if (payloadToken) return payloadToken;

  const authToken = cleanText(
    socket?.handshake?.auth?.authToken ||
    socket?.handshake?.auth?.token ||
    socket?.handshake?.auth?.bearerToken,
    4096
  );
  if (authToken) return authToken;

  const header = String(socket?.handshake?.headers?.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) return cleanText(match[1], 4096);

  const cookies = parseCookieHeader(socket?.handshake?.headers?.cookie);
  return cleanText(cookies?.[AUTH_COOKIE_NAME], 4096);
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

  const body = raw.slice("complimentary_until:".length).trim();
  const segments = body
    .split("|")
    .map((segment) => String(segment || "").trim())
    .filter(Boolean);
  const expiresAt = segments[0] || "";
  const expiresDate = expiresAt ? new Date(expiresAt) : null;
  if (!expiresDate || Number.isNaN(expiresDate.getTime())) {
    return null;
  }

  let totalDays = null;
  for (const segment of segments.slice(1)) {
    const dividerIndex = segment.indexOf(":");
    if (dividerIndex === -1) {
      continue;
    }

    const key = segment.slice(0, dividerIndex).trim().toLowerCase();
    const valueText = segment.slice(dividerIndex + 1).trim();
    if (key === "total_days" || key === "granted_days") {
      const parsed = Number.parseInt(valueText, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        totalDays = parsed;
      }
    }
  }

  return {
    raw,
    expiresAt,
    expiresDate,
    active: expiresDate.getTime() > Date.now(),
    totalDays,
  };
}

function getEffectiveMembership(row) {
  const complimentaryMembership = getStoredComplimentaryMembership(row);
  const storedStripeMembership = getStoredStripeMembership(row);
  return buildCombinedMembershipSnapshot(storedStripeMembership, complimentaryMembership, row);
}

function buildPublicUser(row) {
  const membership = getEffectiveMembership(row);
  return {
    id: row.id,
    email: row.email,
    isAdmin: isAdminUser(row),
    plan: membership.plan,
    premiumActive: membership.premiumActive,
    plusActive: membership.plan === "plus",
    proActive: membership.plan === "pro",
    stripeCustomerId: row.stripe_customer_id || null,
    stripeSubscriptionStatus: membership.stripeSubscriptionStatus,
    complimentaryExpiresAt: membership.complimentaryExpiresAt,
    complimentaryActive: membership.complimentaryActive,
    membershipSource: membership.membershipSource,
    plusDaysTotal: membership.plusDaysTotal,
    plusDaysLeft: membership.plusDaysLeft,
    plusExpiresAt: membership.plusExpiresAt,
    aiTokens: getAITokenBalance(row),
    currentPeriodStartAt: membership.currentPeriodStartAt,
    currentPeriodEndAt: membership.currentPeriodEndAt,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function getIsoFromUnixSeconds(value) {
  const unix = Number(value);
  if (!Number.isFinite(unix) || unix <= 0) {
    return null;
  }

  return new Date(unix * 1000).toISOString();
}

function getDaysBetween(startIso, endIso) {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) {
    return null;
  }

  const diff = end.getTime() - start.getTime();
  if (diff <= 0) {
    return 0;
  }

  return Math.ceil(diff / 86400000);
}

function getDaysLeftUntil(endIso) {
  return endIso ? Math.max(0, getDaysBetween(new Date().toISOString(), endIso) || 0) : 0;
}

function getLaterIsoDate(leftIso, rightIso) {
  const left = parseIsoDate(leftIso);
  const right = parseIsoDate(rightIso);
  if (!left && !right) return null;
  if (!left) return right.toISOString();
  if (!right) return left.toISOString();
  return left.getTime() >= right.getTime() ? left.toISOString() : right.toISOString();
}

function buildMembershipBreakdownEntry(options = {}) {
  const totalRaw = Number.parseInt(String(options.totalDays ?? ""), 10);
  const totalDays = Number.isFinite(totalRaw) ? Math.max(0, totalRaw) : null;
  const expiresAt = parseIsoDate(options.expiresAt)?.toISOString() || null;
  const currentPeriodStartAt = parseIsoDate(options.currentPeriodStartAt)?.toISOString() || null;
  const currentPeriodEndAt = parseIsoDate(options.currentPeriodEndAt)?.toISOString() || null;
  const daysLeft = options.daysLeft != null
    ? Math.max(0, Number(options.daysLeft) || 0)
    : getDaysLeftUntil(expiresAt || currentPeriodEndAt || null);
  const active = typeof options.active === "boolean"
    ? options.active
    : (daysLeft > 0 || Boolean(options.status && isPremiumStatus(options.status)));

  return {
    active,
    totalDays,
    daysLeft,
    expiresAt,
    currentPeriodStartAt,
    currentPeriodEndAt,
    status: options.status || null,
  };
}

function getStoredStripeMembership(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const rawStatus = String(row.stripe_subscription_status || "").trim();
  if (!rawStatus || parseComplimentaryStatus(rawStatus)) {
    return null;
  }

  const normalizedStatus = rawStatus.toLowerCase();
  const currentPeriodStartAt = parseIsoDate(row.stripe_current_period_start_at)?.toISOString() || null;
  const currentPeriodEndAt = parseIsoDate(row.stripe_current_period_end_at)?.toISOString() || null;
  const stripePeriodEnded = Boolean(currentPeriodEndAt && parseIsoDate(currentPeriodEndAt).getTime() <= Date.now());
  const stripeDaysTotalRaw = Number.parseInt(String(row.stripe_days_total ?? ""), 10);
  const stripeDaysTotal = Number.isFinite(stripeDaysTotalRaw) ? Math.max(0, stripeDaysTotalRaw) : null;
  return buildMembershipBreakdownEntry({
    active: isPremiumStatus(normalizedStatus) && !stripePeriodEnded,
    totalDays: stripeDaysTotal,
    daysLeft: currentPeriodEndAt ? undefined : 0,
    expiresAt: currentPeriodEndAt,
    currentPeriodStartAt,
    currentPeriodEndAt,
    status: normalizedStatus,
  });
}

function getStoredComplimentaryMembership(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const oldComplimentary = parseComplimentaryStatus(row.stripe_subscription_status);
  const plusExpiresAt = parseIsoDate(row.plus_expires_at)?.toISOString() || oldComplimentary?.expiresAt || null;
  const currentPeriodStartAt = parseIsoDate(row.plus_current_period_start_at)?.toISOString() || null;
  const currentPeriodEndAt = parseIsoDate(row.plus_current_period_end_at)?.toISOString() || oldComplimentary?.expiresAt || null;
  const plusDaysTotalRaw = Number.parseInt(String(row.plus_days_total ?? ""), 10);
  const plusDaysTotal = Number.isFinite(plusDaysTotalRaw)
    ? Math.max(0, plusDaysTotalRaw)
    : (Number.isFinite(oldComplimentary?.totalDays) ? oldComplimentary.totalDays : null);

  if (!plusExpiresAt && !currentPeriodEndAt && plusDaysTotal == null && !oldComplimentary) {
    return null;
  }

  return buildMembershipBreakdownEntry({
    active: oldComplimentary ? oldComplimentary.active : undefined,
    totalDays: plusDaysTotal,
    daysLeft: plusExpiresAt || currentPeriodEndAt ? undefined : 0,
    expiresAt: plusExpiresAt,
    currentPeriodStartAt,
    currentPeriodEndAt,
    status: "complimentary",
  });
}

function buildCombinedMembershipSnapshot(stripeMembership, complimentaryMembership, row) {
  const stripe = stripeMembership || buildMembershipBreakdownEntry({ active: false, totalDays: null, daysLeft: 0, status: row?.stripe_subscription_status || null });
  const complimentary = complimentaryMembership || buildMembershipBreakdownEntry({ active: false, totalDays: null, daysLeft: 0, status: "complimentary" });
  const resolvedPlan = normalizeMembershipPlan(row?.plan);
  const storedSource = String(row?.membership_source || "").toLowerCase();
  const timedGrantSource = storedSource.includes("complimentary grant") ? "complimentary" : "robux purchase";
  const isComplimentaryPro = resolvedPlan === "pro" && (storedSource.includes("complimentary pro") || storedSource.includes("complimentary grant pro") || storedSource.includes("robux purchase pro"));
  const hasStripeData = Boolean(stripe.status || stripe.currentPeriodEndAt || stripe.currentPeriodStartAt || stripe.totalDays != null);
  const hasComplimentaryData = Boolean(
    complimentary.totalDays != null ||
    complimentary.expiresAt ||
    complimentary.currentPeriodEndAt ||
    complimentary.currentPeriodStartAt
  );
  const durationMembership = resolvedPlan === "pro"
    ? (isComplimentaryPro ? complimentary : stripe)
    : null;
  const stripeTotal = stripe.totalDays != null ? stripe.totalDays : 0;
  const complimentaryTotal = complimentary.totalDays != null ? complimentary.totalDays : 0;
  const stripeLeft = stripe.daysLeft != null ? stripe.daysLeft : 0;
  const complimentaryLeft = complimentary.daysLeft != null ? complimentary.daysLeft : 0;
  const plusDaysTotal = durationMembership
    ? durationMembership.totalDays
    : (stripe.totalDays == null && complimentary.totalDays == null ? null : stripeTotal + complimentaryTotal);
  const plusDaysLeft = durationMembership
    ? (durationMembership.daysLeft != null ? durationMembership.daysLeft : 0)
    : stripeLeft + complimentaryLeft;
  const manualPlusFallback = Boolean(
    !hasStripeData &&
    !hasComplimentaryData &&
    (row?.premium_active === true || ["plus", "pro"].includes(String(row?.plan || "").toLowerCase()))
  );
  const premiumActive = Boolean(stripe.active || complimentary.active || plusDaysLeft > 0 || manualPlusFallback);
  const membershipSource = resolvedPlan === "pro"
    ? (isComplimentaryPro ? timedGrantSource : "stripe")
    : hasStripeData && hasComplimentaryData
    ? "stripe + " + timedGrantSource
    : hasStripeData
      ? "stripe"
      : hasComplimentaryData
      ? timedGrantSource
        : "none";
  const combinedExpiresAt = durationMembership
    ? (durationMembership.expiresAt || durationMembership.currentPeriodEndAt || null)
    : plusDaysLeft > 0
    ? new Date(Date.now() + (plusDaysLeft * 86400000)).toISOString()
    : getLaterIsoDate(stripe.expiresAt || stripe.currentPeriodEndAt, complimentary.expiresAt || complimentary.currentPeriodEndAt);

  return {
    premiumActive,
    plan: premiumActive ? resolvedPlan : "free",
    stripeSubscriptionStatus: stripe.status || row?.stripe_subscription_status || null,
    complimentaryExpiresAt: complimentary.expiresAt || complimentary.currentPeriodEndAt || null,
    complimentaryActive: Boolean(complimentary.active),
    membershipSource,
    plusDaysTotal,
    plusDaysLeft,
    plusExpiresAt: combinedExpiresAt,
    currentPeriodStartAt: stripe.currentPeriodStartAt || complimentary.currentPeriodStartAt || null,
    currentPeriodEndAt: stripe.currentPeriodEndAt || complimentary.currentPeriodEndAt || null,
    membershipBreakdown: {
      stripe: {
        active: Boolean(stripe.active),
        status: stripe.status || row?.stripe_subscription_status || null,
        totalDays: stripe.totalDays,
        daysLeft: stripe.daysLeft != null ? stripe.daysLeft : 0,
        expiresAt: stripe.expiresAt || stripe.currentPeriodEndAt || null,
        currentPeriodStartAt: stripe.currentPeriodStartAt || null,
        currentPeriodEndAt: stripe.currentPeriodEndAt || null,
      },
      complimentary: {
        active: Boolean(complimentary.active),
        status: "complimentary",
        totalDays: complimentary.totalDays,
        daysLeft: complimentary.daysLeft != null ? complimentary.daysLeft : 0,
        expiresAt: complimentary.expiresAt || complimentary.currentPeriodEndAt || null,
        currentPeriodStartAt: complimentary.currentPeriodStartAt || null,
        currentPeriodEndAt: complimentary.currentPeriodEndAt || null,
      },
    },
  };
}

async function getLiveStripeMembership(row) {
  if (!stripeClient || !row?.stripe_customer_id) {
    return null;
  }

  try {
    const membership = await getBestStripeMembershipForCustomer(row.stripe_customer_id);
    if (!membership) {
      return null;
    }
    await persistStripeMembershipSnapshotIfNeeded(row, membership);
    return membership;
  } catch (error) {
    console.warn("Could not load live Stripe membership:", error.message);
    return null;
  }
}

function normalizeSupportCategory(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "website_bug") return "website_bug";
  if (normalized === "live_chat_issue") return "live_chat_issue";
  if (normalized === "membership_issue") return "membership_issue";
  if (normalized === "billing_issue") return "billing_issue";
  if (normalized === "user_report") return "user_report";
  if (normalized === "other") return "other";
  return "";
}

function getSupportCategoryLabel(category) {
  switch (normalizeSupportCategory(category)) {
    case "website_bug":
      return "Website Bugs";
    case "live_chat_issue":
      return "Live Chat Related Issues";
    case "membership_issue":
      return "Membership Related Issues";
    case "billing_issue":
      return "Billing / Purchase Issues";
    case "user_report":
      return "Report A Member";
    case "other":
      return "Other Reason";
    default:
      return "Support Report";
  }
}

function sanitizeSupportFileName(value) {
  const safe = cleanText(value || "attachment", 120).replace(/[^a-zA-Z0-9._()\- ]+/g, "_");
  return safe || "attachment";
}

function parseSupportAttachment(rawAttachment) {
  if (!rawAttachment || typeof rawAttachment !== "object") {
    return null;
  }

  const dataUrl = String(rawAttachment.dataUrl || "").trim();
  if (!dataUrl) {
    return null;
  }

  const match = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/i);
  if (!match || !match[2]) {
    const error = new Error("Attachment data was invalid.");
    error.statusCode = 400;
    throw error;
  }

  let buffer = null;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch (_error) {
    const error = new Error("Attachment could not be decoded.");
    error.statusCode = 400;
    throw error;
  }

  if (!buffer || !buffer.length) {
    return null;
  }

  if (buffer.length > MAX_SUPPORT_ATTACHMENT_BYTES) {
    const error = new Error("Attachments must be 5 MB or smaller.");
    error.statusCode = 400;
    throw error;
  }

  return {
    name: sanitizeSupportFileName(rawAttachment.name || "attachment"),
    type: cleanText(rawAttachment.type || match[1] || "application/octet-stream", 100) || "application/octet-stream",
    size: buffer.length,
    buffer,
    base64: buffer.toString("base64"),
  };
}

function extractMentionIds(value, pattern) {
  const text = String(value || "");
  const matches = [];
  let match = null;
  const regex = new RegExp(pattern, "g");
  while ((match = regex.exec(text))) {
    if (match[1]) {
      matches.push(match[1]);
    }
  }
  return Array.from(new Set(matches));
}

function buildSupportDiscordPayload(report) {
  const roleMentions = extractMentionIds(SUPPORT_STAFF_MENTION, "<@&(\\d+)>");
  const userMentions = extractMentionIds(SUPPORT_STAFF_MENTION, "<@(\\d+)>");
  const content = SUPPORT_STAFF_MENTION || "";
  const attachmentText = report.attachment
    ? `${report.attachment.name} (${Math.max(1, Math.round(report.attachment.size / 1024))} KB)`
    : "None";

  return {
    content,
    allowed_mentions: {
      parse: ["roles", "users"],
      roles: roleMentions,
      users: userMentions,
    },
    embeds: [
      {
        title: `New Support Report: ${report.categoryLabel}`,
        color: 0xff5f5f,
        description: report.details.slice(0, 3500),
        fields: [
          { name: "Reporter User ID", value: report.reporterUserId || "Unknown", inline: true },
          { name: "Reporter Email", value: report.reporterEmail || "Unknown", inline: true },
          { name: "Reporter Name", value: report.reporterDisplayName || "Unknown", inline: true },
          { name: "Reported User ID", value: report.reportedUserId || "Not provided", inline: true },
          { name: "Page", value: report.pageUrl || "Unknown", inline: false },
          { name: "Attachment", value: attachmentText, inline: false }
        ],
        footer: {
          text: `Submitted ${report.submittedAt}`
        }
      }
    ]
  };
}

async function sendSupportReportToBot(report) {
  if (!SUPPORT_BOT_ENDPOINT) {
    return null;
  }

  const response = await fetch(SUPPORT_BOT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(SUPPORT_BOT_SECRET ? { "X-Support-Secret": SUPPORT_BOT_SECRET } : {}),
    },
    body: JSON.stringify({
      type: "support-report",
      category: report.category,
      categoryLabel: report.categoryLabel,
      details: report.details,
      reporter: {
        userId: report.reporterUserId,
        email: report.reporterEmail,
        discordUsername: report.reporterDiscordUsername,
        displayName: report.reporterDisplayName,
      },
      reportedUserId: report.reportedUserId || null,
      pageUrl: report.pageUrl || "",
      submittedAt: report.submittedAt,
      userAgent: report.userAgent || "",
      attachment: report.attachment
        ? {
            name: report.attachment.name,
            type: report.attachment.type,
            size: report.attachment.size,
            base64: report.attachment.base64,
          }
        : null,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "The support bot endpoint rejected the report.");
  }

  return { destination: "bot" };
}

async function sendSupportReportToWebhook(report) {
  if (!DISCORD_SUPPORT_WEBHOOK_URL) {
    return null;
  }

  const payload = buildSupportDiscordPayload(report);

  if (report.attachment && typeof FormData !== "undefined" && typeof Blob !== "undefined") {
    const formData = new FormData();
    formData.append("payload_json", JSON.stringify(payload));
    formData.append(
      "file0",
      new Blob([report.attachment.buffer], { type: report.attachment.type || "application/octet-stream" }),
      report.attachment.name
    );

    const response = await fetch(DISCORD_SUPPORT_WEBHOOK_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || "Discord webhook rejected the support report.");
    }

    return { destination: "discord-webhook" };
  }

  const response = await fetch(DISCORD_SUPPORT_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Discord webhook rejected the support report.");
  }

  return { destination: "discord-webhook" };
}

async function deliverSupportReport(report) {
  if (SUPPORT_BOT_ENDPOINT) {
    return sendSupportReportToBot(report);
  }
  if (DISCORD_SUPPORT_WEBHOOK_URL) {
    return sendSupportReportToWebhook(report);
  }
  const error = new Error("Support reporting is not configured yet. Add SUPPORT_BOT_ENDPOINT or DISCORD_SUPPORT_WEBHOOK_URL.");
  error.statusCode = 500;
  throw error;
}

async function getBestStripeMembershipForCustomer(customerId, debug = null) {
  const subscriptionMembership = await getStripeMembershipFromSubscriptions(customerId);
  if (debug) {
    debug.subscriptionCandidate = subscriptionMembership
      ? {
          totalDays: subscriptionMembership.totalDays ?? null,
          currentPeriodStartAt: subscriptionMembership.currentPeriodStartAt || null,
          currentPeriodEndAt: subscriptionMembership.currentPeriodEndAt || null,
          status: subscriptionMembership.status || null,
        }
      : null;
  }
  if (subscriptionMembership && (subscriptionMembership.currentPeriodEndAt || subscriptionMembership.totalDays != null)) {
    console.log("[stripe-sync] subscription snapshot selected", {
      customerId,
      totalDays: subscriptionMembership.totalDays,
      currentPeriodStartAt: subscriptionMembership.currentPeriodStartAt,
      currentPeriodEndAt: subscriptionMembership.currentPeriodEndAt,
      status: subscriptionMembership.status || null,
    });
    if (debug) {
      debug.selectedSource = "subscription";
    }
    return subscriptionMembership;
  }

  const invoiceMembership = await getStripeMembershipFromInvoices(customerId);
  if (debug) {
    debug.invoiceCandidate = invoiceMembership
      ? {
          totalDays: invoiceMembership.totalDays ?? null,
          currentPeriodStartAt: invoiceMembership.currentPeriodStartAt || null,
          currentPeriodEndAt: invoiceMembership.currentPeriodEndAt || null,
          status: invoiceMembership.status || null,
        }
      : null;
  }
  if (invoiceMembership) {
    console.log("[stripe-sync] invoice-history snapshot selected", {
      customerId,
      totalDays: invoiceMembership.totalDays,
      currentPeriodStartAt: invoiceMembership.currentPeriodStartAt,
      currentPeriodEndAt: invoiceMembership.currentPeriodEndAt,
      status: invoiceMembership.status || null,
    });
    if (debug) {
      debug.selectedSource = "invoice";
    }
    return invoiceMembership;
  }

  if (debug) {
    debug.selectedSource = subscriptionMembership ? "subscription_incomplete" : "none";
  }
  console.log("[stripe-sync] no usable Stripe membership snapshot found", { customerId });
  return subscriptionMembership;
}

async function getStripeMembershipFromSubscriptions(customerId) {
  if (!stripeClient || !customerId) {
    return null;
  }

  const subscriptions = await stripeClient.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });

  const items = Array.isArray(subscriptions?.data) ? subscriptions.data : [];
  if (!items.length) {
    return null;
  }

  const rankedItems = items.filter(Boolean).filter((subscription) => !isDiscordBotUnlimitedSubscription(subscription)).sort(rankStripeSubscription);
  const subscription = rankedItems[0];
  if (!subscription) {
    return null;
  }

  const status = String(subscription.status || "").toLowerCase();
  const currentPeriodStartAt = getIsoFromUnixSeconds(subscription.current_period_start);
  const currentPeriodEndAt = getIsoFromUnixSeconds(subscription.current_period_end);
  const plusDaysLeft = getDaysLeftUntil(currentPeriodEndAt);

  return buildMembershipBreakdownEntry({
    active: isPremiumStatus(status) && (!currentPeriodEndAt || plusDaysLeft > 0),
    totalDays: getDaysBetween(currentPeriodStartAt, currentPeriodEndAt),
    daysLeft: plusDaysLeft,
    expiresAt: currentPeriodEndAt,
    currentPeriodStartAt,
    currentPeriodEndAt,
    status: status || null,
  });
}

async function getStripeMembershipFromInvoices(customerId) {
  if (!stripeClient || !customerId) {
    return null;
  }

  const invoices = await stripeClient.invoices.list({
    customer: customerId,
    limit: 25,
  });

  const items = Array.isArray(invoices?.data) ? invoices.data.filter(Boolean) : [];
  if (!items.length) {
    return null;
  }

  const paidInvoices = items
    .filter((invoice) => {
      const paid = invoice?.paid === true || String(invoice?.status || "").toLowerCase() === "paid";
      return paid && !isDiscordBotUnlimitedInvoice(invoice);
    })
    .sort((left, right) => {
      const leftTime = Number(left?.status_transitions?.paid_at || left?.created || 0);
      const rightTime = Number(right?.status_transitions?.paid_at || right?.created || 0);
      return rightTime - leftTime;
    });

  const invoice = paidInvoices[0];
  if (!invoice) {
    return null;
  }

  const lines = Array.isArray(invoice?.lines?.data) ? invoice.lines.data : [];
  const subscriptionLine = lines.find((line) => String(line?.type || "").toLowerCase() === "subscription") || lines[0];
  if (!subscriptionLine) {
    return null;
  }

  const periodStartAt = getIsoFromUnixSeconds(subscriptionLine?.period?.start);
  const periodEndAt = getIsoFromUnixSeconds(subscriptionLine?.period?.end);
  const paidAtIso = getIsoFromUnixSeconds(invoice?.status_transitions?.paid_at || invoice?.created);
  const plusDaysLeft = getDaysLeftUntil(periodEndAt);
  const active = Boolean(periodEndAt && plusDaysLeft > 0);

  return buildMembershipBreakdownEntry({
    active,
    totalDays: getDaysBetween(periodStartAt, periodEndAt),
    daysLeft: plusDaysLeft,
    expiresAt: periodEndAt,
    currentPeriodStartAt: periodStartAt || paidAtIso,
    currentPeriodEndAt: periodEndAt,
    status: active ? "active" : "paid_history",
  });
}

async function persistStripeMembershipSnapshotIfNeeded(row, membership, debug = null) {
  if (!row?.id || !membership) {
    return;
  }

  const currentTotalRaw = Number.parseInt(String(row.stripe_days_total ?? ""), 10);
  const currentTotal = Number.isFinite(currentTotalRaw) ? Math.max(0, currentTotalRaw) : null;
  const currentStart = parseIsoDate(row.stripe_current_period_start_at)?.toISOString() || null;
  const currentEnd = parseIsoDate(row.stripe_current_period_end_at)?.toISOString() || null;
  const nextTotal = membership.totalDays != null ? Math.max(0, Number(membership.totalDays) || 0) : null;
  const nextStart = membership.currentPeriodStartAt || null;
  const nextEnd = membership.currentPeriodEndAt || null;

  if (currentTotal === nextTotal && currentStart === nextStart && currentEnd === nextEnd) {
    console.log("[stripe-sync] stripe snapshot already current", {
      userId: row.id,
      customerId: row.stripe_customer_id || null,
      stripeDaysTotal: currentTotal,
      stripeCurrentPeriodStartAt: currentStart,
      stripeCurrentPeriodEndAt: currentEnd,
    });
    if (debug) {
      debug.persistResult = "already_current";
      debug.persistPayload = {
        stripeDaysTotal: currentTotal,
        stripeCurrentPeriodStartAt: currentStart,
        stripeCurrentPeriodEndAt: currentEnd,
      };
    }
    return;
  }

  try {
    const updatedUser = await updateAuthUserFields(row.id, buildStripeMembershipStorageFields({
      stripeDaysTotal: nextTotal,
      stripeCurrentPeriodStartAt: nextStart,
      stripeCurrentPeriodEndAt: nextEnd,
    }));
    console.log("[stripe-sync] persisted Stripe snapshot", {
      userId: row.id,
      customerId: row.stripe_customer_id || null,
      stripeDaysTotal: nextTotal,
      stripeCurrentPeriodStartAt: nextStart,
      stripeCurrentPeriodEndAt: nextEnd,
      updateReturnedUser: Boolean(updatedUser),
    });
    if (debug) {
      debug.persistResult = Boolean(updatedUser) ? "updated" : "no_row_returned";
      debug.persistPayload = {
        stripeDaysTotal: nextTotal,
        stripeCurrentPeriodStartAt: nextStart,
        stripeCurrentPeriodEndAt: nextEnd,
      };
    }
  } catch (error) {
    console.warn("Could not persist Stripe membership snapshot:", error.message);
    if (debug) {
      debug.persistResult = "error";
      debug.persistError = error.message;
    }
  }
}

async function resolveMembershipSnapshot(row) {
  const complimentaryMembership = getStoredComplimentaryMembership(row);
  const liveStripeMembership = await getLiveStripeMembership(row);
  return buildCombinedMembershipSnapshot(liveStripeMembership, complimentaryMembership, row);
}

async function buildResolvedPublicUser(row) {
  if (!row) {
    return null;
  }

  const membership = await resolveMembershipSnapshot(row);
  return {
    id: row.id,
    email: row.email,
    isAdmin: isAdminUser(row),
    plan: membership.plan,
    premiumActive: membership.premiumActive,
    plusActive: membership.plan === "plus",
    proActive: membership.plan === "pro",
    stripeCustomerId: row.stripe_customer_id || null,
    stripeSubscriptionStatus: membership.stripeSubscriptionStatus,
    complimentaryExpiresAt: membership.complimentaryExpiresAt,
    complimentaryActive: membership.complimentaryActive,
    membershipSource: membership.membershipSource,
    plusDaysTotal: membership.plusDaysTotal,
    plusDaysLeft: membership.plusDaysLeft,
    plusExpiresAt: membership.plusExpiresAt,
    aiTokens: getAITokenBalance(row),
    currentPeriodStartAt: membership.currentPeriodStartAt,
    currentPeriodEndAt: membership.currentPeriodEndAt,
    membershipBreakdown: membership.membershipBreakdown,
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
  const payload = filterOptionalAuthColumns({
    id: randomUUID(),
    email: normalizedEmail,
    password_hash: hashPassword(password),
    plan: "free",
    premium_active: false,
    plus_active: false,
    stripe_customer_id: null,
    stripe_subscription_status: null,
    membership_source: "none",
    plus_days_total: null,
    plus_expires_at: null,
    plus_current_period_start_at: null,
    plus_current_period_end_at: null,
    stripe_days_total: null,
    stripe_current_period_start_at: null,
    stripe_current_period_end_at: null,
    ai_token_balance: AI_TOKEN_DEFAULT_BALANCE,
    created_at: nowIso,
    updated_at: nowIso,
  });

  let rows;
  let insertPayload = payload;
  while (true) {
    try {
      rows = await supabaseRequest(buildAuthTablePath(), {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(insertPayload),
      });
      break;
    } catch (error) {
      const missingColumn = extractMissingSupabaseColumnName(error);
      if (!missingColumn || !OPTIONAL_AUTH_USER_COLUMNS.has(missingColumn) || !Object.prototype.hasOwnProperty.call(insertPayload, missingColumn)) {
        throw error;
      }

      missingOptionalAuthUserColumns.add(missingColumn);
      insertPayload = filterOptionalAuthColumns(insertPayload);
    }
  }
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
  const payload = filterOptionalAuthColumns({
    ...fields,
    updated_at: new Date().toISOString(),
  });

  let rows;
  let updatePayload = payload;
  while (true) {
    try {
      rows = await supabaseRequest(buildAuthTablePath(`?id=eq.${encodeURIComponent(userId)}`), {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(updatePayload),
      });
      break;
    } catch (error) {
      const missingColumn = extractMissingSupabaseColumnName(error);
      if (!missingColumn || !OPTIONAL_AUTH_USER_COLUMNS.has(missingColumn) || !Object.prototype.hasOwnProperty.call(updatePayload, missingColumn)) {
        throw error;
      }

      missingOptionalAuthUserColumns.add(missingColumn);
      updatePayload = filterOptionalAuthColumns(updatePayload);
    }
  }
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function debitAITokens(userId, cost) {
  const normalizedCost = Math.max(1, Number.parseInt(cost, 10) || 1);

  // The balance predicate prevents two overlapping requests from spending the same token.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const user = await getAuthUserById(userId);
    if (!user) {
      const error = new Error("User not found.");
      error.statusCode = 401;
      throw error;
    }

    const balance = getAITokenBalance(user);
    if (user.ai_token_balance == null || user.ai_token_balance === "") {
      await supabaseRequest(
        buildAuthTablePath(`?id=eq.${encodeURIComponent(userId)}&ai_token_balance=is.null`),
        {
          method: "PATCH",
          body: JSON.stringify({ ai_token_balance: AI_TOKEN_DEFAULT_BALANCE }),
        }
      );
      continue;
    }
    if (balance < normalizedCost) {
      const error = new Error("No AI tokens available. Add tokens before creating another thumbnail.");
      error.statusCode = 402;
      error.aiTokens = balance;
      throw error;
    }

    const rows = await supabaseRequest(
      buildAuthTablePath(`?id=eq.${encodeURIComponent(userId)}&ai_token_balance=eq.${balance}`),
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          ai_token_balance: balance - normalizedCost,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    if (Array.isArray(rows) && rows[0]) {
      return getAITokenBalance(rows[0]);
    }
  }

  const error = new Error("Your AI token balance changed. Please try again.");
  error.statusCode = 409;
  throw error;
}

async function grantAITokensFromStripeCheckout(session) {
  const userId = String(session?.metadata?.appUserId || "").trim();
  const tokens = Number.parseInt(session?.metadata?.aiTokenQuantity, 10);
  const packageKey = String(session?.metadata?.aiTokenPackage || "").trim();
  const packageDefinition = getAITokenPackage(packageKey);
  const sessionId = String(session?.id || "").trim();

  if (!userId || !sessionId || !packageDefinition || packageDefinition.tokens !== tokens) {
    throw new Error("AI token checkout metadata is invalid.");
  }

  const rows = await supabaseRequest("/rest/v1/rpc/grant_ai_token_purchase", {
    method: "POST",
    body: JSON.stringify({
      p_session_id: sessionId,
      p_user_id: userId,
      p_tokens: tokens,
    }),
  });

  return Number.parseInt(rows, 10) || 0;
}

function getStripePriceProductId(price) {
  const product = price?.product;
  return typeof product === "string" ? product : String(product?.id || "").trim();
}

function getStripePriceId(price) {
  return String(price?.id || "").trim();
}

function isDiscordBotUnlimitedSubscription(subscription) {
  if (String(subscription?.metadata?.discordBotUnlimited || "").toLowerCase() === "true") {
    return true;
  }
  const items = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
  return items.some((item) => STRIPE_DISCORD_BOT_UNLIMITED_PRICE_IDS.has(getStripePriceId(item?.price)));
}

function isDiscordBotUnlimitedInvoice(invoice) {
  const lines = Array.isArray(invoice?.lines?.data) ? invoice.lines.data : [];
  return lines.some((line) => STRIPE_DISCORD_BOT_UNLIMITED_PRICE_IDS.has(getStripePriceId(line?.price)));
}

function invoiceContainsProSubscription(invoice) {
  const lines = Array.isArray(invoice?.lines?.data) ? invoice.lines.data : [];
  return lines.some((line) => getStripePriceProductId(line?.price) === STRIPE_PRO_PRODUCT_ID);
}

function getProInvoiceBillingInterval(invoice, subscription) {
  const lines = Array.isArray(invoice?.lines?.data) ? invoice.lines.data : [];
  const proInvoiceLine = lines.find((line) => getStripePriceProductId(line?.price) === STRIPE_PRO_PRODUCT_ID);
  const invoiceInterval = String(proInvoiceLine?.price?.recurring?.interval || "").trim().toLowerCase();
  if (invoiceInterval === "year") return "year";

  const subscriptionItems = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
  const proSubscriptionItem = subscriptionItems.find((item) => getStripePriceProductId(item?.price) === STRIPE_PRO_PRODUCT_ID);
  return String(proSubscriptionItem?.price?.recurring?.interval || "").trim().toLowerCase() === "year" ? "year" : "month";
}

async function grantProTokensFromStripeInvoice(invoice) {
  const invoiceId = String(invoice?.id || "").trim();
  const customerId = typeof invoice?.customer === "string"
    ? invoice.customer
    : String(invoice?.customer?.id || "").trim();
  if (!invoiceId || !customerId || !stripeClient) return null;
  const billingReason = String(invoice?.billing_reason || "").trim().toLowerCase();
  if (billingReason && billingReason !== "subscription_create" && billingReason !== "subscription_cycle") {
    return null;
  }

  let subscription = null;
  const subscriptionId = typeof invoice?.subscription === "string"
    ? invoice.subscription
    : String(invoice?.subscription?.id || invoice?.parent?.subscription_details?.subscription || "").trim();
  if (subscriptionId) {
    subscription = await stripeClient.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price.product"],
    }).catch(() => null);
  }

  if (!invoiceContainsProSubscription(invoice) && getStripeSubscriptionPlan(subscription) !== "pro") {
    return null;
  }

  let user = await getAuthUserByStripeCustomerId(customerId);
  if (!user && subscription?.metadata?.appUserId) {
    user = await getAuthUserById(subscription.metadata.appUserId);
  }
  if (!user) return null;

  const billingInterval = getProInvoiceBillingInterval(invoice, subscription);
  const tokenCredits = billingInterval === "year" ? PRO_ANNUAL_AI_TOKEN_CREDITS : PRO_MONTHLY_AI_TOKEN_CREDITS;

  const rows = await supabaseRequest("/rest/v1/rpc/grant_ai_token_purchase", {
    method: "POST",
    body: JSON.stringify({
      // Invoice IDs are stable, so Stripe webhook retries cannot award the same billing period twice.
      p_session_id: "pro-" + billingInterval + ":" + invoiceId,
      p_user_id: user.id,
      p_tokens: tokenCredits,
    }),
  });

  return Number.parseInt(rows, 10) || 0;
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
  // Admins must always retain access to the control surface, including chat.
  // This prevents a stale account-level action from locking the site owner out.
  if (isAdminUser(user)) {
    return {
      websiteBlacklisted: false,
      websiteBlacklistReason: "",
      chatBanned: false,
      chatBanReason: "",
      chatTimeoutUntil: null,
      chatTimeoutReason: "",
      activeActions: [],
    };
  }

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

async function getAuthUsersWithStripeCustomerIds() {
  const rows = await supabaseRequest(
    buildAuthTablePath(`?stripe_customer_id=not.is.null&select=*`)
  ).catch(() => []);

  return Array.isArray(rows)
    ? rows.filter((row) => String(row?.stripe_customer_id || "").trim())
    : [];
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

function buildMembershipStorageFields(snapshot = {}) {
  const plan = snapshot.plan || (snapshot.premiumActive ? "plus" : "free");
  return {
    premium_active: Boolean(snapshot.premiumActive),
    plus_active: isPlusPlan(plan),
    plan,
    stripe_subscription_status: snapshot.stripeSubscriptionStatus || null,
    membership_source: snapshot.membershipSource || (snapshot.premiumActive ? "account" : "none"),
    plus_days_total: snapshot.plusDaysTotal != null ? Math.max(0, Number(snapshot.plusDaysTotal) || 0) : null,
    plus_expires_at: snapshot.plusExpiresAt || null,
    plus_current_period_start_at: snapshot.currentPeriodStartAt || null,
    plus_current_period_end_at: snapshot.currentPeriodEndAt || null,
    stripe_days_total: snapshot.stripeDaysTotal != null ? Math.max(0, Number(snapshot.stripeDaysTotal) || 0) : null,
    stripe_current_period_start_at: snapshot.stripeCurrentPeriodStartAt || null,
    stripe_current_period_end_at: snapshot.stripeCurrentPeriodEndAt || null,
  };
}

function buildStripeMembershipStorageFields(snapshot = {}) {
  return filterOptionalAuthColumns({
    stripe_days_total: snapshot.stripeDaysTotal != null ? Math.max(0, Number(snapshot.stripeDaysTotal) || 0) : null,
    stripe_current_period_start_at: snapshot.stripeCurrentPeriodStartAt || null,
    stripe_current_period_end_at: snapshot.stripeCurrentPeriodEndAt || null,
  });
}

async function syncSubscriptionStateForUser(userId, customerId, subscriptionStatus, membershipFields = {}) {
    const currentUser = await getAuthUserById(userId);
    const complimentaryMembership = getStoredComplimentaryMembership(currentUser);
  const storedMembershipSource = String(currentUser?.membership_source || "").toLowerCase();
  const timedGrantSource = storedMembershipSource.includes("complimentary grant") ? "complimentary" : "robux purchase";
  const hasComplimentaryData = Boolean(
    complimentaryMembership &&
    (complimentaryMembership.totalDays != null ||
      complimentaryMembership.expiresAt ||
      complimentaryMembership.currentPeriodEndAt)
  );
  const stripeActive = isPremiumStatus(subscriptionStatus);
  const premiumActive = stripeActive || Boolean(complimentaryMembership && complimentaryMembership.active);
  // Pro is the higher tier, so a Plus sync must never demote an existing Pro account.
  const keepExistingPro = isProMember(currentUser) && normalizeMembershipPlan(membershipFields.plan) !== "pro";
  const resolvedPlan = premiumActive ? (keepExistingPro ? "pro" : normalizeMembershipPlan(membershipFields.plan)) : "free";
    const membershipSource = stripeActive && hasComplimentaryData
      ? "stripe + " + timedGrantSource
      : stripeActive
        ? "stripe"
        : hasComplimentaryData
          ? timedGrantSource
          : "none";
    const hasStripeSnapshotData = membershipFields &&
      (membershipFields.stripeDaysTotal != null ||
        membershipFields.stripeCurrentPeriodStartAt ||
        membershipFields.stripeCurrentPeriodEndAt);
    return updateAuthUserFields(userId, {
      stripe_customer_id: customerId || null,
      premium_active: premiumActive,
      plus_active: isPlusPlan(resolvedPlan),
      plan: resolvedPlan,
      stripe_subscription_status: subscriptionStatus || null,
      membership_source: resolvedPlan === "pro" ? "stripe" : membershipSource,
      ...(resolvedPlan === "pro" ? {
        plus_days_total: null,
        plus_expires_at: null,
        plus_current_period_start_at: null,
        plus_current_period_end_at: null,
      } : {}),
      ...(hasStripeSnapshotData ? buildStripeMembershipStorageFields(membershipFields) : {}),
    });
  }

function buildStripeMembershipFieldsFromSubscription(subscription) {
  const currentPeriodStartAt = getIsoFromUnixSeconds(subscription?.current_period_start);
  const currentPeriodEndAt = getIsoFromUnixSeconds(subscription?.current_period_end);
  return {
    plan: getStripeSubscriptionPlan(subscription),
    stripeDaysTotal: getDaysBetween(currentPeriodStartAt, currentPeriodEndAt),
    stripeCurrentPeriodStartAt: currentPeriodStartAt,
    stripeCurrentPeriodEndAt: currentPeriodEndAt,
  };
}

function rankStripeSubscription(left, right) {
  const leftStatus = String(left?.status || "").toLowerCase();
  const rightStatus = String(right?.status || "").toLowerCase();
  const leftRank = isPremiumStatus(leftStatus) ? (getStripeSubscriptionPlan(left) === "pro" ? 4 : 3) : leftStatus === "past_due" ? 2 : 1;
  const rightRank = isPremiumStatus(rightStatus) ? (getStripeSubscriptionPlan(right) === "pro" ? 4 : 3) : rightStatus === "past_due" ? 2 : 1;
  if (leftRank !== rightRank) {
    return rightRank - leftRank;
  }

  return Number(right?.created || 0) - Number(left?.created || 0);
}

async function syncLatestStripeSubscriptionForCustomer(customerId, debug = null) {
  if (!stripeClient || !customerId) {
    if (debug) {
      debug.subscriptionSyncResult = "skipped_no_client_or_customer";
    }
    return null;
  }

  const subscriptions = await stripeClient.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });

  const items = Array.isArray(subscriptions?.data) ? subscriptions.data.filter(Boolean).filter((subscription) => !isDiscordBotUnlimitedSubscription(subscription)) : [];
  if (!items.length) {
    if (debug) {
      debug.subscriptionSyncResult = "no_subscriptions";
    }
    return null;
  }

  const subscription = items.sort(rankStripeSubscription)[0];
  if (!subscription) {
    if (debug) {
      debug.subscriptionSyncResult = "no_ranked_subscription";
    }
    return null;
  }

  const result = await syncSubscriptionStateFromStripeSubscription(subscription);
  if (debug) {
    debug.subscriptionSyncResult = result ? "updated" : "no_user_matched";
    debug.subscriptionStatus = subscription.status || null;
    debug.subscriptionPeriodStartAt = getIsoFromUnixSeconds(subscription.current_period_start);
    debug.subscriptionPeriodEndAt = getIsoFromUnixSeconds(subscription.current_period_end);
  }
  return result;
}

async function getPrimaryStripeSubscriptionForCustomer(customerId, options = {}) {
  if (!stripeClient || !customerId) {
    return null;
  }
  const includeCanceled = Boolean(options.includeCanceled);
  const subscriptions = await stripeClient.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 25,
  });
  const items = Array.isArray(subscriptions?.data) ? subscriptions.data.filter(Boolean).filter((subscription) => !isDiscordBotUnlimitedSubscription(subscription)) : [];
  const filtered = includeCanceled
    ? items
    : items.filter((subscription) => {
        const status = String(subscription?.status || "").toLowerCase();
        return !["canceled", "incomplete_expired"].includes(status);
      });
  if (!filtered.length) {
    return null;
  }
  return filtered.sort(rankStripeSubscription)[0] || null;
}

async function syncStripeSubscriptionObject(subscription) {
  if (!subscription) {
    return null;
  }
  return syncSubscriptionStateFromStripeSubscription(subscription);
}

async function performStripeAdminAction(targetUser, action, payload = {}) {
  if (!targetUser?.stripe_customer_id) {
    const error = new Error("This member does not have a Stripe customer attached.");
    error.statusCode = 400;
    throw error;
  }
  if (action === "add_days") {
    const subscription = await getPrimaryStripeSubscriptionForCustomer(targetUser.stripe_customer_id, {
      includeCanceled: false,
    });
    if (!subscription) {
      const error = new Error("No active Stripe subscription was found for this member.");
      error.statusCode = 404;
      throw error;
    }
    const requestedDays = Number.parseInt(String(payload.days || "0"), 10);
    const days = Number.isFinite(requestedDays) ? Math.max(1, Math.min(requestedDays, 365)) : 0;
    if (!days) {
      const error = new Error("Add at least 1 day for the Stripe extension.");
      error.statusCode = 400;
      throw error;
    }
    const baseEndUnix = Number(subscription.current_period_end || 0);
    const baseEnd = baseEndUnix > 0 ? baseEndUnix : Math.floor(Date.now() / 1000);
    const extendedTrialEnd = baseEnd + (days * 86400);
    try {
      stripeResult = await stripeClient.subscriptions.update(subscription.id, {
        trial_end: extendedTrialEnd,
        proration_behavior: "none",
      });
    } catch (_error) {
      const wrapped = new Error("Stripe did not allow a direct subscription day extension for this member. Use complimentary days for make-good time if needed.");
      wrapped.statusCode = 400;
      throw wrapped;
    }
    await syncStripeSubscriptionObject(stripeResult);
  } else if (action === "remove_plus") {
    const subscriptions = await stripeClient.subscriptions.list({
      customer: targetUser.stripe_customer_id,
      status: "all",
      limit: 100,
    });
    const items = Array.isArray(subscriptions?.data) ? subscriptions.data.filter(Boolean) : [];
    const activeSubscriptions = items.filter((subscription) => {
      const status = String(subscription?.status || "").toLowerCase();
      return !["canceled", "incomplete_expired"].includes(status);
    });
    for (const subscription of activeSubscriptions) {
      await stripeClient.subscriptions.cancel(subscription.id);
    }
    await updateAuthUserFields(targetUser.id, {
      premium_active: false,
      plus_active: false,
      plan: "free",
      stripe_subscription_status: "canceled",
      membership_source: "none",
      stripe_customer_id: null,
      stripe_days_total: null,
      stripe_current_period_start_at: null,
      stripe_current_period_end_at: null,
    });
  } else {
    const error = new Error("That Stripe action is not supported.");
    error.statusCode = 400;
    throw error;
  }

  const refreshed = await getAuthUserById(targetUser.id);
  return refreshed || targetUser;
}

async function refreshStripeMembershipForUserIfNeeded(user) {
    if (!user?.stripe_customer_id) {
      return user;
    }
  
    const debug = {
      customerId: user.stripe_customer_id,
      userId: user.id,
    };

    try {
      const bestMembership = await getBestStripeMembershipForCustomer(user.stripe_customer_id, debug);
      if (bestMembership) {
        await persistStripeMembershipSnapshotIfNeeded(user, bestMembership, debug);
      }
      await syncLatestStripeSubscriptionForCustomer(user.stripe_customer_id, debug);
      console.log("[stripe-sync] refreshed Stripe membership for user", {
        userId: user.id,
        customerId: user.stripe_customer_id,
        bestMembershipFound: Boolean(bestMembership),
        bestMembershipTotalDays: bestMembership?.totalDays ?? null,
        bestMembershipCurrentPeriodEndAt: bestMembership?.currentPeriodEndAt || null,
      });
      const refreshedUser = await getAuthUserById(user.id);
      if (refreshedUser) {
        refreshedUser.__stripeSyncDebug = debug;
      }
      return refreshedUser || user;
    } catch (error) {
      console.warn("Could not refresh Stripe membership for user:", error.message);
      debug.error = error.message;
      user.__stripeSyncDebug = debug;
      return user;
    }
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
    const complimentaryMembership = getStoredComplimentaryMembership(user);
    return updateAuthUserFields(user.id, {
      stripe_customer_id: customerId,
      premium_active: Boolean(complimentaryMembership && complimentaryMembership.active),
      plus_active: Boolean(complimentaryMembership && complimentaryMembership.active && !isProMember(user)),
      plan: complimentaryMembership && complimentaryMembership.active ? (isProMember(user) ? "pro" : "plus") : "free",
      stripe_subscription_status: subscription.status || null,
      membership_source: complimentaryMembership ? ((String(user.membership_source || "").toLowerCase().includes("complimentary grant") ? "complimentary grant" : "robux purchase") + (isProMember(user) ? " pro" : "")) : "none",
      ...buildStripeMembershipStorageFields({
        stripeDaysTotal: null,
        stripeCurrentPeriodStartAt: null,
        stripeCurrentPeriodEndAt: null,
      }),
    });
  }

  return syncSubscriptionStateForUser(
    user.id,
    customerId,
    subscription.status || null,
    buildStripeMembershipFieldsFromSubscription(subscription)
  );
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

async function getDiscordToolsProMember(req) {
  const suppliedSecret = String(req.get("X-RBLXTools-Tools-Secret") || "").trim();
  const discordUserId = String(req.get("X-RBLXTools-Discord-User-Id") || "").trim();
  const guildId = String(req.get("X-RBLXTools-Discord-Guild-Id") || "").trim();
  if (!suppliedSecret && !discordUserId) return null;

  if (!DISCORD_TOOLS_SERVICE_SECRET || !suppliedSecret || !/^\d+$/.test(discordUserId)) {
    const error = new Error("Invalid Discord tools request.");
    error.statusCode = 401;
    throw error;
  }

  const expected = Buffer.from(DISCORD_TOOLS_SERVICE_SECRET);
  const supplied = Buffer.from(suppliedSecret);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    const error = new Error("Invalid Discord tools request.");
    error.statusCode = 401;
    throw error;
  }

  if (guildId) {
    const serverAccess = await getDiscordServerAccess(guildId);
    if (!serverAccess.allowed) {
      const error = new Error(serverAccess.reason || "This Discord server cannot use RBLXTools Bot yet.");
      error.statusCode = 403;
      throw error;
    }
    const owner = await getAuthUserById(serverAccess.appUserId);
    if (!owner) {
      const error = new Error("The RBLXTools account that owns this Discord server is unavailable.");
      error.statusCode = 403;
      throw error;
    }
    return owner;
  }

  const link = await getDiscordLinkByUserId(discordUserId);
  const user = link ? await getAuthUserById(link.appUserId) : null;
  const membership = user ? await resolveMembershipSnapshot(user) : null;
  if (!user || !membership?.premiumActive || String(user.plan || "").toLowerCase() !== "pro") {
    const error = new Error("This Discord tool requires a linked, active RBLXTools Pro account.");
    error.statusCode = 403;
    throw error;
  }

  return user;
}

function requireDiscordToolsServiceSecret(req) {
  const suppliedSecret = String(req.get("X-RBLXTools-Tools-Secret") || "").trim();
  if (!DISCORD_TOOLS_SERVICE_SECRET || !suppliedSecret) {
    const error = new Error("Invalid Discord tools request.");
    error.statusCode = 401;
    throw error;
  }
  const expected = Buffer.from(DISCORD_TOOLS_SERVICE_SECRET);
  const supplied = Buffer.from(suppliedSecret);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    const error = new Error("Invalid Discord tools request.");
    error.statusCode = 401;
    throw error;
  }
}

async function requireDiscordToolsServiceIdentity(req) {
  requireDiscordToolsServiceSecret(req);
  const discordUserId = String(req.get("X-RBLXTools-Discord-User-Id") || "").trim();
  if (!/^\d+$/.test(discordUserId)) {
    const error = new Error("Invalid Discord tools request.");
    error.statusCode = 401;
    throw error;
  }
  const link = await getDiscordLinkByUserId(discordUserId);
  if (!link?.appUserId) {
    const error = new Error("Link your Discord account in RBLXTools before claiming a server.");
    error.statusCode = 403;
    throw error;
  }
  return { discordUserId, appUserId: String(link.appUserId) };
}

async function requireActivePlusUser(req) {
  const discordMember = await getDiscordToolsProMember(req);
  if (discordMember) return discordMember;

  const user = await requireAuthenticatedUser(req);
  const membership = await resolveMembershipSnapshot(user);
  if (!membership.premiumActive) {
    const error = new Error("This tool requires an active RBLXTools Plus subscription.");
    error.statusCode = 403;
    throw error;
  }
  return user;
}

async function requireToolAccount(req, res, next) {
  try {
    const discordMember = await getDiscordToolsProMember(req);
    if (discordMember) {
      req.toolAccount = discordMember;
      return next();
    }

    req.toolAccount = await requireAuthenticatedUser(req);
    return next();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.statusCode === 401
        ? "Log in or sign up to use RBLXTools tools."
        : error.message || "Could not verify your account.",
    });
  }
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

async function getAuthenticatedSocketUser(socket, payload) {
  assertAuthStorageConfigured();

  const token = getSocketBearerToken(socket, payload);

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

async function buildChatMemberProfile(payload, authenticatedUserOverride = null) {
  const sanitizedProfile = sanitizeChatMemberProfile(payload);
  const authenticatedUser = authenticatedUserOverride || await getAuthenticatedSocketUser(null, payload);

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

function applyDashboardAdminAccess(dashboard, user) {
  if (!dashboard || !isAdminUser(user) || dashboard.access) {
    return dashboard;
  }

  // Admins can configure and preview their own dashboard drafts without a paid bot plan.
  dashboard.access = true;
  dashboard.mode = "admin";
  dashboard.adminAccess = true;
  return dashboard;
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
  
  function requireOwnerStripePin(req) {
    const submittedPin = String(req.body?.ownerPin || "").trim();
    if (!submittedPin) {
      const error = new Error("Owner pin is required for Stripe Plus actions.");
      error.statusCode = 400;
      throw error;
    }
    if (submittedPin !== OWNER_STRIPE_PIN) {
      const error = new Error("Owner pin is not correct.");
      error.statusCode = 403;
      throw error;
    }
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

function normalizeMembershipGrantSource(value) {
  return String(value || "robux").trim().toLowerCase() === "complimentary" ? "complimentary" : "robux";
}

async function grantComplimentaryPlusToUser(userId, days, grantSource) {
  const targetUser = await getAuthUserByIdentifier(userId);
  if (!targetUser) {
    const error = new Error("No member account was found for that Plus grant.");
    error.statusCode = 404;
    throw error;
  }

  const safeDays = Number.isFinite(days)
    ? Math.max(1, Math.min(days, MAX_COMPLIMENTARY_PLUS_DAYS))
    : DEFAULT_COMPLIMENTARY_PLUS_DAYS;
  const existingComplimentary = getStoredComplimentaryMembership(targetUser);
  const existingExpiry = parseIsoDate(existingComplimentary?.expiresAt || existingComplimentary?.currentPeriodEndAt);
  const extensionBaseMs = existingExpiry && existingExpiry.getTime() > Date.now()
    ? existingExpiry.getTime()
    : Date.now();
  const expiresAt = new Date(extensionBaseMs + safeDays * 24 * 60 * 60 * 1000).toISOString();
  const totalDays = Math.max(
    0,
    Number.isFinite(existingComplimentary?.totalDays) ? existingComplimentary.totalDays : 0
  ) + safeDays;
  const currentPeriodStartAt = new Date().toISOString();
  const hasStripeAccess = isPremiumStatus(targetUser.stripe_subscription_status);
  const sourceLabel = normalizeMembershipGrantSource(grantSource) === "complimentary" ? "complimentary grant" : "robux purchase";

  const updatedUser = await updateAuthUserFields(targetUser.id, {
    premium_active: true,
    plus_active: !isProMember(targetUser),
    plan: isProMember(targetUser) ? "pro" : "plus",
    membership_source: isProMember(targetUser) ? sourceLabel + " pro" : (hasStripeAccess ? "stripe + " + sourceLabel : sourceLabel),
    plus_days_total: totalDays,
    plus_expires_at: expiresAt,
    plus_current_period_start_at: currentPeriodStartAt,
    plus_current_period_end_at: expiresAt,
  });
  if (!updatedUser) {
    const error = new Error("Could not save the Plus access grant.");
    error.statusCode = 500;
    throw error;
  }

  return {
    user: updatedUser,
    days: safeDays,
    expiresAt,
    totalDays,
  };
}

async function grantComplimentaryProToUser(userId, days, grantSource) {
  const targetUser = await getAuthUserByIdentifier(userId);
  if (!targetUser) {
    const error = new Error("No member account was found for that Pro grant.");
    error.statusCode = 404;
    throw error;
  }
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(days, MAX_COMPLIMENTARY_PLUS_DAYS)) : DEFAULT_COMPLIMENTARY_PLUS_DAYS;
  // A Pro grant replaces lower-tier time instead of carrying Plus days into Pro.
  const expiresAt = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString();
  const totalDays = safeDays;
  const updatedUser = await updateAuthUserFields(targetUser.id, {
    premium_active: true,
    plus_active: false,
    plan: "pro",
    membership_source: (normalizeMembershipGrantSource(grantSource) === "complimentary" ? "complimentary grant" : "robux purchase") + " pro",
    plus_days_total: totalDays,
    plus_expires_at: expiresAt,
    plus_current_period_start_at: new Date().toISOString(),
    plus_current_period_end_at: expiresAt,
  });
  if (!updatedUser) {
    const error = new Error("Could not save the Pro access grant.");
    error.statusCode = 500;
    throw error;
  }
  return { user: updatedUser, days: safeDays, expiresAt, totalDays };
}

async function grantAITokensToUser(userId, amount) {
  const targetUser = await getAuthUserByIdentifier(userId);
  if (!targetUser) {
    const error = new Error("No member account was found for that token grant.");
    error.statusCode = 404;
    throw error;
  }
  const safeAmount = Math.max(1, Math.min(Number.parseInt(amount, 10) || 0, 100000));
  const updatedUser = await updateAuthUserFields(targetUser.id, {
    ai_token_balance: getAITokenBalance(targetUser) + safeAmount,
  });
  if (!updatedUser) {
    const error = new Error("Could not save the AI token grant.");
    error.statusCode = 500;
    throw error;
  }
  return { user: updatedUser, amount: safeAmount };
}

async function removePlusFromUser(userId) {
  const targetUser = await getAuthUserByIdentifier(userId);
  if (!targetUser) {
    const error = new Error("No member account was found for that Plus removal.");
    error.statusCode = 404;
    throw error;
  }

  const hasStripeAccess = isPremiumStatus(targetUser.stripe_subscription_status);
  const updatedUser = await updateAuthUserFields(targetUser.id, {
    premium_active: hasStripeAccess,
    plus_active: hasStripeAccess && !isProMember(targetUser),
    plan: hasStripeAccess ? "plus" : "free",
    membership_source: hasStripeAccess ? "stripe" : "none",
    plus_days_total: null,
    plus_expires_at: null,
    plus_current_period_start_at: null,
    plus_current_period_end_at: null,
  });
  if (!updatedUser) {
    const error = new Error("Could not save the Plus removal.");
    error.statusCode = 500;
    throw error;
  }

  return updatedUser;
}

async function removeComplimentaryMembershipDays(userId, plan, days) {
  const targetUser = await getAuthUserByIdentifier(userId);
  if (!targetUser) {
    const error = new Error("No member account was found for this membership adjustment.");
    error.statusCode = 404;
    throw error;
  }

  const requestedPlan = normalizeMembershipPlan(plan);
  if (requestedPlan !== "plus" && requestedPlan !== "pro") {
    const error = new Error("Choose either Plus or Pro for this membership adjustment.");
    error.statusCode = 400;
    throw error;
  }
  if (normalizeMembershipPlan(targetUser.plan) !== requestedPlan) {
    const error = new Error("This member does not currently have timed " + (requestedPlan === "pro" ? "Pro" : "Plus") + " access to remove.");
    error.statusCode = 409;
    throw error;
  }

  const complimentary = getStoredComplimentaryMembership(targetUser);
  const expiry = parseIsoDate(complimentary?.expiresAt || complimentary?.currentPeriodEndAt);
  const now = Date.now();
  if (!expiry || expiry.getTime() <= now) {
    const error = new Error("This member has no active timed access to remove.");
    error.statusCode = 409;
    throw error;
  }

  const safeDays = Math.max(1, Math.min(Number.parseInt(days, 10) || 0, MAX_COMPLIMENTARY_PLUS_DAYS));
  const dayMs = 24 * 60 * 60 * 1000;
  const remainingDays = Math.ceil((expiry.getTime() - now) / dayMs);
  const removedDays = Math.min(safeDays, remainingDays);
  const nextExpiryMs = expiry.getTime() - removedDays * dayMs;
  const hasStripeAccess = isPremiumStatus(targetUser.stripe_subscription_status);
  const grantEndsNow = nextExpiryMs <= now;
  const nextTotalDays = Math.max(0, (Number(complimentary?.totalDays) || remainingDays) - removedDays);

  const updatedUser = await updateAuthUserFields(targetUser.id, grantEndsNow
    ? {
        premium_active: hasStripeAccess,
        plus_active: hasStripeAccess,
        plan: hasStripeAccess ? "plus" : "free",
        membership_source: hasStripeAccess ? "stripe" : "none",
        plus_days_total: null,
        plus_expires_at: null,
        plus_current_period_start_at: null,
        plus_current_period_end_at: null,
      }
    : {
        plus_days_total: nextTotalDays,
        plus_expires_at: new Date(nextExpiryMs).toISOString(),
        plus_current_period_end_at: new Date(nextExpiryMs).toISOString(),
      });
  if (!updatedUser) {
    const error = new Error("Could not save the membership day adjustment.");
    error.statusCode = 500;
    throw error;
  }

  return {
    user: updatedUser,
    removedDays,
    remainingDays: Math.max(0, remainingDays - removedDays),
    expiresAt: grantEndsNow ? null : new Date(nextExpiryMs).toISOString(),
  };
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

function collectCreatorStoreDetailIds(payload) {
  const ids = new Set();
  const candidatePaths = [
    "id",
    "assetId",
    "asset.id",
    "item.id",
    "item.assetId",
    "model.id",
    "model.assetId",
    "sourceAssetId",
    "rootAssetId",
    "asset.rootAssetId",
    "asset.sourceAssetId",
    "item.rootAssetId",
    "item.sourceAssetId",
    "item.modelId",
    "asset.modelId",
    "underlyingAssetId",
    "asset.underlyingAssetId",
    "item.underlyingAssetId",
  ];

  function readPath(source, path) {
    const parts = path.split(".");
    let value = source;
    for (const part of parts) {
      if (!value || typeof value !== "object" || !(part in value)) {
        return undefined;
      }
      value = value[part];
    }
    return value;
  }

  function maybeAdd(value) {
    if (typeof value === "string" && /^[0-9]+$/.test(value)) ids.add(value);
    if (typeof value === "number" && Number.isFinite(value)) ids.add(String(value));
  }

  for (const path of candidatePaths) {
    maybeAdd(readPath(payload, path));
  }

  try {
    const serialized = JSON.stringify(payload || {});
    for (const id of extractReferencedAssetIds(serialized)) {
      ids.add(String(id));
    }
  } catch (_error) {}

  return Array.from(ids);
}

function extractMeshIds(text) {
  const ids = new Set();
  const patterns = [
    /<Content name="MeshId">[\s\S]*?<url>([\s\S]*?)<\/url>[\s\S]*?<\/Content>/gi,
    /<string name="MeshId">([\s\S]*?)<\/string>/gi,
    /MeshId[\s\S]{0,500}?(?:rbxassetid:\/\/|asset\/\?id=)(\d+)/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const id = extractAssetIdFromUrl(match[1] || match[0]) || match[1];
      if (id && /^[0-9]+$/.test(String(id))) ids.add(String(id));
    }
  }
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

async function resolveAllMeshAssetsFromRobloxAsset(startId, options = {}) {
  const maxDepth = Number.isFinite(options.maxDepth) ? options.maxDepth : 5;
  const visited = new Set();
  const queue = [{ id: startId, depth: 0 }];
  const meshAssets = [];
  const seenMeshIds = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current?.id || visited.has(current.id) || current.depth > maxDepth) continue;
    visited.add(current.id);

    const assetFetch = await fetchBuffer(`https://assetdelivery.roblox.com/v1/asset/?id=${current.id}`);
    const directVersion = assetFetch.buffer.subarray(0, 16).toString("ascii");
    if (directVersion.startsWith("version ")) {
      if (!seenMeshIds.has(String(current.id))) {
        meshAssets.push({ assetId: String(current.id), buffer: assetFetch.buffer, response: assetFetch.response });
        seenMeshIds.add(String(current.id));
      }
      continue;
    }

    const assetText = assetFetch.buffer.toString("utf8");
    if (isAuthRequiredResponse(assetText)) {
      const authError = new Error("Roblox blocked access. Add ROBLOSECURITY cookie.");
      authError.code = 403;
      throw authError;
    }

    for (const meshId of extractMeshIds(assetText)) {
      if (!visited.has(meshId)) queue.unshift({ id: meshId, depth: current.depth + 1 });
    }

    for (const nextId of extractReferencedAssetIds(assetText)) {
      if (!visited.has(nextId)) queue.push({ id: nextId, depth: current.depth + 1 });
    }
  }

  return meshAssets;
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

function remapObjFaceToken(token, vertexOffset, uvOffset, normalOffset) {
  const parts = String(token || "").split("/");
  const vertexIndex = parts[0] ? String(Number(parts[0]) + vertexOffset) : "";
  const uvIndex = parts.length > 1 && parts[1] ? String(Number(parts[1]) + uvOffset) : "";
  const normalIndex = parts.length > 2 && parts[2] ? String(Number(parts[2]) + normalOffset) : "";
  if (parts.length === 1) return vertexIndex;
  if (parts.length === 2) return `${vertexIndex}/${uvIndex}`;
  return `${vertexIndex}/${uvIndex}/${normalIndex}`;
}

function mergeObjTexts(objEntries) {
  let vertexOffset = 0;
  let uvOffset = 0;
  let normalOffset = 0;
  const output = ["# Exported by RBLX Tools", "o rblxtools_multi_mesh"];

  for (let index = 0; index < objEntries.length; index += 1) {
    const entry = objEntries[index];
    const lines = String(entry?.objText || "").split(/\r?\n/);
    let entryVertices = 0;
    let entryUvs = 0;
    let entryNormals = 0;
    output.push(`g mesh_${index + 1}_${entry?.meshId || "part"}`);
    for (const rawLine of lines) {
      const line = String(rawLine || "").trim();
      if (!line || line.startsWith("#") || line.startsWith("mtllib ") || line.startsWith("usemtl ")) continue;
      if (line.startsWith("o ") || line.startsWith("g ")) continue;
      if (line.startsWith("v ")) { output.push(line); entryVertices += 1; continue; }
      if (line.startsWith("vt ")) { output.push(line); entryUvs += 1; continue; }
      if (line.startsWith("vn ")) { output.push(line); entryNormals += 1; continue; }
      if (line.startsWith("f ")) {
        const tokens = line.slice(2).trim().split(/\s+/).filter(Boolean);
        output.push("f " + tokens.map((token) => remapObjFaceToken(token, vertexOffset, uvOffset, normalOffset)).join(" "));
      }
    }
    vertexOffset += entryVertices;
    uvOffset += entryUvs;
    normalOffset += entryNormals;
  }

  output.push("");
  return output.join("\n");
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

app.get("/referrals/me", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    return res.json({ ok: true, referral: getReferralDashboard(user.id) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not load referral details." });
  }
});

app.post("/referrals/request-payout", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const state = readReferralProgram();
    refreshReferralCommissionAvailability(state);
    const available = state.commissions.filter((entry) => String(entry.referrerUserId || "") === String(user.id) && entry.status === "available");
    const availableCents = available.reduce((total, entry) => total + Math.max(0, Number(entry.amountCents) || 0), 0);
    if (availableCents < REFERRAL_MINIMUM_PAYOUT_CENTS) {
      return res.status(400).json({ error: "A $10.00 available balance is required before requesting a payout." });
    }
    if (state.payoutRequests.some((entry) => String(entry.userId || "") === String(user.id) && entry.status === "requested")) {
      return res.status(409).json({ error: "You already have a payout request waiting for review." });
    }
    const request = { id: randomUUID(), userId: user.id, amountCents: availableCents, currency: "usd", status: "requested", createdAt: new Date().toISOString() };
    available.forEach((entry) => { entry.status = "requested"; entry.payoutRequestId = request.id; });
    state.payoutRequests.push(request);
    writeReferralProgram(state);
    return res.json({ ok: true, request, referral: getReferralDashboard(user.id) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not request a payout." });
  }
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
      // Lets a safe browser retry finish a signup whose first response was lost during a server restart.
      if (verifyPassword(password, existingUser.password_hash)) {
        await updateAuthUserLoginStamp(existingUser.id);
        const freshUser = (await getAuthUserById(existingUser.id)) || existingUser;
        const token = createAuthToken(freshUser);
        setAuthCookie(req, res, token);
        return res.json({
          ok: true,
          token,
          user: await buildResolvedPublicUser(freshUser),
          recoveredSignup: true,
        });
      }
      return res.status(409).json({ error: "An account already exists for that email." });
    }

    const createdUser = await createAuthUser(email, password);
    const token = createAuthToken(createdUser);
    setAuthCookie(req, res, token);

    return res.status(201).json({
      ok: true,
      token,
      user: await buildResolvedPublicUser(createdUser),
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
    setAuthCookie(req, res, token);

    return res.json({
      ok: true,
      token,
      user: await buildResolvedPublicUser(freshUser),
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
    setAuthCookie(req, res, token);

    return res.json({
      ok: true,
      token,
      user: await buildResolvedPublicUser(freshUser),
      authProvider: "google",
    });
  } catch (error) {
    console.error("POST /auth/google failed:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not sign in with Google.",
    });
  }
});

app.post("/auth/logout", async (req, res) => {
  clearAuthCookie(req, res);
  return res.json({ ok: true });
});

app.get("/auth/me", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const freshUser = await refreshStripeMembershipForUserIfNeeded(user);
    const resolvedUser = freshUser || user;
    const deviceId = getRequestDeviceId(req);
    if (deviceId) {
      await linkDeviceToUser(resolvedUser, deviceId).catch(() => null);
    }
    const [moderation, rawBotDashboard, discordLink, publicUser] = await Promise.all([
      summarizeModerationForTarget(resolvedUser, deviceId),
      getBotDashboard(resolvedUser.id),
      getDiscordLinkByAppUserId(resolvedUser.id),
      buildResolvedPublicUser(resolvedUser),
    ]);
    const botDashboard = applyDashboardAdminAccess(rawBotDashboard, resolvedUser);
    botDashboard.discordLinked = Boolean(discordLink);
    const botInviteUrl = /^\d+$/.test(DISCORD_TOOLS_BOT_CLIENT_ID)
      ? `https://discord.com/oauth2/authorize?client_id=${DISCORD_TOOLS_BOT_CLIENT_ID}&scope=bot%20applications.commands&permissions=35856`
      : null;
    return res.json({
      ok: true,
      chatToken: createAuthToken(resolvedUser),
      user: publicUser,
      moderation,
      botDashboard,
      botInviteUrl,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not load the current user.",
    });
  }
});

app.get("/chat/sync", (req, res) => {
  const room = cleanText(req.query?.room || defaultChatRoom, 40) || defaultChatRoom;
  const history = recentMessages.get(room) || [];
  const onlineCount = getUsers(room).length;
  return res.json({
    ok: true,
    history,
    onlineCount,
    serverNow: new Date().toISOString(),
  });
});

app.post("/chat/message", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const deviceId = getRequestDeviceId(req);
    const moderation = await summarizeModerationForTarget(user, deviceId);
    if (moderation.websiteBlacklisted || moderation.chatBanned || moderation.chatTimeoutUntil) {
      return res.status(403).json({ error: moderation.chatBanReason || moderation.chatTimeoutReason || moderation.websiteBlacklistReason || "Chat is unavailable for this account.", moderation });
    }

    const text = cleanText(req.body?.text, maxMessageLength);
    if (!text) return res.status(400).json({ error: "Enter a message first." });

    const room = cleanText(req.body?.room || defaultChatRoom, 40) || defaultChatRoom;
    if (text.toLowerCase() === "/clear") {
      if (!isAdminUser(user)) return res.status(403).json({ error: "Only admins can clear live chat." });
      clearRoomMessages(room);
      return res.json({ ok: true, cleared: true, history: [] });
    }
    const profile = await buildChatMemberProfile(req.body || {}, user);
    const message = createChatRoomMessage(profile, { text, replyTo: req.body?.replyTo });
    pushRoomMessage(room, message);
    return res.json({ ok: true, message });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not send the chat message." });
  }
});

app.post("/chat/react", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const deviceId = getRequestDeviceId(req);
    const moderation = await summarizeModerationForTarget(user, deviceId);
    if (moderation.websiteBlacklisted || moderation.chatBanned || moderation.chatTimeoutUntil) {
      return res.status(403).json({ error: moderation.chatBanReason || moderation.chatTimeoutReason || moderation.websiteBlacklistReason || "Chat is unavailable for this account." });
    }

    const room = cleanText(req.body?.room || defaultChatRoom, 40) || defaultChatRoom;
    const messageId = cleanText(req.body?.messageId, 120);
    const history = recentMessages.get(room) || [];
    const message = history.find((entry) => String(entry?.id || "") === messageId);
    if (!message || message.system) return res.status(404).json({ error: "That message is no longer available." });

    const userId = String(user.id || "").trim();
    const hearts = Array.isArray(message.heartUserIds) ? message.heartUserIds.map(String) : [];
    message.heartUserIds = hearts.includes(userId) ? hearts.filter((value) => value !== userId) : hearts.concat(userId).slice(-500);
    persistRoomHistory(room);
    io.to(room).emit("chat-history", recentMessages.get(room) || []);
    return res.json({ ok: true, history: recentMessages.get(room) || [] });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not update the reaction." });
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
    const membership = await resolveMembershipSnapshot(user);
    return res.json({
      ok: true,
      premiumActive: membership.premiumActive,
      plan: membership.plan,
      plusActive: membership.plan === "plus",
      proActive: membership.plan === "pro",
      stripeSubscriptionStatus: membership.stripeSubscriptionStatus,
      complimentaryExpiresAt: membership.complimentaryExpiresAt,
      membershipSource: membership.membershipSource,
      plusDaysTotal: membership.plusDaysTotal,
      plusDaysLeft: membership.plusDaysLeft,
      plusExpiresAt: membership.plusExpiresAt,
      currentPeriodStartAt: membership.currentPeriodStartAt,
      currentPeriodEndAt: membership.currentPeriodEndAt,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not load premium status.",
    });
  }
});

app.post("/support/report", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const category = normalizeSupportCategory(req.body?.category);
    const reporterUserId = cleanText(req.body?.reporterUserId, 80);
    const reportedUserId = cleanText(req.body?.reportedUserId, 80);
    const reporterDiscordUsername = cleanText(req.body?.reporterDiscordUsername, 120);
    const reporterEmailInput = cleanText(req.body?.reporterEmail, 160);
    const details = cleanText(req.body?.details, 1800);
    const pageUrl = cleanText(req.body?.pageUrl, 300);
    const reporterDisplayName = cleanText(
      req.body?.reporterDisplayName || user.display_name || user.username || user.email || "",
      displayNameLength
    );

    if (!category) {
      return res.status(400).json({ error: "Choose a support report reason." });
    }
    if (!reporterUserId) {
      return res.status(400).json({ error: "Your user ID is required." });
    }
    if (String(user.id) !== reporterUserId) {
      return res.status(400).json({ error: "Use your own account user ID when sending a report." });
    }
    if (category === "user_report" && !reportedUserId) {
      return res.status(400).json({ error: "A reported user ID is required for member reports." });
    }
    if (!details) {
      return res.status(400).json({ error: "Add a short explanation before sending the report." });
    }
    if (!reporterDiscordUsername && !reporterEmailInput && !user.email) {
      return res.status(400).json({ error: "Add a Discord username or email so we can contact you back." });
    }

    const attachment = parseSupportAttachment(req.body?.attachment);
    const report = {
      category,
      categoryLabel: getSupportCategoryLabel(category),
      details,
      reporterUserId: String(user.id),
      reporterEmail: reporterEmailInput || user.email || "",
      reporterDiscordUsername: reporterDiscordUsername || "",
      reporterDisplayName: reporterDisplayName || user.email || "Member",
      reportedUserId: reportedUserId || "",
      pageUrl: pageUrl || "",
      submittedAt: new Date().toISOString(),
      userAgent: cleanText(req.headers["user-agent"] || "", 240),
      attachment,
    };

    const delivery = await deliverSupportReport(report);

    return res.json({
      ok: true,
      message: "Support report sent successfully.",
      destination: delivery && delivery.destination ? delivery.destination : "unknown",
    });
  } catch (error) {
    console.error("POST /support/report failed:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not send the support report.",
    });
  }
});

app.post("/ai/generate-clothing", async (req, res) => {
  try {
    await requireAdminUser(req);
    const references = parseAIReferenceImages(
      req.body?.references,
      MAX_AI_CLOTHING_REFERENCE_IMAGES,
      "clothing-reference"
    );
    const promptPayload = {
      templateKey: req.body?.templateKey,
      garmentType: req.body?.garmentType,
      gender: req.body?.gender,
      sleeveLength: req.body?.sleeveLength,
      resolvedSleeveLength: req.body?.resolvedSleeveLength,
      pantsLength: req.body?.pantsLength,
      resolvedPantsLength: req.body?.resolvedPantsLength,
      styleDirection: req.body?.styleDirection,
      colorPalette: req.body?.colorPalette,
      audience: req.body?.audience,
      footwear: req.body?.footwear,
      userPrompt: req.body?.userPrompt,
      negativePrompt: req.body?.negativePrompt,
      styleName: req.body?.styleName,
    };

    const built = buildAIClothingPrompt(promptPayload);
    const generationPlan = buildAIClothingGenerationPlan(built);
    const preserveWhite = /\bwhite\b/i.test(`${built.userPrompt || ""} ${built.palette || ""}`);
    const timestamp = Date.now();
    const outputs = [];
    for (let index = 0; index < generationPlan.length; index += 1) {
      const variant = generationPlan[index];
      const enhancedPrompt = buildAIClothingVariantPrompt(built, variant);
      const result = await generateAIClothingImage({
        templateType: variant.templateType,
        enhancedPrompt,
        sleeveLength: built.sleeveLength,
        pantsLength: built.pantsLength,
        references,
        preserveWhite,
      });
      outputs.push({
        key: variant.key,
        label: variant.label,
        templateType: result.templateType,
        model: result.model,
        sourceGenerationSize: result.sourceGenerationSize,
        outputWidth: result.outputWidth,
        outputHeight: result.outputHeight,
        imageDataUrl: `data:${result.outputMime};base64,${result.outputBase64}`,
        downloadFileName: `rblxtools-ai-${variant.key}-${timestamp}-${index + 1}.png`,
      });
    }
    const primary = outputs[0];

    return res.json({
      ok: true,
      garmentType: built.garmentType,
      sleeveLength: built.sleeveLength,
      pantsLength: built.pantsLength,
      templateType: primary ? primary.templateType : getAIBaseTemplateType(built.garmentType),
      enhancedPrompt: built.promptPreview,
      promptPreview: built.promptPreview,
      model: primary ? primary.model : AI_CLOTHING_MODEL,
      sourceGenerationSize: primary ? primary.sourceGenerationSize : AI_CLOTHING_GENERATION_SIZE,
      outputWidth: primary ? primary.outputWidth : AI_CLOTHING_OUTPUT_WIDTH,
      outputHeight: primary ? primary.outputHeight : AI_CLOTHING_OUTPUT_HEIGHT,
      imageDataUrl: primary ? primary.imageDataUrl : "",
      downloadFileName: primary ? primary.downloadFileName : `rblxtools-ai-${built.garmentType}-${timestamp}.png`,
      outputs,
    });
  } catch (error) {
    console.error("POST /ai/generate-clothing failed:", error);
    return res.status(error.statusCode || 500).json({
      error: error.message || "AI clothing generation failed.",
    });
  }
});

// Admin-only Meshy proxy. Task URLs are short-lived Meshy signed URLs and the
// provider key never leaves this process.
app.post("/ai/ugc/preview", async (req, res) => {
  let user;
  let tokenCost = 0;
  let tokensDebited = false;
  try {
    user = await requireAdminUser(req);
    const inputMode = String(req.body?.inputMode || "text") === "image" ? "image" : "text";
    const prompt = cleanText(req.body?.prompt, 800);
    const sourceImageUrl = inputMode === "image" && req.body?.imageDataUrl ? storeUGCSourceImage(req.body.imageDataUrl) : "";
    if (inputMode === "image" && !sourceImageUrl) return res.status(400).json({ error: "Add a reference image before creating an image-to-model asset." });
    if (inputMode === "text" && !prompt) return res.status(400).json({ error: "Describe the asset before creating a text-to-model asset." });
    const assetType = String(req.body?.assetType || "ugc") === "game" ? "game" : "ugc";
    const isUgcAsset = assetType === "ugc";
    const withTexture = Boolean(req.body?.withTexture);
    const modelType = isUgcAsset ? "smart-topology" : "standard";
    const minTriangles = isUgcAsset ? 300 : 50;
    const maxTriangles = isUgcAsset ? 4000 : 15000;
    const targetPolycount = Math.max(minTriangles, Math.min(maxTriangles, Number.parseInt(req.body?.targetPolycount, 10) || maxTriangles));
    const textureResolution = ["2k", "4k"].includes(String(req.body?.textureResolution || "")) ? String(req.body.textureResolution) : "2k";
    tokenCost = getUGCGenerationTokenCost({ assetType, inputMode, withTexture });
    const aiTokens = await debitAITokens(user.id, tokenCost);
    tokensDebited = true;
    const task = sourceImageUrl
      ? await requestMeshy("/v1/image-to-3d", { method: "POST", body: { image_url: sourceImageUrl, model_type: modelType, ai_model: isUgcAsset ? "meshy-t2" : "latest", should_texture: withTexture, should_remesh: !isUgcAsset, target_polycount: targetPolycount, texture_resolution: textureResolution, enable_pbr: withTexture && Boolean(req.body?.enablePbr), target_formats: ["glb"], alpha_thumbnail: true } })
      : await requestMeshy("/v2/text-to-3d", { method: "POST", body: { mode: "preview", prompt, model_type: modelType, ai_model: "latest", should_remesh: modelType === "standard", target_polycount: targetPolycount, target_formats: ["glb"], alpha_thumbnail: true, moderation: true } });
    const taskId = task.result || task.id;
    ugcGenerationCharges.set(taskId, { userId: user.id, assetType, inputMode, withTexture, tokenCost, textureTokenCost: withTexture && inputMode === "text" ? 30 : 0, expiresAt: Date.now() + UGC_SOURCE_IMAGE_TTL_MS });
    return res.json({ ok: true, taskId, taskType: inputMode, assetType, targetPolycount, textureResolution, withTexture, tokenCost, aiTokens });
  } catch (error) {
    if (user && tokensDebited) await restoreAITokens(user.id, tokenCost).catch(() => null);
    console.error("POST /ai/ugc/preview failed:", error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not start the UGC preview." });
  }
});

app.post("/ai/ugc/refine", async (req, res) => {
  try {
    const user = await requireAdminUser(req);
    const previewTaskId = cleanMeshyTaskId(req.body?.previewTaskId);
    const charge = ugcGenerationCharges.get(previewTaskId);
    if (!charge || charge.userId !== user.id || !charge.withTexture || charge.inputMode !== "text") {
      return res.status(409).json({ error: "This preview is not eligible for a texture pass. Start a new textured generation." });
    }
    const textureResolution = ["2k", "4k"].includes(String(req.body?.textureResolution || "")) ? String(req.body.textureResolution) : "2k";
    const task = await requestMeshy("/v2/text-to-3d", {
      method: "POST",
      body: { mode: "refine", preview_task_id: previewTaskId, enable_pbr: Boolean(req.body?.enablePbr), texture_resolution: textureResolution, target_formats: ["glb"], alpha_thumbnail: true },
    });
    return res.json({ ok: true, taskId: task.result || task.id, aiTokens: getAITokenBalance(await getAuthUserById(user.id)) });
  } catch (error) {
    console.error("POST /ai/ugc/refine failed:", error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not start texture generation." });
  }
});

app.get("/ai/ugc/tasks/:taskId", async (req, res) => {
  try {
    await requireAdminUser(req);
    const taskId = cleanMeshyTaskId(req.params.taskId);
    const taskType = String(req.query.type || "text") === "image" ? "image" : "text";
    const task = await requestMeshy((taskType === "image" ? "/v1/image-to-3d/" : "/v2/text-to-3d/") + encodeURIComponent(taskId));
    return res.json({ ok: true, task: { id: task.id, status: task.status, progress: Number(task.progress || 0), prompt: task.prompt || "", thumbnailUrl: task.alpha_thumbnail_url || task.thumbnail_url || "", modelUrls: task.model_urls || {}, textureUrls: Array.isArray(task.texture_urls) ? task.texture_urls : [], consumedCredits: task.consumed_credits, error: task.task_error && task.task_error.message ? task.task_error.message : "" } });
  } catch (error) {
    console.error("GET /ai/ugc/tasks failed:", error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not load the UGC task." });
  }
});

// Meshy fetches this short-lived, random URL directly while creating an
// image-to-3D task. It intentionally has no member session requirement.
app.get("/ai/ugc/source/:sourceId", (req, res) => {
  const sourceId = String(req.params.sourceId || "");
  const source = ugcSourceImages.get(sourceId);
  if (!source || Number(source.expiresAt || 0) <= Date.now()) {
    ugcSourceImages.delete(sourceId);
    return res.status(404).end();
  }
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.type(source.type);
  return res.send(source.buffer);
});

app.get("/ai/ugc/tasks/:taskId/download", async (req, res) => {
  try {
    await requireAdminUser(req);
    const taskId = cleanMeshyTaskId(req.params.taskId);
    const taskType = String(req.query.type || "text") === "image" ? "image" : "text";
    const assetType = String(req.query.assetType || "ugc") === "game" ? "game" : "ugc";
    const task = await requestMeshy((taskType === "image" ? "/v1/image-to-3d/" : "/v2/text-to-3d/") + encodeURIComponent(taskId));
    if (task.status !== "SUCCEEDED" || !task.model_urls?.glb) {
      return res.status(409).json({ error: "The GLB is not ready to download yet." });
    }
    const modelResponse = await fetch(task.model_urls.glb);
    if (!modelResponse.ok) throw new Error("Could not retrieve the finished GLB.");
    const modelBuffer = Buffer.from(await modelResponse.arrayBuffer());
    const limit = assetType === "ugc" ? 4000 : 15000;
    const prepared = await prepareRobloxGLBDownload(modelBuffer, limit, assetType === "ugc" ? 1024 : 4096);
    res.setHeader("Content-Type", "model/gltf-binary");
    res.setHeader("Content-Disposition", `attachment; filename="rblxtools-${assetType}-${taskId}.glb"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(prepared.buffer);
  } catch (error) {
    console.error("GET /ai/ugc/tasks/download failed:", error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not prepare the Roblox-safe GLB." });
  }
});

// Fast page gate: avoids a live Stripe refresh when a tool only needs identity and entitlements.
app.get("/auth/session", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    return res.json({ ok: true, user: buildPublicUser(user) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not load the current session." });
  }
});

app.post("/ai/generate-thumbnail", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const isPro = isProMember(user);
    const membership = await resolveMembershipSnapshot(user);
    const thumbnailHistoryLimit = getAIThumbnailHistoryLimit(membership);
    const aiTokens = await debitAITokens(user.id, AI_THUMBNAIL_TOKEN_COST);
    let result;
    try {
      result = await generateAIThumbnail({
        prompt: req.body?.prompt,
        references: req.body?.references,
        aspectRatio: req.body?.aspectRatio,
        outputQuality: req.body?.outputQuality,
        isPro,
      });
    } catch (generationError) {
      // A failed provider request should not consume a member's token.
      const latestUser = await getAuthUserById(user.id).catch(() => null);
      const restoredBalance = getAITokenBalance(latestUser) + AI_THUMBNAIL_TOKEN_COST;
      await updateAuthUserFields(user.id, { ai_token_balance: restoredBalance }).catch(() => null);
      throw generationError;
    }
    const timestamp = Date.now();
    const imageDataUrl = `data:${result.outputMime};base64,${result.outputBase64}`;
    const downloadFileName = `rblxtools-ai-thumbnail-${timestamp}.png`;
    let historyItem = null;
    try {
      historyItem = await saveAIThumbnailHistory(user.id, {
        prompt: req.body?.prompt,
        references: req.body?.references,
        imageDataUrl,
        downloadFileName,
      });
    } catch (historyError) {
      console.warn("Could not save AI thumbnail history:", historyError.message);
    }
    return res.json({
      ok: true,
      aiTokens,
      tokenCost: AI_THUMBNAIL_TOKEN_COST,
      model: result.model,
      promptPreview: result.promptPreview,
      outputWidth: result.outputWidth,
      outputHeight: result.outputHeight,
      imageDataUrl,
      downloadFileName,
      historyItem,
      historyLimit: thumbnailHistoryLimit,
      isPro,
    });
  } catch (error) {
    console.error("POST /ai/generate-thumbnail failed:", error);
    return res.status(error.statusCode || 500).json({
      error: error.message || "AI thumbnail generation failed.",
      aiTokens: Number.isFinite(error.aiTokens) ? error.aiTokens : undefined,
    });
  }
});

app.get("/ai/thumbnail-history", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const historyLimit = getAIThumbnailHistoryLimit(await resolveMembershipSnapshot(user));
    const retentionCutoff = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString();
    const localItems = getPersistentAIThumbnailHistory(user.id);
    // History is account-owned and retained for 30 days. Remove expired rows
    // while loading, so old chats cannot reappear after a server restart.
    await supabaseRequest(
      buildTablePath(AI_THUMBNAIL_HISTORY_TABLE, `?user_id=eq.${encodeURIComponent(user.id)}&created_at=lt.${encodeURIComponent(retentionCutoff)}`),
      { method: "DELETE" }
    ).catch((error) => console.warn("Could not prune expired AI thumbnail history:", error.message));
    let databaseItems = [];
    try {
      const rows = await supabaseRequest(
        buildTablePath(AI_THUMBNAIL_HISTORY_TABLE, `?user_id=eq.${encodeURIComponent(user.id)}&created_at=gte.${encodeURIComponent(retentionCutoff)}&order=created_at.desc&limit=50&select=id,prompt,reference_images,image_data_url,download_filename,feedback,created_at`)
      );
      databaseItems = (Array.isArray(rows) ? rows : []).map(buildAIThumbnailHistoryRecord).filter(Boolean);
      databaseItems.forEach((item) => savePersistentAIThumbnailHistory(user.id, item));
    } catch (error) {
      console.warn("Could not load AI thumbnail history from Supabase; using local backup:", error.message);
    }
    const merged = new Map();
    [...databaseItems, ...localItems].forEach((item) => {
      if (!item?.id) return;
      const key = String(item.id);
      merged.set(key, { ...(merged.get(key) || {}), ...item });
    });
    return res.json({ ok: true, items: pruneAIThumbnailHistory([...merged.values()]).slice(0, historyLimit), historyLimit });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not load thumbnail history." });
  }
});

app.patch("/ai/thumbnail-history/:historyId", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const historyId = String(req.params.historyId || "").trim();
    const requestedFeedback = String(req.body?.feedback || "");
    const hasFeedback = ["like", "dislike"].includes(requestedFeedback);
    const title = cleanAIThumbnailText(req.body?.title, 90);
    if (!historyId) return res.status(400).json({ error: "A history item is required." });
    if (!hasFeedback && !title) return res.status(400).json({ error: "Choose feedback or provide a title." });
    let item = getPersistentAIThumbnailHistory(user.id).find((entry) => String(entry.id) === historyId) || null;
    if (hasFeedback) {
      try {
        const rows = await supabaseRequest(
          buildTablePath(AI_THUMBNAIL_HISTORY_TABLE, `?id=eq.${encodeURIComponent(historyId)}&user_id=eq.${encodeURIComponent(user.id)}`),
          { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ feedback: requestedFeedback }) }
        );
        const updated = Array.isArray(rows) ? buildAIThumbnailHistoryRecord(rows[0]) : null;
        if (updated) item = updated;
      } catch (error) {
        console.warn("Could not update AI thumbnail feedback in Supabase:", error.message);
      }
    }
    if (!item) return res.status(404).json({ error: "Thumbnail history item not found." });
    const updates = {};
    if (hasFeedback) updates.feedback = requestedFeedback;
    if (title) updates.title = title;
    updatePersistentAIThumbnailHistory(user.id, historyId, updates);
    return res.json({ ok: true, item: { ...item, ...updates } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not save thumbnail feedback." });
  }
});

app.delete("/ai/thumbnail-history/:historyId", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const historyId = String(req.params.historyId || "").trim();
    if (!historyId) return res.status(400).json({ error: "A history item is required." });
    await supabaseRequest(
      buildTablePath(AI_THUMBNAIL_HISTORY_TABLE, `?id=eq.${encodeURIComponent(historyId)}&user_id=eq.${encodeURIComponent(user.id)}`),
      { method: "DELETE" }
    ).catch((error) => console.warn("Could not delete AI thumbnail history from Supabase:", error.message));
    deletePersistentAIThumbnailHistory(user.id, historyId);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not delete thumbnail history." });
  }
});

app.post("/game-launcher/launch", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const placeId = String(req.body?.placeId || "").trim();

    if (!/^\d{1,20}$/.test(placeId)) {
      return res.status(400).json({
        error: "Use numbers only for the Roblox place ID.",
      });
    }

    const joinUrl = `roblox://placeID=${encodeURIComponent(placeId)}`;
    const webUrl = `https://www.roblox.com/games/${encodeURIComponent(placeId)}`;

    emitToolActivity(defaultChatRoom, "game-launcher", getActionTargetLabel(user));

    return res.json({
      ok: true,
      placeId,
      joinUrl,
      webUrl,
      issuedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not prepare the Roblox launch link.",
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

app.post("/auth/change-email", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const newEmail = normalizeEmail(req.body?.newEmail);
    const currentPassword = String(req.body?.currentPassword || "");

    if (!validateAuthEmail(newEmail)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (!currentPassword || !verifyPassword(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }
    if (newEmail === normalizeEmail(user.email)) {
      return res.status(400).json({ error: "Choose a different email address." });
    }

    const existingUser = await getAuthUserByEmail(newEmail);
    if (existingUser && existingUser.id !== user.id) {
      return res.status(409).json({ error: "An account already exists for that email." });
    }

    const updatedUser = await updateAuthUserFields(user.id, { email: newEmail });
    const freshUser = updatedUser || ((await getAuthUserById(user.id)) || user);
    const token = createAuthToken(freshUser);
    setAuthCookie(req, res, token);

    return res.json({
      ok: true,
      token,
      user: await buildResolvedPublicUser(freshUser),
    });
  } catch (error) {
    console.error("POST /auth/change-email failed:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not change email address.",
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

installSiteOpsFeature({ app, baseDir: __dirname, requireAdminUser, requireAuthenticatedUser, isAdminUser, cleanText, io });

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
    const freshTargetUser = await refreshStripeMembershipForUserIfNeeded(targetUser);
    const resolvedTargetUser = freshTargetUser || targetUser;
    const [moderation, deviceLinks, rawBotDashboard] = await Promise.all([
      summarizeModerationForTarget(resolvedTargetUser),
      getDeviceLinksForUser(resolvedTargetUser.id),
      getBotDashboard(resolvedTargetUser.id),
    ]);
    const botDashboard = {
      access: Boolean(rawBotDashboard.access),
      mode: rawBotDashboard.mode,
      totalUses: rawBotDashboard.totalUses,
      usedUses: rawBotDashboard.usedUses,
      remainingUses: rawBotDashboard.remainingUses,
      subscription: rawBotDashboard.subscription ? {
        status: rawBotDashboard.subscription.status,
        source: rawBotDashboard.subscription.source || null,
        currentPeriodEndAt: rawBotDashboard.subscription.currentPeriodEndAt || null,
      } : null,
      server: rawBotDashboard.server ? {
        guildId: rawBotDashboard.server.guildId,
        guildName: rawBotDashboard.server.guildName,
        claimedAt: rawBotDashboard.server.claimedAt || null,
      } : null,
    };

      return res.json({
        ok: true,
        admin: await buildResolvedPublicUser(adminUser),
        member: await buildResolvedPublicUser(resolvedTargetUser),
        stripeSyncDebug: resolvedTargetUser?.__stripeSyncDebug || null,
        moderation,
        deviceCount: deviceLinks.length,
        botDashboard,
      });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not look up that member.",
    });
  }
});

app.post("/admin/refresh-member-membership", async (req, res) => {
  try {
    await requireAdminUser(req);
    const targetIdentifier = String(req.body?.userId || req.body?.email || req.body?.target || "").trim();

    if (!targetIdentifier) {
      return res.status(400).json({ error: "A user ID or email is required." });
    }

    const targetUser = await getAuthUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      return res.status(404).json({ error: "No member was found for that ID or email." });
    }

    if (targetUser.stripe_customer_id) {
      await syncLatestStripeSubscriptionForCustomer(targetUser.stripe_customer_id);
    }

    const freshUser = await getAuthUserById(targetUser.id);
    const moderation = await summarizeModerationForTarget(freshUser || targetUser);
    const deviceLinks = await getDeviceLinksForUser(targetUser.id);

    return res.json({
      ok: true,
      message: targetUser.stripe_customer_id
        ? "Member membership refreshed from Stripe."
        : "Member does not have a Stripe customer to refresh.",
      member: await buildResolvedPublicUser(freshUser || targetUser),
      moderation,
      deviceCount: deviceLinks.length,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not refresh that member.",
    });
  }
});

app.post("/admin/backfill-stripe-memberships", async (req, res) => {
  try {
    await requireAdminUser(req);

    const users = await getAuthUsersWithStripeCustomerIds();
    if (!users.length) {
      return res.json({
        ok: true,
        message: "No Stripe members were found to backfill.",
        totalChecked: 0,
        refreshedCount: 0,
        failedCount: 0,
        failures: [],
      });
    }

    var refreshedCount = 0;
    var failedCount = 0;
    var failures = [];

    for (const user of users) {
      try {
        const result = await syncLatestStripeSubscriptionForCustomer(user.stripe_customer_id);
        if (result) {
          refreshedCount += 1;
        } else {
          failedCount += 1;
          failures.push({
            email: user.email || null,
            userId: user.id || null,
            reason: "No Stripe subscription data was returned."
          });
        }
      } catch (error) {
        failedCount += 1;
        failures.push({
          email: user.email || null,
          userId: user.id || null,
          reason: error && error.message ? error.message : "Unknown Stripe sync error."
        });
      }
    }

    return res.json({
      ok: true,
      message: "Stripe membership backfill finished.",
      totalChecked: users.length,
      refreshedCount,
      failedCount,
      failures: failures.slice(0, 25),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not backfill Stripe memberships.",
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
    if (!note) {
      return res.status(400).json({ error: "A note is required before Plus access can be granted." });
    }

    const targetUser = await getAuthUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      return res.status(404).json({ error: "No member was found for that ID or email." });
    }

    const grantSource = normalizeMembershipGrantSource(req.body?.grantSource);
    const grantResult = await grantComplimentaryPlusToUser(targetUser.id, days, grantSource);
    const updatedUser = grantResult.user;
    await createModerationAction({ userId: targetUser.id, userEmail: targetUser.email, actionType: grantSource === "complimentary" ? "complimentary_plus" : "robux_purchase_plus", note, expiresAt: grantResult.expiresAt, adminUserId: adminUser.id, adminEmail: adminUser.email });
    const reward = createMemberReward({ userId: targetUser.id, title: req.body?.title, note, rewardType: "plus", amount: grantResult.days, adminUser });

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

    await refreshMembershipStateForConnectedUser(updatedUser || targetUser);
    emitToUserInRoom(defaultChatRoom, targetUser.id, "member-reward-ready", reward);
    emitModerationLog(defaultChatRoom, getActionTargetLabel(targetUser) + " received " + grantResult.days + " days of " + (grantSource === "complimentary" ? "complimentary" : "Robux purchase") + " Plus.");
    return res.json({
      ok: true,
      message: (grantSource === "complimentary" ? "Complimentary" : "Robux purchase") + " Plus granted for " + grantResult.days + " days.",
      member: await buildResolvedPublicUser(updatedUser || targetUser),
      days: grantResult.days,
      expiresAt: grantResult.expiresAt,
      grantedBy: {
        id: adminUser.id,
        email: adminUser.email,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not grant Plus access.",
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
    if (isProMember(targetUser)) {
      return res.status(409).json({ error: "This member has Pro. The Plus removal action cannot downgrade a Pro plan." });
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

    await refreshMembershipStateForConnectedUser(updatedUser || targetUser);
    emitModerationLog(defaultChatRoom, "Plus access was removed from " + getActionTargetLabel(targetUser) + ".");
    return res.json({
      ok: true,
      message: "Plus access removed successfully.",
      member: await buildResolvedPublicUser(updatedUser || targetUser),
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

app.post("/admin/remove-complimentary-membership-days", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const targetIdentifier = String(req.body?.userId || req.body?.email || req.body?.target || "").trim();
    const plan = normalizeMembershipPlan(req.body?.plan);
    const note = cleanText(req.body?.note, 160);
    const days = Number.parseInt(String(req.body?.days || "0"), 10);
    if (!targetIdentifier) return res.status(400).json({ error: "A user ID or email is required." });
    if (!note) return res.status(400).json({ error: "A staff note is required before days can be removed." });
    if (plan !== "plus" && plan !== "pro") return res.status(400).json({ error: "Choose Plus or Pro." });

    const targetUser = await getAuthUserByIdentifier(targetIdentifier);
    if (!targetUser) return res.status(404).json({ error: "No member was found for that ID or email." });
    const adjustment = await removeComplimentaryMembershipDays(targetUser.id, plan, days);
    await createModerationAction({
      userId: targetUser.id,
      userEmail: targetUser.email,
      actionType: "complimentary_" + plan + "_days_removed",
      note,
      expiresAt: adjustment.expiresAt,
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
    });
    await refreshMembershipStateForConnectedUser(adjustment.user || targetUser);
    emitModerationLog(defaultChatRoom, adjustment.removedDays + " timed " + (plan === "pro" ? "Pro" : "Plus") + " day(s) were removed from " + getActionTargetLabel(targetUser) + ".");
    return res.json({
      ok: true,
      message: adjustment.removedDays + " " + (plan === "pro" ? "Pro" : "Plus") + " day(s) removed. " + adjustment.remainingDays + " timed day(s) remain.",
      member: await buildResolvedPublicUser(adjustment.user || targetUser),
      removedDays: adjustment.removedDays,
      remainingDays: adjustment.remainingDays,
      expiresAt: adjustment.expiresAt,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not remove membership days." });
  }
});

app.post("/admin/stripe-plus-action", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    requireOwnerStripePin(req);
    const targetIdentifier = String(req.body?.userId || req.body?.email || req.body?.target || "").trim();
    const note = cleanText(req.body?.note, 160);
    const action = String(req.body?.action || "").trim().toLowerCase();
    const days = Number.parseInt(String(req.body?.days || "0"), 10);
    if (!targetIdentifier) {
      return res.status(400).json({ error: "A user ID or email is required." });
    }
    const targetUser = await getAuthUserByIdentifier(targetIdentifier);
    if (!targetUser) {
      return res.status(404).json({ error: "No member was found for that ID or email." });
    }
    const updatedUser = await performStripeAdminAction(targetUser, action, { days, note });
    console.log(
      "[ADMIN STRIPE ACTION]",
      JSON.stringify({
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        targetId: targetUser.id,
        targetEmail: targetUser.email,
        action,
        days: Number.isFinite(days) ? days : null,
        note: note || "",
        actedAt: new Date().toISOString(),
      })
    );
    await refreshMembershipStateForConnectedUser(updatedUser || targetUser);
      const messageMap = {
        add_days: "Stripe subscription extension attempted and synced.",
        remove_plus: "Stripe subscription canceled and Plus removed from the account.",
      };
    return res.json({
      ok: true,
      message: messageMap[action] || "Stripe action completed successfully.",
      member: await buildResolvedPublicUser(updatedUser || targetUser),
      action,
      actedBy: {
        id: adminUser.id,
        email: adminUser.email,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not complete the Stripe action.",
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
    const rewardType = ["plus", "pro", "tokens"].includes(String(req.body?.rewardType || "").toLowerCase()) ? String(req.body.rewardType).toLowerCase() : "plus";
    const amountRaw = Number.parseInt(String(req.body?.amount || req.body?.days || DEFAULT_COMPLIMENTARY_PLUS_DAYS), 10);
    const maxClaimsRaw = Number.parseInt(String(req.body?.maxClaims || 1), 10);
    const expiresSecondsRaw = Number.parseInt(String(req.body?.expiresSeconds || 60), 10);

    const amount = Number.isFinite(amountRaw) ? Math.max(1, Math.min(amountRaw, rewardType === "tokens" ? 100000 : MAX_COMPLIMENTARY_PLUS_DAYS)) : DEFAULT_COMPLIMENTARY_PLUS_DAYS;
    const maxClaims = Number.isFinite(maxClaimsRaw) ? Math.max(1, Math.min(maxClaimsRaw, 500)) : 1;
    const expiresSeconds = Number.isFinite(expiresSecondsRaw) ? Math.max(1, Math.min(expiresSecondsRaw, 86400)) : 60;
    const rewardLabel = rewardType === "tokens" ? "AI Tokens" : rewardType === "pro" ? "Pro" : "Plus";
    const title = cleanText(req.body?.title, 60) || "Claim Free " + rewardLabel;
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
      rewardType,
      amount,
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
    await createModerationAction({ actionType: "claim_drop_started", note: title + " · " + amount + " " + rewardLabel, adminUserId: adminUser.id, adminEmail: adminUser.email });
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
      text: adminDisplayName + " started a claimable " + rewardLabel + " drop in chat.",
      specialType: "claimDrop",
      claimDrop: state.claimDrop,
    });

    pushRoomMessage(room, message);
    emitRoomSpecials(room);

    return res.json({
      ok: true,
      message: "Claimable " + rewardLabel + " drop sent into live chat.",
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
    const rewardType = ["plus", "pro", "tokens"].includes(String(req.body?.rewardType || "").toLowerCase()) ? String(req.body.rewardType).toLowerCase() : "plus";
    const amountRaw = Number.parseInt(String(req.body?.amount || req.body?.days || DEFAULT_COMPLIMENTARY_PLUS_DAYS), 10);
    const winnersRaw = Number.parseInt(String(req.body?.winnersCount || 1), 10);
    const durationSecondsRaw = Number.parseInt(String(req.body?.durationSeconds || 300), 10);

    const amount = Number.isFinite(amountRaw) ? Math.max(1, Math.min(amountRaw, rewardType === "tokens" ? 100000 : MAX_COMPLIMENTARY_PLUS_DAYS)) : DEFAULT_COMPLIMENTARY_PLUS_DAYS;
    const winnersCount = Number.isFinite(winnersRaw) ? Math.max(1, Math.min(winnersRaw, 100)) : 1;
    const durationSeconds = Number.isFinite(durationSecondsRaw) ? Math.max(1, Math.min(durationSecondsRaw, 604800)) : 300;
    const rewardLabel = rewardType === "tokens" ? "AI Tokens" : rewardType === "pro" ? "Pro" : "Plus";
    const title = cleanText(req.body?.title, 60) || rewardLabel + " Chat Rain";
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
      rewardType,
      amount,
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
    await createModerationAction({ actionType: "chat_rain_started", note: title + " · " + amount + " " + rewardLabel + " · " + winnersCount + " winner(s)", adminUserId: adminUser.id, adminEmail: adminUser.email });

    state.rainTimeout = setTimeout(() => {
      finalizeChatRain(room, "completed").catch((error) => {
        console.error("Finalize chat rain failed:", error.message);
      });
    }, durationSeconds * 1000);

    emitSpecialAnnouncement(
      room,
      adminDisplayName + " started a live chat rain for " + winnersCount + " " + rewardLabel + " winner" + (winnersCount === 1 ? "" : "s") + "."
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

app.get("/store/ai-token-packages", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req).catch(() => null);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, packages: getPublicAITokenPackages(user) });
  } catch (error) {
    return res.status(error.statusCode || 403).json({ error: error.message || "Log in to view AI token packages." });
  }
});

app.get("/member-rewards/pending", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, rewards: getPendingMemberRewards(user.id) });
  } catch (error) {
    return res.status(error.statusCode || 403).json({ error: error.message || "Log in to view rewards." });
  }
});

app.post("/member-rewards/claim", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const reward = claimMemberReward(user.id, req.body?.rewardId);
    return res.json({ ok: true, reward });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not claim this reward." });
  }
});

app.post("/admin/grant-pro", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const targetUser = await getAuthUserByIdentifier(req.body?.userId);
    const note = cleanText(req.body?.note, 500);
    const days = Math.max(1, Math.min(Number.parseInt(req.body?.days, 10) || DEFAULT_COMPLIMENTARY_PLUS_DAYS, MAX_COMPLIMENTARY_PLUS_DAYS));
    if (!targetUser) return res.status(404).json({ error: "No member account was found for that Pro grant." });
    if (!note) return res.status(400).json({ error: "A note is required before Pro access can be granted." });
    const grantSource = normalizeMembershipGrantSource(req.body?.grantSource);
    const grantResult = await grantComplimentaryProToUser(targetUser.id, days, grantSource);
    await createModerationAction({ userId: targetUser.id, userEmail: targetUser.email, actionType: grantSource === "complimentary" ? "complimentary_pro" : "robux_purchase_pro", note, expiresAt: grantResult.expiresAt, adminUserId: adminUser.id, adminEmail: adminUser.email });
    const reward = createMemberReward({ userId: targetUser.id, title: req.body?.title, note, rewardType: "pro", amount: grantResult.days, adminUser });
    await refreshMembershipStateForConnectedUser(grantResult.user);
    emitToUserInRoom(defaultChatRoom, targetUser.id, "member-reward-ready", reward);
    emitModerationLog(defaultChatRoom, getActionTargetLabel(targetUser) + " received " + grantResult.days + " days of " + (grantSource === "complimentary" ? "complimentary" : "Robux purchase") + " Pro.");
    return res.json({ ok: true, message: (grantSource === "complimentary" ? "Complimentary" : "Robux purchase") + " Pro granted for " + grantResult.days + " days.", member: buildPublicUser(grantResult.user), days: grantResult.days, expiresAt: grantResult.expiresAt, grantedBy: { id: adminUser.id, email: adminUser.email } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not grant Pro access." });
  }
});

app.post("/admin/grant-ai-tokens", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const targetUser = await getAuthUserByIdentifier(req.body?.userId);
    const note = cleanText(req.body?.note, 500);
    if (!targetUser) return res.status(404).json({ error: "No member account was found for that token grant." });
    if (!note) return res.status(400).json({ error: "A note is required before AI tokens can be granted." });
    const grantResult = await grantAITokensToUser(targetUser.id, req.body?.amount);
    await createModerationAction({ userId: targetUser.id, userEmail: targetUser.email, actionType: "ai_token_grant", reason: String(grantResult.amount), note, adminUserId: adminUser.id, adminEmail: adminUser.email });
    const reward = createMemberReward({ userId: targetUser.id, title: req.body?.title, note, rewardType: "tokens", amount: grantResult.amount, adminUser });
    emitToUserInRoom(defaultChatRoom, targetUser.id, "member-reward-ready", reward);
    emitModerationLog(defaultChatRoom, getActionTargetLabel(targetUser) + " received " + grantResult.amount + " AI tokens.");
    return res.json({ ok: true, message: grantResult.amount + " AI tokens granted.", member: buildPublicUser(grantResult.user), amount: grantResult.amount, grantedBy: { id: adminUser.id, email: adminUser.email } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not grant AI tokens." });
  }
});

app.post("/admin/grant-discord-bot-access", async (req, res) => {
  try {
    const adminUser = await requireAdminUser(req);
    const targetUser = await getAuthUserByIdentifier(req.body?.userId);
    const note = cleanText(req.body?.note, 500);
    const grantType = String(req.body?.grantType || "").trim().toLowerCase();
    if (!targetUser) return res.status(404).json({ error: "No member account was found for that bot grant." });
    if (!note) return res.status(400).json({ error: "A staff note is required before bot access can be granted." });
    if (!["unlimited", "uses"].includes(grantType)) return res.status(400).json({ error: "Choose Unlimited Uses or Pay by usage." });

    // This is an admin-only complimentary entitlement. Stripe remains the sole customer purchase path.
    const result = grantType === "unlimited"
      ? await grantComplimentaryUnlimited(targetUser.id)
      : await grantComplimentaryUses({ appUserId: targetUser.id, uses: req.body?.uses });
    const amount = grantType === "unlimited" ? "Unlimited Uses" : `${Number.parseInt(req.body?.uses, 10)} uses`;
    await createModerationAction({ userId: targetUser.id, userEmail: targetUser.email, actionType: grantType === "unlimited" ? "discord_bot_unlimited_grant" : "discord_bot_uses_grant", reason: amount, note, adminUserId: adminUser.id, adminEmail: adminUser.email });
    emitModerationLog(defaultChatRoom, getActionTargetLabel(targetUser) + " received complimentary Discord Bot " + amount + ".");
    return res.json({ ok: true, message: grantType === "unlimited" ? "Complimentary Unlimited Uses granted." : "Complimentary Pay by usage credited: " + result + " total uses.", member: buildPublicUser(targetUser), totalUses: grantType === "uses" ? result : null });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not grant Discord Bot access." });
  }
});

app.get("/admin/staff-notes", async (req, res) => {
  try {
    await requireAdminUser(req);
    const rows = await supabaseRequest(buildTablePath(MODERATION_ACTIONS_TABLE, "?note=not.is.null&order=created_at.desc&limit=100&select=action_type,note,admin_email,user_email,created_at"));
    return res.json({ ok: true, notes: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not load staff notes." });
  }
});

app.post("/store/create-ai-token-checkout", async (req, res) => {
  try {
    assertStripePortalConfigured();
    const user = await requireAuthenticatedUser(req);
    const packageDefinition = getAITokenPackage(req.body?.packageKey);
    if (!packageDefinition) {
      return res.status(400).json({ error: "Choose a valid AI token package." });
    }
    if (!packageDefinition.productId) {
      return res.status(503).json({ error: "This AI token package is not configured yet." });
    }

    const customerId = await getOrCreateStripeCustomerForUser(user);
    const priceId = await resolveAITokenPackagePrice(packageDefinition);
    const referralCode = normalizeReferralCode(req.body?.referralCode);
    const checkoutSession = await stripeClient.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: getSafeAiTokenStoreSuccessUrl(),
      cancel_url: getSafeAiTokenStoreCancelUrl(),
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: {
        appUserId: user.id,
        aiTokenPackage: packageDefinition.key,
        aiTokenQuantity: String(packageDefinition.tokens),
        referralCode,
      },
    });

    return res.json({ ok: true, url: checkoutSession.url });
  } catch (error) {
    console.error("POST /store/create-ai-token-checkout failed:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Could not create the AI token checkout session.",
    });
  }
});

app.post("/store/confirm-ai-token-checkout", async (req, res) => {
  try {
    assertStripePortalConfigured();
    const user = await requireAuthenticatedUser(req);
    const sessionId = String(req.body?.sessionId || "").trim();
    if (!sessionId) return res.status(400).json({ error: "A checkout session ID is required." });

    const session = await stripeClient.checkout.sessions.retrieve(sessionId);
    const sessionCustomerId = typeof session?.customer === "string"
      ? session.customer
      : String(session?.customer?.id || "").trim();
    const belongsToUser = Boolean(
      (user.stripe_customer_id && sessionCustomerId && sessionCustomerId === user.stripe_customer_id) ||
      String(session?.client_reference_id || "") === String(user.id || "") ||
      String(session?.metadata?.appUserId || "") === String(user.id || "")
    );
    if (!belongsToUser) return res.status(403).json({ error: "That checkout session does not belong to this account." });
    if (session?.mode !== "payment" || !session?.metadata?.aiTokenQuantity) {
      return res.status(400).json({ error: "That checkout session is not an AI token purchase." });
    }
    if (session?.payment_status !== "paid") {
      return res.json({ ok: true, pending: true, paymentStatus: session?.payment_status || "pending" });
    }

    await grantAITokensFromStripeCheckout(session);
    const refreshedUser = await getAuthUserById(user.id);
    return res.json({
      ok: true,
      pending: false,
      creditedTokens: Number.parseInt(session.metadata.aiTokenQuantity, 10) || 0,
      tokenBalance: getAITokenBalance(refreshedUser || user),
    });
  } catch (error) {
    console.error("POST /store/confirm-ai-token-checkout failed:", error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not confirm the AI token purchase." });
  }
});

app.get("/store/discord-bot-unlimited-status", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const subscription = await getUnlimitedSubscription(user.id);
    return res.json({
      ok: true,
      configured: Boolean(STRIPE_DISCORD_BOT_UNLIMITED_PRICE_IDS.size),
      active: isUnlimitedActive(subscription),
      unclaimedUses: await getPurchasedUses(user.id),
      status: subscription?.status || "none",
      currentPeriodEndAt: subscription?.currentPeriodEndAt || null,
      cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not load the Discord bot subscription." });
  }
});

app.get("/discord-bot/dashboard", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const dashboard = applyDashboardAdminAccess(await getBotDashboard(user.id), user);
    dashboard.discordLinked = Boolean(await getDiscordLinkByAppUserId(user.id));
    const inviteUrl = /^\d+$/.test(DISCORD_TOOLS_BOT_CLIENT_ID)
      ? `https://discord.com/oauth2/authorize?client_id=${DISCORD_TOOLS_BOT_CLIENT_ID}&scope=bot%20applications.commands&permissions=35856`
      : null;
    return res.json({ ok: true, dashboard, inviteUrl });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not load the RBLXTools Bot dashboard." });
  }
});

app.get("/account-overview/preference", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    return res.json({ ok: true, ...(await getAccountOverviewPreference(user.id)) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not load the account preference." });
  }
});

app.post("/account-overview/preference", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    return res.json({ ok: true, ...(await setAccountOverviewPreference({ appUserId: user.id, selectedTab: req.body?.selectedTab })) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not save the account preference." });
  }
});

app.post("/discord-bot/dashboard/claim-code", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    return res.json({ ok: true, ...(await createServerClaimCode(user.id)) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not create a server claim code." });
  }
});

app.post("/discord-bot/dashboard/server-settings", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const dashboard = applyDashboardAdminAccess(await updateServerSettings({ appUserId: user.id, guildId: req.body?.guildId, perUserLimit: req.body?.perUserLimit, userLimitEnabled: req.body?.userLimitEnabled, userLimitPeriod: req.body?.userLimitPeriod, userLimitStackingEnabled: req.body?.userLimitStackingEnabled, roleDailyLimits: req.body?.roleDailyLimits, roleDailyLimitsEnabled: req.body?.roleDailyLimitsEnabled, roleLimitPeriod: req.body?.roleLimitPeriod }), user);
    return res.json({ ok: true, dashboard });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not save Discord server settings." });
  }
});

app.post("/discord-bot/dashboard/server-controls", async (req, res) => {
  try { const user = await requireAuthenticatedUser(req); return res.json({ ok: true, dashboard: applyDashboardAdminAccess(await updateServerControls({ appUserId: user.id, guildId: req.body?.guildId, paused: req.body?.paused, blockedCommands: req.body?.blockedCommands, alertsEnabled: req.body?.alertsEnabled, alertThresholds: req.body?.alertThresholds, alertChannelId: req.body?.alertChannelId }), user) }); }
  catch (error) { return res.status(error.statusCode || 500).json({ error: error.message || "Could not save bot controls." }); }
});

app.post("/discord-bot/dashboard/reset-member", async (req, res) => {
  try { const user = await requireAuthenticatedUser(req); return res.json({ ok: true, dashboard: await resetMemberDailyUse({ appUserId: user.id, guildId: req.body?.guildId, discordUserId: req.body?.discordUserId }) }); }
  catch (error) { return res.status(error.statusCode || 500).json({ error: error.message || "Could not reset member usage." }); }
});

app.post("/discord-bot/dashboard/unclaim-server", async (req, res) => {
  try { const user = await requireAuthenticatedUser(req); return res.json({ ok: true, dashboard: await unclaimServer({ appUserId: user.id, guildId: req.body?.guildId }) }); }
  catch (error) { return res.status(error.statusCode || 500).json({ error: error.message || "Could not unclaim this server." }); }
});

app.post("/discord-bot/service/claim-server", async (req, res) => {
  try {
    const identity = await requireDiscordToolsServiceIdentity(req);
    const dashboard = await claimDiscordServer({ code: req.body?.code, appUserId: identity.appUserId, guildId: req.body?.guildId, guildName: req.body?.guildName, alertChannels: req.body?.alertChannels });
    return res.json({ ok: true, dashboard });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not claim this Discord server." });
  }
});

app.post("/discord-bot/service/sync-alert-channels", async (req, res) => {
  try {
    requireDiscordToolsServiceSecret(req);
    await syncDiscordServerChannels({ guildId: req.body?.guildId, alertChannels: req.body?.alertChannels });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not sync Discord channels." });
  }
});

app.post("/discord-bot/service/consume-use", async (req, res) => {
  try {
    await requireDiscordToolsServiceIdentity(req);
    const usage = await consumeDiscordServerUse({ guildId: req.body?.guildId, discordUserId: req.get("X-RBLXTools-Discord-User-Id"), discordRoleIds: req.body?.discordRoleIds, commandName: req.body?.commandName });
    return res.json({ ok: true, usage });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not use this Discord server entitlement." });
  }
});

app.post("/discord-bot/service/command-policy", async (req, res) => {
  try {
    await requireDiscordToolsServiceIdentity(req);
    return res.json({ ok: true, ...(await getDiscordServerCommandPolicy({ guildId: req.body?.guildId, commandName: req.body?.commandName })) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not check this server command." });
  }
});

app.post("/discord-bot/service/usage-summary", async (req, res) => {
  try {
    await requireDiscordToolsServiceIdentity(req);
    return res.json({ ok: true, usage: await getDiscordServerUsageSummary({ guildId: req.body?.guildId, discordUserId: req.get("X-RBLXTools-Discord-User-Id"), discordRoleIds: req.body?.discordRoleIds }) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not check this server's usage." });
  }
});

app.post("/discord-bot/service/usage-counter", async (req, res) => {
  try {
    await requireDiscordToolsServiceIdentity(req);
    return res.json({ ok: true, dashboard: await setDiscordServerUsageCounter({ guildId: req.body?.guildId, channelId: req.body?.channelId }) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not configure the usage counter." });
  }
});

app.post("/store/create-discord-bot-use-checkout", async (req, res) => {
  try {
    assertStripePortalConfigured();
    const user = await requireAuthenticatedUser(req);
    const uses = Number.parseInt(req.body?.uses, 10);
    if (!Number.isFinite(uses) || uses < 5 || uses > 50000 || uses % 5 !== 0) {
      return res.status(400).json({ error: "Choose between 5 and 50,000 uses in 5-use steps." });
    }
    const customerId = await getOrCreateStripeCustomerForUser(user);
    const checkoutSession = await stripeClient.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: uses / 5,
          product_data: { name: `RBLXTools Discord Bot - ${uses.toLocaleString("en-US")} Uses`, description: "Shared Discord server bot uses. Claim to one server after purchase." },
        },
        quantity: 1,
      }],
      success_url: `${getSanitizedAppBaseUrl()}/discord-bot?checkout=uses_success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: getSafeDiscordBotStoreCancelUrl(),
      client_reference_id: user.id,
      metadata: { appUserId: user.id, productType: "discord_bot_uses", discordBotUses: String(uses) },
    });
    return res.json({ ok: true, url: checkoutSession.url });
  } catch (error) {
    console.error("POST /store/create-discord-bot-use-checkout failed:", error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not create the Discord bot use checkout." });
  }
});

app.post("/store/confirm-discord-bot-use-checkout", async (req, res) => {
  try {
    assertStripePortalConfigured();
    const user = await requireAuthenticatedUser(req);
    const sessionId = String(req.body?.sessionId || "").trim();
    const session = await stripeClient.checkout.sessions.retrieve(sessionId);
    if (String(session?.metadata?.appUserId || "") !== user.id || session?.mode !== "payment" || session?.metadata?.productType !== "discord_bot_uses") {
      return res.status(403).json({ error: "That checkout session does not belong to this account." });
    }
    if (session.payment_status !== "paid") return res.status(409).json({ error: "Stripe is still confirming this payment. Refresh in a moment." });
    const unclaimedUses = await grantPurchasedUses(session);
    return res.json({ ok: true, unclaimedUses, creditedUses: Number.parseInt(session.metadata.discordBotUses, 10) || 0 });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not confirm the Discord bot use purchase." });
  }
});

app.post("/store/create-discord-bot-unlimited-checkout", async (req, res) => {
  try {
    assertDiscordBotUnlimitedCheckoutConfigured();
    const user = await requireAuthenticatedUser(req);
    const existingSubscription = await getUnlimitedSubscription(user.id);
    if (isUnlimitedActive(existingSubscription)) {
      return res.status(409).json({ error: "This account already has an active Discord Bot Unlimited subscription." });
    }

    const billingPeriod = String(req.body?.billingPeriod || "monthly").trim().toLowerCase();
    const priceId = billingPeriod === "annual" ? STRIPE_DISCORD_BOT_UNLIMITED_ANNUAL_PRICE_ID : billingPeriod === "monthly" ? STRIPE_DISCORD_BOT_UNLIMITED_MONTHLY_PRICE_ID : "";
    if (!priceId) return res.status(400).json({ error: "Choose the monthly or annual Unlimited plan." });
    const customerId = await getOrCreateStripeCustomerForUser(user);
    const checkoutSession = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: getSafeDiscordBotStoreSuccessUrl(),
      cancel_url: getSafeDiscordBotStoreCancelUrl(),
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: { appUserId: user.id, productType: "discord_bot_unlimited", billingPeriod },
      subscription_data: { metadata: { appUserId: user.id, discordBotUnlimited: "true", productType: "discord_bot_unlimited", billingPeriod } },
    });
    return res.json({ ok: true, url: checkoutSession.url });
  } catch (error) {
    console.error("POST /store/create-discord-bot-unlimited-checkout failed:", error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not create the Discord Bot Unlimited checkout." });
  }
});

app.post("/store/confirm-discord-bot-unlimited-checkout", async (req, res) => {
  try {
    assertDiscordBotUnlimitedCheckoutConfigured();
    const user = await requireAuthenticatedUser(req);
    const sessionId = String(req.body?.sessionId || "").trim();
    if (!sessionId) return res.status(400).json({ error: "A checkout session ID is required." });
    const session = await stripeClient.checkout.sessions.retrieve(sessionId);
    const customerId = typeof session?.customer === "string" ? session.customer : String(session?.customer?.id || "").trim();
    const belongsToUser = Boolean(
      (user.stripe_customer_id && customerId && user.stripe_customer_id === customerId) ||
      String(session?.client_reference_id || "") === user.id ||
      String(session?.metadata?.appUserId || "") === user.id
    );
    if (!belongsToUser) return res.status(403).json({ error: "That checkout session does not belong to this account." });
    if (session?.mode !== "subscription" || session?.metadata?.productType !== "discord_bot_unlimited") {
      return res.status(400).json({ error: "That checkout session is not a Discord Bot Unlimited purchase." });
    }
    const subscriptionId = typeof session?.subscription === "string" ? session.subscription : String(session?.subscription?.id || "").trim();
    if (!subscriptionId) return res.status(409).json({ error: "Stripe is still creating this subscription. Refresh in a moment." });
    const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
    const entitlement = await setUnlimitedSubscription(subscription, user.id);
    return res.json({ ok: true, active: isUnlimitedActive(entitlement), status: entitlement.status, currentPeriodEndAt: entitlement.currentPeriodEndAt });
  } catch (error) {
    console.error("POST /store/confirm-discord-bot-unlimited-checkout failed:", error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not confirm the Discord Bot Unlimited subscription." });
  }
});

app.post("/auth/create-checkout-session", async (req, res) => {
    try {
    assertStripeCheckoutConfigured();
    const user = await requireAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomerForUser(user);
    const billingInterval = normalizeBillingInterval(req.body?.billingInterval);
    const priceId = await resolvePlusRecurringPrice(billingInterval);
    const referralCode = normalizeReferralCode(req.body?.referralCode);

    const checkoutSession = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: getSafeCheckoutSuccessUrl(),
      cancel_url: getSafeCheckoutCancelUrl(),
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: {
        appUserId: user.id,
        billingInterval,
        referralCode,
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

app.post("/auth/create-pro-checkout-session", async (req, res) => {
  try {
    assertStripePortalConfigured();
    const user = await requireAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomerForUser(user);
    const billingInterval = normalizeBillingInterval(req.body?.billingInterval);
    const priceId = await resolveRecurringProductPrice(STRIPE_PRO_PRODUCT_ID, billingInterval);
    const referralCode = normalizeReferralCode(req.body?.referralCode);
    const checkoutSession = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: getSafeCheckoutSuccessUrl(),
      cancel_url: getSafeCheckoutCancelUrl(),
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: { appUserId: user.id, plan: "pro", billingInterval, referralCode },
      subscription_data: { metadata: { appUserId: user.id, plan: "pro", billingInterval } },
    });
    return res.json({ ok: true, url: checkoutSession.url });
  } catch (error) {
    console.error("POST /auth/create-pro-checkout-session failed:", error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not create a Pro checkout session." });
  }
  });

app.get("/auth/membership-pricing", async (_req, res) => {
  try {
    assertStripeCheckoutConfigured();
    const plusMonthly = await stripeClient.prices.retrieve(STRIPE_PRICE_ID);
    const plusProduct = plusMonthly?.product;
    const plusProductId = typeof plusProduct === "string" ? plusProduct : String(plusProduct?.id || "").trim();
    const [plusPrices, proPrices] = await Promise.all([
      getRecurringProductPrices(plusProductId),
      getRecurringProductPrices(STRIPE_PRO_PRODUCT_ID),
    ]);
    const byInterval = (prices, interval) => serializeMembershipPrice(prices.find((price) => price?.recurring?.interval === interval));
    return res.json({
      ok: true,
      plus: { month: serializeMembershipPrice(plusMonthly), year: byInterval(plusPrices, "year") },
      pro: { month: byInterval(proPrices, "month"), year: byInterval(proPrices, "year") },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Could not load membership pricing." });
  }
});
  
  app.get("/auth/checkout-session-summary", async (req, res) => {
    try {
      assertStripeCheckoutConfigured();
      const user = await requireAuthenticatedUser(req);
      const sessionId = String(req.query?.session_id || "").trim();
      if (!sessionId) {
        return res.status(400).json({ error: "A checkout session ID is required." });
      }
      const session = await stripeClient.checkout.sessions.retrieve(sessionId);
      const sessionCustomerId = typeof session?.customer === "string"
        ? session.customer
        : session?.customer && session.customer.id
          ? session.customer.id
          : "";
      const matchesUser = Boolean(
        (user.stripe_customer_id && sessionCustomerId && sessionCustomerId === user.stripe_customer_id) ||
        String(session?.client_reference_id || "") === String(user.id || "") ||
        String(session?.metadata?.appUserId || "") === String(user.id || "")
      );
      if (!matchesUser) {
        return res.status(403).json({ error: "That checkout session does not belong to this account." });
      }
      const lineItems = await stripeClient.checkout.sessions.listLineItems(sessionId, {
        limit: 10,
        expand: ["data.price.product"],
      }).catch(() => ({ data: [] }));
      const items = Array.isArray(lineItems?.data)
        ? lineItems.data.map((line) => {
            const productName = typeof line?.price?.product === "object" && line.price.product
              ? String(line.price.product.name || "").trim()
              : "";
            const description = String(line?.description || "").trim();
            return {
              description: productName || description || "RBTools Plus",
              quantity: Number(line?.quantity || 1),
            };
          })
        : [];
      const currency = String(session?.currency || "usd").toUpperCase();
      const amountTotal = Number(session?.amount_total || 0);
      const amountTotalFormatted = Number.isFinite(amountTotal)
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
          }).format(amountTotal / 100)
        : null;
      return res.json({
        ok: true,
        sessionId,
        status: session?.status || null,
        paymentStatus: session?.payment_status || null,
        mode: session?.mode || null,
        itemName: items[0]?.description || "RBTools Plus",
        items,
        amountTotal,
        amountTotalFormatted,
        currency,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || "Could not load the checkout summary.",
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

app.get("/developer-asset", async (_req, res) => {
  return res.status(410).json({
    error: "The Game Cloner tool has been removed from this website.",
  });
});

app.get("/ugc-texture", requireToolAccount, async (req, res) => {
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
    await emitToolActivityForRequest(req, "ugc-downloader", getRequestActivityParam(req, "displayName", displayNameLength));

    res.setHeader("Content-Type", textureAsset.mime);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Roblox-Texture-Id", textureAsset.assetId);

    return res.send(textureAsset.buffer);
  } catch (error) {
    console.error("UGC texture fetch failed:", error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
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
    await requireActivePlusUser(req);
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
    await emitToolActivityForRequest(req, "ugc-downloader", cleanText(req.body?.displayName || req.body?.username || "", displayNameLength));

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
  try {
    await requireActivePlusUser(req);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.statusCode === 401
        ? "Log in to use Animations."
        : "Animations requires an active RBLXTools Plus or Pro membership.",
    });
  }

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
  const itemMode = String(req.query.mode || "ugc").trim().toLowerCase() === "classic" ? "classic" : "ugc";

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
    let meshAssets;

    if (directVersion.startsWith("version ")) {
      meshAssets = [{
        assetId: id,
        buffer: assetFetch.buffer,
        response: assetFetch.response,
      }];
    } else if (itemMode === "classic") {
      const primaryMesh = await resolveMeshAssetFromRobloxAsset(id, { maxDepth: 5 });
      meshAssets = primaryMesh ? [primaryMesh] : [];
    } else {
      meshAssets = await resolveAllMeshAssetsFromRobloxAsset(id, { maxDepth: 5 });
    }

    if (!meshAssets?.length) {
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

    const meshId = meshAssets[0].assetId;
    const meshIds = meshAssets.map((entry) => entry.assetId);

    let meshObj;

    try {
      if (meshAssets.length === 1) {
        meshObj = await parseRobloxMeshToObj(meshAssets[0].buffer, meshAssets[0].assetId);
      } else {
        const objEntries = [];
        for (const meshAsset of meshAssets) {
          objEntries.push({
            meshId: meshAsset.assetId,
            objText: await parseRobloxMeshToObj(meshAsset.buffer, meshAsset.assetId),
          });
        }
        meshObj = mergeObjTexts(objEntries);
      }
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
    res.setHeader("X-Roblox-Mesh-Ids", meshIds.join(","));

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
const clearedChatRooms = new Map();
const roomSpecials = new Map();
const maxRecentMessages = 50;
const maxMessageLength = 500;
const displayNameLength = 24;
const usernameLength = 32;
const favoriteToolLength = 32;
const chatBioLength = 150;
const defaultChatRoom = "rblxtools-main";

// Keep chat history outside the read-only LiteSpeed document root so clears and
// 24-hour pruning persist across server restarts.
const chatHistoryPath = path.join(RBLXTOOLS_STATE_DIR, "chat-history.json");
const chatHistoryRetentionMs = 24 * 60 * 60 * 1000;
const chatHistoryPruneIntervalMs = 5 * 60 * 1000;

function getChatMessageTimestamp(message) {
  const parsed = Date.parse(String(message?.createdAt || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pruneRecentMessages(messages, now = Date.now()) {
  const cutoff = now - chatHistoryRetentionMs;
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message?.specialType !== "toolActivity" && getChatMessageTimestamp(message) >= cutoff)
    .slice(-maxRecentMessages);
}

function persistRecentMessages() {
  try {
    const persisted = readJsonFile(chatHistoryPath, { rooms: {}, clearedRooms: {} });
    const persistedClears = persisted && typeof persisted.clearedRooms === "object" ? persisted.clearedRooms : {};
    Object.entries(persistedClears).forEach(([room, clearedAt]) => {
      const timestamp = Date.parse(String(clearedAt || ""));
      const current = clearedChatRooms.get(room) || 0;
      if (Number.isFinite(timestamp) && timestamp > current) clearedChatRooms.set(room, timestamp);
    });
    const payload = {
      updatedAt: new Date().toISOString(),
      clearedRooms: Object.fromEntries(Array.from(clearedChatRooms.entries()).map(([room, timestamp]) => [room, new Date(timestamp).toISOString()])),
      rooms: Object.fromEntries(
        Array.from(recentMessages.entries())
          .map(([room, messages]) => [room, pruneRecentMessages(messages).filter((message) => getChatMessageTimestamp(message) > (clearedChatRooms.get(room) || 0))])
          .filter(([, messages]) => messages.length)
      ),
    };
    writeJsonFile(chatHistoryPath, payload);
  } catch (error) {
    console.error("[CHAT HISTORY] Could not persist chat history.", error);
  }
}

function persistRoomHistory(room) {
  const nextHistory = pruneRecentMessages(recentMessages.get(room) || []);
  if (nextHistory.length) {
    recentMessages.set(room, nextHistory);
  } else {
    recentMessages.delete(room);
  }
  persistRecentMessages();
}

function loadPersistedRecentMessages() {
  try {
    if (!fs.existsSync(chatHistoryPath)) {
      writeJsonFile(chatHistoryPath, { updatedAt: null, clearedRooms: {}, rooms: {} });
      return;
    }

    const parsed = JSON.parse(fs.readFileSync(chatHistoryPath, "utf8"));
    const persistedClears = parsed && typeof parsed.clearedRooms === "object" ? parsed.clearedRooms : {};
    Object.entries(persistedClears).forEach(([room, clearedAt]) => {
      const timestamp = Date.parse(String(clearedAt || ""));
      if (Number.isFinite(timestamp)) clearedChatRooms.set(room, timestamp);
    });
    const roomEntries = parsed && typeof parsed === "object" && parsed.rooms && typeof parsed.rooms === "object"
      ? Object.entries(parsed.rooms)
      : [];

    roomEntries.forEach(([room, messages]) => {
      const nextHistory = pruneRecentMessages(messages).filter((message) => getChatMessageTimestamp(message) > (clearedChatRooms.get(room) || 0));
      if (nextHistory.length) {
        recentMessages.set(room, nextHistory);
      }
    });

    persistRecentMessages();
  } catch (error) {
    console.error("[CHAT HISTORY] Could not load chat history.", error);
    recentMessages.clear();
  }
}


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
    rewardType: drop.rewardType || "plus",
    amount: drop.amount || drop.days,
    days: drop.amount || drop.days,
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
  persistRoomHistory(room);
  io.to(room).emit("chat-history", recentMessages.get(room) || []);
}

function serializeChatRain(rain) {
  if (!rain) return null;

  return {
    id: rain.id,
    title: rain.title,
    rewardType: rain.rewardType || "plus",
    amount: rain.amount || rain.days,
    days: rain.amount || rain.days,
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
    heartUserIds: Array.isArray(payload.heartUserIds)
      ? payload.heartUserIds.map((value) => cleanText(value, 120)).filter(Boolean).slice(0, 500)
      : [],
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
  persistRoomHistory(room);
  io.to(room).emit("chat-message", message);
}

function clearRoomMessages(room) {
  clearedChatRooms.set(room, Date.now());
  recentMessages.delete(room);
  persistRoomHistory(room);
  io.to(room).emit("chat-history", []);
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
  "template-downloader": "Clothing",
  "background-changer": "Background Changer",
  "ugc-downloader": "UGC",
  "media-downloader": "Media",
  "audio-downloader": "Audio",
  "animation-spoofer": "Animations",
  "game-launcher": "Game Joiner",
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

function emitToolActivity() {
  // Tool usage is no longer posted into Community Chat.
  return null;
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

loadPersistedRecentMessages();

const chatHistoryPruneTimer = setInterval(() => {
  recentMessages.forEach((messages, room) => {
    const nextHistory = pruneRecentMessages(messages);
    if (nextHistory.length) {
      recentMessages.set(room, nextHistory);
    } else {
      recentMessages.delete(room);
    }
  });
  persistRecentMessages();
}, chatHistoryPruneIntervalMs);

if (typeof chatHistoryPruneTimer.unref === "function") {
  chatHistoryPruneTimer.unref();
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

async function refreshMembershipStateForConnectedUser(targetUser) {
  if (!targetUser?.id) {
    return null;
  }

  const publicUser = await buildResolvedPublicUser(targetUser);
  const isPlus = Boolean(publicUser.premiumActive);
  const plan = publicUser.plan || "free";

  updateConnectedMemberProfile(defaultChatRoom, targetUser.id, (profile) => ({
    ...profile,
    isPlus,
    plan,
  }));

  updateRecentMessagesForUser(defaultChatRoom, targetUser.id, (message) => ({
    ...message,
    isPlus,
    plan,
    badge: plan === "pro" ? "Pro" : (isPlus ? "Plus" : "Free Plan"),
  }));

  emitToUserInRoom(defaultChatRoom, targetUser.id, "membership-state", {
    ok: true,
    user: publicUser,
    plan,
    premiumActive: isPlus,
    proActive: plan === "pro",
    stripeSubscriptionStatus: publicUser.stripeSubscriptionStatus || null,
    complimentaryExpiresAt: publicUser.complimentaryExpiresAt || null,
    membershipSource: publicUser.membershipSource || null,
    plusDaysTotal: publicUser.plusDaysTotal != null ? publicUser.plusDaysTotal : null,
    plusDaysLeft: publicUser.plusDaysLeft != null ? publicUser.plusDaysLeft : 0,
    plusExpiresAt: publicUser.plusExpiresAt || null,
    currentPeriodStartAt: publicUser.currentPeriodStartAt || null,
    currentPeriodEndAt: publicUser.currentPeriodEndAt || null,
  });

  await refreshModerationStateForConnectedUser(targetUser);
  return publicUser;
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
      const rewardType = rain.rewardType || "plus";
      const rewardAmount = Number(rain.amount || rain.days || DEFAULT_COMPLIMENTARY_PLUS_DAYS);
      const grantResult = rewardType === "tokens"
        ? await grantAITokensToUser(winner.userId, rewardAmount)
        : rewardType === "pro"
          ? await grantComplimentaryProToUser(winner.userId, rewardAmount)
          : await grantComplimentaryPlusToUser(winner.userId, rewardAmount);
      const rewardLabel = rewardType === "tokens" ? rewardAmount + " AI tokens" : rewardType === "pro" ? "Pro for " + grantResult.days + " days" : "Plus for " + grantResult.days + " days";
      await refreshMembershipStateForConnectedUser(grantResult.user || { ...winner, id: winner.userId });
      emitToUserInRoom(room, winner.userId, "special-action-result", {
        type: "chat-rain",
        ok: true,
        awarded: true,
        message: "You won chat rain and received " + rewardLabel + ".",
        days: grantResult.days || 0,
        expiresAt: grantResult.expiresAt || null,
      });
      grantedWinners.push({
        userId: winner.userId,
        username: winner.username,
        displayName: winner.displayName,
        expiresAt: grantResult.expiresAt || null,
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
        winner.displayName + " just won " + (rain.rewardType === "tokens" ? String(rain.amount) + " AI tokens" : (rain.rewardType === "pro" ? "a Pro membership" : "a Plus subscription")) + " from chat rain."
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
    authenticatedUser = await getAuthenticatedSocketUser(socket, payload);
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

    memberProfile = await buildChatMemberProfile(payload, authenticatedUser);
    currentRoom = cleanRoom;

    socket.join(currentRoom);
    addUser(currentRoom, socket.id, memberProfile);

    socket.emit("chat-history", recentMessages.get(currentRoom) || []);
    emitRoomSpecials(currentRoom);
    io.to(currentRoom).emit("room-users", getUsers(currentRoom));
  });

  socket.on("chat-message", async (payload = {}) => {
    if (!currentRoom) return;
    if (!authenticatedUser) {
      authenticatedUser = await getAuthenticatedSocketUser(socket, payload);
    }
    if (!authenticatedUser) {
      socket.emit("special-action-result", {
        type: "authentication",
        ok: false,
        error: "Log in or sign up to use live chat.",
      });
      return;
    }

    memberProfile = await buildChatMemberProfile(payload, authenticatedUser);
    addUser(currentRoom, socket.id, memberProfile);

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

    if (cleanMessage.toLowerCase() === "/clear") {
      if (!isAdminUser(authenticatedUser)) {
        socket.emit("special-action-result", {
          type: "chat-command",
          ok: false,
          error: "Only admins can use /clear.",
        });
        return;
      }
      clearRoomMessages(currentRoom);
      socket.emit("special-action-result", {
        type: "chat-command",
        ok: true,
        message: "Live chat cleared.",
      });
      return;
    }

    memberProfile = syncChatMemberProfile(memberProfile, payload);
    addUser(currentRoom, socket.id, memberProfile);

    const message = createChatRoomMessage(memberProfile, {
      text: cleanMessage,
      replyTo: payload.replyTo,
    });

    pushRoomMessage(currentRoom, message);
  });

  socket.on("chat-react", async (payload = {}) => {
    if (!currentRoom) return;
    if (!authenticatedUser) {
      authenticatedUser = await getAuthenticatedSocketUser(socket, payload);
    }
    if (!authenticatedUser) {
      socket.emit("special-action-result", { type: "authentication", ok: false, error: "Log in or sign up to react in live chat." });
      return;
    }
    const messageId = cleanText(payload.messageId, 120);
    if (!messageId) return;
    const history = recentMessages.get(currentRoom) || [];
    const message = history.find((entry) => String(entry?.id || "") === messageId);
    if (!message || message.system) return;
    const userId = String(authenticatedUser.id || "").trim();
    const hearts = Array.isArray(message.heartUserIds) ? message.heartUserIds.map(String) : [];
    message.heartUserIds = hearts.includes(userId) ? hearts.filter((value) => value !== userId) : hearts.concat(userId).slice(-500);
    persistRoomHistory(currentRoom);
    io.to(currentRoom).emit("chat-history", recentMessages.get(currentRoom) || []);
  });

  socket.on("claim-plus-drop", async () => {
    if (!currentRoom) return;

    const state = getRoomSpecialState(currentRoom);
    const drop = state.claimDrop;
    var rewardType = drop && drop.rewardType || "plus";
    var rewardLabel = rewardType === "tokens" ? "AI token" : rewardType === "pro" ? "Pro" : "Plus";
    if (!drop) {
      socket.emit("special-action-result", {
        type: "claim-drop",
        ok: false,
        error: "There is no active " + rewardLabel + " drop right now.",
      });
      return;
    }

    if (new Date(drop.expiresAt).getTime() <= Date.now()) {
      finalizeClaimDrop(currentRoom, "expired");
      socket.emit("special-action-result", {
        type: "claim-drop",
        ok: false,
        error: "That " + rewardLabel + " drop already expired.",
      });
      return;
    }

    if (!memberProfile.userId || memberProfile.isGuest) {
      socket.emit("special-action-result", {
        type: "claim-drop",
        ok: false,
        error: "You need a real account to claim this reward.",
      });
      return;
    }

    if (rewardType === "plus" && (memberProfile.isPlus || String(memberProfile.plan || "").toLowerCase() === "plus")) {
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
        error: "You already claimed this drop.",
      });
      return;
    }

    if (drop.claimedBy.length >= drop.maxClaims) {
      finalizeClaimDrop(currentRoom, "claimed-out");
      socket.emit("special-action-result", {
        type: "claim-drop",
        ok: false,
        error: "That " + rewardLabel + " drop is already fully claimed.",
      });
      return;
    }

    try {
      const rewardAmount = Number(drop.amount || drop.days || DEFAULT_COMPLIMENTARY_PLUS_DAYS);
      const grantResult = rewardType === "tokens"
        ? await grantAITokensToUser(memberProfile.userId, rewardAmount)
        : rewardType === "pro"
          ? await grantComplimentaryProToUser(memberProfile.userId, rewardAmount)
          : await grantComplimentaryPlusToUser(memberProfile.userId, rewardAmount);
      if (rewardType !== "tokens") { memberProfile.isPlus = true; memberProfile.plan = rewardType; }
      await refreshMembershipStateForConnectedUser(grantResult.user || { ...memberProfile, id: memberProfile.userId });
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
        message: rewardType === "tokens" ? "You claimed " + grantResult.amount + " AI tokens." : "You claimed " + rewardLabel + " for " + grantResult.days + " days.",
        awarded: true,
        days: grantResult.days || 0,
        expiresAt: grantResult.expiresAt || null,
      });
      emitSpecialAnnouncement(
        currentRoom,
        memberProfile.displayName + " just claimed " + (rewardType === "tokens" ? grantResult.amount + " AI tokens." : "a " + rewardLabel + " membership for " + grantResult.days + " days.")
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
        error: "Could not claim this reward right now.",
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
const AI_RIG_STATIC_ROOT = path.join(__dirname, "assets", "ai-rig");


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

app.use("/assets/ai-rig", (req, _res, next) => {
  console.log("[ai-rig] incoming", {
    host: req.headers.host || "",
    method: req.method || "",
    path: req.originalUrl || req.url || "",
  });
  next();
});

app.use(
  "/assets/ai-rig",
  express.static(AI_RIG_STATIC_ROOT, {
    fallthrough: false,
    setHeaders(res, filePath) {
      console.log("[ai-rig] served", {
        filePath,
      });
      if (String(filePath || "").toLowerCase().endsWith(".obj")) {
        res.type("text/plain; charset=utf-8");
      }
    },
  })
);

app.use((error, req, res, next) => {
  if (
    String(req.originalUrl || req.url || "").startsWith("/assets/ai-rig")
  ) {
    console.error("[ai-rig] middleware failure", {
      host: req.headers.host || "",
      method: req.method || "",
      path: req.originalUrl || req.url || "",
      code: error && (error.code || ""),
      status: error && (error.statusCode || error.status || ""),
      message: error && (error.message || String(error)),
    });
  }
  if (res.headersSent) {
    return next(error);
  }
  return next(error);
});

app.post("/discord-tools/link-code", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const linkCode = await createDiscordLinkCode(user.id);
    return res.json({ ok: true, code: linkCode.code, expiresAt: linkCode.expiresAt });
  } catch (error) {
    return res.status(error.statusCode || 401).json({ error: error.message || "Could not create a Discord link code." });
  }
});

app.get("/discord-tools/link-status", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const link = await getDiscordLinkByAppUserId(user.id);
    return res.json({
      ok: true,
      linked: Boolean(link),
      discordUsername: link ? link.discordUsername : null,
      linkedAt: link ? link.linkedAt : null,
    });
  } catch (error) {
    return res.status(error.statusCode || 401).json({ error: error.message || "Could not read Discord link status." });
  }
});

app.delete("/discord-tools/link", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const removed = await unlinkDiscordAccount(user.id);
    return res.json({ ok: true, removed });
  } catch (error) {
    return res.status(error.statusCode || 401).json({ error: error.message || "Could not unlink Discord." });
  }
});

app.get(["/ai-tokens", "/ai-tokens.html"], async (req, res) => {
  return res.sendFile(path.join(STATIC_ROOT, "ai-tokens.html"));
});

app.get(["/ai-ugc-studio", "/ai-ugc-studio.html"], async (req, res) => {
  try {
    await requireAdminUser(req);
    return res.sendFile(path.join(STATIC_ROOT, "ai-ugc-studio.html"));
  } catch (error) {
    return res.status(error.statusCode || 403).sendFile(path.join(STATIC_ROOT, "index.html"));
  }
});

app.use(express.static(STATIC_ROOT, {
  extensions: ["html"],
  setHeaders(res, filePath) {
    // Tool pages and shared shell assets must not retain stale client-side behavior.
    if (/\.(?:html|css|js)$/i.test(filePath)) res.setHeader("Cache-Control", "no-store");
  },
}));

app.get(["/texture-baker", "/texture-baker.html"], (_req, res) => {
  res.redirect(302, "/ugc-downloader");
});

  app.get("/", (_req, res) => {
    res.sendFile(path.join(STATIC_ROOT, "index.html"));
  });

  app.get("/account", (_req, res) => {
    res.sendFile(path.join(STATIC_ROOT, "account-overview.html"));
  });
  
  const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
