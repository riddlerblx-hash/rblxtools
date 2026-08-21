const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const VALID_CATEGORIES = new Set(["announcement", "changelog", "bug-fix", "known-issue"]);
const STATIC_FILE_EXTENSIONS = new Set([
  ".css", ".js", ".mjs", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".map", ".txt", ".xml", ".json", ".obj", ".glb", ".gltf", ".bin", ".mp3", ".wav", ".ogg", ".mp4", ".webm"
]);

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

function getPathnameFromRequest(req) {
  return String((req && (req.path || req.url || req.originalUrl)) || "").split("?")[0] || "/";
}

function isStaticAssetPath(pathname) {
  const extension = path.extname(String(pathname || "").toLowerCase());
  return STATIC_FILE_EXTENSIONS.has(extension);
}

function isHtmlPageRequest(req) {
  const pathname = getPathnameFromRequest(req);
  if (!["GET", "HEAD"].includes(String(req.method || "GET").toUpperCase())) return false;
  if (pathname === "/" || pathname.endsWith(".html")) return true;
  if (isStaticAssetPath(pathname)) return false;
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/") || pathname.startsWith("/admin/") || pathname.startsWith("/socket.io")) return false;
  const accept = String(req.headers?.accept || "").toLowerCase();
  return accept.includes("text/html");
}

function isMaintenanceAllowedPath(pathname) {
  const value = String(pathname || "");
  return (
    value.startsWith("/auth/") ||
    value.startsWith("/admin/") ||
    value.startsWith("/socket.io/") ||
    value.startsWith("/assets/") ||
    value === "/favicon.ico" ||
    value === "/robots.txt" ||
    value === "/sitemap.xml" ||
    value === "/api/site-status"
  );
}

function buildMaintenanceHtml(settings) {
  const title = String(settings?.maintenanceTitle || "Sorry, the site is under maintenance right now.").replace(/[<>&"]/g, "");
  const notice = String(settings?.maintenanceNotice || "This does not mean the servers are down. The RBLXTeam is currently updating the site. Please come back later.").replace(/[<>&"]/g, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Maintenance | RBLXTools</title>
  <meta name="robots" content="noindex,nofollow" />
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 18px;
      font-family: Arial, Helvetica, sans-serif;
      background:
        radial-gradient(circle at top, rgba(255,94,94,.14), transparent 24%),
        radial-gradient(circle at bottom right, rgba(110,179,255,.12), transparent 26%),
        linear-gradient(180deg, #0d1118 0%, #090c12 100%);
      color: #f4f7fb;
    }
    .lock-card {
      width: min(560px, calc(100vw - 20px));
      padding: 26px;
      border-radius: 26px;
      border: 1px solid rgba(255,255,255,.08);
      background:
        radial-gradient(circle at top right, rgba(255,72,72,.18), transparent 30%),
        linear-gradient(180deg, rgba(19,23,34,.98), rgba(11,14,22,.98));
      box-shadow: 0 30px 70px rgba(0,0,0,.42);
      text-align: center;
    }
    .kicker {
      display: inline-flex;
      min-height: 28px;
      align-items: center;
      justify-content: center;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04);
      color: #ffb9a9;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    h1 {
      margin: 16px 0 10px;
      font-size: clamp(34px, 7vw, 54px);
      line-height: .95;
      letter-spacing: -.05em;
    }
    p {
      margin: 0;
      color: #d5deeb;
      font-size: 15px;
      line-height: 1.7;
      font-weight: 700;
    }
    .notice {
      margin-top: 16px;
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px solid rgba(255,204,107,.26);
      background: rgba(255,204,107,.08);
      color: #ffe39b;
      font-size: 13px;
      line-height: 1.65;
      font-weight: 800;
    }
  </style>
</head>
<body>
  <main class="lock-card">
    <div class="kicker">Maintenance Notice</div>
    <h1>${title}</h1>

    <div class="notice">${notice}</div>
  </main>
</body>
</html>`;
}

async function getOptionalAuthenticatedUser(req, requireAuthenticatedUser) {
  if (typeof requireAuthenticatedUser !== "function") return null;
  try {
    return await requireAuthenticatedUser(req);
  } catch (_error) {
    return null;
  }
}

function normalizeCommunityComment(comment) {
  const likes = Array.isArray(comment?.likes) ? comment.likes.map((value) => String(value || "").trim()).filter(Boolean) : [];
  const replies = Array.isArray(comment?.replies) ? comment.replies.map((reply) => ({
    id: String(reply?.id || randomUUID()),
    userId: String(reply?.userId || "").trim(),
    authorName: String(reply?.authorName || "Member").trim().slice(0, 80) || "Member",
    avatarUrl: String(reply?.avatarUrl || "").trim().slice(0, 500),
    bio: String(reply?.bio || "").trim().slice(0, 280),
    plan: String(reply?.plan || "free").trim().toLowerCase() === "plus" ? "plus" : "free",
    body: String(reply?.body || "").trim().slice(0, 800),
    createdAt: reply?.createdAt ? String(reply.createdAt) : new Date().toISOString(),
  })).filter((reply) => reply.body) : [];
  return {
    id: String(comment?.id || randomUUID()), userId: String(comment?.userId || "").trim(),
    authorName: String(comment?.authorName || "Member").trim().slice(0, 80) || "Member",
    avatarUrl: String(comment?.avatarUrl || "").trim().slice(0, 500), bio: String(comment?.bio || "").trim().slice(0, 280),
    plan: String(comment?.plan || "free").trim().toLowerCase() === "plus" ? "plus" : "free", pinned: Boolean(comment?.pinned),
    body: String(comment?.body || "").trim().slice(0, 800), createdAt: comment?.createdAt ? String(comment.createdAt) : new Date().toISOString(), likes, replies,
  };
}

function normalizePostForStorage(post) {
  const likes = Array.isArray(post?.likes) ? post.likes.map((value) => String(value || "").trim()).filter(Boolean) : [];
  const comments = Array.isArray(post?.comments) ? post.comments.map(normalizeCommunityComment).filter((comment) => comment.body) : [];
  return Object.assign({}, post, { likes, comments });
}

function buildPublicCommunityPost(post, viewerId) {
  const normalized = normalizePostForStorage(post);
  const viewer = String(viewerId || "").trim();
  const commentPublic = (comment) => ({
    id: comment.id, userId: comment.userId, authorName: comment.authorName, avatarUrl: comment.avatarUrl, bio: comment.bio, plan: comment.plan,
    pinned: Boolean(comment.pinned), body: comment.body, createdAt: comment.createdAt, likeCount: comment.likes.length, viewerLiked: Boolean(viewer && comment.likes.includes(viewer)),
    replies: comment.replies.map((reply) => ({ id: reply.id, userId: reply.userId, authorName: reply.authorName, avatarUrl: reply.avatarUrl, bio: reply.bio, plan: reply.plan, body: reply.body, createdAt: reply.createdAt }))
  });
  return {
    id: String(normalized.id || ""), title: String(normalized.title || ""), body: String(normalized.body || ""), category: normalizeCategory(normalized.category),
    pinned: Boolean(normalized.pinned), createdAt: normalized.createdAt ? String(normalized.createdAt) : null, updatedAt: normalized.updatedAt ? String(normalized.updatedAt) : null,
    publishedAt: normalized.publishedAt ? String(normalized.publishedAt) : null, authorName: normalized.authorName ? String(normalized.authorName) : "",
    linkLabel: normalized.linkLabel ? String(normalized.linkLabel) : "", linkUrl: normalized.linkUrl ? String(normalized.linkUrl) : "",
    likeCount: normalized.likes.length, viewerLiked: Boolean(viewer && normalized.likes.includes(viewer)), commentCount: normalized.comments.length, comments: normalized.comments.map(commentPublic),
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

function installSiteOpsFeature({ app, baseDir, requireAdminUser, requireAuthenticatedUser, isAdminUser, cleanText }) {
  ensureJsonFile(getCommunityPostsPath(baseDir), []);
  ensureJsonFile(getSiteSettingsPath(baseDir), getDefaultSiteSettings());

  app.use(async (req, res, next) => {
    try {
      const settings = readSiteSettings(baseDir);
      if (!settings.maintenanceEnabled) return next();

      const pathname = getPathnameFromRequest(req);
      if (isMaintenanceAllowedPath(pathname) || isStaticAssetPath(pathname)) {
        return next();
      }

      const user = await getOptionalAuthenticatedUser(req, requireAuthenticatedUser);
      if (user && typeof isAdminUser === "function" && isAdminUser(user)) {
        return next();
      }

      if (isHtmlPageRequest(req)) {
        return res.status(503).type("html").send(buildMaintenanceHtml(settings));
      }

      return res.status(503).json({
        error: settings.maintenanceTitle,
        notice: settings.maintenanceNotice,
        maintenance: true,
      });
    } catch (_error) {
      return next();
    }
  });

  app.get("/api/community-posts", async (req, res) => {
    try {
      const viewer = await getOptionalAuthenticatedUser(req, requireAuthenticatedUser);
      const viewerId = viewer && viewer.id ? String(viewer.id).trim() : "";
      const rawFilter = String(req.query?.filter || "").trim().toLowerCase();
      const normalizedFilter = normalizeCategory(rawFilter);
      const posts = sortCommunityPosts(readCommunityPosts(baseDir)).filter((post) => {
        if (!rawFilter) return true;
        return normalizeCategory(post.category) === normalizedFilter;
      });
      return res.json({ ok: true, posts: posts.map((post) => buildPublicCommunityPost(post, viewerId)) });
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
      const nextPost = normalizePostForStorage({
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
      });

      const posts = readCommunityPosts(baseDir);
      posts.push(nextPost);
      writeCommunityPosts(baseDir, posts);
      return res.json({ ok: true, message: "Community post published.", post: buildPublicCommunityPost(nextPost, String(adminUser.id || "")) });
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

      const existing = normalizePostForStorage(posts[index]);
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

      const updated = normalizePostForStorage(Object.assign({}, existing, {
        title,
        body,
        category,
        pinned,
        linkLabel,
        linkUrl,
        updatedAt: new Date().toISOString(),
      }));

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

  app.patch("/admin/community-posts/:postId/comments/:commentId", async (req, res) => {
    try {
      await requireAdminUser(req);
      const postId = String(req.params?.postId || "").trim();
      const commentId = String(req.params?.commentId || "").trim();
      const posts = readCommunityPosts(baseDir);
      const postIndex = posts.findIndex((post) => String(post.id || "") === postId);
      if (postIndex < 0) return res.status(404).json({ error: "That post could not be found." });
      const post = normalizePostForStorage(posts[postIndex]);
      const comment = post.comments.find((entry) => String(entry.id || "") === commentId);
      if (!comment) return res.status(404).json({ error: "That comment could not be found." });
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "pinned")) comment.pinned = Boolean(req.body.pinned);
      post.updatedAt = new Date().toISOString();
      posts[postIndex] = post;
      writeCommunityPosts(baseDir, posts);
      return res.json({ ok: true, message: "Comment updated." });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || "Could not update the comment." });
    }
  });

  app.delete("/admin/community-posts/:postId/comments/:commentId", async (req, res) => {
    try {
      await requireAdminUser(req);
      const postId = String(req.params?.postId || "").trim();
      const commentId = String(req.params?.commentId || "").trim();
      const posts = readCommunityPosts(baseDir);
      const postIndex = posts.findIndex((post) => String(post.id || "") === postId);
      if (postIndex < 0) return res.status(404).json({ error: "That post could not be found." });
      const post = normalizePostForStorage(posts[postIndex]);
      const nextComments = post.comments.filter((entry) => String(entry.id || "") !== commentId);
      if (nextComments.length === post.comments.length) return res.status(404).json({ error: "That comment could not be found." });
      post.comments = nextComments;
      post.updatedAt = new Date().toISOString();
      posts[postIndex] = post;
      writeCommunityPosts(baseDir, posts);
      return res.json({ ok: true, message: "Comment deleted." });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || "Could not delete the comment." });
    }
  });

  app.post("/api/community-posts/:postId/likes", async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req);
      const userId = String(user?.id || "").trim();
      if (!userId) return res.status(401).json({ error: "Log in first." });

      const postId = String(req.params?.postId || "").trim();
      const posts = readCommunityPosts(baseDir);
      const index = posts.findIndex((post) => String(post.id || "") === postId);
      if (index < 0) return res.status(404).json({ error: "That post could not be found." });

      const post = normalizePostForStorage(posts[index]);
      if (post.likes.includes(userId)) {
        post.likes = post.likes.filter((value) => value !== userId);
      } else {
        post.likes.push(userId);
      }
      post.updatedAt = new Date().toISOString();
      posts[index] = post;
      writeCommunityPosts(baseDir, posts);
      return res.json({ ok: true, post: buildPublicCommunityPost(post, userId) });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || "Could not update likes." });
    }
  });

  app.post("/api/community-posts/:postId/comments", async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req);
      const userId = String(user?.id || "").trim();
      if (!userId) return res.status(401).json({ error: "Log in first." });

      const body = cleanText(req.body?.body, 800);
      if (!body) return res.status(400).json({ error: "Write a comment first." });

      const postId = String(req.params?.postId || "").trim();
      const posts = readCommunityPosts(baseDir);
      const index = posts.findIndex((post) => String(post.id || "") === postId);
      if (index < 0) return res.status(404).json({ error: "That post could not be found." });

      const authorName = cleanText(
        req.body?.displayName || user.display_name || user.username || String(user.email || "").split("@")[0] || "Member",
        80
      ) || "Member";
      const avatarUrl = cleanText(req.body?.avatarUrl, 500);
      const bio = cleanText(req.body?.bio, 280);
      const plan = cleanText(req.body?.plan, 24).toLowerCase() === "plus" ? "plus" : "free";
      const post = normalizePostForStorage(posts[index]);
      post.comments.push({
        id: randomUUID(),
        userId,
        authorName,
        avatarUrl,
        bio,
        plan,
        body,
        createdAt: new Date().toISOString(),
      });
      post.updatedAt = new Date().toISOString();
      posts[index] = post;
      writeCommunityPosts(baseDir, posts);
      return res.json({ ok: true, post: buildPublicCommunityPost(post, userId) });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || "Could not post the comment." });
    }
  });

  app.post("/api/community-posts/:postId/comments/:commentId/likes", async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req);
      const userId = String(user?.id || "").trim();
      const posts = readCommunityPosts(baseDir);
      const post = posts.find((entry) => String(entry.id || "") === String(req.params?.postId || ""));
      if (!post) return res.status(404).json({ error: "That post could not be found." });
      const normalized = normalizePostForStorage(post);
      const comment = normalized.comments.find((entry) => String(entry.id || "") === String(req.params?.commentId || ""));
      if (!comment) return res.status(404).json({ error: "That comment could not be found." });
      comment.likes = comment.likes.includes(userId) ? comment.likes.filter((value) => value !== userId) : comment.likes.concat(userId);
      normalized.updatedAt = new Date().toISOString();
      posts[posts.indexOf(post)] = normalized; writeCommunityPosts(baseDir, posts);
      return res.json({ ok: true, post: buildPublicCommunityPost(normalized, userId) });
    } catch (error) { return res.status(error.statusCode || 500).json({ error: error.message || "Could not update the comment like." }); }
  });

  app.post("/api/community-posts/:postId/comments/:commentId/replies", async (req, res) => {
    try {
      const user = await requireAuthenticatedUser(req);
      const body = cleanText(req.body?.body, 800);
      if (!body) return res.status(400).json({ error: "Write a reply first." });
      const posts = readCommunityPosts(baseDir); const post = posts.find((entry) => String(entry.id || "") === String(req.params?.postId || ""));
      if (!post) return res.status(404).json({ error: "That post could not be found." });
      const normalized = normalizePostForStorage(post); const comment = normalized.comments.find((entry) => String(entry.id || "") === String(req.params?.commentId || ""));
      if (!comment) return res.status(404).json({ error: "That comment could not be found." });
      comment.replies.push(normalizeCommunityComment({ id: randomUUID(), userId: String(user.id || ""), authorName: cleanText(req.body?.displayName || user.display_name || user.username || "Member", 80), avatarUrl: cleanText(req.body?.avatarUrl, 500), bio: cleanText(req.body?.bio, 280), plan: cleanText(req.body?.plan, 24), body, createdAt: new Date().toISOString() }));
      normalized.updatedAt = new Date().toISOString(); posts[posts.indexOf(post)] = normalized; writeCommunityPosts(baseDir, posts);
      return res.json({ ok: true, post: buildPublicCommunityPost(normalized, String(user.id || "")) });
    } catch (error) { return res.status(error.statusCode || 500).json({ error: error.message || "Could not post the reply." }); }
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
