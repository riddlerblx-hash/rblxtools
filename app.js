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
const OWNER_STRIPE_PIN = "0212";
const DISCORD_SUPPORT_WEBHOOK_URL = String(process.env.DISCORD_SUPPORT_WEBHOOK_URL || process.env.SUPPORT_DISCORD_WEBHOOK_URL || "").trim();
const SUPPORT_BOT_ENDPOINT = String(process.env.SUPPORT_BOT_ENDPOINT || "").trim();
const SUPPORT_BOT_SECRET = String(process.env.SUPPORT_BOT_SECRET || "").trim();
const SUPPORT_STAFF_MENTION = String(process.env.SUPPORT_STAFF_MENTION || "").trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const MAX_SUPPORT_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_CHAT_TIMEOUT_SECONDS = 3650 * 24 * 60 * 60;
const AI_CLOTHING_OUTPUT_WIDTH = 585;
const AI_CLOTHING_OUTPUT_HEIGHT = 559;
const AI_CLOTHING_MODEL = "gpt-image-2";
const AI_CLOTHING_GENERATION_SIZE = "832x800";
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
const AI_TEMPLATE_APPLICATION_PATHS = {
  shirt: path.join(__dirname, "assets", "ai-rig", "Blank Template.png"),
  pants: path.join(__dirname, "assets", "ai-rig", "Blank Template.png"),
};
const AI_CLOTHING_PANEL_PARTS = {
  shirt: [
    { x: 231, y: 8, w: 128, h: 64 },
    { x: 165, y: 74, w: 64, h: 128 },
    { x: 231, y: 74, w: 128, h: 128 },
    { x: 361, y: 74, w: 64, h: 128 },
    { x: 427, y: 74, w: 128, h: 128 },
    { x: 231, y: 204, w: 128, h: 64 },
    { x: 217, y: 289, w: 64, h: 64 },
    { x: 19, y: 355, w: 64, h: 128 },
    { x: 85, y: 355, w: 64, h: 128 },
    { x: 151, y: 355, w: 64, h: 128 },
    { x: 217, y: 355, w: 64, h: 128 },
    { x: 217, y: 485, w: 64, h: 64 },
    { x: 308, y: 289, w: 64, h: 64 },
    { x: 308, y: 355, w: 64, h: 128 },
    { x: 374, y: 355, w: 64, h: 128 },
    { x: 440, y: 355, w: 64, h: 128 },
    { x: 506, y: 355, w: 64, h: 128 },
    { x: 308, y: 485, w: 64, h: 64 },
  ],
  pants: [
    { x: 217, y: 289, w: 64, h: 64 },
    { x: 19, y: 355, w: 64, h: 128 },
    { x: 85, y: 355, w: 64, h: 128 },
    { x: 151, y: 355, w: 64, h: 128 },
    { x: 217, y: 355, w: 64, h: 128 },
    { x: 217, y: 485, w: 64, h: 64 },
    { x: 308, y: 289, w: 64, h: 64 },
    { x: 308, y: 355, w: 64, h: 128 },
    { x: 374, y: 355, w: 64, h: 128 },
    { x: 440, y: 355, w: 64, h: 128 },
    { x: 506, y: 355, w: 64, h: 128 },
    { x: 308, y: 485, w: 64, h: 64 },
  ],
};
const AI_CLOTHING_MASK_BLEED_PX = 12;
const AI_CLOTHING_SLEEVE_KEYWORDS = {
  long: ["hoodie", "hooded", "sweater", "sweatshirt", "jacket", "varsity", "zip up", "zipup", "coat", "flannel", "cardigan", "crewneck", "pullover"],
  short: ["t shirt", "t-shirt", "tshirt", "tee", "polo", "jersey", "short sleeve", "short-sleeve"],
  sleeveless: ["tank", "tank top", "beater", "wife beater", "sleeveless", "vest"],
};
const AI_CLOTHING_PANTS_LENGTH_KEYWORDS = {
  "30": ["shorts", "short", "basketball shorts", "swim trunks", "boxer", "underwear shorts"],
  "80": ["cropped", "capri", "3/4", "three quarter", "three-quarter", "highwater", "high water"],
  "100": ["pants", "jeans", "joggers", "sweatpants", "cargo", "full length", "full-length", "slacks"],
};
const AUTH_JWT_TTL_DAYS = Math.max(
  1,
  Number.parseInt(process.env.AUTH_JWT_TTL_DAYS || "30", 10) || 30
);
const OPTIONAL_AUTH_USER_COLUMNS = new Set([
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

function getAIBaseTemplateType(garmentType) {
  return normalizeAIClothingGarmentType(garmentType) === "pants" ? "pants" : "shirt";
}

function cleanAIClothingText(value, maxLength = 1200) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeAIClothingSleeveLength(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "short" || normalized === "long" || normalized === "sleeveless") {
    return normalized;
  }
  return "auto";
}

function normalizeAIClothingSkinTone(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "none" || normalized === "white" || normalized === "lightskin" || normalized === "darkskin") {
    return normalized;
  }
  return "auto";
}

function getAIClothingSkinToneColor(skinTone) {
  if (skinTone === "white") return { r: 239, g: 210, b: 191, a: 255 };
  if (skinTone === "lightskin") return { r: 201, g: 152, b: 118, a: 255 };
  if (skinTone === "darkskin") return { r: 92, g: 64, b: 48, a: 255 };
  if (skinTone === "auto") return { r: 219, g: 184, b: 160, a: 255 };
  return null;
}

function expandAIClothingGuideMask(maskBuffer, width, height, radius = 0) {
  if (!maskBuffer || !width || !height || radius <= 0) {
    return Buffer.from(maskBuffer || []);
  }

  let source = Buffer.from(maskBuffer);
  const totalPasses = Math.max(1, Math.floor(radius));

  for (let pass = 0; pass < totalPasses; pass += 1) {
    const target = Buffer.from(source);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (source[index]) continue;
        let shouldFill = false;
        for (let offsetY = -1; offsetY <= 1 && !shouldFill; offsetY += 1) {
          const sampleY = y + offsetY;
          if (sampleY < 0 || sampleY >= height) continue;
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const sampleX = x + offsetX;
            if (sampleX < 0 || sampleX >= width) continue;
            if (!offsetX && !offsetY) continue;
            if (source[sampleY * width + sampleX]) {
              shouldFill = true;
              break;
            }
          }
        }
        if (shouldFill) target[index] = 255;
      }
    }
    source = target;
  }

  return source;
}

function shouldUseExpandedAIClothingSkinMask(templateType, sleeveLength, pantsLength, x, y) {
  if (templateType === "shirt") {
    if (sleeveLength === "sleeveless") {
      if (y >= 289) return true;
      if (x >= 165 && x < 229 && y >= 74 && y < 202) return true;
      if (x >= 361 && x < 425 && y >= 74 && y < 202) return true;
      return false;
    }
    if (sleeveLength === "short") {
      return y >= 289;
    }
    return false;
  }

  if (templateType === "pants") {
    if (pantsLength === "30" || pantsLength === "80") {
      return y >= 289;
    }
  }

  return false;
}

function isInsideAIClothingPanel(templateType, x, y) {
  const normalizedTemplateType = templateType === "pants" ? "pants" : "shirt";
  const panels = AI_CLOTHING_PANEL_PARTS[normalizedTemplateType] || AI_CLOTHING_PANEL_PARTS.shirt;
  return panels.some((panel) =>
    x >= panel.x &&
    x < panel.x + panel.w &&
    y >= panel.y &&
    y < panel.y + panel.h
  );
}

function getAIClothingPixelLuma(red, green, blue) {
  return (red * 0.299) + (green * 0.587) + (blue * 0.114);
}

async function buildAIClothingGenerationReference(
  referenceTemplateBuffer,
  blankTemplateBuffer,
  skinTone,
  templateType
) {
  const sharp = getSharp();
  const blankTemplateRaw = await sharp(blankTemplateBuffer)
    .resize(AI_CLOTHING_OUTPUT_WIDTH, AI_CLOTHING_OUTPUT_HEIGHT, {
      fit: "fill",
      kernel: "nearest",
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const referenceTemplateRaw = await sharp(referenceTemplateBuffer)
    .resize(AI_CLOTHING_OUTPUT_WIDTH, AI_CLOTHING_OUTPUT_HEIGHT, {
      fit: "fill",
      kernel: "nearest",
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const outputRaw = Buffer.from(blankTemplateRaw.data);
  const tone = getAIClothingSkinToneColor(skinTone);

  for (let offset = 0; offset < referenceTemplateRaw.data.length; offset += 4) {
    const pixelIndex = offset / 4;
    const x = pixelIndex % referenceTemplateRaw.info.width;
    const y = Math.floor(pixelIndex / referenceTemplateRaw.info.width);
    if (!isInsideAIClothingPanel(templateType, x, y)) continue;

    const red = referenceTemplateRaw.data[offset];
    const green = referenceTemplateRaw.data[offset + 1];
    const blue = referenceTemplateRaw.data[offset + 2];
    const alpha = referenceTemplateRaw.data[offset + 3];

    if (templateType === "shirt" && alpha <= 16) {
      if (tone) {
        outputRaw[offset] = tone.r;
        outputRaw[offset + 1] = tone.g;
        outputRaw[offset + 2] = tone.b;
        outputRaw[offset + 3] = 255;
      }
      continue;
    }

    outputRaw[offset] = red;
    outputRaw[offset + 1] = green;
    outputRaw[offset + 2] = blue;
    outputRaw[offset + 3] = alpha > 0 ? 255 : outputRaw[offset + 3];
  }

  return sharp(outputRaw, {
    raw: {
      width: blankTemplateRaw.info.width,
      height: blankTemplateRaw.info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

function normalizeAIClothingPantsLength(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "30" || normalized === "80" || normalized === "100") {
    return normalized;
  }
  return "auto";
}

function inferAIClothingSleeveLength(promptText) {
  const text = String(promptText || "").trim().toLowerCase();
  if (!text) return "long";
  if (AI_CLOTHING_SLEEVE_KEYWORDS.sleeveless.some((keyword) => text.includes(keyword))) {
    return "sleeveless";
  }
  if (AI_CLOTHING_SLEEVE_KEYWORDS.short.some((keyword) => text.includes(keyword))) {
    return "short";
  }
  if (AI_CLOTHING_SLEEVE_KEYWORDS.long.some((keyword) => text.includes(keyword))) {
    return "long";
  }
  return "long";
}

function inferAIClothingPantsLength(promptText) {
  const text = String(promptText || "").trim().toLowerCase();
  if (!text) return "100";
  if (AI_CLOTHING_PANTS_LENGTH_KEYWORDS["30"].some((keyword) => text.includes(keyword))) {
    return "30";
  }
  if (AI_CLOTHING_PANTS_LENGTH_KEYWORDS["80"].some((keyword) => text.includes(keyword))) {
    return "80";
  }
  if (AI_CLOTHING_PANTS_LENGTH_KEYWORDS["100"].some((keyword) => text.includes(keyword))) {
    return "100";
  }
  return "100";
}

function getAIClothingSkinToneInstruction(skinTone) {
  if (skinTone === "none") {
    return "Do not show visible skin. Keep exposed hand, arm, leg, neck, torso, and cutout zones covered or visually concealed by the garment design.";
  }
  if (skinTone === "white") {
    return "Every required visible skin zone should use a light white skin tone consistently anywhere the garment exposes skin, including hand openings, wrist exits, neck openings, arm openings, and any intentional cutout areas.";
  }
  if (skinTone === "lightskin") {
    return "Every required visible skin zone should use a light brown lightskin tone consistently anywhere the garment exposes skin, including hand openings, wrist exits, neck openings, arm openings, and any intentional cutout areas.";
  }
  if (skinTone === "darkskin") {
    return "Every required visible skin zone should use a rich dark skin tone consistently anywhere the garment exposes skin, including hand openings, wrist exits, neck openings, arm openings, and any intentional cutout areas.";
  }
  return "";
}

function expandAIClothingMask(maskBuffer, width, height, radius) {
  const bleed = Math.max(0, radius | 0);
  if (!bleed) {
    return Buffer.from(maskBuffer);
  }
  const expanded = Buffer.from(maskBuffer);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!maskBuffer[index]) continue;
      for (let offsetY = -bleed; offsetY <= bleed; offsetY += 1) {
        const nextY = y + offsetY;
        if (nextY < 0 || nextY >= height) continue;
        for (let offsetX = -bleed; offsetX <= bleed; offsetX += 1) {
          const nextX = x + offsetX;
          if (nextX < 0 || nextX >= width) continue;
          expanded[nextY * width + nextX] = 255;
        }
      }
    }
  }
  return expanded;
}

function bleedAIClothingTransparentPixels(rgbaBuffer, width, height, passes = 2) {
  if (!rgbaBuffer || !width || !height) {
    return Buffer.from(rgbaBuffer || []);
  }

  let source = Buffer.from(rgbaBuffer);
  const totalPasses = Math.max(1, passes | 0);

  for (let pass = 0; pass < totalPasses; pass += 1) {
    const target = Buffer.from(source);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        if (source[index + 3] > 6) continue;

        let redTotal = 0;
        let greenTotal = 0;
        let blueTotal = 0;
        let hits = 0;

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const sampleY = y + offsetY;
          if (sampleY < 0 || sampleY >= height) continue;
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (!offsetX && !offsetY) continue;
            const sampleX = x + offsetX;
            if (sampleX < 0 || sampleX >= width) continue;
            const sampleIndex = (sampleY * width + sampleX) * 4;
            if (source[sampleIndex + 3] <= 6) continue;
            redTotal += source[sampleIndex];
            greenTotal += source[sampleIndex + 1];
            blueTotal += source[sampleIndex + 2];
            hits += 1;
          }
        }

        if (!hits) continue;
        target[index] = Math.round(redTotal / hits);
        target[index + 1] = Math.round(greenTotal / hits);
        target[index + 2] = Math.round(blueTotal / hits);
      }
    }
    source = target;
  }

  return source;
}

function isAIClothingNearWhitePixel(red, green, blue, alpha) {
  return (
    alpha > 16 &&
    red >= 214 &&
    green >= 214 &&
    blue >= 214 &&
    Math.max(red, green, blue) - Math.min(red, green, blue) <= 42
  );
}

function repairAIClothingSeamPixels(rgbaBuffer, width, height, baseMaskBuffer, expandedMaskBuffer, passes = 3) {
  if (!rgbaBuffer || !width || !height || !baseMaskBuffer || !expandedMaskBuffer) {
    return Buffer.from(rgbaBuffer || []);
  }

  let source = Buffer.from(rgbaBuffer);
  const totalPasses = Math.max(1, passes | 0);

  for (let pass = 0; pass < totalPasses; pass += 1) {
    const target = Buffer.from(source);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixelIndex = y * width + x;
        if (!expandedMaskBuffer[pixelIndex]) continue;

        const rgbaIndex = pixelIndex * 4;
        const alpha = source[rgbaIndex + 3];
        const isExpandedOnly = !baseMaskBuffer[pixelIndex];
        const isNearWhite = isAIClothingNearWhitePixel(
          source[rgbaIndex],
          source[rgbaIndex + 1],
          source[rgbaIndex + 2],
          alpha
        );

        if (!isExpandedOnly && !isNearWhite) continue;

        let redTotal = 0;
        let greenTotal = 0;
        let blueTotal = 0;
        let alphaTotal = 0;
        let hits = 0;

        for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
          const sampleY = y + offsetY;
          if (sampleY < 0 || sampleY >= height) continue;
          for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
            if (!offsetX && !offsetY) continue;
            const sampleX = x + offsetX;
            if (sampleX < 0 || sampleX >= width) continue;
            const samplePixelIndex = sampleY * width + sampleX;
            if (!expandedMaskBuffer[samplePixelIndex]) continue;
            const sampleRgbaIndex = samplePixelIndex * 4;
            const sampleAlpha = source[sampleRgbaIndex + 3];
            if (sampleAlpha <= 40) continue;
            if (
              isAIClothingNearWhitePixel(
                source[sampleRgbaIndex],
                source[sampleRgbaIndex + 1],
                source[sampleRgbaIndex + 2],
                sampleAlpha
              )
            ) {
              continue;
            }

            redTotal += source[sampleRgbaIndex];
            greenTotal += source[sampleRgbaIndex + 1];
            blueTotal += source[sampleRgbaIndex + 2];
            alphaTotal += sampleAlpha;
            hits += 1;
          }
        }

        if (!hits) continue;
        target[rgbaIndex] = Math.round(redTotal / hits);
        target[rgbaIndex + 1] = Math.round(greenTotal / hits);
        target[rgbaIndex + 2] = Math.round(blueTotal / hits);
        target[rgbaIndex + 3] = Math.max(alpha, Math.round(alphaTotal / hits), 220);
      }
    }
    source = target;
  }

  return source;
}

function extendAIClothingGutterBleed(rgbaBuffer, width, height, gutterMaskBuffer, passes = 8) {
  if (!rgbaBuffer || !width || !height || !gutterMaskBuffer) {
    return Buffer.from(rgbaBuffer || []);
  }

  let source = Buffer.from(rgbaBuffer);
  const totalPasses = Math.max(1, passes | 0);

  for (let pass = 0; pass < totalPasses; pass += 1) {
    const target = Buffer.from(source);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixelIndex = y * width + x;
        if (!gutterMaskBuffer[pixelIndex]) continue;

        const rgbaIndex = pixelIndex * 4;
        const alpha = source[rgbaIndex + 3];
        const needsFill =
          alpha <= 200 ||
          isAIClothingNearWhitePixel(
            source[rgbaIndex],
            source[rgbaIndex + 1],
            source[rgbaIndex + 2],
            alpha
          );

        if (!needsFill) continue;

        let redTotal = 0;
        let greenTotal = 0;
        let blueTotal = 0;
        let alphaTotal = 0;
        let hits = 0;

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const sampleY = y + offsetY;
          if (sampleY < 0 || sampleY >= height) continue;
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (!offsetX && !offsetY) continue;
            const sampleX = x + offsetX;
            if (sampleX < 0 || sampleX >= width) continue;
            const samplePixelIndex = sampleY * width + sampleX;
            if (!gutterMaskBuffer[samplePixelIndex]) continue;
            const sampleRgbaIndex = samplePixelIndex * 4;
            const sampleAlpha = source[sampleRgbaIndex + 3];
            if (sampleAlpha <= 220) continue;
            if (
              isAIClothingNearWhitePixel(
                source[sampleRgbaIndex],
                source[sampleRgbaIndex + 1],
                source[sampleRgbaIndex + 2],
                sampleAlpha
              )
            ) {
              continue;
            }

            redTotal += source[sampleRgbaIndex];
            greenTotal += source[sampleRgbaIndex + 1];
            blueTotal += source[sampleRgbaIndex + 2];
            alphaTotal += sampleAlpha;
            hits += 1;
          }
        }

        if (!hits) continue;
        target[rgbaIndex] = Math.round(redTotal / hits);
        target[rgbaIndex + 1] = Math.round(greenTotal / hits);
        target[rgbaIndex + 2] = Math.round(blueTotal / hits);
        target[rgbaIndex + 3] = Math.max(alpha, Math.round(alphaTotal / hits), 250);
      }
    }
    source = target;
  }

  return source;
}

async function rebuildAIClothingPanelsOnBlankTemplate(generatedBuffer, blankTemplateBuffer, templateType) {
  const sharp = getSharp();
  const normalizedTemplateType = templateType === "pants" ? "pants" : "shirt";
  const panels = AI_CLOTHING_PANEL_PARTS[normalizedTemplateType] || AI_CLOTHING_PANEL_PARTS.shirt;
  const baseTemplate = await sharp(blankTemplateBuffer)
    .resize(AI_CLOTHING_OUTPUT_WIDTH, AI_CLOTHING_OUTPUT_HEIGHT, {
      fit: "fill",
      kernel: "nearest",
    })
    .ensureAlpha()
    .png()
    .toBuffer();
  const baseTemplateRaw = await sharp(baseTemplate)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const composites = [];

  for (let index = 0; index < panels.length; index += 1) {
    const panel = panels[index];
    const croppedPanel = await sharp(generatedBuffer)
      .extract({
        left: panel.x,
        top: panel.y,
        width: panel.w,
        height: panel.h,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const panelMaskRaw = Buffer.alloc(panel.w * panel.h * 4, 0);
    for (let y = 0; y < panel.h; y += 1) {
      for (let x = 0; x < panel.w; x += 1) {
        const sourceIndex = ((panel.y + y) * baseTemplateRaw.info.width + (panel.x + x)) * 4;
        const alpha = baseTemplateRaw.data[sourceIndex + 3];
        if (alpha > 8) continue;
        const targetIndex = (y * panel.w + x) * 4;
        panelMaskRaw[targetIndex] = 255;
        panelMaskRaw[targetIndex + 1] = 255;
        panelMaskRaw[targetIndex + 2] = 255;
        panelMaskRaw[targetIndex + 3] = 255;
      }
    }
    const panelMaskBuffer = await sharp(panelMaskRaw, {
      raw: {
        width: panel.w,
        height: panel.h,
        channels: 4,
      },
    })
      .png()
      .toBuffer();
    const clippedPanel = await sharp(croppedPanel.data, {
      raw: {
        width: croppedPanel.info.width,
        height: croppedPanel.info.height,
        channels: 4,
      },
    })
      .composite([{ input: panelMaskBuffer, blend: "dest-in" }])
      .png()
      .toBuffer();
    composites.push({
      input: clippedPanel,
      left: panel.x,
      top: panel.y,
    });
  }

  return sharp(baseTemplate)
    .composite(composites)
    .png()
    .toBuffer();
}

async function applyAIClothingSkinGuide(
  panelBuffer,
  referenceTemplateBuffer,
  skinTone,
  templateType,
  sleeveLength,
  pantsLength
) {
  const tone = getAIClothingSkinToneColor(skinTone);
  if (!tone) return panelBuffer;
  const sharp = getSharp();
  const referenceTemplateRaw = await sharp(referenceTemplateBuffer)
    .resize(AI_CLOTHING_OUTPUT_WIDTH, AI_CLOTHING_OUTPUT_HEIGHT, {
      fit: "fill",
      kernel: "nearest",
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const guideMask = Buffer.alloc(referenceTemplateRaw.info.width * referenceTemplateRaw.info.height, 0);

  for (let offset = 0; offset < referenceTemplateRaw.data.length; offset += 4) {
    const pixelIndex = offset / 4;
    const x = pixelIndex % referenceTemplateRaw.info.width;
    const y = Math.floor(pixelIndex / referenceTemplateRaw.info.width);
    const red = referenceTemplateRaw.data[offset];
    const green = referenceTemplateRaw.data[offset + 1];
    const blue = referenceTemplateRaw.data[offset + 2];
    const alpha = referenceTemplateRaw.data[offset + 3];
    const insidePanel = isInsideAIClothingPanel(templateType, x, y);
    if (!insidePanel) continue;
    const isTransparentSkinGuide = templateType === "shirt" && alpha <= 16;
    const isHotPinkGuide =
      templateType === "pants" &&
      alpha > 0 &&
      red >= 220 &&
      blue >= 220 &&
      green <= 120;
    if (!isTransparentSkinGuide && !isHotPinkGuide) continue;
    guideMask[pixelIndex] = 255;
  }

  let expansionRadius = 0;
  if (templateType === "shirt") {
    if (sleeveLength === "sleeveless") expansionRadius = 18;
    else if (sleeveLength === "short") expansionRadius = 8;
  } else if (templateType === "pants") {
    if (pantsLength === "30") expansionRadius = 4;
    else if (pantsLength === "80") expansionRadius = 2;
  }

  const expandedMask = expansionRadius > 0
    ? expandAIClothingGuideMask(
        guideMask,
        referenceTemplateRaw.info.width,
        referenceTemplateRaw.info.height,
        expansionRadius
      )
    : guideMask;
  const finalSkinMask = Buffer.alloc(guideMask.length, 0);
  for (let index = 0; index < guideMask.length; index += 1) {
    const x = index % referenceTemplateRaw.info.width;
    const y = Math.floor(index / referenceTemplateRaw.info.width);
    const useExpandedMask = shouldUseExpandedAIClothingSkinMask(
      templateType,
      sleeveLength,
      pantsLength,
      x,
      y
    );
    finalSkinMask[index] = useExpandedMask ? expandedMask[index] : guideMask[index];
  }

  const panelRaw = await sharp(panelBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (templateType === "shirt") {
    const sourceData = Buffer.from(panelRaw.data);
    const width = panelRaw.info.width;
    const height = panelRaw.info.height;

    for (let index = 0; index < finalSkinMask.length; index += 1) {
      if (!finalSkinMask[index]) continue;
      const offset = index * 4;
      const x = index % width;
      const y = Math.floor(index / width);
      const red = sourceData[offset];
      const green = sourceData[offset + 1];
      const blue = sourceData[offset + 2];
      const alpha = sourceData[offset + 3];
      if (alpha <= 8) {
        panelRaw.data[offset] = tone.r;
        panelRaw.data[offset + 1] = tone.g;
        panelRaw.data[offset + 2] = tone.b;
        panelRaw.data[offset + 3] = tone.a;
        continue;
      }

      const luminance = getAIClothingPixelLuma(red, green, blue);
      const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
      let neighborTotal = 0;
      let neighborCount = 0;
      const neighborOffsets = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];

      for (let neighborIndex = 0; neighborIndex < neighborOffsets.length; neighborIndex += 1) {
        const [dx, dy] = neighborOffsets[neighborIndex];
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const neighborFlatIndex = (ny * width) + nx;
        if (!finalSkinMask[neighborFlatIndex]) continue;
        const neighborOffset = neighborFlatIndex * 4;
        neighborTotal += getAIClothingPixelLuma(
          sourceData[neighborOffset],
          sourceData[neighborOffset + 1],
          sourceData[neighborOffset + 2]
        );
        neighborCount += 1;
      }

      const neighborAverage = neighborCount ? neighborTotal / neighborCount : luminance;
      const contrast = Math.abs(luminance - neighborAverage);
      const likelyFabricFill =
        saturation < 42 &&
        contrast < 18 &&
        luminance < (getAIClothingPixelLuma(tone.r, tone.g, tone.b) + 28);

      if (likelyFabricFill) {
        panelRaw.data[offset] = tone.r;
        panelRaw.data[offset + 1] = tone.g;
        panelRaw.data[offset + 2] = tone.b;
        panelRaw.data[offset + 3] = tone.a;
        continue;
      }

      const multipliedRed = Math.round((tone.r * red) / 255);
      const multipliedGreen = Math.round((tone.g * green) / 255);
      const multipliedBlue = Math.round((tone.b * blue) / 255);
      const detailStrength = Math.max(
        0,
        Math.min(
          1,
          ((contrast - 10) / 34) + (saturation / 180)
        )
      );

      panelRaw.data[offset] = Math.round((tone.r * (1 - detailStrength)) + (multipliedRed * detailStrength));
      panelRaw.data[offset + 1] = Math.round((tone.g * (1 - detailStrength)) + (multipliedGreen * detailStrength));
      panelRaw.data[offset + 2] = Math.round((tone.b * (1 - detailStrength)) + (multipliedBlue * detailStrength));
      panelRaw.data[offset + 3] = tone.a;
    }

    return sharp(panelRaw.data, {
      raw: {
        width: panelRaw.info.width,
        height: panelRaw.info.height,
        channels: 4,
      },
    })
      .png()
      .toBuffer();
  }

  for (let index = 0; index < finalSkinMask.length; index += 1) {
    if (!finalSkinMask[index]) continue;
    const offset = index * 4;
    panelRaw.data[offset] = tone.r;
    panelRaw.data[offset + 1] = tone.g;
    panelRaw.data[offset + 2] = tone.b;
    panelRaw.data[offset + 3] = tone.a;
  }

  return sharp(panelRaw.data, {
    raw: {
      width: panelRaw.info.width,
      height: panelRaw.info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

function buildAIClothingPrompt(input = {}) {
  const garment = normalizeAIClothingGarmentType(input.garmentType);
  const style = cleanAIClothingText(input.styleDirection, 160);
  const palette = cleanAIClothingText(input.colorPalette, 200);
  const vibe = cleanAIClothingText(input.audience, 200);
  const userPrompt = cleanAIClothingText(input.userPrompt || input.prompt, 1200);
  const negativePrompt = cleanAIClothingText(input.negativePrompt, 700);
  const styleName = cleanAIClothingText(input.styleName, 60);
  const skinTone = normalizeAIClothingSkinTone(input.skinTone);
  const sleeveLength = normalizeAIClothingSleeveLength(input.sleeveLength);
  const pantsLength = normalizeAIClothingPantsLength(input.pantsLength);
  const resolvedSleeveLength =
    sleeveLength === "auto"
      ? normalizeAIClothingSleeveLength(input.resolvedSleeveLength) !== "auto"
        ? normalizeAIClothingSleeveLength(input.resolvedSleeveLength)
        : inferAIClothingSleeveLength([userPrompt, style, vibe].filter(Boolean).join(" "))
      : sleeveLength;
  const resolvedPantsLength =
    pantsLength === "auto"
      ? normalizeAIClothingPantsLength(input.resolvedPantsLength) !== "auto"
        ? normalizeAIClothingPantsLength(input.resolvedPantsLength)
        : inferAIClothingPantsLength([userPrompt, style, vibe].filter(Boolean).join(" "))
      : pantsLength;
  const goalTexts = Array.isArray(input.templateGoals)
    ? input.templateGoals.map((goal) => cleanAIClothingText(goal, 80)).filter(Boolean).slice(0, 8)
    : [];
  const usesShirt =
    garment === "shirt" ||
    garment === "full_outfit" ||
    garment === "matching_shirts" ||
    garment === "matching_outfits";
  const usesPants =
    garment === "pants" ||
    garment === "full_outfit" ||
    garment === "matching_pants" ||
    garment === "matching_outfits";

  return {
    garmentType: garment,
    sleeveLength: resolvedSleeveLength,
    pantsLength: resolvedPantsLength,
    skinTone,
    style,
    palette,
    vibe,
    userPrompt,
    negativePrompt,
    styleName,
    goalTexts,
    promptPreview: [
      "Create a clean Roblox clothing texture for the supplied blank clothing panel layout.",
      usesShirt ? `Resolved sleeve guide: ${resolvedSleeveLength}.` : "",
      usesPants ? `Resolved pants length guide: ${resolvedPantsLength}%.` : "",
      skinTone !== "auto" ? `Visible skin tone: ${skinTone}.` : "",
      `Design brief: ${userPrompt || "Create a polished, high-detail Roblox clothing design with readable front, back, sleeve, and leg zones."}.`,
      style ? `Art direction: ${style}.` : "",
      palette ? `Color palette: ${palette}.` : "",
      vibe ? `Target vibe: ${vibe}.` : "",
      goalTexts.length ? `Priority goals: ${goalTexts.join(", ")}.` : "",
      negativePrompt ? `Avoid: ${negativePrompt}.` : "",
    ].filter(Boolean).join(" "),
  };
}

function buildAIClothingVariantPrompt(basePrompt, variant = {}) {
  const templateType = variant.templateType === "pants" ? "pants" : "shirt";
  const sleeveInstruction = templateType === "shirt"
    ? basePrompt.sleeveLength === "short"
      ? "Use short sleeves and keep the visible hand and lower-arm opening zones clear. Sleeve fabric must stop before the exposed hand zone begins."
      : basePrompt.sleeveLength === "sleeveless"
        ? "Use true sleeveless arm treatment. Every fully transparent cutout area on the supplied sleeve reference is mandatory exposed skin territory, not optional fabric. Leave those arm-opening and hand-opening zones uncovered and render them in the selected skin tone."
        : "Use long sleeves but always leave a clear hand opening and cuff break at the wrist end of the supplied guide layout so the hands stay exposed. Any fully transparent cutout zone on the supplied sleeve reference is mandatory visible skin territory and must not be covered by sleeve fabric."
    : "";
  const sleeveReferenceInstruction = templateType === "shirt"
    ? "On the supplied sleeve reference, fully transparent cutout areas are strict skin markers. Any transparent cutout area must stay open and become exposed skin in the exact selected skin tone in the final clothing texture. Never print fabric, trim, chains, shading, or graphics over transparent cutout guide zones."
    : "";
  const pantsLengthInstruction = templateType === "pants"
    ? basePrompt.pantsLength === "30"
      ? "Use a short pants length around the 30% guide. The hot pink guide zones on the pants length reference are exposed skin zones below the shorts cutoff and should render in the selected skin tone."
      : basePrompt.pantsLength === "80"
        ? "Use a cropped pants length around the 80% guide. The hot pink guide zones on the pants length reference are exposed skin zones below the fabric cutoff and should render in the selected skin tone."
        : "Use a full pants length around the 100% guide. Any hot pink guide zones should stay as visible skin or open ankle territory rendered in the selected skin tone."
    : "";
  const pantsReferenceInstruction = templateType === "pants"
    ? "On the supplied pants length reference, bright hot pink is a strict skin marker. Any bright hot pink area must become exposed skin in the exact selected skin tone or remain a clean open cutoff where the pants stop. Never place fabric or graphics over hot pink guide zones."
    : "";
  const garmentInstruction = templateType === "pants"
    ? "Use only the supplied pants panel map. Focus strictly on waist, thigh, knee, calf, cuff, and ankle zones. Do not generate shirt collars, chest panels, sleeves, shoulder seams, or upper-body outfit pieces."
    : "Use only the supplied shirt panel map. Focus strictly on torso front, torso back, side torso panels, sleeves, shoulders, cuffs, and neck opening zones. Do not generate leg-only layouts or lower-body outfit pieces that do not belong on the shirt panel map.";
  const landmarkInstruction = templateType === "pants"
    ? "The lowest exposed parts of the supplied pants guide represent ankle and shoe-entry territory, not random fabric panels. Keep those ankle openings readable and never treat them like sealed solid blocks."
    : "The very top-center opening on the supplied shirt guide is always the neck area and must stay clear for the avatar neck. The lower ends of the arm strips are always hand-opening territory and should render as exposed skin in the selected skin tone, with clean wrist exits that stay clearly separated from the sleeve fabric.";
  return [
    "Create a clean clothing texture on the supplied blank clothing panel layout.",
    `Return only a wearable clothing texture at exactly ${AI_CLOTHING_OUTPUT_WIDTH} x ${AI_CLOTHING_OUTPUT_HEIGHT} pixels.`,
    `The working image may be generated at ${AI_CLOTHING_GENERATION_SIZE}, but the final design must map cleanly back into the supplied panel layout size.`,
    garmentInstruction,
    sleeveInstruction,
    sleeveReferenceInstruction,
    pantsLengthInstruction,
    pantsReferenceInstruction,
    landmarkInstruction,
    "Use the supplied layout only as a placement guide. Do not redraw mannequin previews, helper diagrams, template labels, divider lines, border strokes, letters, logos, or background sheet elements.",
    "Keep artwork inside the clothing zones, aligned across connected panels, and slightly overpaint fold edges so the worn result stays solid without visible gaps.",
    "Make the result feel like a real catalog-ready clothing texture, not a poster, mockup, or random square graphic.",
    variant.modeInstruction || "",
    variant.lookInstruction || "",
    variant.partInstruction || "",
    `Design brief: ${basePrompt.userPrompt || "Create a polished, high-detail Roblox clothing design with readable front, back, sleeve, and leg zones."}.`,
    basePrompt.style ? `Art direction: ${basePrompt.style}.` : "",
    basePrompt.palette ? `Color palette: ${basePrompt.palette}.` : "",
    basePrompt.vibe ? `Target vibe: ${basePrompt.vibe}.` : "",
    basePrompt.styleName ? `Preset style tag: ${basePrompt.styleName}.` : "",
    basePrompt.goalTexts.length ? `Priority goals: ${basePrompt.goalTexts.join(", ")}.` : "",
    getAIClothingSkinToneInstruction(basePrompt.skinTone),
    basePrompt.negativePrompt ? `Avoid: ${basePrompt.negativePrompt}.` : "",
  ].filter(Boolean).join(" ");
}

function buildAIClothingGenerationPlan(basePrompt) {
  const mode = basePrompt.garmentType;
  if (mode === "pants") {
    return [{ key: "pants", label: "Pants Template", templateType: "pants" }];
  }
  if (mode === "full_outfit") {
    return [
      {
        key: "full-outfit-shirt",
        label: "Full Outfit Shirt",
        templateType: "shirt",
        modeInstruction: "This output is the shirt half of a single coordinated full outfit.",
      },
      {
        key: "full-outfit-pants",
        label: "Full Outfit Pants",
        templateType: "pants",
        modeInstruction: "This output is the pants half of a single coordinated full outfit. It should clearly match the shirt half in palette, texture language, trims, and overall vibe.",
      },
    ];
  }
  if (mode === "matching_shirts") {
    return [
      {
        key: "matching-shirt-1",
        label: "Look One Shirt",
        templateType: "shirt",
        modeInstruction: "This output is look one in a coordinated two-person matching set.",
        lookInstruction: "Keep this look clearly related to the partner look through shared palette, motifs, trim language, and vibe, but do not make it an identical clone.",
      },
      {
        key: "matching-shirt-2",
        label: "Look Two Shirt",
        templateType: "shirt",
        modeInstruction: "This output is look two in a coordinated two-person matching set.",
        lookInstruction: "Keep this look clearly related to the partner look through shared palette, motifs, trim language, and vibe, but do not make it an identical clone.",
      },
    ];
  }
  if (mode === "matching_pants") {
    return [
      {
        key: "matching-pants-1",
        label: "Look One Pants",
        templateType: "pants",
        modeInstruction: "This output is look one in a coordinated two-person matching set.",
        lookInstruction: "Keep this look clearly related to the partner look through shared palette, motifs, trim language, and vibe, but do not make it an identical clone.",
      },
      {
        key: "matching-pants-2",
        label: "Look Two Pants",
        templateType: "pants",
        modeInstruction: "This output is look two in a coordinated two-person matching set.",
        lookInstruction: "Keep this look clearly related to the partner look through shared palette, motifs, trim language, and vibe, but do not make it an identical clone.",
      },
    ];
  }
  if (mode === "matching_outfits") {
    return [
      {
        key: "matching-outfit-1-shirt",
        label: "Look One Shirt",
        templateType: "shirt",
        modeInstruction: "This output belongs to look one in a coordinated two-person matching outfit set.",
        lookInstruction: "Keep this look clearly related to the partner look through shared palette, motifs, trim language, and vibe, but do not make it an identical clone.",
      },
      {
        key: "matching-outfit-1-pants",
        label: "Look One Pants",
        templateType: "pants",
        modeInstruction: "This output belongs to look one in a coordinated two-person matching outfit set.",
        lookInstruction: "These pants should match look one's shirt and still stay coordinated with look two overall.",
      },
      {
        key: "matching-outfit-2-shirt",
        label: "Look Two Shirt",
        templateType: "shirt",
        modeInstruction: "This output belongs to look two in a coordinated two-person matching outfit set.",
        lookInstruction: "Keep this look clearly related to the partner look through shared palette, motifs, trim language, and vibe, but do not make it an identical clone.",
      },
      {
        key: "matching-outfit-2-pants",
        label: "Look Two Pants",
        templateType: "pants",
        modeInstruction: "This output belongs to look two in a coordinated two-person matching outfit set.",
        lookInstruction: "These pants should match look two's shirt and still stay coordinated with look one overall.",
      },
    ];
  }
  return [{ key: "shirt", label: "Shirt Template", templateType: "shirt" }];
}

async function generateAIClothingImage({ templateType, enhancedPrompt, sleeveLength, pantsLength, skinTone }) {
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
  const applicationTemplatePath = AI_TEMPLATE_APPLICATION_PATHS[normalizedTemplateType] || AI_TEMPLATE_APPLICATION_PATHS.shirt;
  const { toFile } = getOpenAIUploadHelpers();
  await fs.promises.access(referenceTemplatePath, fs.constants.R_OK);
  await fs.promises.access(applicationTemplatePath, fs.constants.R_OK);
  const sharp = getSharp();
  const referenceTemplateBuffer = await fs.promises.readFile(referenceTemplatePath);
  const applyTemplateBuffer = await fs.promises.readFile(applicationTemplatePath);
  const cleanedApplyTemplateBuffer = await sharp(applyTemplateBuffer)
    .resize(AI_CLOTHING_OUTPUT_WIDTH, AI_CLOTHING_OUTPUT_HEIGHT, {
      fit: "fill",
      kernel: "nearest",
    })
    .ensureAlpha()
    .png()
    .toBuffer();
  const generationReferenceBuffer = await buildAIClothingGenerationReference(
    referenceTemplateBuffer,
    cleanedApplyTemplateBuffer,
    normalizeAIClothingSkinTone(skinTone),
    normalizedTemplateType
  );
  const templateUpload = await toFile(Readable.from([generationReferenceBuffer]), path.basename(applicationTemplatePath), {
    type: "image/png",
  });

  const generation = await getOpenAIClient().images.edit({
    model: AI_CLOTHING_MODEL,
    image: templateUpload,
    prompt: `${promptText} Build directly on the supplied blank ${normalizedTemplateType} clothing panel layout. The transparent panel zones are the only clothing zones. Keep all artwork strictly inside those transparent panel zones. Leave the surrounding gray canvas completely empty. Do not add any mannequin previews, template labels, helper diagrams, letters, logos, background sheet elements, or explanatory text. Return only mapped clothing artwork on that blank panel layout.`,
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
  const resizedGeneratedBuffer = await sharp(generatedBuffer)
    .resize(AI_CLOTHING_OUTPUT_WIDTH, AI_CLOTHING_OUTPUT_HEIGHT, {
      fit: "fill",
      kernel: "lanczos3",
    })
    .png()
    .toBuffer();
  const panelMappedBuffer = await rebuildAIClothingPanelsOnBlankTemplate(
    resizedGeneratedBuffer,
    cleanedApplyTemplateBuffer,
    normalizedTemplateType
  );
  const skinMappedBuffer = await applyAIClothingSkinGuide(
    panelMappedBuffer,
    referenceTemplateBuffer,
    normalizeAIClothingSkinTone(skinTone),
    normalizedTemplateType,
    resolvedSleeveReferenceKey,
    resolvedPantsReferenceKey
  );
  const templateRaw = await sharp(cleanedApplyTemplateBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const maskBuffer = Buffer.alloc(AI_CLOTHING_OUTPUT_WIDTH * AI_CLOTHING_OUTPUT_HEIGHT);
  for (let index = 0; index < maskBuffer.length; index += 1) {
    const offset = index * 4;
    const red = templateRaw.data[offset];
    const green = templateRaw.data[offset + 1];
    const blue = templateRaw.data[offset + 2];
    const alpha = templateRaw.data[offset + 3];
    const looksLikeTemplateZone = alpha <= 8;
    maskBuffer[index] = looksLikeTemplateZone ? 255 : 0;
  }
  const expandedMaskBuffer = expandAIClothingMask(
    maskBuffer,
    AI_CLOTHING_OUTPUT_WIDTH,
    AI_CLOTHING_OUTPUT_HEIGHT,
    AI_CLOTHING_MASK_BLEED_PX
  );
  const gutterMaskBuffer = expandAIClothingMask(
    maskBuffer,
    AI_CLOTHING_OUTPUT_WIDTH,
    AI_CLOTHING_OUTPUT_HEIGHT,
    Math.max(AI_CLOTHING_MASK_BLEED_PX, 24)
  );
  const maskRgbaBuffer = Buffer.alloc(AI_CLOTHING_OUTPUT_WIDTH * AI_CLOTHING_OUTPUT_HEIGHT * 4, 255);
  for (let index = 0; index < expandedMaskBuffer.length; index += 1) {
    maskRgbaBuffer[index * 4 + 3] = expandedMaskBuffer[index];
  }
  const maskImageBuffer = await sharp(maskRgbaBuffer, {
    raw: {
      width: AI_CLOTHING_OUTPUT_WIDTH,
      height: AI_CLOTHING_OUTPUT_HEIGHT,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
  const maskedOutput = await sharp(skinMappedBuffer)
    .ensureAlpha()
    .composite([{ input: maskImageBuffer, blend: "dest-in" }])
    .raw()
    .toBuffer({ resolveWithObject: true });
  const maskedArtBuffer = await sharp(maskedOutput.data, {
    raw: {
      width: maskedOutput.info.width,
      height: maskedOutput.info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
  const finalBuffer = maskedArtBuffer;

  return {
    outputBuffer: finalBuffer,
    outputMime: "image/png",
    outputBase64: finalBuffer.toString("base64"),
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
    stripeCustomerId: row.stripe_customer_id || null,
    stripeSubscriptionStatus: membership.stripeSubscriptionStatus,
    complimentaryExpiresAt: membership.complimentaryExpiresAt,
    complimentaryActive: membership.complimentaryActive,
    membershipSource: membership.membershipSource,
    plusDaysTotal: membership.plusDaysTotal,
    plusDaysLeft: membership.plusDaysLeft,
    plusExpiresAt: membership.plusExpiresAt,
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
  const hasStripeData = Boolean(stripe.status || stripe.currentPeriodEndAt || stripe.currentPeriodStartAt || stripe.totalDays != null);
  const hasComplimentaryData = Boolean(
    complimentary.totalDays != null ||
    complimentary.expiresAt ||
    complimentary.currentPeriodEndAt ||
    complimentary.currentPeriodStartAt
  );
  const stripeTotal = stripe.totalDays != null ? stripe.totalDays : 0;
  const complimentaryTotal = complimentary.totalDays != null ? complimentary.totalDays : 0;
  const stripeLeft = stripe.daysLeft != null ? stripe.daysLeft : 0;
  const complimentaryLeft = complimentary.daysLeft != null ? complimentary.daysLeft : 0;
  const plusDaysTotal = stripe.totalDays == null && complimentary.totalDays == null
    ? null
    : stripeTotal + complimentaryTotal;
  const plusDaysLeft = stripeLeft + complimentaryLeft;
  const manualPlusFallback = Boolean(
    !hasStripeData &&
    !hasComplimentaryData &&
    (row?.premium_active === true || String(row?.plan || "").toLowerCase() === "plus")
  );
  const premiumActive = Boolean(stripe.active || complimentary.active || plusDaysLeft > 0 || manualPlusFallback);
  const membershipSource = hasStripeData && hasComplimentaryData
    ? "stripe + complimentary"
    : hasStripeData
      ? "stripe"
      : hasComplimentaryData
        ? "complimentary"
        : "none";
  const combinedExpiresAt = plusDaysLeft > 0
    ? new Date(Date.now() + (plusDaysLeft * 86400000)).toISOString()
    : getLaterIsoDate(stripe.expiresAt || stripe.currentPeriodEndAt, complimentary.expiresAt || complimentary.currentPeriodEndAt);

  return {
    premiumActive,
    plan: premiumActive ? "plus" : (row?.plan || "free"),
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

  const rankedItems = items.filter(Boolean).sort(rankStripeSubscription);
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
      return paid;
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
    stripeCustomerId: row.stripe_customer_id || null,
    stripeSubscriptionStatus: membership.stripeSubscriptionStatus,
    complimentaryExpiresAt: membership.complimentaryExpiresAt,
    complimentaryActive: membership.complimentaryActive,
    membershipSource: membership.membershipSource,
    plusDaysTotal: membership.plusDaysTotal,
    plusDaysLeft: membership.plusDaysLeft,
    plusExpiresAt: membership.plusExpiresAt,
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
  return {
    premium_active: Boolean(snapshot.premiumActive),
    plan: snapshot.plan || (snapshot.premiumActive ? "plus" : "free"),
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
  const hasComplimentaryData = Boolean(
    complimentaryMembership &&
    (complimentaryMembership.totalDays != null ||
      complimentaryMembership.expiresAt ||
      complimentaryMembership.currentPeriodEndAt)
  );
  const stripeActive = isPremiumStatus(subscriptionStatus);
  const premiumActive = stripeActive || Boolean(complimentaryMembership && complimentaryMembership.active);
    const membershipSource = stripeActive && hasComplimentaryData
      ? "stripe + complimentary"
      : stripeActive
        ? "stripe"
        : hasComplimentaryData
          ? "complimentary"
          : "none";
    const hasStripeSnapshotData = membershipFields &&
      (membershipFields.stripeDaysTotal != null ||
        membershipFields.stripeCurrentPeriodStartAt ||
        membershipFields.stripeCurrentPeriodEndAt);
    return updateAuthUserFields(userId, {
      stripe_customer_id: customerId || null,
      premium_active: premiumActive,
      plan: premiumActive ? "plus" : "free",
      stripe_subscription_status: subscriptionStatus || null,
      membership_source: membershipSource,
      ...(hasStripeSnapshotData ? buildStripeMembershipStorageFields(membershipFields) : {}),
    });
  }

function buildStripeMembershipFieldsFromSubscription(subscription) {
  const currentPeriodStartAt = getIsoFromUnixSeconds(subscription?.current_period_start);
  const currentPeriodEndAt = getIsoFromUnixSeconds(subscription?.current_period_end);
  return {
    stripeDaysTotal: getDaysBetween(currentPeriodStartAt, currentPeriodEndAt),
    stripeCurrentPeriodStartAt: currentPeriodStartAt,
    stripeCurrentPeriodEndAt: currentPeriodEndAt,
  };
}

function rankStripeSubscription(left, right) {
  const leftStatus = String(left?.status || "").toLowerCase();
  const rightStatus = String(right?.status || "").toLowerCase();
  const leftRank = isPremiumStatus(leftStatus) ? 3 : leftStatus === "past_due" ? 2 : 1;
  const rightRank = isPremiumStatus(rightStatus) ? 3 : rightStatus === "past_due" ? 2 : 1;
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

  const items = Array.isArray(subscriptions?.data) ? subscriptions.data.filter(Boolean) : [];
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
  const items = Array.isArray(subscriptions?.data) ? subscriptions.data.filter(Boolean) : [];
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
      plan: complimentaryMembership && complimentaryMembership.active ? "plus" : "free",
      stripe_subscription_status: subscription.status || null,
      membership_source: complimentaryMembership ? "complimentary" : "none",
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

async function requireActivePlusUser(req) {
  const user = await requireAuthenticatedUser(req);
  const membership = await resolveMembershipSnapshot(user);
  if (!membership.premiumActive) {
    const error = new Error("This tool requires an active RBLXTools Plus subscription.");
    error.statusCode = 403;
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

  const updatedUser = await updateAuthUserFields(targetUser.id, {
    premium_active: true,
    plan: "plus",
    membership_source: hasStripeAccess ? "stripe + complimentary" : "complimentary",
    plus_days_total: totalDays,
    plus_expires_at: expiresAt,
    plus_current_period_start_at: currentPeriodStartAt,
    plus_current_period_end_at: expiresAt,
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
    totalDays,
  };
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

app.get("/auth/me", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req);
    const freshUser = await refreshStripeMembershipForUserIfNeeded(user);
    const deviceId = getRequestDeviceId(req);
    if (deviceId) {
      await linkDeviceToUser(freshUser || user, deviceId).catch(() => null);
    }
    const moderation = await summarizeModerationForTarget(freshUser || user, deviceId);
    return res.json({
      ok: true,
      user: await buildResolvedPublicUser(freshUser || user),
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
    const membership = await resolveMembershipSnapshot(user);
    return res.json({
      ok: true,
      premiumActive: membership.premiumActive,
      plan: membership.plan,
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
    const promptPayload = {
      garmentType: req.body?.garmentType,
      sleeveLength: req.body?.sleeveLength,
      resolvedSleeveLength: req.body?.resolvedSleeveLength,
      pantsLength: req.body?.pantsLength,
      resolvedPantsLength: req.body?.resolvedPantsLength,
      skinTone: req.body?.skinTone,
      styleDirection: req.body?.styleDirection,
      colorPalette: req.body?.colorPalette,
      audience: req.body?.audience,
      userPrompt: req.body?.userPrompt,
      negativePrompt: req.body?.negativePrompt,
      styleName: req.body?.styleName,
      templateGoals: Array.isArray(req.body?.templateGoals) ? req.body.templateGoals : [],
    };

    const built = buildAIClothingPrompt(promptPayload);
    const generationPlan = buildAIClothingGenerationPlan(built);
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
        skinTone: built.skinTone,
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
      skinTone: built.skinTone,
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
    const freshTargetUser = await refreshStripeMembershipForUserIfNeeded(targetUser);
    const moderation = await summarizeModerationForTarget(freshTargetUser || targetUser);
    const deviceLinks = await getDeviceLinksForUser((freshTargetUser || targetUser).id);

      return res.json({
        ok: true,
        admin: await buildResolvedPublicUser(adminUser),
        member: await buildResolvedPublicUser(freshTargetUser || targetUser),
        stripeSyncDebug: (freshTargetUser || targetUser)?.__stripeSyncDebug || null,
        moderation,
        deviceCount: deviceLinks.length,
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
      return res.status(400).json({ error: "A note is required before complimentary Plus can be granted." });
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

    await refreshMembershipStateForConnectedUser(updatedUser || targetUser);
    emitModerationLog(defaultChatRoom, getActionTargetLabel(targetUser) + " received " + grantResult.days + " days of complimentary Plus.");
    return res.json({
      ok: true,
      message: "Complimentary Plus granted for " + grantResult.days + " days.",
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

    await refreshMembershipStateForConnectedUser(updatedUser || targetUser);
    emitModerationLog(defaultChatRoom, "Complimentary Plus was removed from " + getActionTargetLabel(targetUser) + ".");
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

app.get("/ugc-texture", async (req, res) => {
  const id = String(req.query.id || "").trim();

  if (!/^[0-9]+$/.test(id)) {
    return res.status(400).json({ error: "Invalid or missing UGC asset id" });
  }

  try {
    await requireActivePlusUser(req);
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
  "template-downloader": "Clothing",
  "background-changer": "Background Changer",
  "ugc-downloader": "UGC",
  "media-downloader": "Media",
  "audio-downloader": "Audio",
  "texture-baker": "Texture Baker",
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
    badge: isPlus ? "Plus" : "Free Plan",
  }));

  emitToUserInRoom(defaultChatRoom, targetUser.id, "membership-state", {
    ok: true,
    user: publicUser,
    plan,
    premiumActive: isPlus,
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
      const grantResult = await grantComplimentaryPlusToUser(winner.userId, rain.days);
      await refreshMembershipStateForConnectedUser(grantResult.user || { ...winner, id: winner.userId });
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

app.use(express.static(STATIC_ROOT, { extensions: ["html"] }));
  
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
