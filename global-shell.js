(function () {
  if (window.__rblxShellReady) return;
  window.__rblxShellReady = true;

  var API_BASE = window.location.origin;
  var TOKEN_KEY = "rblxtools_auth_token";
  var USER_KEY = "rblxtools_auth_user";
  var PLUS_STATUS_KEY = "rblxtools_plus_cache";
  var PROFILE_KEY = "rblxtools_profile_overview";
  var DEVICE_KEY = "rblxtools_device_id";
  var TOOL_ACTIVITY_CACHE_KEY = "rblxtools_tool_activity_cache";
  var LEFT_STATE_KEY = "rblxtools_shell_left_collapsed";
  var RIGHT_STATE_KEY = "rblxtools_shell_right_collapsed";
  var shellState = {
    chatMessages: [],
    chatList: null,
    chatInput: null,
    chatSendButton: null,
    chatAdminButton: null,
    currentUser: null,
    currentProfile: null,
    profileCache: [],
    socket: null,
    socketReady: false,
    onlineCount: 0,
    isAdmin: false,
    deviceId: "",
    moderation: null,
    profileOverlay: null,
    profileModal: null,
    profileAvatar: null,
    profileAvatarImage: null,
    profileAvatarFallback: null,
    profilePlusMark: null,
    profileName: null,
    profilePlan: null,
    profileUserId: null,
    profileDisplayName: null,
    profileClose: null,
    adminWindow: null,
    adminWindowFrame: null,
    adminWindowClose: null,
    siteLockOverlay: null,
    siteLockReason: null,
    chatAlert: null,
    chatAlertText: null,
    moderationCountdownTimer: null,
    chatSpecials: null,
    chatBottom: null,
    chatRainOverlay: null,
    roomSpecials: null,
    roomSpecialsTimer: null,
    serverTimeOffset: 0,
    chatMessageRefreshTimer: null
  };

  var navGroups = [
    {
      title: "Tools",
      items: [
        { href: "./index", label: "Home", icon: "home" },
        { href: "./template-downloader", label: "Template Downloader", icon: "shirt" },
        { href: "./template-background-changer", label: "Background Changer", icon: "spark" },
        { href: "./ugc-downloader", label: "UGC Downloader", icon: "hat" },
        { href: "./media-downloader", label: "Media Downloader", icon: "media" },
        { href: "./audio-downloader", label: "Audio Downloader", icon: "audio" },
        { href: "./robux-calculator", label: "Robux Calculator", icon: "calc" },
        { href: "./texture-baker", label: "Texture Baker", icon: "texture" },
        { href: "./animation-spoofer", label: "Animation Spoofer", icon: "rig" }
      ]
    },
    {
      title: "Account",
      items: [
        { href: "./subscriptions", label: "Subscriptions", icon: "plan" },
        { href: "./account-overview", label: "Account Overview", icon: "account" },
        { href: "./login", label: "Login / Sign Up", icon: "login" }
      ]
    },
    {
      title: "Info",
      items: [
        { href: "./about-us", label: "About Us", icon: "about" },
        { href: "./privacy-policy", label: "Privacy Policy", icon: "privacy" },
        { href: "./terms-and-conditions", label: "Terms & Conditions", icon: "terms" }
      ]
    }
  ];

  var starterMessages = [];

  function getNavIcon(kind) {
    var icons = {
      home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.8v-6.2H9.8V21H5a1 1 0 0 1-1-1v-9.5Z"/></svg>',
      shirt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 4.2 10.8 6h2.4l2.6-1.8 3.7 2.5-1.9 3.7-2.1-1V20H8.5V9.4l-2.1 1-1.9-3.7 3.7-2.5Z"/></svg>',
      spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.9 4.6L18.5 9l-4.6 1.4L12 15l-1.9-4.6L5.5 9l4.6-1.4L12 3Zm6.5 10.5 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5ZM5.5 14l.8 2 .2.1 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z"/></svg>',
      hat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14.5c.5-3.8 2.7-6.3 6-6.3s5.5 2.5 6 6.3H6Zm-2 1.7h16c0 2.1-1.8 3.8-4 3.8H8c-2.2 0-4-1.7-4-3.8Z"/></svg>',
      media: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1.6 11h10.8l-3.3-4.1-2.7 3-1.9-2.1L6.6 16ZM8.5 10.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Z"/></svg>',
      audio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h2.8l3.4-4.7V20l-3.4-4.7H4V14Zm10.8-4.6a5.5 5.5 0 0 1 0 5.2m2.7-7.7a9 9 0 0 1 0 10.2"/></svg>',
      calc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 3h6v2H9V6Zm0 5h2v2H9v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2H9v-2Zm4 0h2v2h-2v-2Z"/></svg>',
      texture: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h6v6H5V5Zm8 0h6v6h-6V5ZM5 13h6v6H5v-6Zm8 0h6v6h-6v-6Z"/></svg>',
      rig: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4ZM9.2 10l2.8 1.5 2.8-1.5 1.2 2.1-2.6 1.4v2.1l2.1 4.1-2.1 1-1.4-3-1.4 3-2.1-1 2.1-4.1v-2.1L8 12.1 9.2 10Z"/></svg>',
      plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 14.6 8l5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L5.2 8.7l5-.7L12 3.5Z"/></svg>',
      account: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4ZM5 19c.6-3 3.4-5 7-5s6.4 2 7 5H5Z"/></svg>',
      login: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5h6v14h-6M4 12h10m-3.5-3.5L14 12l-3.5 3.5"/></svg>',
      shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.5-7 9-4.1-1.5-7-4.8-7-9V6l7-2.5Zm0 4.2v8.2"/></svg>',
      about: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-.8 5.2a1.1 1.1 0 1 0 1.6 0 1.1 1.1 0 0 0-1.6 0ZM11 11h2v5h-2v-5Z"/></svg>',
      privacy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.5-7 9-4.1-1.5-7-4.8-7-9V6l7-2.5Zm0 5a2.5 2.5 0 0 0-2.5 2.5v1.2H9v4.8h6v-4.8h-.5V11A2.5 2.5 0 0 0 12 8.5Z"/></svg>',
      terms: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h8l4 4v12H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm7 1.5V9h3.5M9 12h6m-6 3h6"/></svg>'
    };
    return icons[kind] || "";
  }

  function getSocialIcon(kind) {
    var icons = {
      x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2H22l-6.76 7.73L23 22h-6.08l-4.76-6.22L6.72 22H3.6l7.23-8.27L1 2h6.24l4.3 5.67L18.9 2Zm-1.06 18h1.69L6.33 3.9H4.51L17.84 20Z"/></svg>',
      youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.6 15.7V8.3l6.4 3.7-6.4 3.7Z"/></svg>',
      discord: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 4.4A16.7 16.7 0 0 0 16.2 3l-.2.4a15.4 15.4 0 0 1 3.6 1.4 13.7 13.7 0 0 0-7.6-2.1 13.7 13.7 0 0 0-7.6 2.1A15.4 15.4 0 0 1 8 3.4L7.8 3A16.7 16.7 0 0 0 3.7 4.4C1 8.4.4 12.2.7 16l.1.2a16.9 16.9 0 0 0 5 2.5l.2-.4a10.7 10.7 0 0 1-1.6-.8l.4-.3c3 1.4 6.3 1.4 9.2 0l.4.3c-.5.3-1 .5-1.6.8l.2.4a16.9 16.9 0 0 0 5-2.5l.1-.2c.4-4.4-.7-8.2-3.4-11.6ZM9.5 14.5c-.9 0-1.7-.8-1.7-1.9 0-1 .7-1.8 1.7-1.8.9 0 1.7.8 1.7 1.8 0 1.1-.8 1.9-1.7 1.9Zm5 0c-.9 0-1.7-.8-1.7-1.9 0-1 .8-1.8 1.7-1.8 1 0 1.7.8 1.7 1.8 0 1.1-.8 1.9-1.7 1.9Z"/></svg>',
      twitch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2 2 6v14h5v2h2l2-2h3l6-6V2H4Zm14 11-3 3h-3l-2 2v-2H6V4h12v9Zm-3-6h-2v5h2V7Zm-5 0H8v5h2V7Z"/></svg>'
    };
    return icons[kind] || "";
  }

  function getToggleIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.25h14M5 12h14M5 16.75h14"/></svg>';
  }

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; }
    catch (_error) { return ""; }
  }

  function readStorage(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (_error) {
      return fallback;
    }
  }

  function readRawStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_error) {}
  }

  function readToolActivityCache() {
    var value = readStorage(TOOL_ACTIVITY_CACHE_KEY, null);
    return Array.isArray(value) ? value : [];
  }

  function writeToolActivityCache(entries) {
    writeStorage(TOOL_ACTIVITY_CACHE_KEY, Array.isArray(entries) ? entries.slice(-80) : []);
  }

  function getInitials(value) {
    var text = String(value || "").trim();
    if (!text) return "R";
    var parts = text.split(/\s+/).filter(Boolean);
    if (!parts.length) return "R";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
  }

  function getEmailNamePart(value) {
    var text = String(value || "").trim();
    if (!text) return "";
    return text.split("@")[0].trim();
  }

  function getCurrentActivityActorName() {
    var currentUser = shellState.currentUser || {};
    var currentProfile = shellState.currentProfile || readSavedProfile(currentUser.userId);
    var profileName = String(currentProfile && currentProfile.displayName || "").trim();
    if (profileName) return profileName;

    var userName = String(currentUser.displayName || currentUser.username || "").trim();
    if (userName) return userName;

    var cachedUser = getCachedAuthUser();
    var cachedDisplayName = String(cachedUser && (cachedUser.displayName || cachedUser.username || cachedUser.name) || "").trim();
    if (cachedDisplayName) return cachedDisplayName;

    var cachedEmailName = getEmailNamePart(cachedUser && cachedUser.email);
    if (cachedEmailName) return cachedEmailName;

    return "Guest";
  }

  function resolveToolActivityActor(message, defaultActorName) {
    var safeDefault = String(defaultActorName || "").trim() || "Guest";
    var messageId = String(message && message.id || "").trim();
    var toolName = String(message && message.text || "").trim();
    var messageCreatedAt = new Date(message && message.createdAt || "").getTime();
    if (!messageId || !toolName || !messageCreatedAt) {
      return safeDefault;
    }

    var cache = readToolActivityCache();
    var pinned = null;
    var pending = [];

    for (var index = 0; index < cache.length; index += 1) {
      var entry = cache[index];
      if (!entry || typeof entry !== "object") continue;
      if (String(entry.messageId || "").trim() === messageId && String(entry.actorName || "").trim()) {
        pinned = String(entry.actorName || "").trim();
        break;
      }
      if (!entry.messageId && String(entry.toolName || "").trim() === toolName) {
        pending.push(entry);
      }
    }

    if (pinned) {
      return pinned;
    }

    var matchedEntry = null;
    var matchedIndex = -1;
    for (var pendingIndex = 0; pendingIndex < pending.length; pendingIndex += 1) {
      var candidate = pending[pendingIndex];
      var candidateTime = new Date(candidate.createdAt || "").getTime();
      if (!candidateTime) continue;
      var delta = Math.abs(candidateTime - messageCreatedAt);
      if (delta > 2 * 60 * 1000) continue;
      matchedEntry = candidate;
      matchedIndex = cache.indexOf(candidate);
      break;
    }

    if (!matchedEntry || matchedIndex < 0) {
      return safeDefault;
    }

    cache[matchedIndex] = {
      messageId: messageId,
      toolName: toolName,
      actorName: String(matchedEntry.actorName || "").trim(),
      createdAt: message && message.createdAt ? String(message.createdAt) : matchedEntry.createdAt
    };
    writeToolActivityCache(cache);
    return String(matchedEntry.actorName || "").trim() || safeDefault;
  }

  function getPreferredUserName(user, payload) {
    var source = user || {};
    var extra = payload || {};
    var savedProfile = source && source.id ? readSavedProfile(String(source.id)) : null;
    return String(
      (savedProfile && savedProfile.displayName) ||
      extra.displayName ||
      source.displayName ||
      source.username ||
      source.name ||
      getEmailNamePart(source.email) ||
      "Member"
    ).trim();
  }

  function getCachedAuthUser() {
    var raw = readRawStorage(USER_KEY) || "";
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function saveCachedAuthUser(user) {
    try {
      if (user && typeof user === "object") {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        localStorage.setItem(PLUS_STATUS_KEY, JSON.stringify({
          isPlus: hasPlusFromPayload(user),
          updatedAt: Date.now()
        }));
      } else {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(PLUS_STATUS_KEY);
      }
    } catch (_error) {}
  }

  function writeCachedPlusStatus(isPlus) {
    try {
      localStorage.setItem(PLUS_STATUS_KEY, JSON.stringify({
        isPlus: Boolean(isPlus),
        updatedAt: Date.now()
      }));
    } catch (_error) {}
  }

  function dispatchMembershipUpdate(detail) {
    try {
      window.dispatchEvent(new CustomEvent("rblxtools-membership-updated", {
        detail: detail || {}
      }));
    } catch (_error) {}
  }

  function getDeviceId() {
    try {
      var stored = localStorage.getItem(DEVICE_KEY) || "";
      if (!stored) {
        stored = "device-" + Math.random().toString(16).slice(2) + Date.now().toString(16);
        localStorage.setItem(DEVICE_KEY, stored);
      }
      return stored;
    } catch (_error) {
      return "device-fallback";
    }
  }

  function loadSocketScript() {
    if (window.io) return Promise.resolve(window.io);
    if (window.__rblxSocketScriptPromise) return window.__rblxSocketScriptPromise;

    window.__rblxSocketScriptPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-rblx-socket="true"]');
      if (existing) {
        existing.addEventListener("load", function () { resolve(window.io); }, { once: true });
        existing.addEventListener("error", function () { reject(new Error("Could not load live chat.")); }, { once: true });
        return;
      }

      var script = document.createElement("script");
      script.src = API_BASE + "/socket.io/socket.io.js";
      script.async = true;
      script.defer = true;
      script.setAttribute("data-rblx-socket", "true");
      script.onload = function () { resolve(window.io); };
      script.onerror = function () { reject(new Error("Could not load live chat.")); };
      document.head.appendChild(script);
    });

    return window.__rblxSocketScriptPromise;
  }

  function getSocketChatIdentity() {
    var currentProfile = shellState.currentProfile || readSavedProfile(shellState.currentUser && shellState.currentUser.userId);
    var isLoggedIn = Boolean(shellState.currentUser && shellState.currentUser.loggedIn);
    var fallbackName = isLoggedIn
      ? (currentProfile.displayName || shellState.currentUser.displayName || shellState.currentUser.username || "Member")
      : "Guest";
    var guestId = isLoggedIn ? "" : getGuestHash();

    return {
      authToken: getToken(),
      deviceId: shellState.deviceId || getDeviceId(),
      room: "rblxtools-main",
      userId: shellState.currentUser && shellState.currentUser.userId ? String(shellState.currentUser.userId) : guestId,
      displayName: currentProfile.displayName || fallbackName,
      username: currentProfile.displayName || (shellState.currentUser && shellState.currentUser.username) || fallbackName,
      avatarUrl: currentProfile.avatarUrl || "",
      bio: currentProfile.bio || "",
      isPlus: shellState.currentUser && shellState.currentUser.plan === "plus",
      isGuest: !isLoggedIn,
      plan: shellState.currentUser && shellState.currentUser.plan ? shellState.currentUser.plan : "guest",
      favoriteTools: []
    };
  }

  function setChatComposeState(disabled, placeholder, statusMessage) {
    if (shellState.chatInput) {
      shellState.chatInput.disabled = Boolean(disabled);
      if (placeholder) shellState.chatInput.placeholder = placeholder;
    }
    if (shellState.chatSendButton) {
      shellState.chatSendButton.disabled = Boolean(disabled);
    }
    if (statusMessage && shellState.chatList) {
      shellState.chatList.setAttribute("data-chat-status", statusMessage);
    }
  }

  function clearModerationCountdown() {
    if (shellState.moderationCountdownTimer) {
      window.clearInterval(shellState.moderationCountdownTimer);
      shellState.moderationCountdownTimer = null;
    }
  }

  function formatRemainingDuration(ms) {
    var totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    var parts = [];

    if (days) parts.push(days + "d");
    if (hours) parts.push(hours + "h");
    if (minutes) parts.push(minutes + "m");
    if (seconds || !parts.length) parts.push(seconds + "s");

    return parts.join(" ");
  }

  function setChatAlert(message, tone) {
    if (!shellState.chatAlert || !shellState.chatAlertText) return;
    clearModerationCountdown();
    if (!message) {
      shellState.chatAlert.hidden = true;
      shellState.chatAlert.className = "rblx-shell-chat-alert";
      shellState.chatAlertText.textContent = "";
      return;
    }
    shellState.chatAlert.hidden = false;
    shellState.chatAlert.className = "rblx-shell-chat-alert" + (tone ? " is-" + tone : "");
    shellState.chatAlertText.textContent = message;
  }

  function setTimedOutAlert(expiresAt) {
    if (!shellState.chatAlert || !shellState.chatAlertText) return;
    clearModerationCountdown();

    function renderCountdown() {
      var ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) {
        clearModerationCountdown();
        setChatAlert("", "");
        loadPublicModerationState();
        return;
      }
      shellState.chatAlert.hidden = false;
      shellState.chatAlert.className = "rblx-shell-chat-alert is-timeout";
      shellState.chatAlertText.textContent = "You are timed out for " + formatRemainingDuration(ms) + ".";
    }

    renderCountdown();
    shellState.moderationCountdownTimer = window.setInterval(renderCountdown, 1000);
  }

  function clearRoomSpecialsTimer() {
    if (shellState.roomSpecialsTimer) {
      window.clearInterval(shellState.roomSpecialsTimer);
      shellState.roomSpecialsTimer = null;
    }
  }

  function clearChatMessageRefreshTimer() {
    if (shellState.chatMessageRefreshTimer) {
      window.clearInterval(shellState.chatMessageRefreshTimer);
      shellState.chatMessageRefreshTimer = null;
    }
  }

  function updateChatMessageRefresh() {
    clearChatMessageRefreshTimer();
    var messages = Array.isArray(shellState.chatMessages) ? shellState.chatMessages : [];
    var needsRefresh = messages.some(function (message) {
      if (!message) return false;
      if (message.specialType === "toolActivity" && message.createdAt) return true;
      if (message.specialType === "claimDrop" && message.claimDrop && message.claimDrop.expiresAt) return true;
      if (message.moderationTimeoutUntil && new Date(message.moderationTimeoutUntil).getTime() > Date.now()) return true;
      return false;
    });

    if (!needsRefresh || shellState.roomSpecialsTimer || !shellState.chatList) {
      return;
    }

    shellState.chatMessageRefreshTimer = window.setInterval(function () {
      if (!shellState.chatList) return;
      renderChatMessages(shellState.chatList, shellState.chatMessages);
    }, 1000);
  }

  function formatCountdownTo(value) {
    var targetTime = new Date(value).getTime();
    if (!targetTime) return "0s";
    return formatRemainingDuration(targetTime - (Date.now() + (shellState.serverTimeOffset || 0)));
  }

  function formatRelativeTimeSince(value) {
    var sourceTime = new Date(value).getTime();
    if (!sourceTime) return "just now";
    var elapsedMs = Math.max(0, (Date.now() + (shellState.serverTimeOffset || 0)) - sourceTime);
    var elapsedSeconds = Math.floor(elapsedMs / 1000);
    if (elapsedSeconds < 5) return "just now";
    if (elapsedSeconds < 60) return elapsedSeconds + " seconds ago";
    var elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 60) return elapsedMinutes + (elapsedMinutes === 1 ? " minute ago" : " minutes ago");
    var elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return elapsedHours + (elapsedHours === 1 ? " hour ago" : " hours ago");
    var elapsedDays = Math.floor(elapsedHours / 24);
    return elapsedDays + (elapsedDays === 1 ? " day ago" : " days ago");
  }

  function buildPlusBurstMarkup(className, count) {
    var items = [];
    for (var index = 0; index < count; index += 1) {
      items.push(
        '<span class="' + className + '" style="--plus-left:' + ((index * 17) % 100) + '%;--plus-delay:' + (index * -0.18).toFixed(2) + 's;--plus-size:' + (12 + (index % 5) * 3) + 'px;">+</span>'
      );
    }
    return items.join("");
  }

  function renderRoomSpecials() {
    if (!shellState.chatSpecials) return;
    clearRoomSpecialsTimer();
    var specials = shellState.roomSpecials || {};
    var hasChatRain = Boolean(specials.chatRain && !specials.chatRain.ended);

    if (!hasChatRain) {
      shellState.chatSpecials.hidden = true;
      shellState.chatSpecials.innerHTML = "";
      renderChatRainOverlay();
      return;
    }

    var html = "";

    var rain = specials.chatRain;
    var rainDurationMs = Math.max(1, new Date(rain.expiresAt).getTime() - new Date(rain.createdAt || rain.expiresAt).getTime());
    var rainRemainingMs = Math.max(0, new Date(rain.expiresAt).getTime() - (Date.now() + (shellState.serverTimeOffset || 0)));
    var rainProgressPercent = Math.max(0, Math.min(100, (rainRemainingMs / rainDurationMs) * 100));
    html += (
      '<section class="rblx-shell-special-card is-rain">' +
        '<div class="rblx-shell-special-head">' +
          '<div><div class="rblx-shell-special-kicker">Chat Rain</div><h3 class="rblx-shell-special-title">' + escapeHtml(rain.title || "Live Chat Rain") + "</h3></div>" +
          '<div class="rblx-shell-special-chip">Ends In ' + escapeHtml(formatCountdownTo(rain.expiresAt)) + "</div>" +
        "</div>" +
        '<p class="rblx-shell-special-copy">Join the live chat rain for <strong>' + escapeHtml(String(rain.winnersCount || 1)) + "</strong> Plus winner" + ((rain.winnersCount || 1) === 1 ? "" : "s") + ".</p>" +
        '<div class="rblx-shell-event-progress"><span class="rblx-shell-event-progress-fill" style="width:' + rainProgressPercent.toFixed(2) + '%;"></span></div>' +
        '<div class="rblx-shell-special-meta"><span>' + escapeHtml(String(rain.participantCount || 0)) + ' joined</span><span>' + escapeHtml(String(rain.days || 0)) + ' Plus days</span></div>' +
        '<div class="rblx-shell-special-actions"><button class="rblx-shell-special-btn is-rain" type="button" data-special-action="join-rain">Join Rain</button></div>' +
      "</section>"
    );

    shellState.chatSpecials.hidden = false;
    shellState.chatSpecials.innerHTML = html;
    renderChatRainOverlay();
    shellState.roomSpecialsTimer = window.setInterval(function () {
      renderRoomSpecials();
      if (shellState.chatList && shellState.chatMessages && shellState.chatMessages.length) {
        renderChatMessages(shellState.chatList, shellState.chatMessages);
      }
    }, 1000);
  }

  function renderChatRainOverlay() {
    if (!shellState.chatRainOverlay || !shellState.chatSpecials || !shellState.chatBottom) return;
    var specials = shellState.roomSpecials || {};
    var hasChatRain = Boolean(specials.chatRain && !specials.chatRain.ended);
    if (!hasChatRain || shellState.chatSpecials.hidden) {
      shellState.chatRainOverlay.hidden = true;
      shellState.chatRainOverlay.innerHTML = "";
      return;
    }

    var top = shellState.chatSpecials.offsetTop + shellState.chatSpecials.offsetHeight - 6;
    var bottomInset = Math.max(12, shellState.chatBottom.offsetHeight + 12);
    shellState.chatRainOverlay.style.top = top + "px";
    shellState.chatRainOverlay.style.bottom = bottomInset + "px";
    shellState.chatRainOverlay.hidden = false;
    if (!shellState.chatRainOverlay.innerHTML) {
      shellState.chatRainOverlay.innerHTML = buildPlusBurstMarkup("rblx-shell-chat-rain-plus", 72);
    }
  }

  function applyModerationState(moderation) {
    shellState.moderation = moderation || null;

    if (shellState.siteLockOverlay && shellState.siteLockReason) {
      var locked = Boolean(moderation && moderation.websiteBlacklisted);
      shellState.siteLockOverlay.classList.toggle("is-open", locked);
      shellState.siteLockOverlay.setAttribute("aria-hidden", locked ? "false" : "true");
      shellState.siteLockReason.textContent = locked
        ? (moderation.websiteBlacklistReason || "This browser is blocked from using the website.")
        : "";
    }

    if (moderation && moderation.websiteBlacklisted) {
      setChatComposeState(true, "Website access locked", moderation.websiteBlacklistReason || "Website access locked");
      setChatAlert(moderation.websiteBlacklistReason || "This browser is blocked from using the website.", "ban");
      return;
    }

    if (moderation && moderation.chatBanned) {
      setChatComposeState(true, "You are banned from chat", moderation.chatBanReason || "You are banned from chat");
      setChatAlert(moderation.chatBanReason || "You are chat banned.", "ban");
      return;
    }

    if (moderation && moderation.chatTimeoutUntil && new Date(moderation.chatTimeoutUntil).getTime() > Date.now()) {
      setChatComposeState(true, "You are timed out from chat", "Timed out until " + new Date(moderation.chatTimeoutUntil).toLocaleString());
      setTimedOutAlert(moderation.chatTimeoutUntil);
      return;
    }

    setChatComposeState(false, "Enter a message...", "");
    setChatAlert("", "");
  }

  function hashText(value) {
    var text = String(value || "");
    var hash = 2166136261;
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function getGuestHash() {
    try {
      var key = "rblxtools_guest_hash";
      var stored = localStorage.getItem(key) || "";
      if (!stored) {
        var seed = [
          navigator.userAgent,
          navigator.language,
          navigator.platform,
          String(screen.width || 0) + "x" + String(screen.height || 0),
          String(new Date().getTimezoneOffset())
        ].join("|");
        stored = "guest-" + hashText(seed + "|" + Math.random().toString(16).slice(2));
        localStorage.setItem(key, stored);
      }
      return stored;
    } catch (_error) {
      return "guest-" + hashText(navigator.userAgent + "|" + navigator.language + "|" + navigator.platform);
    }
  }

  function readProfileFromKey(key) {
    try {
      var raw = localStorage.getItem(key) || "";
      var parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return null;
      return {
        displayName: parsed.displayName ? String(parsed.displayName).trim() : "",
        bio: parsed.bio ? String(parsed.bio).trim().slice(0, 150) : "",
        avatarUrl: parsed.avatarUrl ? String(parsed.avatarUrl).trim() : "",
        avatarScale: parsed.avatarScale != null ? Number(parsed.avatarScale) : 1,
        avatarX: parsed.avatarX != null ? Number(parsed.avatarX) : 50,
        avatarY: parsed.avatarY != null ? Number(parsed.avatarY) : 50
      };
    } catch (_error) {
      return null;
    }
  }

  function readSavedProfile(userId) {
    var keys = [];
    var keyPrefix = PROFILE_KEY + ":";

    if (userId) {
      keys.push(PROFILE_KEY + ":" + userId);
      keys.push(PROFILE_KEY);
    } else {
      keys.push(PROFILE_KEY);
    }

    try {
      if (!userId) {
        for (var index = 0; index < localStorage.length; index += 1) {
          var storageKey = localStorage.key(index) || "";
          if (storageKey.indexOf(keyPrefix) === 0) {
            keys.push(storageKey);
          }
        }
      }
    } catch (_error) {}

    for (var i = 0; i < keys.length; i += 1) {
      var profile = readProfileFromKey(keys[i]);
      if (profile) return profile;
    }

    return {
      displayName: "",
      bio: "",
      avatarUrl: "",
      avatarScale: 1,
      avatarX: 50,
      avatarY: 50
    };
  }

  function refreshCurrentProfile() {
    var userId = shellState.currentUser && shellState.currentUser.userId ? String(shellState.currentUser.userId) : "";
    shellState.currentProfile = readSavedProfile(userId);
    return shellState.currentProfile;
  }

  function getMessageProfile(message) {
    var currentUser = shellState.currentUser || {};
    var currentProfile = shellState.currentProfile || readSavedProfile(currentUser.userId);
    var profile = {
      displayName: String((message && (message.displayName || message.name)) || "Unknown").trim() || "Unknown",
      userId: String((message && message.userId) || "").trim(),
      badge: String((message && message.badge) || "Free Plan").trim() || "Free Plan",
      plan: String((message && message.plan) || "").trim(),
      avatarUrl: String((message && message.avatarUrl) || "").trim(),
      avatarText: String((message && message.avatar) || "").trim(),
      bio: String((message && message.bio) || "").trim(),
      favoriteTools: Array.isArray(message && message.favoriteTools) ? message.favoriteTools.slice() : [],
      system: Boolean(message && message.system),
      moderationChatBanned: Boolean(message && message.moderationChatBanned),
      moderationTimeoutUntil: String((message && message.moderationTimeoutUntil) || "").trim(),
      moderationTimeoutReason: String((message && message.moderationTimeoutReason) || "").trim()
    };
    var isGuestMessage = Boolean(
      message && (
        message.badge === "Guest" ||
        message.name === "Guest" ||
        message.plan === "guest" ||
        !profile.userId
      )
    );

    if (message && (message.badge === "Local" || (currentUser.userId && profile.userId && String(profile.userId) === String(currentUser.userId)))) {
      if (currentProfile) {
        profile.displayName = currentProfile.displayName || profile.displayName;
        profile.avatarUrl = currentProfile.avatarUrl || profile.avatarUrl;
        profile.bio = currentProfile.bio || profile.bio;
      }
      profile.badge = currentUser.loggedIn && currentUser.plan === "plus" ? "Plus" : (currentUser.loggedIn ? "Free Plan" : "Guest");
      profile.plan = currentUser.plan ? currentUser.plan : "guest";
      profile.userId = currentUser.userId ? String(currentUser.userId) : profile.userId;
    }

    if (!profile.userId) {
      profile.userId = isGuestMessage ? getGuestHash() : "N/A";
    }

    var savedProfile = profile.userId !== "N/A" ? readSavedProfile(profile.userId) : null;
    if (savedProfile) {
      profile.displayName = savedProfile.displayName || profile.displayName;
      profile.avatarUrl = savedProfile.avatarUrl || profile.avatarUrl;
      profile.bio = savedProfile.bio || profile.bio;
    }

    if (!profile.bio && currentProfile && currentProfile.bio && profile.userId && currentUser.userId && profile.userId === String(currentUser.userId)) {
      profile.bio = currentProfile.bio;
    }

    if (!profile.avatarText) {
      profile.avatarText = getInitials(profile.displayName);
    }

    if (profile.system && (!message || message.specialType !== "toolActivity")) {
      profile.displayName = "RBLXTools Bot";
      profile.badge = "Bot";
      profile.plan = "bot";
      profile.avatarUrl = "";
      profile.avatarText = "RB";
    }

    if (!profile.plan) {
      if (profile.badge.toLowerCase() === "staff") profile.plan = "staff";
      else if (profile.badge.toLowerCase() === "plus") profile.plan = "plus";
      else if (profile.badge.toLowerCase() === "local") profile.plan = "local";
      else profile.plan = "free";
    }

    if (profile.moderationTimeoutUntil && new Date(profile.moderationTimeoutUntil).getTime() <= Date.now()) {
      profile.moderationTimeoutUntil = "";
      profile.moderationTimeoutReason = "";
    }

    return profile;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizePath(path) {
    return String(path || "").split("?")[0].split("#")[0].toLowerCase();
  }

  function buildNavMarkup() {
    var currentPath = normalizePath(window.location.pathname);
    var isLoggedIn = Boolean(shellState.currentUser && shellState.currentUser.loggedIn);
    return navGroups.map(function (group) {
      var items = group.items.filter(function (item) {
        if (item.href === "./account-overview") return isLoggedIn;
        if (item.adminOnly) return Boolean(shellState.isAdmin);
        return true;
      });
      if (!items.length) return "";

      var links = items.map(function (item) {
        var normalizedHref = normalizePath(item.href).replace("./", "/");
        var active = currentPath.endsWith(normalizedHref) || currentPath.endsWith(normalizedHref.slice(1));
        return (
          '<a class="rblx-shell-nav-link' + (active ? ' is-active' : '') + '" href="' + item.href + '">' +
            '<span class="rblx-shell-nav-icon">' + getNavIcon(item.icon) + '</span>' +
            '<span>' + escapeHtml(item.label) + '</span>' +
            '<span class="rblx-shell-nav-tooltip">' + escapeHtml(item.label) + '</span>' +
          "</a>"
        );
      }).join("");

      return (
        '<section class="rblx-shell-nav-group">' +
          '<h3 class="rblx-shell-nav-group-title">' + escapeHtml(group.title) + "</h3>" +
          links +
        "</section>"
      );
    }).join("");
  }

  function buildAuthMarkup() {
    var currentUser = shellState.currentUser || {};
    if (currentUser.loggedIn) {
      if (currentUser.plan === "plus") {
        return (
          '<div class="rblx-shell-auth" id="rblxShellAuth">' +
            '<a class="rblx-shell-btn" href="./account-overview">Account</a>' +
            '<button class="rblx-shell-btn" type="button" id="rblxShellLogout">Log Out</button>' +
          "</div>"
        );
      }

      return (
        '<div class="rblx-shell-auth" id="rblxShellAuth">' +
          '<a class="rblx-shell-btn" href="./account-overview">Account</a>' +
          '<a class="rblx-shell-btn is-primary" href="./subscriptions">View Plans</a>' +
          '<button class="rblx-shell-btn" type="button" id="rblxShellLogout">Log Out</button>' +
        "</div>"
      );
    }

    return (
      '<div class="rblx-shell-auth" id="rblxShellAuth">' +
        '<a class="rblx-shell-btn is-primary" href="./login">Login / Sign Up</a>' +
      "</div>"
    );
  }

  function buildShellMarkup() {
    return (
      '<div class="rblx-shell" id="rblxShellRoot">' +
        '<header class="rblx-shell-header">' +
          '<a class="rblx-shell-brand" href="./index">' +
            '<span class="rblx-shell-brand-mark">RB</span>' +
            '<span class="rblx-shell-brand-text">' +
              '<span class="rblx-shell-brand-title">RBLXTools</span>' +
              '<span class="rblx-shell-brand-subtitle">Roblox creator toolkit</span>' +
            "</span>" +
          "</a>" +
          '<div class="rblx-shell-status" id="rblxShellStatus" data-plan="guest">' +
            '<span class="rblx-shell-status-dot"></span>' +
            '<span id="rblxShellStatusText">You are browsing this website as a guest.</span>' +
          "</div>" +
          '<div class="rblx-shell-header-actions">' +
            '<div class="rblx-shell-support-wrap"><span class="rblx-shell-support-float one">$</span><span class="rblx-shell-support-float two">$</span><span class="rblx-shell-support-float three">$</span><span class="rblx-shell-support-float four">$</span><a class="rblx-shell-support-link" href="https://ko-fi.com/rblxtools" target="_blank" rel="noopener noreferrer">Support</a></div>' +
            buildAuthMarkup() +
          "</div>" +
        "</header>" +
        '<div class="rblx-shell-body">' +
          '<aside class="rblx-shell-left">' +
            '<div class="rblx-shell-left-inner">' +
              '<div class="rblx-shell-panel-head">' +
                '<h2 class="rblx-shell-panel-title">Navigation</h2>' +
                '<button class="rblx-shell-toggle" type="button" id="rblxShellLeftToggle" aria-label="Toggle navigation">' + getToggleIcon() + '</button>' +
              "</div>" +
              '<div class="rblx-shell-nav-scroll" id="rblxShellNavScroll">' + buildNavMarkup() + "</div>" +
              '<div class="rblx-shell-left-foot">' +
                '<a class="rblx-shell-mini-banner" href="./subscriptions"><strong>Plus Plan</strong><span>$1.00 / month</span></a>' +
                '<div class="rblx-shell-socials">' +
                  '<a href="https://x.com/Reese28575571" target="_blank" rel="noreferrer" aria-label="X">' + getSocialIcon("x") + '</a>' +
                  '<a href="https://www.youtube.com/@ItzReeseRBLX" target="_blank" rel="noreferrer" aria-label="YouTube">' + getSocialIcon("youtube") + '</a>' +
                  '<a href="https://discord.gg/j5JbFdj47Q" target="_blank" rel="noreferrer" aria-label="Discord">' + getSocialIcon("discord") + '</a>' +
                  '<a href="https://www.twitch.tv/2muchreese" target="_blank" rel="noreferrer" aria-label="Twitch">' + getSocialIcon("twitch") + '</a>' +
                "</div>" +
              "</div>" +
            "</div>" +
          "</aside>" +
          '<main class="rblx-shell-center">' +
            '<div class="rblx-shell-page" id="rblxShellPage"></div>' +
          "</main>" +
          '<aside class="rblx-shell-right">' +
            '<div class="rblx-shell-right-inner">' +
              '<div class="rblx-shell-panel-head">' +
                '<h2 class="rblx-shell-panel-title">Community Chat</h2>' +
                '<button class="rblx-shell-toggle" type="button" id="rblxShellRightToggle" aria-label="Toggle chat">' + getToggleIcon() + '</button>' +
              "</div>" +
              '<div class="rblx-shell-chat-card">' +
                '<div class="rblx-shell-chat-room">' +
                  '<div class="rblx-shell-chat-room-label"><span class="rblx-shell-chat-live"></span><span>Live Chat</span></div>' +
                  '<div class="rblx-shell-chat-pills"><span class="rblx-shell-pill">Online</span></div>' +
                "</div>" +
              "</div>" +
              '<div class="rblx-shell-chat-specials" id="rblxShellChatSpecials" hidden></div>' +
              '<div class="rblx-shell-chat-rain-overlay" id="rblxShellChatRainOverlay" hidden></div>' +
              '<div class="rblx-shell-chat-scroll" id="rblxShellChatScroll"></div>' +
              '<div class="rblx-shell-chat-bottom" id="rblxShellChatBottom">' +
                '<div class="rblx-shell-chat-alert" id="rblxShellChatAlert" hidden><span id="rblxShellChatAlertText"></span></div>' +
                '<form class="rblx-shell-chat-compose" id="rblxShellChatForm">' +
                  '<input id="rblxShellChatInput" type="text" maxlength="160" placeholder="Enter a message..." />' +
                  '<div class="rblx-shell-chat-compose-actions">' +
                    '<button class="rblx-shell-chat-admin-button" type="button" id="rblxShellAdminButton" aria-label="Open admin panel" hidden>' + getNavIcon("shield") + '</button>' +
                    '<button class="rblx-shell-btn is-primary" type="submit" id="rblxShellChatSendButton">Send</button>' +
                  "</div>" +
                "</form>" +
                '<div class="rblx-shell-chat-foot">' +
                  '<a class="rblx-shell-chat-rules" href="#" id="rblxShellRulesLink">Chat Rules</a>' +
                  '<span class="rblx-shell-chat-online"><span class="rblx-shell-chat-online-dot"></span><span id="rblxShellOnlineCount">17</span></span>' +
                "</div>" +
              "</div>" +
            "</div>" +
          "</aside>" +
        "</div>" +
        '<div class="rblx-shell-profile-overlay" id="rblxShellProfileOverlay" aria-hidden="true">' +
          '<div class="rblx-shell-profile-modal" id="rblxShellProfileModal" role="dialog" aria-modal="true" aria-labelledby="rblxShellProfileName">' +
            '<button class="rblx-shell-profile-close" type="button" id="rblxShellProfileClose" aria-label="Close profile" style="position:absolute;top:10px;right:10px;left:auto;z-index:4;">X</button>' +
            '<div class="rblx-shell-profile-top">' +
              '<div class="rblx-shell-profile-avatar" id="rblxShellProfileAvatar">' +
                '<span class="rblx-shell-profile-avatar-fallback" id="rblxShellProfileAvatarFallback">R</span>' +
                '<img id="rblxShellProfileAvatarImage" alt="" />' +
              "</div>" +
              '<div class="rblx-shell-profile-copy">' +
                '<div class="rblx-shell-profile-title-row">' +
                  '<h3 class="rblx-shell-profile-name" id="rblxShellProfileName">Profile</h3>' +
                "</div>" +
              "</div>" +
              '<div class="rblx-shell-profile-bio">' +
                '<div class="rblx-shell-profile-bio-label">Bio</div>' +
                '<div class="rblx-shell-profile-bio-text" id="rblxShellProfileBio">No bio added yet.</div>' +
              "</div>" +
            "</div>" +
            '<div class="rblx-shell-profile-grid">' +
              '<div class="rblx-shell-profile-row"><span>Display Name</span><strong id="rblxShellProfileDisplayName">-</strong></div>' +
              '<div class="rblx-shell-profile-row"><span>User ID</span><strong id="rblxShellProfileUserId">-</strong></div>' +
              '<div class="rblx-shell-profile-row"><span>Plan</span><strong id="rblxShellProfilePlanValue">-</strong></div>' +
            "</div>" +
          "</div>" +
        "</div>" +
        '<div class="rblx-shell-site-lock" id="rblxShellSiteLock" aria-hidden="true">' +
          '<div class="rblx-shell-site-lock-card">' +
            '<div class="rblx-shell-site-lock-kicker">Website Locked</div>' +
            '<h3>Access Restricted</h3>' +
            '<p id="rblxShellSiteLockReason"></p>' +
          "</div>" +
        "</div>" +
        '<div class="rblx-shell-admin-window" id="rblxShellAdminWindow" hidden>' +
          '<div class="rblx-shell-admin-window-shell">' +
            '<div class="rblx-shell-admin-window-head" id="rblxShellAdminWindowHead">' +
              '<span>Admin Panel</span>' +
              '<button type="button" id="rblxShellAdminWindowClose" aria-label="Close admin panel">X</button>' +
            "</div>" +
            '<div class="rblx-shell-admin-window-body">' +
              '<iframe id="rblxShellAdminWindowFrame" src="./admin-panel" title="Admin Panel"></iframe>' +
            "</div>" +
            '<span class="rblx-shell-admin-resize handle-se" data-resize="se"></span>' +
            '<span class="rblx-shell-admin-resize handle-e" data-resize="e"></span>' +
            '<span class="rblx-shell-admin-resize handle-s" data-resize="s"></span>' +
            '<span class="rblx-shell-admin-resize handle-n" data-resize="n"></span>' +
            '<span class="rblx-shell-admin-resize handle-w" data-resize="w"></span>' +
            '<span class="rblx-shell-admin-resize handle-ne" data-resize="ne"></span>' +
            '<span class="rblx-shell-admin-resize handle-nw" data-resize="nw"></span>' +
            '<span class="rblx-shell-admin-resize handle-sw" data-resize="sw"></span>' +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function buildClaimDropMessage(message, drop) {
    var claimedCount = drop && Array.isArray(drop.claimedBy) ? drop.claimedBy.length : 0;
    var maxClaims = drop && drop.maxClaims ? drop.maxClaims : 0;
    var remainingClaims = Math.max(0, maxClaims - claimedCount);
    var currentPlan = String(shellState.currentUser && shellState.currentUser.plan || "").toLowerCase();
    var alreadyPlus = currentPlan === "plus";
    var expired = Boolean(drop && (drop.ended || new Date(drop.expiresAt).getTime() <= (Date.now() + (shellState.serverTimeOffset || 0))));
    var winnerLabel = claimedCount === 0 ? "No Winners" : (claimedCount === 1 ? "1 Winner" : claimedCount + " Winners");
    var buttonLabel = expired ? winnerLabel : (alreadyPlus ? "You Already Have Plus" : "Claim Plus");
    var buttonAttrs = (expired || alreadyPlus) ? ' disabled aria-disabled="true"' : "";
    var durationMs = Math.max(1, new Date(drop.expiresAt).getTime() - new Date(drop.createdAt || drop.expiresAt).getTime());
    var remainingMs = Math.max(0, new Date(drop.expiresAt).getTime() - (Date.now() + (shellState.serverTimeOffset || 0)));
    var progressPercent = Math.max(0, Math.min(100, (remainingMs / durationMs) * 100));

    return (
      '<div class="rblx-shell-drop-message">' +
        '<div class="rblx-shell-drop-glare" aria-hidden="true"></div>' +
        '<div class="rblx-shell-drop-burst" aria-hidden="true">' + buildPlusBurstMarkup("rblx-shell-drop-plus", 16) + "</div>" +
        '<div class="rblx-shell-drop-head">' +
          '<div class="rblx-shell-drop-kicker">Claimable Plus Drop</div>' +
          '<div class="rblx-shell-drop-chip' + (expired ? ' is-expired' : '') + '">' + (expired ? "Expired" : ("Ends In " + escapeHtml(formatCountdownTo(drop.expiresAt)))) + "</div>" +
        "</div>" +
        '<div class="rblx-shell-drop-title">' + escapeHtml(drop.title || "Claim Free Plus") + "</div>" +
        '<div class="rblx-shell-event-progress"><span class="rblx-shell-event-progress-fill" style="width:' + progressPercent.toFixed(2) + '%;"></span></div>' +
        '<div class="rblx-shell-drop-meta"><span>' + escapeHtml(String(remainingClaims)) + ' claims left</span><span>' + escapeHtml(String(drop.days || 0)) + ' Plus days</span></div>' +
        '<div class="rblx-shell-drop-actions"><button class="rblx-shell-drop-btn" type="button" data-special-action="claim-drop"' + buttonAttrs + ">" + escapeHtml(buttonLabel) + "</button></div>" +
      "</div>"
    );
  }

  function renderChatMessages(target, messages, options) {
    var settings = options || {};
    var previousScrollTop = target.scrollTop;
    var previousScrollHeight = target.scrollHeight;
    var previousClientHeight = target.clientHeight;
    var distanceFromBottom = previousScrollHeight - (previousScrollTop + previousClientHeight);
    var shouldStickToBottom = Boolean(settings.forceBottom || distanceFromBottom <= 24);

    shellState.chatMessages = Array.isArray(messages) ? messages : [];
    shellState.profileCache = [];
    target.innerHTML = shellState.chatMessages.map(function (message, index) {
      var profile = getMessageProfile(message);
      shellState.profileCache[index] = profile;
      if (message && message.specialType === "toolActivity") {
        var actorName = resolveToolActivityActor(message, profile.displayName || "Guest");
        var toolName = message.text || "Tool";
        var relativeTime = formatRelativeTimeSince(message.createdAt);
        return (
          '<article class="rblx-shell-chat-activity-pill-row" data-chat-index="' + index + '">' +
            '<span class="rblx-shell-chat-activity-pill">' + escapeHtml(actorName) + " used " + escapeHtml(toolName) + " â€¢ " + escapeHtml(relativeTime) + "</span>" +
          "</article>"
        );
      }
      var isPlus = profile.plan === "plus" || String(profile.badge || "").toLowerCase() === "plus";
      var isSystem = Boolean(profile.system);
      var isTimedOut = Boolean(profile.moderationTimeoutUntil && new Date(profile.moderationTimeoutUntil).getTime() > Date.now());
      var avatarMarkup = profile.avatarUrl
        ? '<img class="rblx-shell-chat-avatar-image" src="' + escapeHtml(profile.avatarUrl) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\';" />' +
          '<span class="rblx-shell-chat-avatar-fallback" style="display:none;">' + escapeHtml(profile.avatarText) + "</span>"
        : '<span class="rblx-shell-chat-avatar-fallback">' + escapeHtml(profile.avatarText) + "</span>";
      var badgeMarkup = isPlus ? "Plus" : escapeHtml(profile.badge);
      var nameClass = isPlus ? ' class="rblx-shell-chat-name-text is-plus"' : ' class="rblx-shell-chat-name-text"';
      var messageBody = message && message.specialType === "claimDrop" && message.claimDrop
        ? buildClaimDropMessage(message, message.claimDrop)
        : '<div class="rblx-shell-chat-text">' + escapeHtml(message.text) + "</div>";

        return (
        '<article class="rblx-shell-chat-message' + (isSystem ? ' is-system' : '') + '" data-chat-index="' + index + '">' +
          (isTimedOut
            ? '<span class="rblx-shell-chat-timeout-flag" aria-hidden="true"><span class="rblx-shell-chat-timeout-icon">!</span><span class="rblx-shell-chat-timeout-tip">Timed out: ' + escapeHtml(profile.moderationTimeoutReason || "No reason given") + ' | ' + escapeHtml(formatRemainingDuration(new Date(profile.moderationTimeoutUntil).getTime() - Date.now())) + " left</span></span>"
            : "") +
          '<button class="rblx-shell-chat-avatar-button" type="button" data-chat-action="profile" data-chat-index="' + index + '" aria-label="Open profile for ' + escapeHtml(profile.displayName) + '">' +
            '<span class="rblx-shell-chat-avatar' + (profile.avatarUrl ? ' has-image' : '') + '">' + avatarMarkup + "</span>" +
          "</button>" +
          '<div>' +
            '<div class="rblx-shell-chat-name">' +
              '<button class="rblx-shell-chat-name-button" type="button" data-chat-action="profile" data-chat-index="' + index + '">' +
                '<span class="rblx-shell-chat-badge' + (isPlus ? ' is-plus' : '') + '">' + badgeMarkup + '</span>' +
                (isPlus ? '<span class="rblx-shell-chat-plus-mark">+</span>' : "") +
                '<span' + nameClass + '>' + escapeHtml(profile.displayName) + "</span>" +
              "</button>" +
            "</div>" +
            messageBody +
          "</div>" +
        "</article>"
        );
      }).join("");
    if (shouldStickToBottom) {
      target.scrollTop = target.scrollHeight;
    } else {
      var nextScrollHeight = target.scrollHeight;
      var heightDelta = nextScrollHeight - previousScrollHeight;
      target.scrollTop = previousScrollTop + Math.max(0, heightDelta);
    }
    updateChatMessageRefresh();
  }

  function buildProfilePlusFloats() {
    var specs = [
      ["6%", "12%", "14px", "7.2s", "-1.4s", "0.22"],
      ["16%", "22%", "18px", "8.1s", "-3.0s", "0.18"],
      ["28%", "8%", "12px", "6.4s", "-2.2s", "0.14"],
      ["40%", "18%", "16px", "7.8s", "-0.8s", "0.20"],
      ["54%", "10%", "20px", "9.2s", "-4.1s", "0.16"],
      ["66%", "24%", "13px", "6.9s", "-2.7s", "0.12"],
      ["78%", "14%", "17px", "8.8s", "-1.0s", "0.19"],
      ["88%", "30%", "15px", "7.1s", "-3.6s", "0.15"],
      ["10%", "42%", "13px", "6.8s", "-1.9s", "0.13"],
      ["22%", "54%", "21px", "9.0s", "-4.6s", "0.17"],
      ["34%", "46%", "14px", "7.5s", "-2.4s", "0.21"],
      ["48%", "58%", "18px", "8.4s", "-0.5s", "0.16"],
      ["62%", "48%", "12px", "6.6s", "-3.3s", "0.11"],
      ["74%", "60%", "19px", "8.9s", "-2.1s", "0.18"],
      ["86%", "50%", "15px", "7.4s", "-4.0s", "0.14"],
      ["94%", "44%", "13px", "6.3s", "-1.2s", "0.12"],
      ["8%", "70%", "16px", "8.0s", "-3.8s", "0.19"],
      ["20%", "82%", "12px", "6.5s", "-2.0s", "0.10"],
      ["32%", "76%", "18px", "8.6s", "-4.4s", "0.20"],
      ["46%", "86%", "14px", "7.0s", "-1.7s", "0.15"],
      ["58%", "74%", "20px", "9.4s", "-3.2s", "0.17"],
      ["70%", "84%", "13px", "6.7s", "-0.9s", "0.12"],
      ["82%", "72%", "17px", "8.3s", "-2.9s", "0.18"],
      ["92%", "88%", "15px", "7.6s", "-4.8s", "0.14"],
      ["14%", "94%", "12px", "6.2s", "-1.5s", "0.11"],
      ["38%", "96%", "16px", "8.7s", "-3.7s", "0.16"],
      ["64%", "92%", "18px", "9.1s", "-2.6s", "0.19"],
      ["76%", "96%", "13px", "6.9s", "-4.3s", "0.13"]
    ];

    return specs.map(function (spec) {
      return (
        '<span class="rblx-shell-profile-plus-float" style="' +
        '--float-left:' + spec[0] + ';' +
        '--float-top:' + spec[1] + ';' +
        '--float-size:' + spec[2] + ';' +
        '--float-duration:' + spec[3] + ';' +
        '--float-delay:' + spec[4] + ';' +
        '--float-opacity:' + spec[5] + ';' +
        '">+</span>'
      );
    }).join("");
  }

  function openProfileModal(message, anchorEl) {
    var index = message && message.__chatIndex != null ? Number(message.__chatIndex) : -1;
    if (!shellState.currentProfile || !shellState.currentProfile.displayName) {
      refreshCurrentProfile();
    }
    var profile = index >= 0 && shellState.profileCache[index] ? shellState.profileCache[index] : getMessageProfile(message);
    var isPlus = profile.plan === "plus" || String(profile.badge || "").toLowerCase() === "plus";

    shellState.profileAvatar.classList.toggle("has-image", Boolean(profile.avatarUrl));
    if (profile.avatarUrl) {
      shellState.profileAvatarImage.src = profile.avatarUrl;
      shellState.profileAvatarImage.style.display = "block";
      shellState.profileAvatarFallback.style.display = "none";
      shellState.profileAvatarImage.onerror = function () {
        shellState.profileAvatarImage.style.display = "none";
        shellState.profileAvatarFallback.style.display = "flex";
        shellState.profileAvatarFallback.textContent = profile.avatarText || getInitials(profile.displayName);
        shellState.profileAvatar.classList.remove("has-image");
      };
    } else {
      shellState.profileAvatarImage.removeAttribute("src");
      shellState.profileAvatarImage.style.display = "none";
      shellState.profileAvatarFallback.style.display = "flex";
      shellState.profileAvatarFallback.textContent = profile.avatarText || getInitials(profile.displayName);
    }

    shellState.profileName.classList.toggle("is-plus", isPlus);
    shellState.profileModal.classList.toggle("is-plus", isPlus);
    shellState.profileName.textContent = profile.displayName || "Profile";
    shellState.profileUserId.textContent = profile.userId || "-";
    shellState.profileDisplayName.textContent = profile.displayName || "-";
    if (shellState.profileBio) {
      shellState.profileBio.textContent = profile.bio || "No bio added yet.";
      shellState.profileBio.classList.toggle("is-empty", !profile.bio);
    }
    shellState.profileUserId.textContent = profile.userId || "N/A";
    if (shellState.profilePlanValue) {
      shellState.profilePlanValue.textContent = profile.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : "Free";
    }

    shellState.profileOverlay.classList.add("is-open");
    shellState.profileOverlay.setAttribute("aria-hidden", "false");

    if (anchorEl && typeof anchorEl.getBoundingClientRect === "function") {
      var rect = anchorEl.getBoundingClientRect();
      shellState.profileModal.style.setProperty("--profile-anchor-x", Math.round(rect.left + rect.width / 2) + "px");
      shellState.profileModal.style.setProperty("--profile-anchor-y", Math.round(rect.top + rect.height / 2) + "px");
    }
  }

  function closeProfileModal() {
    if (!shellState.profileOverlay) return;
    shellState.profileOverlay.classList.remove("is-open");
    shellState.profileOverlay.setAttribute("aria-hidden", "true");
  }

  function syncChatIdentity() {
    if (!shellState.chatList || !shellState.chatMessages.length) return;
          renderChatMessages(shellState.chatList, shellState.chatMessages);
  }

  function initChat() {
    var list = document.getElementById("rblxShellChatScroll");
    var form = document.getElementById("rblxShellChatForm");
    var input = document.getElementById("rblxShellChatInput");
    var sendButton = document.getElementById("rblxShellChatSendButton");
    var adminButton = document.getElementById("rblxShellAdminButton");
    var chatAlert = document.getElementById("rblxShellChatAlert");
    var chatAlertText = document.getElementById("rblxShellChatAlertText");
    var chatSpecials = document.getElementById("rblxShellChatSpecials");
    var chatBottom = document.getElementById("rblxShellChatBottom");
    var chatRainOverlay = document.getElementById("rblxShellChatRainOverlay");
    if (!list || !form || !input || !sendButton) return;

    shellState.chatList = list;
    shellState.chatInput = input;
    shellState.chatSendButton = sendButton;
    shellState.chatAdminButton = adminButton;
    shellState.chatAlert = chatAlert;
    shellState.chatAlertText = chatAlertText;
    shellState.chatSpecials = chatSpecials;
    shellState.chatBottom = chatBottom;
    shellState.chatRainOverlay = chatRainOverlay;
    if (shellState.chatAdminButton) {
      shellState.chatAdminButton.hidden = true;
      shellState.chatAdminButton.style.display = "none";
    }
    renderChatMessages(list, starterMessages, { forceBottom: true });

    if (shellState.chatSpecials) {
      shellState.chatSpecials.addEventListener("click", function (event) {
        var button = event.target && event.target.closest ? event.target.closest("[data-special-action]") : null;
        if (!button || !shellState.socket || !shellState.socketReady) return;
        var action = button.getAttribute("data-special-action") || "";
        if (action === "claim-drop") {
          shellState.socket.emit("claim-plus-drop");
        } else if (action === "join-rain") {
          shellState.socket.emit("join-chat-rain");
        }
      });
    }

    list.addEventListener("click", function (event) {
      var specialButton = event.target && event.target.closest ? event.target.closest("[data-special-action]") : null;
      if (specialButton && shellState.socket && shellState.socketReady) {
        var specialAction = specialButton.getAttribute("data-special-action") || "";
        if (specialAction === "claim-drop") {
          event.preventDefault();
          shellState.socket.emit("claim-plus-drop");
          return;
        }
      }

      var target = event.target;
      var button = target && target.closest ? target.closest("[data-chat-action='profile']") : null;
      if (!button) return;

      var index = Number(button.getAttribute("data-chat-index"));
      if (!isFinite(index) || index < 0 || index >= shellState.chatMessages.length) return;
      var message = shellState.chatMessages[index];
      message.__chatIndex = index;
      openProfileModal(message, button);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = input.value.trim();
      if (!value) return;
      if (!shellState.socket || !shellState.socketReady) return;
      shellState.socket.emit("chat-message", {
        text: value,
        displayName: getSocketChatIdentity().displayName,
        username: getSocketChatIdentity().username,
        avatarUrl: getSocketChatIdentity().avatarUrl,
        bio: getSocketChatIdentity().bio,
        plan: getSocketChatIdentity().plan,
        isPlus: getSocketChatIdentity().isPlus,
        isGuest: getSocketChatIdentity().isGuest
      });
      input.value = "";
    });
  }

  function initRulesLink() {
    var link = document.getElementById("rblxShellRulesLink");
    if (!link) return;
    link.addEventListener("click", function (event) {
      event.preventDefault();
      window.alert(
        "RBLXTools Chat Rules\n\n" +
        "1. Keep it respectful.\n" +
        "2. No harassment or hate speech.\n" +
        "3. No spam, scams, or malicious links.\n" +
        "4. Keep the chat related to Roblox tools or creator help.\n" +
        "5. Repeated rule breaking may lead to chat removal later."
      );
    });
  }

  function connectChatSocket() {
    loadSocketScript().then(function () {
      if (!window.io) return;

      if (shellState.socket) {
        try { shellState.socket.disconnect(); } catch (_error) {}
      }

      shellState.socket = window.io(API_BASE, {
        transports: ["websocket", "polling"]
      });

      shellState.socket.on("connect", function () {
        shellState.socketReady = true;
        shellState.socket.emit("join-room", getSocketChatIdentity());
      });

      shellState.socket.on("disconnect", function () {
        shellState.socketReady = false;
      });

      shellState.socket.on("chat-history", function (history) {
        var messages = Array.isArray(history) ? history.filter(function (message) {
          return !(message && message.specialType === "toolActivity");
        }) : [];
        renderChatMessages(shellState.chatList, messages, { forceBottom: true });
      });

      shellState.socket.on("chat-message", function (message) {
        if (message && message.specialType === "toolActivity") {
          return;
        }
        var nextMessages = shellState.chatMessages.slice();
        nextMessages.push(message);
        nextMessages = nextMessages.slice(-80);
        renderChatMessages(shellState.chatList, nextMessages, { forceBottom: true });
      });

      shellState.socket.on("room-users", function (users) {
        shellState.onlineCount = Array.isArray(users) ? users.length : 0;
        var onlineEl = document.getElementById("rblxShellOnlineCount");
        if (onlineEl) onlineEl.textContent = String(shellState.onlineCount || 0);
      });

      shellState.socket.on("room-specials", function (specials) {
        shellState.roomSpecials = specials || null;
        shellState.serverTimeOffset = specials && specials.serverNow
          ? (new Date(specials.serverNow).getTime() - Date.now())
          : 0;
        renderRoomSpecials();
      });

      shellState.socket.on("moderation-state", function (moderation) {
        applyModerationState(moderation);
      });

      shellState.socket.on("membership-state", function (payload) {
        applyMembershipPayload(payload);
      });

      shellState.socket.on("special-action-result", function (result) {
        if (!result) return;
        if (result.ok === true && (result.type === "claim-drop" || result.type === "chat-rain") && result.awarded && shellState.currentUser) {
          applyMembershipPayload({
            user: Object.assign({}, getCachedAuthUser() || {}, {
              id: shellState.currentUser.userId || "",
              username: shellState.currentUser.username || "",
              plan: "plus",
              premiumActive: true
            })
          });
          if (shellState.chatList) {
            renderChatMessages(shellState.chatList, shellState.chatMessages);
          }
          return;
        }
        if (result.ok !== false) return;
        if (result.type === "site-blacklist" || result.type === "chat-ban" || result.type === "chat-timeout") {
          setChatComposeState(true, result.error || "Chat unavailable", result.error || "Chat unavailable");
          if (result.type === "chat-timeout" && result.expiresAt) {
            applyModerationState({
              websiteBlacklisted: false,
              chatBanned: false,
              chatTimeoutUntil: result.expiresAt
            });
          } else if (result.type === "chat-ban") {
            applyModerationState({
              websiteBlacklisted: false,
              chatBanned: true,
              chatBanReason: result.error || "You are chat banned."
            });
          } else if (result.type === "site-blacklist") {
            applyModerationState({
              websiteBlacklisted: true,
              websiteBlacklistReason: result.error || "This browser is blocked from using the website."
            });
          }
        }
      });
    }).catch(function () {
      renderChatMessages(shellState.chatList, starterMessages, { forceBottom: true });
      setChatComposeState(true, "Live chat unavailable", "Live chat unavailable");
    });
  }

  function openAdminWindow() {
    if (!shellState.adminWindow) return;
    shellState.adminWindow.hidden = false;
    shellState.adminWindow.classList.add("is-open");
    window.requestAnimationFrame(function () {
      window.dispatchEvent(new Event("resize"));
    });
  }

  function closeAdminWindow() {
    if (!shellState.adminWindow) return;
    shellState.adminWindow.classList.remove("is-open");
    shellState.adminWindow.hidden = true;
  }

  function initAdminWindow() {
    shellState.adminWindow = document.getElementById("rblxShellAdminWindow");
    shellState.adminWindowFrame = document.getElementById("rblxShellAdminWindowFrame");
    shellState.adminWindowClose = document.getElementById("rblxShellAdminWindowClose");
    shellState.siteLockOverlay = document.getElementById("rblxShellSiteLock");
    shellState.siteLockReason = document.getElementById("rblxShellSiteLockReason");

    if (shellState.adminWindowClose) {
      shellState.adminWindowClose.addEventListener("click", closeAdminWindow);
    }

    var shellEl = shellState.adminWindow && shellState.adminWindow.querySelector(".rblx-shell-admin-window-shell");
    var headEl = document.getElementById("rblxShellAdminWindowHead");
    if (!shellEl || !headEl) return;

    var activeInteraction = null;
    var activePointerId = null;
    var captureNode = null;

    function getMinWidth() {
      return Math.min(520, Math.max(360, window.innerWidth - 16));
    }

    function getMinHeight() {
      return Math.min(420, Math.max(300, window.innerHeight - 24));
    }

    function getViewportBounds() {
      return {
        left: 8,
        top: 8,
        right: Math.max(8, window.innerWidth - 8),
        bottom: Math.max(8, window.innerHeight - 8)
      };
    }

    function getShellRect() {
      var rect = shellEl.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
    }

    function clampRect(rect) {
      var bounds = getViewportBounds();
      var minWidth = getMinWidth();
      var minHeight = getMinHeight();
      var maxWidth = Math.max(minWidth, bounds.right - bounds.left);
      var maxHeight = Math.max(minHeight, bounds.bottom - bounds.top);
      var next = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };

      next.width = Math.max(minWidth, Math.min(next.width, maxWidth));
      next.height = Math.max(minHeight, Math.min(next.height, maxHeight));
      next.left = Math.max(bounds.left, Math.min(next.left, bounds.right - next.width));
      next.top = Math.max(bounds.top, Math.min(next.top, bounds.bottom - next.height));

      return next;
    }

    function applyRect(rect) {
      var next = clampRect(rect);
      shellEl.style.left = Math.round(next.left) + "px";
      shellEl.style.top = Math.round(next.top) + "px";
      shellEl.style.width = Math.round(next.width) + "px";
      shellEl.style.height = Math.round(next.height) + "px";
    }

    function stopInteraction() {
      if (captureNode && activePointerId != null && captureNode.releasePointerCapture) {
        try { captureNode.releasePointerCapture(activePointerId); } catch (_error) {}
      }
      captureNode = null;
      activePointerId = null;
      activeInteraction = null;
      shellEl.classList.remove("is-dragging", "is-resizing");
      document.body.classList.remove("rblx-shell-admin-active");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", stopInteraction);
    }

    function onPointerMove(event) {
      if (!activeInteraction || activePointerId !== event.pointerId) return;
      var dx = event.clientX - activeInteraction.startX;
      var dy = event.clientY - activeInteraction.startY;
      var rect = {
        left: activeInteraction.startRect.left,
        top: activeInteraction.startRect.top,
        width: activeInteraction.startRect.width,
        height: activeInteraction.startRect.height
      };
      var mode = activeInteraction.mode;

      if (mode === "drag") {
        rect.left += dx;
        rect.top += dy;
        applyRect(rect);
        return;
      }

      if (mode.indexOf("e") !== -1) {
        rect.width = activeInteraction.startRect.width + dx;
      }
      if (mode.indexOf("s") !== -1) {
        rect.height = activeInteraction.startRect.height + dy;
      }
      if (mode.indexOf("w") !== -1) {
        rect.width = activeInteraction.startRect.width - dx;
        rect.left = activeInteraction.startRect.left + dx;
      }
      if (mode.indexOf("n") !== -1) {
        rect.height = activeInteraction.startRect.height - dy;
        rect.top = activeInteraction.startRect.top + dy;
      }

      rect = clampRect(rect);

      if (mode.indexOf("w") !== -1) {
        rect.left = activeInteraction.startRect.right - rect.width;
      }
      if (mode.indexOf("n") !== -1) {
        rect.top = activeInteraction.startRect.bottom - rect.height;
      }

      applyRect(rect);
    }

    function onPointerUp(event) {
      if (activePointerId !== event.pointerId) return;
      stopInteraction();
    }

    function startInteraction(mode, event, node) {
      if (event.button !== 0) return;
      stopInteraction();
      var startRect = getShellRect();
      activeInteraction = {
        mode: mode,
        startX: event.clientX,
        startY: event.clientY,
        startRect: {
          left: startRect.left,
          top: startRect.top,
          width: startRect.width,
          height: startRect.height,
          right: startRect.left + startRect.width,
          bottom: startRect.top + startRect.height
        }
      };
      activePointerId = event.pointerId;
      captureNode = node || event.currentTarget || null;
      if (captureNode && captureNode.setPointerCapture) {
        try { captureNode.setPointerCapture(activePointerId); } catch (_error) {}
      }
      shellEl.classList.toggle("is-dragging", mode === "drag");
      shellEl.classList.toggle("is-resizing", mode !== "drag");
      document.body.classList.add("rblx-shell-admin-active");
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      window.addEventListener("blur", stopInteraction);
      event.preventDefault();
      event.stopPropagation();
    }

    headEl.addEventListener("pointerdown", function (event) {
      if (event.target && event.target.closest && event.target.closest("button")) return;
      startInteraction("drag", event, headEl);
    });

    Array.prototype.slice.call(shellEl.querySelectorAll("[data-resize]")).forEach(function (handle) {
      handle.addEventListener("pointerdown", function (event) {
        startInteraction(handle.getAttribute("data-resize") || "", event, handle);
      });
    });

    window.addEventListener("resize", function () {
      applyRect(getShellRect());
    });

    if (shellState.adminWindow) {
      shellState.adminWindow.addEventListener("transitionend", function () {
        applyRect(getShellRect());
      });
    }
  }

  function initProfileOverlay() {
    shellState.profileOverlay = document.getElementById("rblxShellProfileOverlay");
    shellState.profileModal = document.getElementById("rblxShellProfileModal");
    shellState.profileAvatar = document.getElementById("rblxShellProfileAvatar");
    shellState.profileAvatarImage = document.getElementById("rblxShellProfileAvatarImage");
    shellState.profileAvatarFallback = document.getElementById("rblxShellProfileAvatarFallback");
    shellState.profilePlusMark = document.getElementById("rblxShellProfilePlusMark");
    shellState.profileName = document.getElementById("rblxShellProfileName");
    shellState.profilePlan = document.getElementById("rblxShellProfilePlan");
    shellState.profileUserId = document.getElementById("rblxShellProfileUserId");
    shellState.profileDisplayName = document.getElementById("rblxShellProfileDisplayName");
    shellState.profilePlanValue = document.getElementById("rblxShellProfilePlanValue");
    shellState.profileBio = document.getElementById("rblxShellProfileBio");
    shellState.profileClose = document.getElementById("rblxShellProfileClose");

    if (shellState.profileModal && !shellState.profileModal.querySelector(".rblx-shell-profile-pluses")) {
      var plusLayer = document.createElement("div");
      plusLayer.className = "rblx-shell-profile-pluses";
      plusLayer.setAttribute("aria-hidden", "true");
      plusLayer.innerHTML = buildProfilePlusFloats();
      shellState.profileModal.insertBefore(plusLayer, shellState.profileModal.firstChild);
    }

    if (!shellState.profilePlusMark && shellState.profileName && shellState.profileName.parentNode) {
      shellState.profilePlusMark = document.createElement("span");
      shellState.profilePlusMark.className = "rblx-shell-profile-plus-mark";
      shellState.profilePlusMark.id = "rblxShellProfilePlusMark";
      shellState.profilePlusMark.textContent = "+";
      shellState.profileName.parentNode.insertBefore(shellState.profilePlusMark, shellState.profileName);
    }

    if (shellState.profileClose) {
      shellState.profileClose.addEventListener("click", closeProfileModal);
    }

    if (shellState.profileOverlay) {
      shellState.profileOverlay.addEventListener("click", function (event) {
        if (event.target === shellState.profileOverlay) {
          closeProfileModal();
        }
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeProfileModal();
      }
    });
  }

  function applyCollapsedState(body) {
    var leftCollapsed = Boolean(readStorage(LEFT_STATE_KEY, false));
    var rightCollapsed = Boolean(readStorage(RIGHT_STATE_KEY, false));
    body.classList.toggle("rblx-shell-left-collapsed", leftCollapsed);
    body.classList.toggle("rblx-shell-right-collapsed", rightCollapsed);
  }

  function initToggles() {
    var leftToggle = document.getElementById("rblxShellLeftToggle");
    var rightToggle = document.getElementById("rblxShellRightToggle");
    if (leftToggle) {
      leftToggle.addEventListener("click", function () {
        var next = !document.body.classList.contains("rblx-shell-left-collapsed");
        document.body.classList.toggle("rblx-shell-left-collapsed", next);
        writeStorage(LEFT_STATE_KEY, next);
      });
    }
    if (rightToggle) {
      rightToggle.addEventListener("click", function () {
        var next = !document.body.classList.contains("rblx-shell-right-collapsed");
        document.body.classList.toggle("rblx-shell-right-collapsed", next);
        writeStorage(RIGHT_STATE_KEY, next);
      });
    }
  }
  function updateAuthUi(state) {
    var auth = document.getElementById("rblxShellAuth");
    var status = document.getElementById("rblxShellStatus");
    var statusText = document.getElementById("rblxShellStatusText");
    if (!auth || !status || !statusText) return;

    status.setAttribute("data-plan", state.plan);
    statusText.textContent = state.message;
    shellState.currentUser = {
      loggedIn: Boolean(state.loggedIn),
      plan: state.plan || "guest",
      message: state.message || "",
      userId: state.userId || "",
      username: state.username || "",
      displayName: state.displayName || ""
    };
    var navScroll = document.getElementById("rblxShellNavScroll");
    if (navScroll) navScroll.innerHTML = buildNavMarkup();
    shellState.isAdmin = Boolean(state.isAdmin);
    refreshCurrentProfile();
    syncChatIdentity();
    applyModerationState(state.moderation || shellState.moderation);

    if (state.loggedIn) {
      auth.innerHTML = state.plan === "plus"
        ? '<a class="rblx-shell-btn" href="./account-overview">Account</a>' +
          '<button class="rblx-shell-btn" type="button" id="rblxShellLogout">Log Out</button>'
        : '<a class="rblx-shell-btn" href="./account-overview">Account</a>' +
          '<a class="rblx-shell-btn is-primary" href="./subscriptions">View Plans</a>' +
          '<button class="rblx-shell-btn" type="button" id="rblxShellLogout">Log Out</button>';

      var logout = document.getElementById("rblxShellLogout");
      if (logout) {
        logout.addEventListener("click", function () {
          try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(PLUS_STATUS_KEY);
          } catch (_error) {}
          window.location.reload();
        });
      }
      if (shellState.chatAdminButton) {
        shellState.chatAdminButton.hidden = !shellState.isAdmin;
        shellState.chatAdminButton.style.display = shellState.isAdmin ? "inline-flex" : "none";
      }
      return;
    }

    auth.innerHTML =
      '<a class="rblx-shell-btn is-primary" href="./login">Login / Sign Up</a>';
    if (shellState.chatAdminButton) {
      shellState.chatAdminButton.hidden = true;
      shellState.chatAdminButton.style.display = "none";
    }
  }

  function hasPlusFromPayload(payload) {
    if (!payload || typeof payload !== "object") return false;
    return Boolean(
      payload.plus === true || payload.isPlus === true || payload.hasPlus === true ||
      payload.premiumActive === true || payload.plusActive === true ||
      payload.subscription === "plus" || payload.plan === "plus" ||
      payload.tier === "plus" ||
      (payload.user && (
        payload.user.premiumActive === true ||
        payload.user.plus === true ||
        payload.user.isPlus === true ||
        payload.user.plan === "plus"
      ))
    );
  }

  function buildUserStateFromPayload(payload, moderationOverride) {
    var user = payload && payload.user ? payload.user : payload;
    if (!user || typeof user !== "object") return null;

    var plus = hasPlusFromPayload(payload) || hasPlusFromPayload(user);
    var displayName = getPreferredUserName(user, payload);
    return {
      loggedIn: true,
      plan: plus ? "plus" : "free",
      message: plus
        ? "You are browsing this website as a Plus subscriber. Thank you for your support" + (displayName ? ", " + displayName : "") + "."
        : "You are browsing this website as a free plan user" + (displayName ? ", " + displayName : "") + ".",
      userId: user && user.id ? String(user.id) : "",
      username: user && user.username ? String(user.username) : "",
      displayName: displayName,
      isAdmin: Boolean(user && user.isAdmin),
      moderation: moderationOverride || (payload && payload.moderation ? payload.moderation : shellState.moderation)
    };
  }

  function applyMembershipPayload(payload) {
    var nextState = buildUserStateFromPayload(payload, null);
    if (!nextState) return;
    if (shellState.currentUser && shellState.currentUser.userId && nextState.userId && String(shellState.currentUser.userId) !== String(nextState.userId)) {
      return;
    }

    var user = payload && payload.user ? payload.user : payload;
    var cachedUser = getCachedAuthUser() || {};
    var mergedUser = Object.assign({}, cachedUser, user || {});
    saveCachedAuthUser(mergedUser);
    writeCachedPlusStatus(nextState.plan === "plus");
    updateAuthUi(nextState);
    if (shellState.socket && shellState.socketReady) {
      shellState.socket.emit("join-room", getSocketChatIdentity());
    }
    dispatchMembershipUpdate({
      user: mergedUser,
      plan: nextState.plan,
      premiumActive: nextState.plan === "plus"
    });
  }

  function getImmediateUserState() {
    var token = getToken();
    var cachedUser = getCachedAuthUser();
    if (!token || !cachedUser) {
      return {
        loggedIn: false,
        plan: "guest",
        message: "You are browsing this website as a guest.",
        userId: getGuestHash(),
        username: "",
        displayName: "Guest",
        isAdmin: false,
        moderation: shellState.moderation
      };
    }

    var displayName = getPreferredUserName(cachedUser, cachedUser);
    var plus = hasPlusFromPayload(cachedUser);
    return {
      loggedIn: true,
      plan: plus ? "plus" : "free",
      message: plus
        ? "You are browsing this website as a Plus subscriber. Thank you for your support" + (displayName ? ", " + displayName : "") + "."
        : "You are browsing this website as a free plan user" + (displayName ? ", " + displayName : "") + ".",
      userId: cachedUser && cachedUser.id ? String(cachedUser.id) : "",
      username: cachedUser && cachedUser.username ? String(cachedUser.username) : "",
      displayName: displayName,
      isAdmin: Boolean(cachedUser && cachedUser.isAdmin),
      moderation: shellState.moderation
    };
  }

  async function resolveUserState() {
    var token = getToken();
    var cachedUser = getCachedAuthUser();
    if (!token) {
      var guestHash = getGuestHash();
      saveCachedAuthUser(null);
      return {
        loggedIn: false,
        plan: "guest",
        message: "You are browsing this website as a guest.",
        userId: guestHash,
        username: "",
        displayName: "Guest",
        isAdmin: false,
        moderation: shellState.moderation
      };
    }

    var displayName = "";
    var plus = false;

    try {
      var premiumResponse = await fetch(API_BASE + "/auth/premium-status", {
        method: "GET",
        headers: { Authorization: "Bearer " + token }
      });
      if (premiumResponse.ok) {
        plus = hasPlusFromPayload(await premiumResponse.json().catch(function () { return null; }));
      }
    } catch (_error) {}

    try {
      var response = await fetch(API_BASE + "/auth/me", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token,
          "X-RBLX-Device-Id": shellState.deviceId || getDeviceId()
        }
      });

      if (!response.ok) throw new Error("Not signed in");
      var payload = await response.json().catch(function () { return null; });
      var user = payload && payload.user ? payload.user : payload;
      saveCachedAuthUser(user);
      displayName = getPreferredUserName(user, payload);
      plus = plus || hasPlusFromPayload(payload) || hasPlusFromPayload(user);
      return {
        loggedIn: true,
        plan: plus ? "plus" : "free",
        message: plus
          ? "You are browsing this website as a Plus subscriber. Thank you for your support" + (displayName ? ", " + displayName : "") + "."
          : "You are browsing this website as a free plan user" + (displayName ? ", " + displayName : "") + ".",
        userId: user && user.id ? String(user.id) : "",
        username: user && user.username ? String(user.username) : "",
        displayName: displayName,
        isAdmin: Boolean(user && user.isAdmin),
        moderation: payload && payload.moderation ? payload.moderation : null
      };
    } catch (_error2) {
      if (cachedUser) {
        displayName = getPreferredUserName(cachedUser, cachedUser);
        plus = plus || hasPlusFromPayload(cachedUser);
        return {
          loggedIn: true,
          plan: plus ? "plus" : "free",
          message: plus
            ? "You are browsing this website as a Plus subscriber. Thank you for your support" + (displayName ? ", " + displayName : "") + "."
            : "You are browsing this website as a free plan user" + (displayName ? ", " + displayName : "") + ".",
          userId: cachedUser && cachedUser.id ? String(cachedUser.id) : "",
          username: cachedUser && cachedUser.username ? String(cachedUser.username) : "",
          displayName: displayName,
          isAdmin: Boolean(cachedUser && cachedUser.isAdmin),
          moderation: shellState.moderation
        };
      }
      var fallbackGuestHash = getGuestHash();
      return {
        loggedIn: false,
        plan: "guest",
        message: "You are browsing this website as a guest.",
        userId: fallbackGuestHash,
        username: "",
        displayName: "Guest",
        isAdmin: false,
        moderation: shellState.moderation
      };
    }
  }

  function loadPublicModerationState() {
    return fetch(API_BASE + "/auth/device-status", {
      method: "GET",
      headers: {
        "X-RBLX-Device-Id": shellState.deviceId || getDeviceId()
      }
    }).then(function (response) {
      return response.json().catch(function () { return null; });
    }).then(function (payload) {
      if (payload && payload.moderation) {
        applyModerationState(payload.moderation);
      }
    }).catch(function () {
      return null;
    });
  }

  function movePageContent(pageHost) {
    var nodes = Array.prototype.slice.call(document.body.childNodes);
    nodes.forEach(function (node) {
      if (node === document.getElementById("rblxShellRoot")) return;
      if (node.nodeType === 1 && node.tagName === "SCRIPT") return;
      pageHost.appendChild(node);
    });
  }


  function getSharedToolShowcaseIcon(kind) {
    var icons = {
      spark: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6l2.9 8.1L35 17l-8.1 2.9L24 28l-2.9-8.1L13 17l8.1-2.9L24 6z"></path><path d="M36 26l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8 1.8-5z"></path><path d="M13 28l1.5 4.1 4.1 1.5-4.1 1.5L13 39l-1.5-4.1-4.1-1.5 4.1-1.5L13 28z"></path></svg>',
      hat: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 26c1.9-5.8 6.1-9 10-9s8.1 3.2 10 9"></path><path d="M8 28.5c4.9-2.7 10.4-4 16-4s11.1 1.3 16 4"></path><path d="M10 29v3.5c0 2.5 6.3 4.5 14 4.5s14-2 14-4.5V29"></path></svg>',
      calc: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="13" y="7" width="22" height="34" rx="5"></rect><rect x="17" y="12" width="14" height="6" rx="2"></rect><path d="M18 25h4"></path><path d="M18 31h4"></path><path d="M18 37h4"></path><path d="M26 25h4"></path><path d="M26 31h4"></path><path d="M26 37h4"></path></svg>',
      media: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="11" width="32" height="26" rx="5"></rect><circle cx="17" cy="19" r="3"></circle><path d="M13 32l7-7 5 5 5-4 5 6"></path></svg>',
      audio: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 29h5l7 7V12l-7 7h-5z"></path><path d="M32 18c2.8 2 4.5 5.2 4.5 8.5S34.8 33 32 35"></path><path d="M35.5 13.5c4.1 3.1 6.5 7.8 6.5 13s-2.4 9.9-6.5 13"></path></svg>',
      texture: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="10" width="28" height="28" rx="5"></rect><path d="M19.5 10v28"></path><path d="M28.5 10v28"></path><path d="M10 19.5h28"></path><path d="M10 28.5h28"></path></svg>',
      rig: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="11" r="4"></circle><path d="M24 15v10"></path><path d="M24 19l-8 4"></path><path d="M24 19l8 4"></path><path d="M24 25l-6 10"></path><path d="M24 25l6 10"></path><path d="M18 35h12"></path></svg>'
    };
    return icons[kind] || icons.spark;
  }

  function initSharedToolShowcase() {
    var currentPath = String(window.location.pathname || "/").replace(/\/+$|^\/+|\.html$/g, "");
    if (currentPath === "" || currentPath === "template-downloader") return;

    var showcasePanel = document.getElementById("showcasePanel");
    var showcaseViewport = document.getElementById("showcaseViewport");
    var showcaseProgress = document.getElementById("showcaseProgress");
    var slidePills = document.getElementById("slidePills");
    var slideName = document.getElementById("slideName");
    var slideDesc = document.getElementById("slideDesc");
    var slideGlyph = document.getElementById("slideGlyph");
    var slideTag = document.getElementById("slideTag");
    var slideLogoPreview = document.getElementById("slideLogoPreview");
    var prevTool = document.getElementById("prevTool");
    var nextTool = document.getElementById("nextTool");
    var openTool = document.getElementById("openTool");
    var plusGate = document.getElementById("plusGate");
    var closeGate = document.getElementById("closeGate");

    if (!showcasePanel || !showcaseViewport || !showcaseProgress || !slidePills || !slideName || !slideDesc || !slideGlyph || !slideTag || !slideLogoPreview || !prevTool || !nextTool || !openTool) {
      return;
    }
    if (showcaseViewport.dataset.sharedShowcaseBound === "true") return;
    showcaseViewport.dataset.sharedShowcaseBound = "true";

    var SHOWCASE_INTERVAL_MS = 45000;
    var showcaseTimer = null;
    var showcaseProgressTimer = null;
    var activeToolIndex = 0;
    var toolsData = [
      { name: "Template Downloader", desc: "Download supported Roblox clothing templates fast.", href: "./template-downloader", plus: false, icon: "spark", tag: "Template Tool", tone: "linear-gradient(180deg,#50395a,#2d2035)" },
      { name: "Template Background Changer", desc: "Remove marks and restore a clean classic template background.", href: "./template-background-changer", plus: false, icon: "spark", tag: "Cleanup Tool", tone: "linear-gradient(180deg,#31506a,#1f2f42)" },
      { name: "UGC Downloader", desc: "Download supported UGC accessory files for creator workflows.", href: "./ugc-downloader", plus: false, icon: "hat", tag: "UGC Tool", tone: "linear-gradient(180deg,#2a4a6c,#1e2f42)" },
      { name: "Robux Calculator", desc: "Fast conversion math for Robux and pricing plans.", href: "./robux-calculator", plus: false, icon: "calc", tag: "Value Tool", tone: "linear-gradient(180deg,#3e5b35,#27391f)" },
      { name: "Media Downloader", desc: "Pull supported media assets quickly.", href: "./media-downloader", plus: false, icon: "media", tag: "Media Tool", tone: "linear-gradient(180deg,#5a3b61,#32213a)" },
      { name: "Audio Downloader", desc: "Fetch audio asset files from supported IDs.", href: "./audio-downloader", plus: false, icon: "audio", tag: "Audio Tool", tone: "linear-gradient(180deg,#6a3e3a,#3f2523)" },
      { name: "Texture Baker", desc: "Premium texture workflow and cleaner UGC output.", href: "./texture-baker", plus: true, icon: "texture", tag: "Plus Tool", tone: "linear-gradient(180deg,#4a406b,#2a2441)" },
      { name: "Animation Spoofer", desc: "Premium animation utility for advanced workflows.", href: "./animation-spoofer", plus: true, icon: "rig", tag: "Plus Tool", tone: "linear-gradient(180deg,#3a456f,#212846)" }
    ].filter(function (tool) {
      if (tool.adminOnly && !shellState.isAdmin) return false;
      return String(tool.href || "").replace(/^\.\//, "").replace(/\.html$/, "") !== currentPath;
    });

    if (!toolsData.length) return;

    function updateShowcaseProgress() {
      showcaseProgress.style.width = "0%";
      var start = Date.now();
      if (showcaseProgressTimer) clearInterval(showcaseProgressTimer);
      showcaseProgressTimer = setInterval(function () {
        var elapsed = Date.now() - start;
        var percent = Math.min(100, (elapsed / SHOWCASE_INTERVAL_MS) * 100);
        showcaseProgress.style.width = percent + "%";
        if (percent >= 100) clearInterval(showcaseProgressTimer);
      }, 200);
    }

    function renderToolSlide() {
      var tool = toolsData[activeToolIndex];
      slidePills.innerHTML = '<span class="tool-pill">Other Tool</span>' + (tool.plus ? '<span class="tool-pill plus"><span class="plus-word">Plus</span> Required</span>' : '<span class="tool-pill">Free Access</span>');
      slideName.textContent = tool.name;
      slideDesc.textContent = tool.desc;
      slideGlyph.innerHTML = getSharedToolShowcaseIcon(tool.icon);
      slideTag.textContent = tool.tag;
      slideLogoPreview.style.background = tool.tone;
    }

    function animateToolSlide(nextIndex) {
      if (nextIndex === activeToolIndex) return;
      showcasePanel.classList.add("animating");
      window.setTimeout(function () {
        activeToolIndex = nextIndex;
        renderToolSlide();
        showcasePanel.classList.remove("animating");
      }, 220);
    }

    function restartShowcaseTimer() {
      if (showcaseTimer) clearInterval(showcaseTimer);
      updateShowcaseProgress();
      showcaseTimer = setInterval(function () {
        animateToolSlide((activeToolIndex + 1) % toolsData.length);
        updateShowcaseProgress();
      }, SHOWCASE_INTERVAL_MS);
    }

    function goToTool(nextIndex) {
      var normalizedIndex = (nextIndex + toolsData.length) % toolsData.length;
      animateToolSlide(normalizedIndex);
      restartShowcaseTimer();
    }

    function showPlusGate() {
      if (plusGate) plusGate.classList.add("open");
      else window.location.href = "./subscriptions";
    }

    function hidePlusGate() {
      if (plusGate) plusGate.classList.remove("open");
    }

    async function openCurrentTool() {
      var tool = toolsData[activeToolIndex];
      if (!tool.plus) {
        window.location.href = tool.href;
        return;
      }
      if (shellState.currentUser && String(shellState.currentUser.plan || "").toLowerCase() === "plus") {
        window.location.href = tool.href;
        return;
      }
      try {
        var state = await resolveUserState();
        if (state && String(state.plan || "").toLowerCase() === "plus") {
          window.location.href = tool.href;
          return;
        }
      } catch (_error) {}
      showPlusGate();
    }

    prevTool.addEventListener("click", function () { goToTool(activeToolIndex - 1); });
    nextTool.addEventListener("click", function () { goToTool(activeToolIndex + 1); });
    openTool.addEventListener("click", openCurrentTool);
    if (closeGate) closeGate.addEventListener("click", hidePlusGate);
    if (plusGate) {
      plusGate.addEventListener("click", function (event) {
        if (event.target && event.target.id === "plusGate") hidePlusGate();
      });
    }
    showcaseViewport.addEventListener("mouseenter", function () {
      if (showcaseTimer) clearInterval(showcaseTimer);
      if (showcaseProgressTimer) clearInterval(showcaseProgressTimer);
    });
    showcaseViewport.addEventListener("mouseleave", restartShowcaseTimer);

    renderToolSlide();
    restartShowcaseTimer();
  }

  function setFaqItemOpenState(item, isOpen) {
    if (!item) return;
    item.classList.toggle("open", Boolean(isOpen));
    var button = item.querySelector(".faq-q");
    if (button) {
      button.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  }

  function normalizeFaqWrap(wrap) {
    if (!wrap) return;
    var items = Array.prototype.slice.call(wrap.querySelectorAll(".faq-item"));
    items.forEach(function (item) {
      setFaqItemOpenState(item, false);
    });
  }

  function initFaqAccordions() {
    if (document.body.hasAttribute("data-rblx-faq-bound")) return;
    document.body.setAttribute("data-rblx-faq-bound", "true");

    document.querySelectorAll(".faq-wrap").forEach(normalizeFaqWrap);

    document.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest(".faq-q") : null;
      if (!button) return;

      var item = button.closest(".faq-item");
      var wrap = button.closest(".faq-wrap");
      if (!item || !wrap) return;

      var shouldOpen = !item.classList.contains("open");
      wrap.querySelectorAll(".faq-item.open").forEach(function (openItem) {
        setFaqItemOpenState(openItem, false);
      });
      setFaqItemOpenState(item, shouldOpen);
    });
  }

  function initShell() {
    var initialState = getImmediateUserState();
    shellState.currentUser = {
      loggedIn: Boolean(initialState.loggedIn),
      plan: initialState.plan || "guest",
      message: initialState.message || "",
      userId: initialState.userId || "",
      username: initialState.username || "",
      displayName: initialState.displayName || ""
    };
    shellState.isAdmin = Boolean(initialState.isAdmin);
    refreshCurrentProfile();

    document.body.insertAdjacentHTML("beforeend", buildShellMarkup());
    var pageHost = document.getElementById("rblxShellPage");
    movePageContent(pageHost);
    initFaqAccordions();
    initSharedToolShowcase();
    document.body.classList.add("rblx-shell-ready");
    shellState.deviceId = getDeviceId();
    applyCollapsedState(document.body);
    initProfileOverlay();
    initToggles();
    initChat();
    initAdminWindow();
    initRulesLink();
    loadPublicModerationState();
    window.addEventListener("resize", renderChatRainOverlay);
    if (shellState.chatAdminButton) {
      shellState.chatAdminButton.addEventListener("click", openAdminWindow);
    }
    window.addEventListener("rblxtools-profile-updated", function (event) {
      var detail = event && event.detail ? event.detail : {};
      var activeUserId = shellState.currentUser && shellState.currentUser.userId ? String(shellState.currentUser.userId) : "";
      if (detail.userId && activeUserId && String(detail.userId) !== activeUserId) return;
      refreshCurrentProfile();
      syncChatIdentity();
      if (shellState.socket && shellState.socketReady) {
        shellState.socket.emit("join-room", getSocketChatIdentity());
      }
    });
    window.addEventListener("storage", function (event) {
      if (!event || !event.key) return;
      if (event.key === PROFILE_KEY || event.key.indexOf(PROFILE_KEY + ":") === 0) {
        refreshCurrentProfile();
        syncChatIdentity();
        if (shellState.socket && shellState.socketReady) {
          shellState.socket.emit("join-room", getSocketChatIdentity());
        }
        return;
      }
      if (event.key === USER_KEY || event.key === PLUS_STATUS_KEY) {
        var nextState = getImmediateUserState();
        updateAuthUi(nextState);
        dispatchMembershipUpdate({
          user: getCachedAuthUser(),
          plan: nextState.plan,
          premiumActive: nextState.plan === "plus"
        });
      }
    });
    updateAuthUi(initialState);
    resolveUserState().then(updateAuthUi).catch(function () {
      updateAuthUi({
        loggedIn: false,
        plan: "guest",
        message: "You are browsing this website as a guest.",
        userId: "",
        username: "",
        displayName: ""
      });
    }).finally(function () {
      connectChatSocket();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShell, { once: true });
  } else {
    initShell();
  }
}());


