(function () {
  var API_BASE = window.location.origin;
  var TOKEN_KEY = "rblxtools_auth_token";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (_error) {
      return "";
    }
  }

  function setStatus(message, tone) {
    var node = document.getElementById("communityPublishStatus");
    if (!node) return;
    node.textContent = message || "";
    node.className = "admin-result" + (tone ? " " + tone : "");
  }

  function setListStatus(message, tone) {
    var node = document.getElementById("communityManageStatus");
    if (!node) return;
    node.textContent = message || "";
    node.className = "admin-result" + (tone ? " " + tone : "");
  }

  function getValue(id) {
    var node = document.getElementById(id);
    return node ? String(node.value || "").trim() : "";
  }

  function getChecked(id) {
    var node = document.getElementById(id);
    return Boolean(node && node.checked);
  }

  function formatType(type) {
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
    return parsed.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  async function fetchJson(url, options) {
    var response = await fetch(url, options);
    var payload = await response.json().catch(function () { return null; });
    if (!response.ok) {
      throw new Error(payload && payload.error ? payload.error : "Request failed.");
    }
    return payload || {};
  }

  function renderPosts(posts) {
    var wrap = document.getElementById("communityPostList");
    if (!wrap) return;

    if (!Array.isArray(posts) || !posts.length) {
      wrap.innerHTML =
        '<div class="admin-member-empty" style="display:block;">' +
          "<strong>No posts yet</strong>" +
          "Publish your first Community update from the form above." +
        "</div>";
      return;
    }

    wrap.innerHTML = posts.map(function (post) {
      return (
        '<div class="admin-member-box wide" style="margin-bottom:12px;">' +
          '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">' +
            "<div>" +
              '<div class="admin-member-key">' + escapeHtml(formatType(post.category)) + (post.pinned ? " • Pinned" : "") + "</div>" +
              '<div class="admin-member-value" style="margin-top:6px;">' + escapeHtml(post.title || "Untitled post") + "</div>" +
              '<div class="admin-status-copy" style="margin-top:8px;max-width:820px;">' + escapeHtml(post.body || "") + "</div>" +
              '<div class="admin-status-copy" style="margin-top:10px;">' +
                escapeHtml(formatDate(post.publishedAt || post.createdAt)) +
                (post.authorName ? " • " + escapeHtml(post.authorName) : "") +
              "</div>" +
            "</div>" +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
              '<button class="admin-btn red" type="button" data-community-delete="' + escapeHtml(post.id) + '">Delete</button>' +
            "</div>" +
          "</div>" +
        "</div>"
      );
    }).join("");

    wrap.querySelectorAll("[data-community-delete]").forEach(function (button) {
      button.addEventListener("click", function () {
        deletePost(button.getAttribute("data-community-delete") || "");
      });
    });
  }

  async function loadPosts() {
    var token = getToken();
    if (!token) {
      setListStatus("Log into an approved admin account first.", "error");
      return;
    }

    try {
      var payload = await fetchJson(API_BASE + "/admin/community-posts", {
        headers: {
          Authorization: "Bearer " + token
        }
      });
      renderPosts(payload.posts || []);
      setListStatus("Community posts loaded.", "success");
    } catch (error) {
      setListStatus(error.message || "Could not load community posts.", "error");
    }
  }

  async function publishPost() {
    var token = getToken();
    if (!token) {
      setStatus("Log into an approved admin account first.", "error");
      return;
    }

    var title = getValue("communityPostTitle");
    var body = getValue("communityPostBody");
    if (!title) {
      setStatus("Give the post a title first.", "error");
      return;
    }
    if (!body) {
      setStatus("Write the post body first.", "error");
      return;
    }

    var button = document.getElementById("publishCommunityPostButton");
    if (button) button.disabled = true;
    setStatus("Publishing post...");

    try {
      var payload = await fetchJson(API_BASE + "/admin/community-posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          title: title,
          body: body,
          category: getValue("communityPostCategory"),
          pinned: getChecked("communityPostPinned"),
          linkLabel: getValue("communityPostLinkLabel"),
          linkUrl: getValue("communityPostLinkUrl")
        })
      });

      setStatus(payload.message || "Community post published.", "success");
      ["communityPostTitle", "communityPostBody", "communityPostLinkLabel", "communityPostLinkUrl"].forEach(function (id) {
        var node = document.getElementById(id);
        if (node) node.value = "";
      });
      var category = document.getElementById("communityPostCategory");
      if (category) category.value = "announcement";
      var pinned = document.getElementById("communityPostPinned");
      if (pinned) pinned.checked = false;
      await loadPosts();
    } catch (error) {
      setStatus(error.message || "Could not publish the post.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function deletePost(postId) {
    if (!postId) return;
    var token = getToken();
    if (!token) {
      setListStatus("Log into an approved admin account first.", "error");
      return;
    }

    if (!window.confirm("Delete this community post?")) return;

    try {
      var payload = await fetchJson(API_BASE + "/admin/community-posts/" + encodeURIComponent(postId), {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + token
        }
      });
      setListStatus(payload.message || "Post deleted.", "success");
      await loadPosts();
    } catch (error) {
      setListStatus(error.message || "Could not delete this post.", "error");
    }
  }

  function init() {
    var publishButton = document.getElementById("publishCommunityPostButton");
    var refreshButton = document.getElementById("refreshCommunityPostsButton");
    if (!publishButton || !refreshButton) return;

    publishButton.addEventListener("click", publishPost);
    refreshButton.addEventListener("click", loadPosts);
    loadPosts();
  }

  init();
})();
