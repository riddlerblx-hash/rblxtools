(function () {
  var API_BASE = window.location.origin;
  var VALID_FILTERS = ["announcement", "changelog", "bug-fix", "known-issue"];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
        '<article class="community-post">' +
          '<div class="community-post-head">' +
            '<span class="' + typeClasses + '">' + escapeHtml(formatPostType(post.category)) + "</span>" +
            '<span class="community-date">' + escapeHtml(formatDate(post.publishedAt || post.createdAt)) + "</span>" +
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

  async function loadCommunityPosts() {
    var feed = document.getElementById("communityFeed");
    if (!feed) return;

    var activeFilter = getActiveFilter();
    syncFilterUi(activeFilter);

    var url = API_BASE + "/api/community-posts";
    if (activeFilter !== "all") {
      url += "?filter=" + encodeURIComponent(activeFilter);
    }

    try {
      var response = await fetch(url, { cache: "no-store" });
      var payload = await response.json().catch(function () { return null; });
      if (!response.ok) {
        throw new Error(payload && payload.error ? payload.error : "Could not load community posts.");
      }

      var posts = Array.isArray(payload && payload.posts) ? payload.posts : [];
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

  loadCommunityPosts();
})();
