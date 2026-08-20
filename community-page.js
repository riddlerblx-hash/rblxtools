(function () {
  var API_BASE = window.location.origin;
  var TOKEN_KEY = "rblxtools_auth_token";
  var VALID_FILTERS = ["announcement", "changelog", "bug-fix", "known-issue"];
  var isAdminUser = false;
  var editingPostId = "";
  var pollTimer = null;
  var lastFeedSignature = "";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; }
    catch (_error) { return ""; }
  }

  function formatFilterLabel(filter) {
    var map = {
      announcement: "Announcements",
      changelog: "Changelog",
      "bug-fix": "Bug Fixes",
      "known-issue": "Known Issues"
    };
    return map[filter] || "All";
  }

  function formatPostType(type) {
    var map = {
      announcement: "Announcement",
      changelog: "Changelog",
      "bug-fix": "Bug Fix",
      "known-issue": "Known Issue"
    };
    return map[type] || "Update";
  }

  function formatDate(value) {
    if (!value) return "Recently";
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Recently";
    return parsed.toLocaleDateString([], {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function getActiveFilter() {
    var params = new URLSearchParams(window.location.search);
    var raw = String(params.get("filter") || "").trim().toLowerCase();
    return VALID_FILTERS.indexOf(raw) >= 0 ? raw : "all";
  }

  function syncFilterUi(activeFilter) {
    var pills = document.querySelectorAll("[data-filter]");
    pills.forEach(function (pill) {
      var matches = (pill.getAttribute("data-filter") || "all") === activeFilter;
      pill.classList.toggle("is-active", matches);
    });
  }

  function setPublishStatus(message, tone) {
    var node = document.getElementById("communityPublishStatus");
    if (!node) return;
    node.hidden = !message;
    node.textContent = message || "";
    node.className = "community-status" + (tone ? " is-" + tone : "");
  }

  function renderEmpty(feed, activeFilter) {
    var title = activeFilter === "all"
      ? "Nothing has been posted yet."
      : "No " + formatFilterLabel(activeFilter).toLowerCase() + " have been posted yet.";
    feed.innerHTML =
      '<article class="community-empty">' +
        "<h2>" + escapeHtml(title) + "</h2>" +
        "<p>Check back later for official RBLXTools updates from the admin team.</p>" +
      "</article>";
  }

  function getFeedSignature(posts) {
    return JSON.stringify(posts || []);
  }

  function buildAdminPostMenu(post) {
    if (!isAdminUser) return "";
    var pinLabel = post.pinned ? "Unpin Post" : "Pin Post";
    return (
      '<details class="community-post-menu">' +
        '<summary aria-label="Post settings">⋯</summary>' +
        '<div class="community-post-menu-panel">' +
          '<button class="community-post-menu-item" type="button" data-community-edit="' + escapeHtml(post.id) + '">Edit Post</button>' +
          '<button class="community-post-menu-item" type="button" data-community-pin="' + escapeHtml(post.id) + '" data-next-pinned="' + (post.pinned ? "false" : "true") + '">' + pinLabel + "</button>" +
          '<button class="community-post-menu-item is-danger" type="button" data-community-delete="' + escapeHtml(post.id) + '">Delete Post</button>' +
        "</div>" +
      "</details>"
    );
  }

  function renderPosts(feed, posts) {
    feed.innerHTML = posts.map(function (post) {
      var typeClasses = "community-type" + (post.pinned ? " is-pinned" : "");
      var action = "";
      if (post.linkUrl && post.linkLabel) {
        action =
          '<a class="community-action" href="' + escapeHtml(post.linkUrl) + '">' +
            escapeHtml(post.linkLabel) +
          "</a>";
      }

      var authorBits = [];
      if (post.authorName) authorBits.push("Posted by " + escapeHtml(post.authorName));
      if (post.pinned) authorBits.push("Pinned");

      return (
        '<article class="community-post" data-community-post-id="' + escapeHtml(post.id) + '">' +
          '<div class="community-post-head">' +
            '<div class="community-post-head-main">' +
              '<span class="' + typeClasses + '">' + escapeHtml(formatPostType(post.category)) + "</span>" +
              '<span class="community-date">' + escapeHtml(formatDate(post.publishedAt || post.createdAt)) + "</span>" +
            "</div>" +
            buildAdminPostMenu(post) +
          "</div>" +
          "<h2>" + escapeHtml(post.title || "Untitled update") + "</h2>" +
          "<p>" + escapeHtml(post.body || "").replace(/\n/g, "<br>") + "</p>" +
          '<div class="community-meta">' + authorBits.map(function (bit) {
            return "<span>" + bit + "</span>";
          }).join("") + "</div>" +
          action +
        "</article>"
      );
    }).join("");
  }

  async function fetchJson(url, options) {
    var response = await fetch(url, options);
    var payload = await response.json().catch(function () { return null; });
    if (!response.ok) {
      throw new Error(payload && payload.error ? payload.error : "Request failed.");
    }
    return payload || {};
  }

  async function loadCommunityPosts(forceRender) {
    var feed = document.getElementById("communityFeed");
    if (!feed) return;
    var activeFilter = getActiveFilter();
    syncFilterUi(activeFilter);

    var url = API_BASE + "/api/community-posts";
    if (activeFilter !== "all") {
      url += "?filter=" + encodeURIComponent(activeFilter);
    }

    try {
      var payload = await fetchJson(url, { cache: "no-store" });
      var posts = Array.isArray(payload.posts) ? payload.posts : [];
      var signature = getFeedSignature(posts);
      if (!forceRender && signature === lastFeedSignature) return;
      lastFeedSignature = signature;
      if (!posts.length) {
        renderEmpty(feed, activeFilter);
        return;
      }
      renderPosts(feed, posts);
    } catch (error) {
      feed.innerHTML =
        '<article class="community-empty">' +
          "<h2>Community could not load right now.</h2>" +
          "<p>" + escapeHtml(error && error.message ? error.message : "Please try again in a moment.") + "</p>" +
        "</article>";
    }
  }

  async function revealAdminComposerIfAllowed() {
    var composer = document.getElementById("communityAdminComposer");
    if (!composer) return;
    var token = getToken();
    if (!token) return;

    try {
      var payload = await fetchJson(API_BASE + "/auth/me", {
        headers: { Authorization: "Bearer " + token }
      });
      var user = payload && payload.user ? payload.user : null;
      if (user && user.isAdmin) {
        isAdminUser = true;
        composer.hidden = false;
        await loadCommunityPosts(true);
      }
    } catch (_error) {
    }
  }

  function resetComposer() {
    editingPostId = "";
    var title = document.getElementById("communityComposerTitle");
    var button = document.getElementById("communityPublishButton");
    var cancel = document.getElementById("communityCancelEditButton");
    if (title) title.textContent = "Create Community Post";
    if (button) button.textContent = "Publish Post";
    if (cancel) cancel.hidden = true;
    var titleNode = document.getElementById("communityPostTitle");
    var bodyNode = document.getElementById("communityPostBody");
    var categoryNode = document.getElementById("communityPostCategory");
    var linkLabelNode = document.getElementById("communityPostLinkLabel");
    var linkUrlNode = document.getElementById("communityPostLinkUrl");
    var pinnedNode = document.getElementById("communityPostPinned");
    if (titleNode) titleNode.value = "";
    if (bodyNode) bodyNode.value = "";
    if (categoryNode) categoryNode.value = "announcement";
    if (linkLabelNode) linkLabelNode.value = "";
    if (linkUrlNode) linkUrlNode.value = "";
    if (pinnedNode) pinnedNode.checked = false;
    setPublishStatus("", "");
  }

  async function getAllPosts() {
    var payload = await fetchJson(API_BASE + "/api/community-posts", { cache: "no-store" });
    return Array.isArray(payload.posts) ? payload.posts : [];
  }

  async function loadPostIntoComposer(postId) {
    try {
      var posts = await getAllPosts();
      var match = posts.find(function (post) { return String(post.id) === String(postId); });
      if (!match) {
        setPublishStatus("That post could not be found.", "error");
        return;
      }
      editingPostId = String(match.id);
      var title = document.getElementById("communityComposerTitle");
      var button = document.getElementById("communityPublishButton");
      var cancel = document.getElementById("communityCancelEditButton");
      if (title) title.textContent = "Edit Community Post";
      if (button) button.textContent = "Save Post";
      if (cancel) cancel.hidden = false;
      document.getElementById("communityPostTitle").value = match.title || "";
      document.getElementById("communityPostBody").value = match.body || "";
      document.getElementById("communityPostCategory").value = match.category || "announcement";
      document.getElementById("communityPostLinkLabel").value = match.linkLabel || "";
      document.getElementById("communityPostLinkUrl").value = match.linkUrl || "";
      document.getElementById("communityPostPinned").checked = Boolean(match.pinned);
      document.getElementById("communityAdminComposer").scrollIntoView({ behavior: "smooth", block: "start" });
      setPublishStatus("Editing selected post.", "success");
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "Could not load that post.", "error");
    }
  }

  async function savePost() {
    var token = getToken();
    if (!token) {
      setPublishStatus("Log into an approved admin account first.", "error");
      return;
    }

    var titleNode = document.getElementById("communityPostTitle");
    var bodyNode = document.getElementById("communityPostBody");
    var categoryNode = document.getElementById("communityPostCategory");
    var linkLabelNode = document.getElementById("communityPostLinkLabel");
    var linkUrlNode = document.getElementById("communityPostLinkUrl");
    var pinnedNode = document.getElementById("communityPostPinned");
    var button = document.getElementById("communityPublishButton");

    var title = titleNode ? String(titleNode.value || "").trim() : "";
    var body = bodyNode ? String(bodyNode.value || "").trim() : "";
    if (!title) {
      setPublishStatus("Give the post a title first.", "error");
      return;
    }
    if (!body) {
      setPublishStatus("Write the post body first.", "error");
      return;
    }

    if (button) button.disabled = true;
    setPublishStatus(editingPostId ? "Saving post..." : "Publishing post...");

    try {
      var payload = await fetchJson(
        editingPostId
          ? (API_BASE + "/admin/community-posts/" + encodeURIComponent(editingPostId))
          : (API_BASE + "/admin/community-posts"),
        {
          method: editingPostId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({
            title: title,
            body: body,
            category: categoryNode ? categoryNode.value : "announcement",
            pinned: Boolean(pinnedNode && pinnedNode.checked),
            linkLabel: linkLabelNode ? String(linkLabelNode.value || "").trim() : "",
            linkUrl: linkUrlNode ? String(linkUrlNode.value || "").trim() : ""
          })
        }
      );

      setPublishStatus(payload.message || (editingPostId ? "Post saved." : "Post published."), "success");
      resetComposer();
      await loadCommunityPosts(true);
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "Could not save the post.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function deletePost(postId) {
    var token = getToken();
    if (!token) return;
    if (!window.confirm("Delete this post?")) return;
    try {
      var payload = await fetchJson(API_BASE + "/admin/community-posts/" + encodeURIComponent(postId), {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      if (editingPostId && String(editingPostId) === String(postId)) {
        resetComposer();
      }
      setPublishStatus(payload.message || "Post deleted.", "success");
      await loadCommunityPosts(true);
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "Could not delete the post.", "error");
    }
  }

  async function pinPost(postId, nextPinned) {
    var token = getToken();
    if (!token) return;
    try {
      var payload = await fetchJson(API_BASE + "/admin/community-posts/" + encodeURIComponent(postId), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ pinned: nextPinned === "true" })
      });
      setPublishStatus(payload.message || "Post updated.", "success");
      await loadCommunityPosts(true);
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "Could not update the post.", "error");
    }
  }

  function bindComposer() {
    var publishButton = document.getElementById("communityPublishButton");
    var cancelButton = document.getElementById("communityCancelEditButton");
    if (publishButton) publishButton.addEventListener("click", savePost);
    if (cancelButton) cancelButton.addEventListener("click", resetComposer);
    document.addEventListener("click", function (event) {
      var editButton = event.target.closest("[data-community-edit]");
      if (editButton) {
        loadPostIntoComposer(editButton.getAttribute("data-community-edit"));
        return;
      }
      var deleteButton = event.target.closest("[data-community-delete]");
      if (deleteButton) {
        deletePost(deleteButton.getAttribute("data-community-delete"));
        return;
      }
      var pinButton = event.target.closest("[data-community-pin]");
      if (pinButton) {
        pinPost(pinButton.getAttribute("data-community-pin"), pinButton.getAttribute("data-next-pinned"));
      }
    });
  }

  function startFeedHeartbeat() {
    if (pollTimer) return;
    pollTimer = window.setInterval(function () {
      loadCommunityPosts(false);
    }, 5000);
    window.addEventListener("focus", function () {
      loadCommunityPosts(false);
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) loadCommunityPosts(false);
    });
  }

  bindComposer();
  revealAdminComposerIfAllowed();
  loadCommunityPosts(true);
  startFeedHeartbeat();
})();
