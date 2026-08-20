const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const VALID_CATEGORIES = new Set(["announcement", "changelog", "bug-fix", "known-issue"]);

function getCommunityPostsPath(baseDir) {
  return path.join(baseDir, "community-posts.json");
}

function getSiteSettingsPath(baseDir) {
  return path.join(baseDir, "site-settings.json");
}

function ensureCommunityPosts(baseDir) {
  const filePath = getCommunityPostsPath(baseDir);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]\n", "utf8");
  }
  return filePath;
}

function ensureSiteSettings(baseDir) {
  const filePath = getSiteSettingsPath(baseDir);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(getDefaultSiteSettings(), null, 2) + "\n", "utf8");
  }
  return filePath;
}

function getDefaultSiteSettings() {
  return {
    maintenanceEnabled: false,
    maintenanceTitle: "Sorry, the site is under maintenance right now.",
    maintenanceNotice: "This does not mean the servers are down. The RBLXTeam is currently updating the site. Please come back later.",
    updatedAt: null,
    updatedBy: "",
  };
}

function normalizeCategory(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_CATEGORIES.has(normalized) ? normalized : "announcement";
}

function cleanOptionalUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text.slice(0, 500);
  if (/^\.\//.test(text) || /^\//.test(text)) return text.slice(0, 500);
  return "";
}

function readCommunityPosts(baseDir) {
  const filePath = ensureCommunityPosts(baseDir);
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id || "").trim(),
        title: String(item.title || "").trim(),
        body: String(item.body || "").trim(),
        category: normalizeCategory(item.category),
        pinned: Boolean(item.pinned),
        createdAt: String(item.createdAt || ""),
        updatedAt: String(item.updatedAt || item.createdAt || ""),
        publishedAt: String(item.publishedAt || item.createdAt || ""),
        authorId: String(item.authorId || "").trim(),
        authorEmail: String(item.authorEmail || "").trim(),
        authorName: String(item.authorName || "").trim(),
        linkLabel: String(item.linkLabel || "").trim(),
        linkUrl: cleanOptionalUrl(item.linkUrl),
      }))
      .filter((item) => item.id && item.title && item.body);
  } catch (_error) {
    return [];
  }
}

function sortCommunityPosts(posts) {
  return posts.slice().sort((left, right) => {
    if (Boolean(left.pinned) !== Boolean(right.pinned)) {
      return left.pinned ? -1 : 1;
    }
    const leftTime = Date.parse(left.publishedAt || left.createdAt || "") || 0;
    const rightTime = Date.parse(right.publishedAt || right.createdAt || "") || 0;
    return rightTime - leftTime;
  });
}

function writeCommunityPosts(baseDir, posts) {
  const filePath = ensureCommunityPosts(baseDir);
  fs.writeFileSync(filePath, JSON.stringify(sortCommunityPosts(posts), null, 2) + "\n", "utf8");
}

function readSiteSettings(baseDir) {
  const filePath = ensureSiteSettings(baseDir);
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const defaults = getDefaultSiteSettings();
    return {
      maintenanceEnabled: Boolean(parsed.maintenanceEnabled),
      maintenanceTitle: String(parsed.maintenanceTitle || defaults.maintenanceTitle).trim() || defaults.maintenanceTitle,
      maintenanceNotice: String(parsed.maintenanceNotice || defaults.maintenanceNotice).trim() || defaults.maintenanceNotice,
      updatedAt: parsed.updatedAt ? String(parsed.updatedAt) : null,
      updatedBy: parsed.updatedBy ? String(parsed.updatedBy) : "",
    };
  } catch (_error) {
    return getDefaultSiteSettings();
  }
}

function writeSiteSettings(baseDir, settings) {
  const filePath = ensureSiteSettings(baseDir);
  const defaults = getDefaultSiteSettings();
  const next = {
    maintenanceEnabled: Boolean(settings.maintenanceEnabled),
    maintenanceTitle: String(settings.maintenanceTitle || defaults.maintenanceTitle).trim() || defaults.maintenanceTitle,
    maintenanceNotice: String(settings.maintenanceNotice || defaults.maintenanceNotice).trim() || defaults.maintenanceNotice,
    updatedAt: settings.updatedAt ? String(settings.updatedAt) : null,
    updatedBy: settings.updatedBy ? String(settings.updatedBy) : "",
  };
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

function buildPublicCommunityPost(post) {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    category: post.category,
    pinned: Boolean(post.pinned),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    publishedAt: post.publishedAt,
    authorName: post.authorName || "",
    linkLabel: post.linkLabel || "",
    linkUrl: post.linkUrl || "",
  };
}

function buildPublicSiteStatus(settings) {
  return {
    maintenanceEnabled: Boolean(settings.maintenanceEnabled),
    maintenanceTitle: settings.maintenanceTitle,
    maintenanceNotice: settings.maintenanceNotice,
    updatedAt: settings.updatedAt || null,
  };
}

function installSiteOpsFeature({ app, baseDir, requireAdminUser, cleanText }) {
  if (!app || typeof app.get !== "function" || typeof app.post !== "function") {
    throw new Error("A valid Express app is required for site ops routes.");
  }

  ensureCommunityPosts(baseDir);
  ensureSiteSettings(baseDir);

  app.get("/api/community-posts", async (req, res) => {
    try {
      const rawFilter = String(req.query?.filter || "").trim().toLowerCase();
      const normalizedFilter = normalizeCategory(rawFilter);
      const posts = sortCommunityPosts(readCommunityPosts(baseDir)).filter((post) => {
        if (!rawFilter) return true;
        return post.category === normalizedFilter;
      });

      return res.json({
        ok: true,
        posts: posts.map(buildPublicCommunityPost),
      });
    } catch (error) {
      return res.status(500).json({
        error: error.message || "Could not load community posts.",
      });
    }
  });

  app.post("/admin/community-posts", async (req, res) => {
    try {
      const adminUser = await requireAdminUser(req);
      const title = cleanText(req.body?.title, 140);
      const body = cleanText(req.body?.body, 6000);
      const category = normalizeCategory(req.body?.category);
      const pinned = Boolean(req.body?.pinned);
      const linkLabel = cleanText(req.body?.linkLabel, 60);
      const linkUrl = cleanOptionalUrl(req.body?.linkUrl);

      if (!title) {
        return res.status(400).json({ error: "A title is required." });
      }
      if (!body) {
        return res.status(400).json({ error: "A post body is required." });
      }
      if ((linkLabel && !linkUrl) || (!linkLabel && linkUrl)) {
        return res.status(400).json({ error: "Link label and link URL need to be filled together." });
      }

      const now = new Date().toISOString();
      const adminName =
        cleanText(adminUser.display_name || adminUser.username || adminUser.email?.split("@")[0] || "Admin", 80) ||
        "Admin";
      const post = {
        id: randomUUID(),
        title,
        body,
        category,
        pinned,
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
        authorId: String(adminUser.id || "").trim(),
        authorEmail: String(adminUser.email || "").trim(),
        authorName: adminName,
        linkLabel,
        linkUrl,
      };

      const posts = readCommunityPosts(baseDir);
      posts.push(post);
      writeCommunityPosts(baseDir, posts);

      return res.json({
        ok: true,
        message: "Community post published.",
        post: buildPublicCommunityPost(post),
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || "Could not publish the community post.",
      });
    }
  });

  app.get("/admin/site-maintenance", async (req, res) => {
    try {
      await requireAdminUser(req);
      return res.json({
        ok: true,
        settings: buildPublicSiteStatus(readSiteSettings(baseDir)),
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || "Could not load maintenance settings.",
      });
    }
  });

  app.post("/admin/site-maintenance", async (req, res) => {
    try {
      const adminUser = await requireAdminUser(req);
      const defaults = getDefaultSiteSettings();
      const nextSettings = writeSiteSettings(baseDir, {
        maintenanceEnabled: Boolean(req.body?.maintenanceEnabled),
        maintenanceTitle: cleanText(req.body?.maintenanceTitle, 140) || defaults.maintenanceTitle,
        maintenanceNotice: cleanText(req.body?.maintenanceNotice, 500) || defaults.maintenanceNotice,
        updatedAt: new Date().toISOString(),
        updatedBy: String(adminUser.email || adminUser.id || "admin"),
      });

      return res.json({
        ok: true,
        message: nextSettings.maintenanceEnabled
          ? "Site maintenance mode is now enabled."
          : "Site maintenance mode is now disabled.",
        settings: buildPublicSiteStatus(nextSettings),
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || "Could not update maintenance mode.",
      });
    }
  });

  app.get("/api/site-status", async (_req, res) => {
    try {
      return res.json({
        ok: true,
        settings: buildPublicSiteStatus(readSiteSettings(baseDir)),
      });
    } catch (error) {
      return res.status(500).json({
        error: error.message || "Could not load site status.",
      });
    }
  });
}

module.exports = {
  installSiteOpsFeature,
};
