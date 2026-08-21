(function () {
  var API_BASE = window.location.origin;
  var USER_KEY = "rblxtools_auth_user";
  var PROFILE_KEY = "rblxtools_profile_overview";
  var VALID_FILTERS = ["announcement", "changelog", "bug-fix", "known-issue"];
  var isAdminUser = false;
  var isLoggedIn = false;
  var editingPostId = "";
  var pollTimer = null;
  var lastFeedSignature = "";
  var currentViewer = null;
  var viewerMembershipSignature = "";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isApprovedAdminUser(user) {
    if (!user || typeof user !== "object") return false;
    return user.isAdmin === true ||
      user.admin === true ||
      user.is_admin === true ||
      String(user.role || "").trim().toLowerCase() === "admin";
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

  function formatTime(value) {
    if (!value) return "Recently";
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Recently";
    return parsed.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function getActiveFilter() {
    var params = new URLSearchParams(window.location.search);
    var raw = String(params.get("filter") || "").trim().toLowerCase();
    return VALID_FILTERS.indexOf(raw) >= 0 ? raw : "all";
  }

  function syncFilterUi(activeFilter) {
    document.querySelectorAll("[data-filter]").forEach(function (pill) {
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

  function readJsonStorage(key) {
    try {
      var raw = localStorage.getItem(key) || "";
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function readAuthUser() {
    var user = readJsonStorage(USER_KEY) || {};
    return {
      userId: String(user.userId || user.id || "").trim(),
      displayName: String(user.displayName || user.username || "").trim(),
      plan: String(user.plan || "free").trim().toLowerCase() || "free"
    };
  }

  function readSavedProfile(userId) {
    try {
      var scopedKey = PROFILE_KEY + ":" + String(userId || "").trim();
      var scopedRaw = localStorage.getItem(scopedKey) || "";
      if (scopedRaw) return JSON.parse(scopedRaw) || {};
      var fallbackRaw = localStorage.getItem(PROFILE_KEY) || "";
      return fallbackRaw ? JSON.parse(fallbackRaw) || {} : {};
    } catch (_error) {
      return {};
    }
  }

  function getInitials(name) {
    return String(name || "Member")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) { return part.charAt(0).toUpperCase(); })
      .join("") || "MB";
  }

  function buildCommentProfile(comment) {
    var currentIdentity = window.RBLXToolsProfile && typeof window.RBLXToolsProfile.getCurrentIdentity === "function"
      ? window.RBLXToolsProfile.getCurrentIdentity()
      : null;
    var commentUserId = String(comment.userId || "").trim();
    var currentUserId = String(
      (currentViewer && currentViewer.userId) ||
      (currentIdentity && currentIdentity.userId) ||
      ""
    ).trim();
    var useCurrentIdentity = Boolean(commentUserId && currentUserId && commentUserId === currentUserId);
    var displayName = String(
      (useCurrentIdentity && (currentIdentity.displayName || currentIdentity.username)) ||
      comment.authorName ||
      comment.displayName ||
      "Member"
    ).trim() || "Member";
    var plan = String(
      (useCurrentIdentity && currentViewer && currentViewer.plan) ||
      (useCurrentIdentity && currentIdentity && currentIdentity.plan) ||
      comment.plan ||
      ""
    ).trim().toLowerCase();
    var isPlus = plan === "plus" || String(comment.badge || "").trim().toLowerCase() === "plus";
    return {
      displayName: displayName,
      userId: commentUserId,
      avatarUrl: String((useCurrentIdentity && currentIdentity.avatarUrl) || comment.avatarUrl || "").trim(),
      avatarText: getInitials(displayName),
      bio: String((useCurrentIdentity && currentIdentity.bio) || comment.bio || "").trim(),
      plan: isPlus ? "plus" : "free",
      badge: isPlus ? "Plus" : "Free Plan"
    };
  }

  function getCurrentCommentProfile() {
    var authUser = readAuthUser();
    var shellIdentity = window.RBLXToolsProfile && typeof window.RBLXToolsProfile.getCurrentIdentity === "function"
      ? window.RBLXToolsProfile.getCurrentIdentity()
      : null;
    var savedProfile = authUser.userId ? readSavedProfile(authUser.userId) : {};
    var displayName = String(
      (shellIdentity && (shellIdentity.displayName || shellIdentity.username)) ||
      savedProfile.displayName ||
      authUser.displayName ||
      ""
    ).trim() || "Member";
    var plan = String(
      (currentViewer && currentViewer.plan) ||
      (shellIdentity && shellIdentity.plan) ||
      savedProfile.plan ||
      authUser.plan ||
      "free"
    ).trim().toLowerCase() || "free";
    var isPlus = plan === "plus";
    return {
      displayName: displayName,
      userId: String((currentViewer && currentViewer.userId) || (shellIdentity && shellIdentity.userId) || authUser.userId || "").trim(),
      avatarUrl: String((shellIdentity && shellIdentity.avatarUrl) || savedProfile.avatarUrl || "").trim(),
      bio: String((shellIdentity && shellIdentity.bio) || savedProfile.bio || "").trim(),
      plan: isPlus ? "plus" : "free",
      badge: isPlus ? "Plus" : "Free Plan"
    };
  }

  function buildCommunityProfileAttrs(profile) {
    return (
      ' data-community-profile="1"' +
      ' data-community-profile-name="' + escapeHtml(profile.displayName || "Member") + '"' +
      ' data-community-profile-user-id="' + escapeHtml(profile.userId || "") + '"' +
      ' data-community-profile-avatar="' + escapeHtml(profile.avatarUrl || "") + '"' +
      ' data-community-profile-bio="' + escapeHtml(profile.bio || "") + '"' +
      ' data-community-profile-plan="' + escapeHtml(profile.plan || "free") + '"'
    );
  }

  function buildCommunityCommentAuthor(profile) {
    var isPlus = String(profile.plan || "").toLowerCase() === "plus";
    var badgeMarkup = isPlus
      ? ""
      : '<span class="rblx-shell-chat-badge">' + escapeHtml(profile.badge || "Free Plan") + "</span>";
    var avatarMarkup = profile.avatarUrl
      ? '<img class="rblx-shell-chat-avatar-image" src="' + escapeHtml(profile.avatarUrl) + '" alt="" onerror="this.style.display=&quot;none&quot;;this.nextElementSibling.style.display=&quot;grid&quot;;" />' +
        '<span class="rblx-shell-chat-avatar-fallback" style="display:none;">' + escapeHtml(profile.avatarText || getInitials(profile.displayName)) + '</span>'
      : '<span class="rblx-shell-chat-avatar-fallback">' + escapeHtml(profile.avatarText || getInitials(profile.displayName)) + '</span>';
    var attrs = buildCommunityProfileAttrs(profile);
    var nameClass = isPlus ? ' class="rblx-shell-chat-name-text is-plus"' : ' class="rblx-shell-chat-name-text"';
    return (
      '<div class="community-comment-author">' +
        '<button class="rblx-shell-chat-avatar-button" type="button"' + attrs + ' aria-label="Open profile for ' + escapeHtml(profile.displayName || "Member") + '">' +
          '<span class="rblx-shell-chat-avatar' + (profile.avatarUrl ? ' has-image' : '') + '">' + avatarMarkup + '</span>' +
        '</button>' +
        '<div class="community-comment-author-copy">' +
          '<div class="rblx-shell-chat-name">' +
            '<button class="rblx-shell-chat-name-button" type="button"' + attrs + '>' +
              badgeMarkup +
              (isPlus ? '<span class="rblx-shell-chat-plus-mark">+</span>' : '') +
              '<span' + nameClass + '>' + escapeHtml(profile.displayName || "Member") + '</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function openCommunityProfileFromButton(button) {
    if (!button || !window.RBLXToolsProfile || typeof window.RBLXToolsProfile.open !== "function") return;
    window.RBLXToolsProfile.open({
      displayName: button.getAttribute("data-community-profile-name") || "Member",
      userId: button.getAttribute("data-community-profile-user-id") || "",
      avatarUrl: button.getAttribute("data-community-profile-avatar") || "",
      bio: button.getAttribute("data-community-profile-bio") || "",
      plan: button.getAttribute("data-community-profile-plan") || "free"
    }, button);
  }

  function buildAdminPostMenu(post) {
    if (!isAdminUser) return "";
    var pinLabel = post.pinned ? "Unpin Post" : "Pin Post";
    return (
      '<details class="community-post-menu">' +
        '<summary aria-label="Post settings"><span>&#8942;</span></summary>' +
        '<div class="community-post-menu-panel">' +
          '<button class="community-post-menu-item" type="button" data-community-edit="' + escapeHtml(post.id) + '">Edit Post</button>' +
          '<button class="community-post-menu-item" type="button" data-community-pin="' + escapeHtml(post.id) + '" data-next-pinned="' + (post.pinned ? "false" : "true") + '">' + pinLabel + "</button>" +
          '<button class="community-post-menu-item is-danger" type="button" data-community-delete="' + escapeHtml(post.id) + '">Delete Post</button>' +
        "</div>" +
      "</details>"
    );
  }

  function buildAdminCommentMenu(postId, comment) {
    if (!isAdminUser) return "";
    var isPinned = Boolean(comment && comment.pinned);
    return (
      '<details class="community-post-menu community-comment-menu">' +
        '<summary aria-label="Comment settings"><span>&#8942;</span></summary>' +
        '<div class="community-post-menu-panel">' +
          '<button class="community-post-menu-item" type="button" data-community-comment-pin-post="' + escapeHtml(postId) + '" data-community-comment-pin="' + escapeHtml(comment.id) + '" data-next-pinned="' + (isPinned ? "false" : "true") + '">' + (isPinned ? "Unpin Comment" : "Pin Comment") + '</button>' +
          '<button class="community-post-menu-item is-danger" type="button" data-community-comment-delete-post="' + escapeHtml(postId) + '" data-community-comment-delete="' + escapeHtml(comment.id) + '">Delete Comment</button>' +
        "</div>" +
      "</details>"
    );
  }

  function buildPostActions(post) {
    var likeLabel = post.viewerLiked ? "Liked" : "Like";
    return (
      '<div class="community-post-actions">' +
        '<button class="community-post-action' + (post.viewerLiked ? " is-active" : "") + '" type="button" data-community-like="' + escapeHtml(post.id) + '">' +
          '<span>&#10084;</span><span>' + escapeHtml(likeLabel) + " (" + Number(post.likeCount || 0) + ")</span>" +
        "</button>" +
        '<button class="community-post-action" type="button" data-community-focus-comment="' + escapeHtml(post.id) + '">' +
          '<span>&#128172;</span><span>Comment (' + Number(post.commentCount || 0) + ")</span>" +
        "</button>" +
        '<button class="community-post-action" type="button" data-community-share="' + escapeHtml(post.id) + '">' +
          '<span>&#10150;</span><span>Share</span>' +
        "</button>" +
      "</div>"
    );
  }

  function buildComments(post) {
    var comments = (Array.isArray(post.comments) ? post.comments : []).slice().sort(function (left, right) {
      return Number(Boolean(right.pinned)) - Number(Boolean(left.pinned));
    });
    var commentsMarkup = comments.length
      ? comments.map(function (comment) {
          var profile = buildCommentProfile(comment);
          return (
            '<article class="community-comment' + (comment.pinned ? ' is-pinned' : '') + '">' +
              '<div class="community-comment-top">' +
                buildCommunityCommentAuthor(profile) +
                '<span class="community-comment-date">' + (comment.pinned ? 'Pinned · ' : '') + escapeHtml(formatTime(comment.createdAt)) + '</span>' +
                buildAdminCommentMenu(post.id, comment) +
              '</div>' +
              '<p>' + escapeHtml(comment.body || '').replace(/\\n/g, '<br>') + '</p>' +
            '</article>'
          );
        }).join("")
      : '<div class="community-comment-empty">No comments yet.</div>';

    var composer = isLoggedIn
      ? (
        '<div class="community-comment-compose">' +
          '<textarea class="community-comment-input" id="communityCommentInput-' + escapeHtml(post.id) + '" placeholder="Write a comment..."></textarea>' +
          '<button class="community-comment-submit" type="button" data-community-submit-comment="' + escapeHtml(post.id) + '">Post Comment</button>' +
        "</div>"
      )
      : '<div class="community-comment-empty">Want to join the conversation? <button class="community-login-link" type="button" data-community-open-login="true">Log in or sign up</button> to like or comment.</div>';

    return (
      '<div class="community-comments">' +
        commentsMarkup +
        composer +
      "</div>"
    );
  }

  function renderPosts(feed, posts) {
    feed.innerHTML = posts.map(function (post) {
      var typeClasses = "community-type" + (post.pinned ? " is-pinned" : "");
      var action = "";
      if (post.linkUrl && post.linkLabel) {
        action =
          '<div class="community-post-link">' +
            '<a class="community-action" href="' + escapeHtml(post.linkUrl) + '">' +
              escapeHtml(post.linkLabel) +
            '</a>' +
          '</div>';
      }
      var authorBits = [];
      if (post.authorName) authorBits.push("Posted by " + escapeHtml(post.authorName));
      if (post.pinned) authorBits.push("Pinned");

      return (
        '<article class="community-post" id="post-' + escapeHtml(post.id) + '" data-community-post-id="' + escapeHtml(post.id) + '">' +
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
          buildPostActions(post) +
          action +
          buildComments(post) +
        "</article>"
      );
    }).join("");
  }

  async function fetchJson(url, options) {
    var config = options ? Object.assign({}, options) : {};
    var headers = Object.assign({}, config.headers || {});
    config.headers = headers;
    config.credentials = "include";
    var response = await fetch(url, config);
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

  async function syncViewerState() {
    var composer = document.getElementById("communityAdminComposer");
    if (composer) composer.hidden = true;
    isAdminUser = false;
    isLoggedIn = false;
    currentViewer = null;

    try {
      var payload = await fetchJson(API_BASE + "/auth/me", { method: "GET", cache: "no-store" });
      var user = payload && payload.user ? payload.user : null;
      if (!user) return;
      isLoggedIn = true;
      currentViewer = {
        userId: String(user.id || user.userId || "").trim(),
        plan: (user.premiumActive === true || user.plusActive === true || user.isPlus === true || String(user.plan || "").toLowerCase() === "plus") ? "plus" : "free"
      };
      var nextMembershipSignature = currentViewer.userId + "|" + currentViewer.plan;
      if (viewerMembershipSignature && viewerMembershipSignature !== nextMembershipSignature) {
        lastFeedSignature = "";
      }
      viewerMembershipSignature = nextMembershipSignature;
      if (isApprovedAdminUser(user)) {
        isAdminUser = true;
        if (composer) composer.hidden = false;
      }
    } catch (_error) {
    }
  }

  function resetComposer() {
    editingPostId = "";
    var title = document.getElementById("communityComposerTitle");
    var button = document.getElementById("communityPublishButton");
    if (title) title.textContent = "Create Community Post";
    if (button) button.textContent = "Publish Post";
    ["communityPostTitle", "communityPostBody", "communityPostLinkLabel", "communityPostLinkUrl"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.value = "";
    });
    var categoryNode = document.getElementById("communityPostCategory");
    if (categoryNode) categoryNode.value = "announcement";
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
      if (title) title.textContent = "Edit Community Post";
      if (button) button.textContent = "Save Post";
      document.getElementById("communityPostTitle").value = match.title || "";
      document.getElementById("communityPostBody").value = match.body || "";
      document.getElementById("communityPostCategory").value = match.category || "announcement";
      document.getElementById("communityPostLinkLabel").value = match.linkLabel || "";
      document.getElementById("communityPostLinkUrl").value = match.linkUrl || "";
      document.getElementById("communityAdminComposer").scrollIntoView({ behavior: "smooth", block: "start" });
      setPublishStatus("Editing selected post.", "success");
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "Could not load that post.", "error");
    }
  }

  async function savePost() {
    if (!isAdminUser) {
      setPublishStatus("Only admins can publish here.", "error");
      return;
    }

    var titleNode = document.getElementById("communityPostTitle");
    var bodyNode = document.getElementById("communityPostBody");
    var categoryNode = document.getElementById("communityPostCategory");
    var linkLabelNode = document.getElementById("communityPostLinkLabel");
    var linkUrlNode = document.getElementById("communityPostLinkUrl");
    var button = document.getElementById("communityPublishButton");

    var title = titleNode ? String(titleNode.value || "").trim() : "";
    var body = bodyNode ? String(bodyNode.value || "").trim() : "";
    if (!title) return setPublishStatus("Give the post a title first.", "error");
    if (!body) return setPublishStatus("Write the post body first.", "error");

    if (button) button.disabled = true;
    setPublishStatus(editingPostId ? "Saving post..." : "Publishing post...");

    try {
      var payload = await fetchJson(
        editingPostId
          ? (API_BASE + "/admin/community-posts/" + encodeURIComponent(editingPostId))
          : (API_BASE + "/admin/community-posts"),
        {
          method: editingPostId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title,
            body: body,
            category: categoryNode ? categoryNode.value : "announcement",
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
    if (!window.confirm("Delete this post?")) return;
    try {
      var payload = await fetchJson(API_BASE + "/admin/community-posts/" + encodeURIComponent(postId), {
        method: "DELETE"
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
    try {
      var payload = await fetchJson(API_BASE + "/admin/community-posts/" + encodeURIComponent(postId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: nextPinned === "true" })
      });
      setPublishStatus(payload.message || "Post updated.", "success");
      await loadCommunityPosts(true);
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "Could not update the post.", "error");
    }
  }

  function openLoginPrompt(message) {
    if (window.RBLXToolsAuth && typeof window.RBLXToolsAuth.open === "function") {
      window.RBLXToolsAuth.open({ mode: "login", message: message || "Log in or sign up to continue." });
      return;
    }
    window.dispatchEvent(new CustomEvent("rblxtools-open-auth", { detail: { mode: "login", message: message || "Log in or sign up to continue." } }));
  }

  function createHeartBurst(button) {
    if (!button) return;
    var rect = button.getBoundingClientRect();
    var heart = document.createElement("span");
    heart.className = "community-heart-burst";
    heart.setAttribute("aria-hidden", "true");
    heart.innerHTML = "&#10084;";
    heart.style.left = (rect.left + rect.width / 2) + "px";
    heart.style.top = (rect.top + rect.height / 2) + "px";
    document.body.appendChild(heart);
    button.classList.add("is-hearting");
    window.setTimeout(function () { button.classList.remove("is-hearting"); }, 520);
    window.setTimeout(function () { heart.remove(); }, 900);
  }

  async function toggleLike(postId, button) {
    if (!isLoggedIn) {
      openLoginPrompt("Log in or sign up to like community posts.");
      return;
    }
    var isNewLike = !button || !button.classList.contains("is-active");
    try {
      await fetchJson(API_BASE + "/api/community-posts/" + encodeURIComponent(postId) + "/likes", {
        method: "POST"
      });
      if (isNewLike) createHeartBurst(button);
      await loadCommunityPosts(true);
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "Could not update the like.", "error");
    }
  }

  async function submitComment(postId) {
    if (!isLoggedIn) {
      setPublishStatus("Log in first so you can comment.", "error");
      return;
    }
    var input = document.getElementById("communityCommentInput-" + postId);
    var body = input ? String(input.value || "").trim() : "";
    if (!body) {
      setPublishStatus("Write a comment first.", "error");
      return;
    }
    var profile = getCurrentCommentProfile();
    try {
      await fetchJson(API_BASE + "/api/community-posts/" + encodeURIComponent(postId) + "/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          bio: profile.bio,
          plan: profile.plan
        })
      });
      if (input) input.value = "";
      await loadCommunityPosts(true);
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "Could not post the comment.", "error");
    }
  }

  async function updateComment(postId, commentId, body) {
    try {
      await fetchJson(API_BASE + "/admin/community-posts/" + encodeURIComponent(postId) + "/comments/" + encodeURIComponent(commentId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      await loadCommunityPosts(true);
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "Could not update the comment.", "error");
    }
  }

  async function deleteComment(postId, commentId) {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await fetchJson(API_BASE + "/admin/community-posts/" + encodeURIComponent(postId) + "/comments/" + encodeURIComponent(commentId), { method: "DELETE" });
      await loadCommunityPosts(true);
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "Could not delete the comment.", "error");
    }
  }

  async function sharePost(postId) {
    var url = window.location.origin + "/community#post-" + encodeURIComponent(postId);
    try {
      if (navigator.share) {
        await navigator.share({ title: "RBLXTools Community", url: url });
        return;
      }
    } catch (_error) {
    }
    try {
      await navigator.clipboard.writeText(url);
      setPublishStatus("Post link copied.", "success");
    } catch (_error) {
      setPublishStatus("Could not copy the post link.", "error");
    }
  }

  function bindComposer() {
    var publishButton = document.getElementById("communityPublishButton");
    if (publishButton) publishButton.addEventListener("click", savePost);
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var profileButton = target.closest("[data-community-profile]");
      if (profileButton) return void openCommunityProfileFromButton(profileButton);

      var editButton = target.closest("[data-community-edit]");
      if (editButton) return void loadPostIntoComposer(editButton.getAttribute("data-community-edit"));

      var deleteButton = target.closest("[data-community-delete]");
      if (deleteButton) return void deletePost(deleteButton.getAttribute("data-community-delete"));

      var pinButton = target.closest("[data-community-pin]");
      if (pinButton) return void pinPost(pinButton.getAttribute("data-community-pin"), pinButton.getAttribute("data-next-pinned"));

      var guestLogin = target.closest("[data-community-open-login]");
      if (guestLogin) return void openLoginPrompt("Log in or sign up to join the conversation.");

      var categoryOption = target.closest("[data-community-category]");
      if (categoryOption) {
        var category = categoryOption.getAttribute("data-community-category") || "announcement";
        var categoryInput = document.getElementById("communityPostCategory");
        var categoryLabel = document.getElementById("communityCategorySelectLabel");
        var categoryDetails = document.getElementById("communityCategorySelect");
        if (categoryInput) categoryInput.value = category;
        if (categoryLabel) categoryLabel.textContent = formatPostType(category);
        document.querySelectorAll("[data-community-category]").forEach(function (node) {
          node.classList.toggle("is-selected", node === categoryOption);
        });
        if (categoryDetails) categoryDetails.open = false;
        return;
      }

      var commentDeleteButton = target.closest("[data-community-comment-delete]");
      if (commentDeleteButton) return void deleteComment(commentDeleteButton.getAttribute("data-community-comment-delete-post"), commentDeleteButton.getAttribute("data-community-comment-delete"));

      var commentPinButton = target.closest("[data-community-comment-pin]");
      if (commentPinButton) return void updateComment(commentPinButton.getAttribute("data-community-comment-pin-post"), commentPinButton.getAttribute("data-community-comment-pin"), { pinned: commentPinButton.getAttribute("data-next-pinned") === "true" });

      var likeButton = target.closest("[data-community-like]");
      if (likeButton) return void toggleLike(likeButton.getAttribute("data-community-like"), likeButton);

      var shareButton = target.closest("[data-community-share]");
      if (shareButton) return void sharePost(shareButton.getAttribute("data-community-share"));

      var commentButton = target.closest("[data-community-submit-comment]");
      if (commentButton) return void submitComment(commentButton.getAttribute("data-community-submit-comment"));

      var focusComment = target.closest("[data-community-focus-comment]");
      if (focusComment) {
        if (!isLoggedIn) return void openLoginPrompt("Log in or sign up to comment on community posts.");
        var input = document.getElementById("communityCommentInput-" + focusComment.getAttribute("data-community-focus-comment"));
        if (input) input.focus();
      }
    });

    var categoryDetails = document.getElementById("communityCategorySelect");
    if (categoryDetails) {
      categoryDetails.addEventListener("toggle", function () {
        var field = categoryDetails.closest(".community-field");
        if (field) field.classList.toggle("is-category-open", categoryDetails.open);
      });
    }
  }

  function startFeedHeartbeat() {
    if (pollTimer) return;
    pollTimer = window.setInterval(function () {
      syncViewerState().then(function () { return loadCommunityPosts(false); });
    }, 5000);
    window.addEventListener("focus", function () {
      loadCommunityPosts(false);
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) loadCommunityPosts(false);
    });
  }

  async function init() {
    bindComposer();
    await syncViewerState();
    await loadCommunityPosts(true);
    startFeedHeartbeat();
  }

  init();
})();
