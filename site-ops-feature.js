const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const VALID_CATEGORIES = new Set(["announcement", "changelog", "bug-fix", "known-issue"]);

function getDefaultSiteSettings() {
  return {
    maintenanceEnabled: false,
    maintenanceTitle: "Sorry, the site is under maintenance right now.",
    maintenanceNotice: "This does not mean the servers are down. The RBLXTeam is currently updating the site. Please come back later.",
    updatedAt: null,
    updatedBy: "",
  };
}

function ensureJsonFile(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2) + "\n", "utf8");
  }
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

function getCommunityPostsPath(baseDir) {
  return path.join(baseDir, "community-posts.json");
}

function getSiteSettingsPath(baseDir) {
  return path.join(baseDir, "site-settings.json");
}

function readCommunityPosts(baseDir) {
  const filePath = getCommunityPostsPath(baseDir);
  ensureJsonFile(filePath, []);
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
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
  fs.writeFileSync(
    getCommunityPostsPath(baseDir),
    JSON.stringify(sortCommunityPosts(posts), null, 2) + "\n",
    "utf8"
  );
}

function readSiteSettings(baseDir) {
  const filePath = getSiteSettingsPath(baseDir);
  ensureJsonFile(filePath, getDefaultSiteSettings());
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
  const defaults = getDefaultSiteSettings();
  const next = {
    maintenanceEnabled: Boolean(settings.maintenanceEnabled),
    maintenanceTitle: String(settings.maintenanceTitle || defaults.maintenanceTitle).trim() || defaults.maintenanceTitle,
    maintenanceNotice: String(settings.maintenanceNotice || defaults.maintenanceNotice).trim() || defaults.maintenanceNotice,
    updatedAt: settings.updatedAt ? String(settings.updatedAt) : null,
    updatedBy: settings.updatedBy ? String(settings.updatedBy) : "",
  };
  fs.writeFileSync(getSiteSettingsPath(baseDir), JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

function buildPublicCommunityPost(post) {
  return {
    id: String(post.id || ""),
    title: String(post.title || ""),
    body: String(post.body || ""),
    category: normalizeCategory(post.category),
    pinned: Boolean(post.pinned),
    createdAt: post.createdAt ? String(post.createdAt) : null,
    updatedAt: post.updatedAt ? String(post.updatedAt) : null,
    publishedAt: post.publishedAt ? String(post.publishedAt) : null,
    authorName: post.authorName ? String(post.authorName) : "",
    linkLabel: post.linkLabel ? String(post.linkLabel) : "",
    linkUrl: post.linkUrl ? String(post.linkUrl) : "",
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
  ensureJsonFile(getCommunityPostsPath(baseDir), []);
  ensureJsonFile(getSiteSettingsPath(baseDir), getDefaultSiteSettings());

  app.get("/api/community-posts", async (req, res) => {
    try {
      const rawFilter = String(req.query?.filter || "").trim().toLowerCase();
      const normalizedFilter = normalizeCategory(rawFilter);
      const posts = sortCommunityPosts(readCommunityPosts(baseDir)).filter((post) => {
        if (!rawFilter) return true;
        return normalizeCategory(post.category) === normalizedFilter;
      });
      return res.json({ ok: true, posts: posts.map(buildPublicCommunityPost) });
    } catch (error) {
      return res.status(500).json({ error: error.message || "Could not load community posts." });
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

      if (!title) return res.status(400).json({ error: "A title is required." });
      if (!body) return res.status(400).json({ error: "A post body is required." });
      if ((linkLabel && !linkUrl) || (!linkLabel && linkUrl)) {
        return res.status(400).json({ error: "Link label and link URL need to be filled together." });
      }

      const now = new Date().toISOString();
      const adminName =
        cleanText(adminUser.display_name || adminUser.username || adminUser.email?.split("@")[0] || "Admin", 80) ||
        "Admin";
      const nextPost = {
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
      posts.push(nextPost);
      writeCommunityPosts(baseDir, posts);
      return res.json({ ok: true, message: "Community post published.", post: buildPublicCommunityPost(nextPost) });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || "Could not publish the community post." });
    }
  });

  app.patch("/admin/community-posts/:postId", async (req, res) => {
    try {
      await requireAdminUser(req);
      const postId = String(req.params?.postId || "").trim();
      if (!postId) return res.status(400).json({ error: "A post ID is required." });

      const posts = readCommunityPosts(baseDir);
      const index = posts.findIndex((post) => String(post.id || "") === postId);
      if (index < 0) return res.status(404).json({ error: "That post could not be found." });

      const existing = posts[index];
      const hasTitle = Object.prototype.hasOwnProperty.call(req.body || {}, "title");
      const hasBody = Object.prototype.hasOwnProperty.call(req.body || {}, "body");
      const hasCategory = Object.prototype.hasOwnProperty.call(req.body || {}, "category");
      const hasPinned = Object.prototype.hasOwnProperty.call(req.body || {}, "pinned");
      const hasLinkLabel = Object.prototype.hasOwnProperty.call(req.body || {}, "linkLabel");
      const hasLinkUrl = Object.prototype.hasOwnProperty.call(req.body || {}, "linkUrl");

      const title = hasTitle ? cleanText(req.body?.title, 140) : String(existing.title || "");
      const body = hasBody ? cleanText(req.body?.body, 6000) : String(existing.body || "");
      const category = hasCategory ? normalizeCategory(req.body?.category) : normalizeCategory(existing.category);
      const pinned = hasPinned ? Boolean(req.body?.pinned) : Boolean(existing.pinned);
      const linkLabel = hasLinkLabel ? cleanText(req.body?.linkLabel, 60) : String(existing.linkLabel || "");
      const linkUrl = hasLinkUrl ? cleanOptionalUrl(req.body?.linkUrl) : cleanOptionalUrl(existing.linkUrl || "");

      if (!title) return res.status(400).json({ error: "A title is required." });
      if (!body) return res.status(400).json({ error: "A post body is required." });
      if ((linkLabel && !linkUrl) || (!linkLabel && linkUrl)) {
        return res.status(400).json({ error: "Link label and link URL need to be filled together." });
      }

      const updated = Object.assign({}, existing, {
        title,
        body,
        category,
        pinned,
        linkLabel,
        linkUrl,
        updatedAt: new Date().toISOString(),
      });

      posts[index] = updated;
      writeCommunityPosts(baseDir, posts);
      return res.json({ ok: true, message: "Community post updated.", post: buildPublicCommunityPost(updated) });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || "Could not update the community post." });
    }
  });

  app.delete("/admin/community-posts/:postId", async (req, res) => {
    try {
      await requireAdminUser(req);
      const postId = String(req.params?.postId || "").trim();
      if (!postId) return res.status(400).json({ error: "A post ID is required." });

      const posts = readCommunityPosts(baseDir);
      const nextPosts = posts.filter((post) => String(post.id || "") !== postId);
      if (nextPosts.length === posts.length) {
        return res.status(404).json({ error: "That post could not be found." });
      }
      writeCommunityPosts(baseDir, nextPosts);
      return res.json({ ok: true, message: "Community post deleted." });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || "Could not delete the community post." });
    }
  });

  app.get("/admin/site-maintenance", async (req, res) => {
    try {
      await requireAdminUser(req);
      return res.json({ ok: true, settings: buildPublicSiteStatus(readSiteSettings(baseDir)) });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || "Could not load maintenance settings." });
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
      return res.status(error.statusCode || 500).json({ error: error.message || "Could not update maintenance mode." });
    }
  });

  app.get("/api/site-status", async (_req, res) => {
    try {
      return res.json({ ok: true, settings: buildPublicSiteStatus(readSiteSettings(baseDir)) });
    } catch (error) {
      return res.status(500).json({ error: error.message || "Could not load site status." });
    }
  });
}

module.exports = { installSiteOpsFeature };
