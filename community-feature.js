const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const VALID_CATEGORIES = new Set(["announcement", "changelog", "bug-fix", "known-issue"]);

function getStorePath(baseDir) {
  return path.join(baseDir, "community-posts.json");
}

function ensureStore(baseDir) {
  const filePath = getStorePath(baseDir);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]\n", "utf8");
  }
  return filePath;
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

function readPosts(baseDir) {
  const filePath = ensureStore(baseDir);
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

function sortPosts(posts) {
  return posts.slice().sort((left, right) => {
    if (Boolean(left.pinned) !== Boolean(right.pinned)) {
      return left.pinned ? -1 : 1;
    }
    const leftTime = Date.parse(left.publishedAt || left.createdAt || "") || 0;
    const rightTime = Date.parse(right.publishedAt || right.createdAt || "") || 0;
    return rightTime - leftTime;
  });
}

function writePosts(baseDir, posts) {
  const filePath = ensureStore(baseDir);
  fs.writeFileSync(filePath, JSON.stringify(sortPosts(posts), null, 2) + "\n", "utf8");
}

function buildPublicPost(post) {
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

function installCommunityFeature({ app, baseDir, requireAdminUser, cleanText }) {
  if (!app || typeof app.get !== "function" || typeof app.post !== "function") {
    throw new Error("A valid Express app is required for community routes.");
  }

  ensureStore(baseDir);

  app.get("/api/community-posts", async (req, res) => {
    try {
      const rawFilter = String(req.query?.filter || "").trim().toLowerCase();
      const normalizedFilter = normalizeCategory(rawFilter);
      const posts = sortPosts(readPosts(baseDir)).filter((post) => {
        if (!rawFilter) return true;
        return post.category === normalizedFilter;
      });

      return res.json({
        ok: true,
        posts: posts.map(buildPublicPost),
      });
    } catch (error) {
      return res.status(500).json({
        error: error.message || "Could not load community posts.",
      });
    }
  });

  app.get("/admin/community-posts", async (req, res) => {
    try {
      await requireAdminUser(req);
      const posts = sortPosts(readPosts(baseDir));
      return res.json({
        ok: true,
        posts: posts.map(buildPublicPost),
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || "Could not load admin community posts.",
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

      const posts = readPosts(baseDir);
      posts.push(post);
      writePosts(baseDir, posts);

      return res.json({
        ok: true,
        message: "Community post published.",
        post: buildPublicPost(post),
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || "Could not publish the community post.",
      });
    }
  });

  app.delete("/admin/community-posts/:postId", async (req, res) => {
    try {
      await requireAdminUser(req);
      const postId = String(req.params?.postId || "").trim();
      if (!postId) {
        return res.status(400).json({ error: "A post ID is required." });
      }

      const posts = readPosts(baseDir);
      const nextPosts = posts.filter((post) => post.id !== postId);
      if (nextPosts.length === posts.length) {
        return res.status(404).json({ error: "That community post could not be found." });
      }

      writePosts(baseDir, nextPosts);
      return res.json({
        ok: true,
        message: "Community post deleted.",
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || "Could not delete the community post.",
      });
    }
  });
}

module.exports = {
  installCommunityFeature,
};
