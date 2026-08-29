(function () {
  var API_BASE = window.location.origin;
  var USER_KEY = "rblxtools_auth_user";
  var PROFILE_KEY = "rblxtools_profile_overview";
  var VALID_FILTERS = ["announcement", "changelog", "bug-report", "feedback", "known-issue"];
  var isAdminUser = false;
  var isLoggedIn = false;
  var editingPostId = "";
  var pollTimer = null;
  var lastFeedSignature = "";
  var cachedPosts = [];
  var currentViewer = null;
  var viewerMembershipSignature = "";
  var publishStatusTimer = null;
  var composerOpen = true;
  var composerAttachment = null;

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
      "bug-report": "Bug Reports",
      feedback: "Feedback",
      "known-issue": "Known Issues"
    };
    return map[filter] || "All";
  }

  function formatPostType(type) {
    var map = {
      announcement: "Announcement",
      changelog: "Changelog",
      "bug-report": "Bug Report",
      feedback: "Feedback",
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
    if (publishStatusTimer) {
      window.clearTimeout(publishStatusTimer);
      publishStatusTimer = null;
    }
    node.hidden = !message;
    node.textContent = message || "";
    node.className = "community-status" + (tone ? " is-" + tone : "");
    if (!message) return;

    // Restart the animation for back-to-back actions, then remove the toast.
    void node.offsetWidth;
    node.classList.add("is-visible");
    publishStatusTimer = window.setTimeout(function () {
      node.hidden = true;
      node.classList.remove("is-visible");
      publishStatusTimer = null;
    }, tone === "error" ? 4600 : 3300);
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

  function filterPosts(posts, activeFilter) {
    if (activeFilter === "all") {
      return posts.filter(function (post) {
        const category = String(post.category || "");
        return category === "announcement" || category === "changelog" || category === "known-issue";
      });
    }
    return posts.filter(function (post) {
      if (activeFilter === "known-issue") return String(post.category || "") === "known-issue" || Boolean(post.knownIssue);
      return String(post.category || "") === activeFilter;
    });
  }

  function renderCachedPosts(forceRender) {
    var feed = document.getElementById("communityFeed");
    if (!feed) return false;
    var activeFilter = getActiveFilter();
    var posts = filterPosts(cachedPosts, activeFilter);
    var signature = activeFilter + "|" + getFeedSignature(posts);
    if (!forceRender && signature === lastFeedSignature) return true;
    lastFeedSignature = signature;
    if (!posts.length) renderEmpty(feed, activeFilter);
    else renderPosts(feed, posts);
    return true;
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

  function buildBugStatus(post) {
    if (String(post.category || "") !== "bug-report") return "";
    var resolved = String(post.bugStatus || "").toLowerCase() === "resolved";
    var label = resolved ? "Resolved" : "Unresolved";
    if (post.knownIssue) label = resolved ? "Known issue · resolved" : "Known issue";
    return '<span class="community-bug-status ' + (resolved ? 'is-resolved' : 'is-unresolved') + '">' + escapeHtml(label) + "</span>";
  }

  function buildFeedbackRating(post) {
    if (String(post && post.category || "") !== "feedback") return "";
    var rating = Math.max(1, Math.min(5, Number(post.rating || 0) || 1));
    var stars = "";
    for (var index = 1; index <= 5; index += 1) stars += index <= rating ? "&#9733;" : "&#9734;";
    return '<span class="community-feedback-rating" aria-label="' + rating + ' out of 5 stars">' + stars + '<span>' + rating + '/5</span></span>';
  }

  function isMemberBugReport(post) {
    return String(post && post.category || "") === "bug-report" && !post.authorIsAdmin;
  }

  function isMemberContribution(post) {
    var category = String(post && post.category || "");
    return (category === "bug-report" || category === "feedback") && !post.authorIsAdmin;
  }

  function buildAdminPostMenu(post) {
    var viewerId = String(currentViewer && currentViewer.userId || "").trim();
    var ownsPost = Boolean(!isAdminUser && viewerId && String(post && post.authorId || "").trim() === viewerId);
    if (!isAdminUser && !ownsPost) return "";
    var pinLabel = post.pinned ? "Unpin Post" : "Pin Post";
    var resolved = String(post.bugStatus || "").toLowerCase() === "resolved";
    var ownerMenu =
      '<button class="community-post-menu-item" type="button" data-community-edit="' + escapeHtml(post.id) + '">Edit Post</button>' +
      '<button class="community-post-menu-item is-danger" type="button" data-community-delete="' + escapeHtml(post.id) + '">Delete Post</button>';
    if (!isAdminUser) {
      return (
        '<div class="community-post-menu">' +
          '<button class="community-menu-toggle" type="button" aria-label="Post settings" data-community-menu-toggle="true"><span>&#8942;</span></button>' +
          '<div class="community-post-menu-panel">' + ownerMenu + '</div>' +
        '</div>'
      );
    }
    return (
      '<div class="community-post-menu">' +
        '<button class="community-menu-toggle" type="button" aria-label="Post settings" data-community-menu-toggle="true"><span>&#8942;</span></button>' +
        '<div class="community-post-menu-panel">' +
          '<button class="community-post-menu-item" type="button" data-community-edit="' + escapeHtml(post.id) + '">Edit Post</button>' +
          '<button class="community-post-menu-item" type="button" data-community-pin="' + escapeHtml(post.id) + '" data-next-pinned="' + (post.pinned ? "false" : "true") + '">' + pinLabel + "</button>" +
          (String(post.category || "") === "bug-report" ? '<button class="community-post-menu-item" type="button" data-community-bug-status="' + escapeHtml(post.id) + '" data-next-bug-status="' + (resolved ? "unresolved" : "resolved") + '">' + (resolved ? "Mark as unresolved" : "Mark as resolved") + '</button><button class="community-post-menu-item" type="button" data-community-known-issue="' + escapeHtml(post.id) + '" data-next-known-issue="' + (post.knownIssue ? "false" : "true") + '">' + (post.knownIssue ? "Remove from Known Issues" : "Mark as known issue") + '</button>' : "") +
          '<button class="community-post-menu-item is-danger" type="button" data-community-delete="' + escapeHtml(post.id) + '">Delete Post</button>' +
        "</div>" +
      "</div>"
    );
  }

  function buildAdminCommentMenu(postId, comment) {
    var viewerId = String(currentViewer && currentViewer.userId || "").trim();
    var ownsComment = Boolean(!isAdminUser && viewerId && String(comment && comment.userId || "").trim() === viewerId);
    if (!isAdminUser && !ownsComment) return "";
    var isPinned = Boolean(comment && comment.pinned);
    var actions = isAdminUser
      ? '<button class="community-post-menu-item" type="button" data-community-comment-pin-post="' + escapeHtml(postId) + '" data-community-comment-pin="' + escapeHtml(comment.id) + '" data-next-pinned="' + (isPinned ? "false" : "true") + '">' + (isPinned ? "Unpin Comment" : "Pin Comment") + '</button>' +
        '<button class="community-post-menu-item is-danger" type="button" data-community-comment-delete-post="' + escapeHtml(postId) + '" data-community-comment-delete="' + escapeHtml(comment.id) + '">Delete Comment</button>'
      : '<button class="community-post-menu-item" type="button" data-community-comment-edit-post="' + escapeHtml(postId) + '" data-community-comment-edit="' + escapeHtml(comment.id) + '" data-community-comment-body="' + escapeHtml(comment.body || "") + '">Edit Comment</button>' +
        '<button class="community-post-menu-item is-danger" type="button" data-community-comment-delete-post="' + escapeHtml(postId) + '" data-community-comment-delete="' + escapeHtml(comment.id) + '">Delete Comment</button>';
    return (
      '<div class="community-post-menu community-comment-menu">' +
        '<button class="community-menu-toggle" type="button" aria-label="Comment settings" data-community-menu-toggle="true"><span>&#8942;</span></button>' +
        '<div class="community-post-menu-panel">' + actions + '</div>' +
      "</div>"
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
              '<div class="community-comment-actions"><button type="button" data-community-comment-like-post="' + escapeHtml(post.id) + '" data-community-comment-like="' + escapeHtml(comment.id) + '" class="community-comment-action community-comment-like' + (comment.viewerLiked ? ' is-active' : '') + '"><span>&#10084;</span><span>' + (comment.viewerLiked ? 'Liked' : 'Like') + ' (' + Number(comment.likeCount || 0) + ')</span></button><button type="button" class="community-comment-action" data-community-comment-reply-post="' + escapeHtml(post.id) + '" data-community-comment-reply="' + escapeHtml(comment.id) + '"><span>&#8618;</span><span>Reply</span></button></div>' +
              (Array.isArray(comment.replies) && comment.replies.length ? '<div class="community-comment-replies">' + comment.replies.map(function (reply) { var replyProfile = buildCommentProfile(reply); return '<article class="community-comment-reply">' + buildCommunityCommentAuthor(replyProfile) + '<p>' + escapeHtml(reply.body || '').replace(/\\n/g, '<br>') + '</p></article>'; }).join('') + '</div>' : '') +
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
      var attachment = post.attachment && post.attachment.dataUrl ? post.attachment : null;
      var attachmentMarkup = "";
      if (attachment) {
        if (/^image\//i.test(attachment.type || "")) {
          attachmentMarkup = '<div class="community-post-attachment"><img src="' + escapeHtml(attachment.dataUrl) + '" alt="Attachment: ' + escapeHtml(attachment.name || "image") + '"></div>';
        } else {
          attachmentMarkup = '<div class="community-post-attachment"><a href="' + escapeHtml(attachment.dataUrl) + '" download="' + escapeHtml(attachment.name || "attachment") + '">Download attachment: ' + escapeHtml(attachment.name || "file") + '</a></div>';
        }
      }

      return (
        '<article class="community-post" id="post-' + escapeHtml(post.id) + '" data-community-post-id="' + escapeHtml(post.id) + '">' +
          '<div class="community-post-head">' +
            '<div class="community-post-head-main">' +
              '<span class="' + typeClasses + '">' + escapeHtml(formatPostType(post.category)) + "</span>" +
              buildBugStatus(post) + buildFeedbackRating(post) +
              '<span class="community-date">' + escapeHtml(formatDate(post.publishedAt || post.createdAt)) + "</span>" +
            "</div>" +
            buildAdminPostMenu(post) +
          "</div>" +
          "<h2>" + escapeHtml(post.title || "Untitled update") + "</h2>" +
          "<p>" + escapeHtml(post.body || "").replace(/\n/g, "<br>") + "</p>" +
          attachmentMarkup +
          '<div class="community-meta">' + authorBits.map(function (bit) {
            return "<span>" + bit + "</span>";
          }).join("") + "</div>" +
          buildPostActions(post) +
          action +
          buildComments(post) +
        "</article>"
      );
    }).join("");
    focusRequestedCommunityPost();
  }

  function focusRequestedCommunityPost() {
    var postId = String(window.location.hash || "").replace(/^#post-/, "").trim();
    if (!postId) return;
    window.setTimeout(function () {
      var post = document.getElementById("post-" + postId);
      if (!post) return;
      post.classList.add("community-post-notification-target");
      post.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(function () { post.classList.remove("community-post-notification-target"); }, 2200);
    }, 0);
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
    updateComposerMode();

    try {
      var payload = await fetchJson(API_BASE + "/api/community-posts", { cache: "no-store" });
      cachedPosts = Array.isArray(payload.posts) ? payload.posts : [];
      renderCachedPosts(forceRender);
    } catch (error) {
      feed.innerHTML =
        '<article class="community-empty">' +
          "<h2>Community could not load right now.</h2>" +
          "<p>" + escapeHtml(error && error.message ? error.message : "Please try again in a moment.") + "</p>" +
        "</article>";
    }
  }

  // rblx-silent-community-viewer
  function toViewer(user) {
    if (!user || typeof user !== "object") return null;
    var userId = String(user.id || user.userId || "").trim();
    if (!userId) return null;
    return {
      userId: userId,
      plan: (user.premiumActive === true || user.plusActive === true || user.isPlus === true || String(user.plan || "").toLowerCase() === "plus") ? "plus" : "free",
      isAdmin: isApprovedAdminUser(user)
    };
  }

  function updateComposerMode() {
    var composer = document.getElementById("communityAdminComposer");
    var title = document.getElementById("communityComposerTitle");
    var helper = composer && composer.querySelector(".community-helper-copy");
    var category = document.getElementById("communityPostCategory");
    var categoryLabel = document.getElementById("communityCategorySelectLabel");
    var button = document.getElementById("communityPublishButton");
    var ratingField = document.getElementById("communityFeedbackRatingField");
    if (!composer) return;
    var activeFilter = getActiveFilter();
    var memberCategory = activeFilter === "feedback" ? "feedback" : "bug-report";
    var memberCanPost = isLoggedIn && !isAdminUser && (activeFilter === "bug-report" || activeFilter === "feedback");
    composer.hidden = !(isAdminUser || memberCanPost);
    composer.classList.toggle("is-member-report", memberCanPost);
    composer.classList.toggle("is-member-feedback", memberCanPost && memberCategory === "feedback");
    if (ratingField) ratingField.hidden = !(memberCanPost && memberCategory === "feedback");
    if (!isLoggedIn) return;
    if (isAdminUser) {
      if (title && !editingPostId) title.textContent = "Create Community Post";
      if (helper) helper.textContent = "Publish official updates for the community feed here.";
      if (button && !editingPostId) button.textContent = "Publish Post";
      return;
    }
    if (editingPostId) {
      if (title) title.textContent = memberCategory === "feedback" ? "Edit Website Feedback" : "Edit Bug Report";
      if (helper) helper.textContent = "Update your submission, then save your changes.";
      if (button) button.textContent = "Save Changes";
      return;
    }
    if (memberCategory === "feedback") {
      if (title) title.textContent = "Leave Website Feedback";
      if (helper) helper.textContent = "Tell the RBLXTools team what you think and rate your experience from 1 to 5 stars.";
      if (category) category.value = "feedback";
      if (categoryLabel) categoryLabel.textContent = "Feedback";
      if (button) button.textContent = "Submit Feedback";
    } else {
      if (title) title.textContent = "Create Bug Report";
      if (helper) helper.textContent = "Tell the RBLXTools team what happened. Your report will start as unresolved until it is verified.";
      if (category) category.value = "bug-report";
      if (categoryLabel) categoryLabel.textContent = "Bug Reports";
      if (button) button.textContent = "Submit Bug Report";
    }
  }

  function updateRatingPicker(value, previewValue) {
    var selected = Math.max(0, Math.min(5, Number(value) || 0));
    var preview = Math.max(0, Math.min(5, Number(previewValue) || selected));
    document.querySelectorAll("[data-community-rating]").forEach(function (star) {
      var score = Number(star.getAttribute("data-community-rating")) || 0;
      star.classList.toggle("is-selected", score <= selected);
      star.classList.toggle("is-preview", score <= preview);
      star.setAttribute("aria-checked", String(score === selected));
    });
  }

  function bindFilters() {
    document.querySelectorAll("[data-filter]").forEach(function (pill) {
      pill.addEventListener("click", function (event) {
        event.preventDefault();
        var nextFilter = pill.getAttribute("data-filter") || "all";
        var url = new URL(window.location.href);
        if (nextFilter === "all") url.searchParams.delete("filter");
        else url.searchParams.set("filter", nextFilter);
        window.history.pushState({}, "", url.pathname + (url.search || ""));
        syncFilterUi(nextFilter);
        updateComposerMode();
        renderCachedPosts(true);
        loadCommunityPosts(false);
      });
    });
    window.addEventListener("popstate", function () {
      syncFilterUi(getActiveFilter());
      updateComposerMode();
      renderCachedPosts(true);
      loadCommunityPosts(false);
    });
  }

  function applyViewerState(user) {
    var viewer = toViewer(user);
    if (!viewer) {
      var wasLoggedIn = isLoggedIn;
      isLoggedIn = false;
      isAdminUser = false;
      currentViewer = null;
      viewerMembershipSignature = "guest";
      updateComposerMode();
      if (wasLoggedIn) lastFeedSignature = "";
      return;
    }
    var signature = viewer.userId + "|" + viewer.plan + "|" + viewer.isAdmin;
    var changed = signature !== viewerMembershipSignature;
    isLoggedIn = true;
    isAdminUser = viewer.isAdmin;
    currentViewer = { userId: viewer.userId, plan: viewer.plan };
    viewerMembershipSignature = signature;
    updateComposerMode();
    if (changed) lastFeedSignature = "";
  }

  function setComposerOpen(open) {
    composerOpen = Boolean(open);
    updateComposerMode();
    if (composerOpen) {
      window.setTimeout(function () {
        var title = document.getElementById("communityPostTitle");
        if (title) title.focus();
      }, 0);
    }
  }

  function updateAttachmentFromInput() {
    var input = document.getElementById("communityPostAttachment");
    var label = document.getElementById("communityAttachmentName");
    var file = input && input.files ? input.files[0] : null;
    composerAttachment = null;
    if (!file) {
      if (label) label.textContent = "Up to 2 MB.";
      return;
    }
    var allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain"];
    if (allowedTypes.indexOf(file.type) === -1 || file.size > 2 * 1024 * 1024) {
      if (input) input.value = "";
      if (label) label.textContent = "Choose an image, PDF, or text file smaller than 2 MB.";
      return;
    }
    if (label) label.textContent = file.name + " ready to attach";
    var reader = new FileReader();
    reader.onload = function () {
      composerAttachment = { name: file.name, type: file.type, dataUrl: String(reader.result || "") };
    };
    reader.readAsDataURL(file);
  }

  function primeViewerState() {
    var cached = readJsonStorage(USER_KEY);
    if (cached && (cached.id || cached.userId)) applyViewerState(cached);
  }

  async function syncViewerState() {
    // Never clear the existing page while a background auth request is in flight.
    // The cached identity paints immediately; only a real server response changes it.
    try {
      var payload = await fetchJson(API_BASE + "/auth/me", { method: "GET", cache: "no-store" });
      applyViewerState(payload && payload.user ? payload.user : null);
    } catch (_error) {
      // Keep the last known state during a transient network failure.
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
    var attachmentInput = document.getElementById("communityPostAttachment");
    if (attachmentInput) attachmentInput.value = "";
    composerAttachment = null;
    var attachmentName = document.getElementById("communityAttachmentName");
    if (attachmentName) attachmentName.textContent = "Up to 2 MB.";
    var categoryNode = document.getElementById("communityPostCategory");
    if (categoryNode) categoryNode.value = isAdminUser ? "announcement" : (getActiveFilter() === "feedback" ? "feedback" : "bug-report");
    var ratingNode = document.getElementById("communityFeedbackRating");
    if (ratingNode) ratingNode.value = "0";
    updateRatingPicker(0);
    updateComposerMode();
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
      setComposerOpen(true);
      setPublishStatus("Editing selected post.", "success");
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "Could not load that post.", "error");
    }
  }

  async function savePost() {
    if (!isLoggedIn) {
      openLoginPrompt("Log in or sign up to publish a community post.");
      return;
    }

    var titleNode = document.getElementById("communityPostTitle");
    var bodyNode = document.getElementById("communityPostBody");
    var categoryNode = document.getElementById("communityPostCategory");
    var linkLabelNode = document.getElementById("communityPostLinkLabel");
    var linkUrlNode = document.getElementById("communityPostLinkUrl");
    var ratingNode = document.getElementById("communityFeedbackRating");
    var button = document.getElementById("communityPublishButton");

    var title = titleNode ? String(titleNode.value || "").trim() : "";
    var body = bodyNode ? String(bodyNode.value || "").trim() : "";
    if (!title) return setPublishStatus("Give the post a title first.", "error");
    if (!body) return setPublishStatus("Write the post body first.", "error");

    var memberCategory = getActiveFilter();
    if (!isAdminUser && memberCategory !== "bug-report" && memberCategory !== "feedback") {
      return setPublishStatus("Choose Bug Reports or Feedback before submitting a community post.", "error");
    }
    if (!isAdminUser && memberCategory === "feedback" && (!ratingNode || Number(ratingNode.value) < 1 || Number(ratingNode.value) > 5)) {
      return setPublishStatus("Choose a rating from 1 to 5 stars.", "error");
    }
    if (button) button.disabled = true;
    setPublishStatus(editingPostId ? "Saving post..." : "Publishing post...");

    try {
      var payload = await fetchJson(
        editingPostId
          ? (API_BASE + (isAdminUser ? "/admin/community-posts/" : "/api/community-posts/") + encodeURIComponent(editingPostId))
          : (isAdminUser ? (API_BASE + "/admin/community-posts") : (API_BASE + "/api/community-posts/member-posts")),
        {
          method: editingPostId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title,
            body: body,
            category: isAdminUser && categoryNode ? categoryNode.value : memberCategory,
            rating: !isAdminUser && memberCategory === "feedback" && ratingNode ? Number(ratingNode.value) : 0,
            linkLabel: isAdminUser && linkLabelNode ? String(linkLabelNode.value || "").trim() : "",
            linkUrl: isAdminUser && linkUrlNode ? String(linkUrlNode.value || "").trim() : "",
            attachment: composerAttachment,
            avatarUrl: getCurrentCommentProfile().avatarUrl,
            bio: getCurrentCommentProfile().bio,
            plan: getCurrentCommentProfile().plan
          })
        }
      );
      var successMessage = payload.message || (editingPostId ? "Post saved." : "Post published.");
      resetComposer();
      setComposerOpen(false);
      await loadCommunityPosts(true);
      setPublishStatus(successMessage, "success");
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "Could not save the post.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function deletePost(postId) {
    if (!window.confirm("Delete this post?")) return;
    try {
      var payload = await fetchJson(API_BASE + (isAdminUser ? "/admin/community-posts/" : "/api/community-posts/") + encodeURIComponent(postId), {
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

  async function toggleCommentLike(postId, commentId, button) {
    if (!isLoggedIn) return void openLoginPrompt("Log in or sign up to like comments.");
    var isNewLike = !button || !button.classList.contains("is-active");
    try {
      await fetchJson(API_BASE + "/api/community-posts/" + encodeURIComponent(postId) + "/comments/" + encodeURIComponent(commentId) + "/likes", { method: "POST" });
      if (isNewLike) createHeartBurst(button);
      await loadCommunityPosts(true);
    } catch (error) { setPublishStatus(error && error.message ? error.message : "Could not update the comment like.", "error"); }
  }

  async function replyToComment(postId, commentId) {
    if (!isLoggedIn) return void openLoginPrompt("Log in or sign up to reply to comments.");
    var body = window.prompt("Write a reply:"); if (!body || !String(body).trim()) return;
    var profile = getCurrentCommentProfile();
    try { await fetchJson(API_BASE + "/api/community-posts/" + encodeURIComponent(postId) + "/comments/" + encodeURIComponent(commentId) + "/replies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: body, displayName: profile.displayName, avatarUrl: profile.avatarUrl, bio: profile.bio, plan: profile.plan }) }); await loadCommunityPosts(true); }
    catch (error) { setPublishStatus(error && error.message ? error.message : "Could not post the reply.", "error"); }
  }

  async function updateComment(postId, commentId, body) {
    try {
      await fetchJson(API_BASE + (isAdminUser ? "/admin/community-posts/" : "/api/community-posts/") + encodeURIComponent(postId) + "/comments/" + encodeURIComponent(commentId), {
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
      await fetchJson(API_BASE + (isAdminUser ? "/admin/community-posts/" : "/api/community-posts/") + encodeURIComponent(postId) + "/comments/" + encodeURIComponent(commentId), { method: "DELETE" });
      await loadCommunityPosts(true);
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "Could not delete the comment.", "error");
    }
  }

  async function editComment(postId, commentId, currentBody) {
    var body = window.prompt("Edit your comment:", currentBody || "");
    if (body === null) return;
    body = String(body).trim();
    if (!body) return void setPublishStatus("A comment cannot be empty.", "error");
    await updateComment(postId, commentId, { body: body });
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

  async function updateBugReport(postId, patch, successMessage) {
    try {
      var payload = await fetchJson(API_BASE + "/admin/community-posts/" + encodeURIComponent(postId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      setPublishStatus(payload.message || successMessage || "Bug report updated.", "success");
      await loadCommunityPosts(true);
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "Could not update the bug report.", "error");
    }
  }

  function bindComposer() {
    var composer = document.getElementById("communityAdminComposer");
    var publishButton = document.getElementById("communityPublishButton");
    if (publishButton) publishButton.addEventListener("click", savePost);
    var openButton = document.getElementById("communityOpenComposer");
    if (openButton) openButton.addEventListener("click", function () {
      if (!isLoggedIn) return void openLoginPrompt("Log in or sign up to create a community post.");
      if (!isAdminUser && getActiveFilter() !== "bug-report" && getActiveFilter() !== "feedback") {
        var url = new URL(window.location.href);
        url.searchParams.set("filter", "bug-report");
        window.history.pushState({}, "", url.pathname + url.search);
        syncFilterUi("bug-report");
      }
      setComposerOpen(true);
    });
    var closeButton = document.getElementById("communityCloseComposer");
    if (closeButton) closeButton.addEventListener("click", function () { setComposerOpen(false); });
    var attachmentInput = document.getElementById("communityPostAttachment");
    if (attachmentInput) attachmentInput.addEventListener("change", updateAttachmentFromInput);
    document.querySelectorAll("[data-community-rating]").forEach(function (star) {
      star.addEventListener("mouseenter", function () {
        var ratingNode = document.getElementById("communityFeedbackRating");
        updateRatingPicker(ratingNode ? ratingNode.value : 0, star.getAttribute("data-community-rating"));
      });
      star.addEventListener("focus", function () {
        var ratingNode = document.getElementById("communityFeedbackRating");
        updateRatingPicker(ratingNode ? ratingNode.value : 0, star.getAttribute("data-community-rating"));
      });
      star.addEventListener("click", function () {
        var ratingNode = document.getElementById("communityFeedbackRating");
        if (ratingNode) ratingNode.value = star.getAttribute("data-community-rating") || "0";
        updateRatingPicker(ratingNode ? ratingNode.value : 0);
      });
    });
    var ratingPicker = document.querySelector(".community-rating-picker");
    if (ratingPicker) ratingPicker.addEventListener("mouseleave", function () {
      var ratingNode = document.getElementById("communityFeedbackRating");
      updateRatingPicker(ratingNode ? ratingNode.value : 0);
    });
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var menuToggle = target.closest("[data-community-menu-toggle]");
      if (menuToggle) {
        event.stopPropagation();
        var menu = menuToggle.closest(".community-post-menu");
        document.querySelectorAll(".community-post-menu.is-open").forEach(function (node) { if (node !== menu) node.classList.remove("is-open"); });
        menu.classList.toggle("is-open");
        return;
      }

      var categoryToggle = target.closest("[data-community-category-toggle]");
      if (categoryToggle) {
        var categoryMenu = categoryToggle.closest(".community-category-select");
        if (categoryMenu) {
          var isOpen = categoryMenu.classList.toggle("is-open");
          var categoryField = categoryMenu.closest(".community-field");
          if (categoryField) categoryField.classList.toggle("is-category-open", isOpen);
        }
        return;
      }

      var profileButton = target.closest("[data-community-profile]");
      if (profileButton) return void openCommunityProfileFromButton(profileButton);

      var editButton = target.closest("[data-community-edit]");
      if (editButton) return void loadPostIntoComposer(editButton.getAttribute("data-community-edit"));

      var deleteButton = target.closest("[data-community-delete]");
      if (deleteButton) return void deletePost(deleteButton.getAttribute("data-community-delete"));

      var pinButton = target.closest("[data-community-pin]");
      if (pinButton) return void pinPost(pinButton.getAttribute("data-community-pin"), pinButton.getAttribute("data-next-pinned"));

      var bugStatusButton = target.closest("[data-community-bug-status]");
      if (bugStatusButton) return void updateBugReport(bugStatusButton.getAttribute("data-community-bug-status"), { bugStatus: bugStatusButton.getAttribute("data-next-bug-status") }, "Bug report status updated.");

      var knownIssueButton = target.closest("[data-community-known-issue]");
      if (knownIssueButton) return void updateBugReport(knownIssueButton.getAttribute("data-community-known-issue"), { knownIssue: knownIssueButton.getAttribute("data-next-known-issue") === "true" }, "Known issue status updated.");

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
        if (categoryDetails) {
          categoryDetails.classList.remove("is-open");
          var categoryField = categoryDetails.closest(".community-field");
          if (categoryField) categoryField.classList.remove("is-category-open");
        }
        return;
      }

      var commentDeleteButton = target.closest("[data-community-comment-delete]");
      if (commentDeleteButton) return void deleteComment(commentDeleteButton.getAttribute("data-community-comment-delete-post"), commentDeleteButton.getAttribute("data-community-comment-delete"));

      var commentEditButton = target.closest("[data-community-comment-edit]");
      if (commentEditButton) return void editComment(commentEditButton.getAttribute("data-community-comment-edit-post"), commentEditButton.getAttribute("data-community-comment-edit"), commentEditButton.getAttribute("data-community-comment-body"));

      var commentPinButton = target.closest("[data-community-comment-pin]");
      if (commentPinButton) return void updateComment(commentPinButton.getAttribute("data-community-comment-pin-post"), commentPinButton.getAttribute("data-community-comment-pin"), { pinned: commentPinButton.getAttribute("data-next-pinned") === "true" });

      var commentLikeButton = target.closest("[data-community-comment-like]");
      if (commentLikeButton) return void toggleCommentLike(commentLikeButton.getAttribute("data-community-comment-like-post"), commentLikeButton.getAttribute("data-community-comment-like"), commentLikeButton);

      var commentReplyButton = target.closest("[data-community-comment-reply]");
      if (commentReplyButton) return void replyToComment(commentReplyButton.getAttribute("data-community-comment-reply-post"), commentReplyButton.getAttribute("data-community-comment-reply"));

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

  }

  function startFeedHeartbeat() {
    if (pollTimer) return;
    // Poll post data silently. Membership state changes come from the shell event,
    // not from rebuilding the community UI every few seconds.
    pollTimer = window.setInterval(function () { loadCommunityPosts(false); }, 12000);
    window.addEventListener("rblxtools-membership-updated", function () {
      syncViewerState().then(function () { lastFeedSignature = ""; return loadCommunityPosts(true); });
    });
    window.addEventListener("focus", function () { syncViewerState().then(function () { return loadCommunityPosts(false); }); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) loadCommunityPosts(false); });
  }

  async function init() {
    bindFilters();
    bindComposer();
    await syncViewerState();
    await loadCommunityPosts(true);
    startFeedHeartbeat();
  }

  init();
})();
