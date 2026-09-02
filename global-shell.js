(function () {
  if (window.__rblxShellReady) return;
  window.__rblxShellReady = true;

  var API_BASE = window.location.origin;
  var ADSENSE_CLIENT = "ca-pub-1298532626039613";
  var ADSTERRA_POPUNDER_SRC = "https://professionalsusceptible.com/db/b2/3c/dbb23c04482ce596492b26e928c44986.js";
  var GOOGLE_ANALYTICS_ID = "G-Z6QK1TBNFQ";
  var TOKEN_KEY = "rblxtools_auth_token";
  var USER_KEY = "rblxtools_auth_user";
  var REFERRAL_CODE_KEY = "rblxtools_referral_code";
  function getReferralCode() {
    try { return String(localStorage.getItem(REFERRAL_CODE_KEY) || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20); } catch (_error) { return ""; }
  }
  try {
    var incomingReferralCode = new URLSearchParams(window.location.search || "").get("ref");
    if (incomingReferralCode) localStorage.setItem(REFERRAL_CODE_KEY, String(incomingReferralCode).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20));
  } catch (_error) {}
  window.RBLXToolsReferral = { getCode: getReferralCode };
  // Keep a verified identity available while the cookie session is checked on a
  // new page.  A navigation must never briefly render a signed-in member as a
  // guest just because that background request has not completed yet.
  var SESSION_SNAPSHOT_KEY = "rblxtools_verified_session_snapshot";
  var AUTH_MODE_KEY = "rblxtools_auth_mode";
  var PLUS_STATUS_KEY = "rblxtools_plus_cache";
  var PROFILE_KEY = "rblxtools_profile_overview";
  var DEVICE_KEY = "rblxtools_device_id";
  var TOOL_ACTIVITY_CACHE_KEY = "rblxtools_tool_activity_cache";
  var CHAT_CACHE_KEY = "rblxtools_shell_chat_cache_v1";
  var COMMUNITY_NOTIFICATION_READ_KEY = "rblxtools_community_notification_reads_v1";
  var COMMUNITY_RECENTLY_SEEN_KEY = "rblxtools_community_recently_seen_v1";
  var COMMUNITY_NOTIFICATION_CACHE_KEY = "rblxtools_community_notification_cache_v1";
  var LEFT_STATE_KEY = "rblxtools_shell_left_collapsed";
  var RIGHT_STATE_KEY = "rblxtools_shell_right_collapsed";
  var GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
  var AUTH_PENDING_OPEN_KEY = "rblxtools_auth_modal_pending";
  var AUTH_PENDING_MODE_KEY = "rblxtools_auth_modal_pending_mode";
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
    chatSyncTimer: null,
    chatSyncInFlight: false,
    chatHistoryHydrated: false,
    chatAuthToken: "",
    // The active visitor is part of the room even before Socket.IO confirms its join.
    onlineCount: 1,
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
    chatReportButton: null,
    supportOverlay: null,
    supportModal: null,
    supportCategory: null,
    supportReporterId: null,
    supportReporterDiscord: null,
    supportReporterEmail: null,
    supportReportedIdWrap: null,
    supportReportedId: null,
    supportDetails: null,
    supportAttachment: null,
    supportAttachmentName: null,
    supportStatus: null,
    supportSubmit: null,
    supportCancel: null,
    authOverlay: null,
    authModal: null,
    authClose: null,
    authLoginTab: null,
    authSignupTab: null,
    authForm: null,
    authTitle: null,
    authCopy: null,
    authSubmit: null,
    authEmail: null,
    authPassword: null,
    authTogglePassword: null,
    authStatus: null,
    authGoogleWrap: null,
    authGoogleSection: null,
    authGoogleNote: null,
    authDivider: null,
    authSwitchPrompt: null,
    authSwitchButton: null,
    authReturnUrl: "",
    authMode: "login",
    authGoogleClientId: "",
    lastViewedProfileUserId: "",
    moderationCountdownTimer: null,
    chatSpecials: null,
    chatBottom: null,
    chatRainOverlay: null,
    checkoutSuccessOverlay: null,
    checkoutSuccessModal: null,
    checkoutSuccessClose: null,
    checkoutSuccessItem: null,
    checkoutSuccessAmount: null,
    checkoutSuccessCopy: null,
    checkoutSuccessTimer: null,
    checkoutSuccessCountdown: null,
    roomSpecials: null,
    roomSpecialsTimer: null,
    serverTimeOffset: 0,
    chatMessageRefreshTimer: null,
    chatSocketBooting: false,
    chatReplyTo: null,
    authUiSignature: "",
    communityNotifications: [],
    communityUnreadCount: 0,
    notificationsForUserId: "",
    communityVisitReadAttempt: "",
    renderedCommunityUnreadCount: null,
    authResolved: false
  };

  window.__rblxShellState = shellState;

  var navGroups = [
    {
      title: "Tools",
      items: [
        { href: "./index", label: "Home", icon: "home" },
        { href: "./template-downloader", label: "Clothing", icon: "shirt" },
        { href: "./template-background-changer", label: "Background Changer", icon: "spark" },
        { href: "./ugc-downloader", label: "UGC", icon: "hat" },
        { href: "./media-downloader", label: "Media", icon: "media" },
        { href: "./audio-downloader", label: "Audio", icon: "audio" },
        { href: "./robux-calculator", label: "Robux Calculator", icon: "calc" },
        { href: "./animation-spoofer", label: "Animations", icon: "rig" }
      ]
    },
    {
      title: "AI Tools",
      items: [
        { href: "./ai-clothing-studio", label: "AI Clothing Studio", icon: "ai", adminOnly: true },
        { href: "./ai-thumbnail-studio", label: "AI Thumbnail Studio", icon: "spark" }
      ]
    },
    {
      title: "Store",
      items: [
        { href: "./ai-tokens", label: "AI Tokens", icon: "spark" },
        { href: "./discord-bot", label: "Discord Bot", icon: "community" },
        { href: "./subscriptions", label: "Subscriptions", icon: "plan" }
      ]
    },
    {
      title: "Info",
      items: [
        { href: "./community", label: "Community", icon: "community" },
        { href: "./about-us", label: "About Us", icon: "about" },
        { href: "./privacy-policy", label: "Privacy Policy", icon: "privacy" },
        { href: "./terms-and-conditions", label: "Terms & Conditions", icon: "terms" }
      ]
    }
  ];

  var starterMessages = [];

  function getCachedChatMessages() {
    try {
      var cached = JSON.parse(sessionStorage.getItem(CHAT_CACHE_KEY) || "null");
      if (!cached || !Array.isArray(cached.messages) || Date.now() - Number(cached.savedAt || 0) > 10 * 60 * 1000) return [];
      return cached.messages.filter(function (message) { return message && !message.specialType; }).slice(-80);
    } catch (_error) {
      return [];
    }
  }

  function cacheChatMessages(messages) {
    try {
      sessionStorage.setItem(CHAT_CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        messages: (Array.isArray(messages) ? messages : []).filter(function (message) { return message && !message.specialType; }).slice(-80)
      }));
    } catch (_error) {}
  }

  function isMobileShellViewport() {
    return window.matchMedia("(max-width: 820px)").matches;
  }

  function closeMobilePanels() {
    document.body.classList.remove("rblx-mobile-nav-open");
    document.body.classList.remove("rblx-mobile-chat-open");
    var overlay = document.getElementById("rblxMobileOverlay");
    if (overlay) {
      overlay.hidden = true;
    }
  }

  function openMobilePanel(kind) {
    if (!isMobileShellViewport()) return;
    var overlay = document.getElementById("rblxMobileOverlay");
    document.body.classList.toggle("rblx-mobile-nav-open", kind === "nav");
    document.body.classList.toggle("rblx-mobile-chat-open", kind === "chat");
    if (overlay) {
      overlay.hidden = false;
    }
  }

  function syncMobileHeaderActions() {
    var actions = document.querySelector(".rblx-shell-header-actions");
    var header = document.querySelector(".rblx-shell-header");
    var navInner = document.querySelector(".rblx-shell-left-inner");
    if (!actions || !header || !navInner) return;

    if (isMobileShellViewport()) {
      if (actions.parentElement !== navInner) {
        navInner.insertBefore(actions, navInner.firstChild);
      }
      return;
    }

    if (actions.parentElement !== header) {
      header.appendChild(actions);
    }
  }

  function syncMobileShellState() {
    syncMobileHeaderActions();
    if (isMobileShellViewport()) {
      document.body.classList.add("rblx-mobile-shell");
      document.body.classList.remove("rblx-shell-left-collapsed");
      document.body.classList.remove("rblx-shell-right-collapsed");
      closeMobilePanels();
      return;
    }

    document.body.classList.remove("rblx-mobile-shell");
    closeMobilePanels();
  }

  // Safari can restore a page from its back-forward cache with a stale overlay state.
  window.addEventListener("pageshow", function () {
    closeMobilePanels();
  });

  function ensureAdSenseSetup() {
    var head = document.head || document.getElementsByTagName("head")[0];
    if (!head) return;

    var existingMeta = document.querySelector('meta[name="google-adsense-account"]');
    if (!existingMeta) {
      var meta = document.createElement("meta");
      meta.name = "google-adsense-account";
      meta.content = ADSENSE_CLIENT;
      head.appendChild(meta);
    }

    var existingScript = document.querySelector('script[data-rblxtools-adsense="true"]');
    if (!existingScript) {
      var script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.rblxtoolsAdsense = "true";
      script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(ADSENSE_CLIENT);
      head.appendChild(script);
    }
  }

  ensureAdSenseSetup();

  function isMobileViewer() {
    var userAgentData = navigator.userAgentData;
    if (userAgentData && userAgentData.mobile) return true;
    if (/Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent || "")) return true;
    // Mobile browsers can request a desktop user agent or report mouse-like
    // capabilities. Treat compact screens and small touch-only devices as mobile
    // so a popunder is never loaded on a phone in desktop-site mode.
    if (window.matchMedia && window.matchMedia("(max-width: 820px)").matches) return true;
    var shortestScreenSide = Math.min(Number(window.screen && window.screen.width) || 0, Number(window.screen && window.screen.height) || 0);
    return Boolean(navigator.maxTouchPoints > 0 && shortestScreenSide > 0 && shortestScreenSide <= 1024);
  }

  function ensureAdsterraPopunderSetup() {
    if (!ADSTERRA_POPUNDER_SRC || window.__rblxAdsterraPopunderLoaded || isMobileViewer()) return;
    var head = document.head || document.getElementsByTagName("head")[0];
    if (!head || document.querySelector('script[data-rblxtools-adsterra-popunder="true"]')) return;

    var script = document.createElement("script");
    script.async = true;
    script.dataset.rblxtoolsAdsterraPopunder = "true";
    script.src = ADSTERRA_POPUNDER_SRC;
    head.appendChild(script);
    window.__rblxAdsterraPopunderLoaded = true;
  }

  function syncAdsterraPopunderForMember(state) {
    if (!shellState.authResolved || String(state && state.plan || "").toLowerCase() === "pro") return;
    ensureAdsterraPopunderSetup();
  }

  function isProMember(state) {
    var plan = state && state.plan != null ? state.plan : (shellState.currentUser && shellState.currentUser.plan);
    return String(plan || "").toLowerCase() === "pro";
  }

  function shouldShowMemberAds() {
    return !isProMember();
  }

  function syncMemberAdVisibility(state) {
    var hideAds = isProMember(state);
    document.body.classList.toggle("rblx-pro-ad-free", hideAds);
    Array.prototype.forEach.call(document.querySelectorAll("[data-rblx-shell-box-ad], [data-rblx-promo-box-ad], [data-rblx-modal-ad], [data-rblx-vertical-ad], [data-rblx-banner-ad]"), function (host) {
      host.hidden = hideAds;
      if (!hideAds) return;
      // Remove any ad that was mounted before the account state was resolved.
      if (host.hasAttribute("data-rblx-banner-ad")) {
        Array.prototype.forEach.call(host.querySelectorAll(".rblx-tool-banner-ad-slot"), function (slot) {
          slot.textContent = "";
          delete slot.dataset.rblxBannerLoaded;
        });
        return;
      }
      host.textContent = "";
      delete host.dataset.rblxBoxAdMounted;
      delete host.dataset.rblxVerticalAdMounted;
    });
    if (!hideAds) {
      mountDesktopShellBoxAds();
      mountDesktopVerticalAds();
    }
  }

  function ensureGoogleAnalyticsSetup() {
    if (!GOOGLE_ANALYTICS_ID) return;
    var head = document.head || document.getElementsByTagName("head")[0];
    if (!head) return;

    window.dataLayer = window.dataLayer || [];

    if (typeof window.gtag !== "function") {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
    }

    var existingScript = document.querySelector('script[data-rblxtools-ga="true"]');
    if (!existingScript) {
      var script = document.createElement("script");
      script.async = true;
      script.dataset.rblxtoolsGa = "true";
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GOOGLE_ANALYTICS_ID);
      head.appendChild(script);
    }

    if (!window.__rblxGaConfigured) {
      window.gtag("js", new Date());
      window.gtag("config", GOOGLE_ANALYTICS_ID);
      window.__rblxGaConfigured = true;
    }
  }

  ensureGoogleAnalyticsSetup();

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
      ai: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7.5A2.5 2.5 0 1 1 10.5 10 2.5 2.5 0 0 1 8 7.5Zm5.8 1.7h3.7a1.8 1.8 0 0 1 1.8 1.8v4.8a1.8 1.8 0 0 1-1.8 1.8H12a2.7 2.7 0 0 1-2.7-2.7v-1.2m-2.6 1.6h2.1m7 0h2.1M15 6.2V4.5m0 15v-1.7M4.7 12h1.7m8.1-7.3 1.2 1.2m-10.1 0-1.2 1.2m10.1 9.9 1.2-1.2m-10.1 0-1.2-1.2"/></svg>',
      plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 14.6 8l5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L5.2 8.7l5-.7L12 3.5Z"/></svg>',
      account: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4ZM5 19c.6-3 3.4-5 7-5s6.4 2 7 5H5Z"/></svg>',
      login: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5h6v14h-6M4 12h10m-3.5-3.5L14 12l-3.5 3.5"/></svg>',
      shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.5-7 9-4.1-1.5-7-4.8-7-9V6l7-2.5Zm0 4.2v8.2"/></svg>',
      community: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v8A1.5 1.5 0 0 1 18.5 16H9l-4.2 3.1c-.3.2-.8 0-.8-.4V16H5.5A1.5 1.5 0 0 1 4 14.5v-8Zm4 2.2h8v1.6H8V8.7Zm0 3.5h6.2v1.6H8v-1.6Z"/></svg>',
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

  function getChatToggleIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14v10H9l-4 3v-13z"></path><path d="M8 9h8M8 12h5"></path></svg>';
  }

    function getSupportCategoryOptionsMarkup() {
      return [
        '<option value="website_bug">🐞 Website Bugs</option>',
        '<option value="live_chat_issue">💬 Live Chat Related Issues</option>',
        '<option value="membership_issue">💎 Membership Related Issues</option>',
        '<option value="billing_issue">💳 Billing / Purchase Issues</option>',
        '<option value="user_report">🚨 Report A Member</option>',
        '<option value="other">🧩 Other Reason</option>'
      ].join("");
    }

  function buildCheckoutConfetti() {
    var pieces = "";
    for (var index = 0; index < 26; index += 1) {
      var left = 4 + ((index * 13) % 92);
      var delay = ((index % 8) * 0.28).toFixed(2);
      var duration = (4.6 + (index % 5) * 0.55).toFixed(2);
      var size = 8 + (index % 4) * 3;
      var hue = index % 3 === 0 ? "green" : (index % 3 === 1 ? "gold" : "blue");
      pieces += '<span class="rblx-shell-checkout-confetti-piece is-' + hue + '" style="--confetti-left:' + left + '%;--confetti-delay:' + delay + 's;--confetti-duration:' + duration + 's;--confetti-size:' + size + 'px;"></span>';
    }
    return pieces;
  }

  function buildModalAdRailsMarkup() {
    return '<aside class="rblx-shell-modal-ad-rail is-left" data-rblx-modal-ad aria-label="Advertisement"><span>Advertisement</span></aside>' +
      '<aside class="rblx-shell-modal-ad-rail is-right" data-rblx-modal-ad aria-label="Advertisement"><span>Advertisement</span></aside>';
  }

  function buildAnimationMembershipGateMarkup() {
    return (
      '<div class="rblx-shell-membership-gate" id="rblxShellAnimationGate" aria-hidden="true">' +
        '<div class="rblx-shell-membership-gate-card" role="dialog" aria-modal="true" aria-labelledby="rblxShellAnimationGateTitle">' +
          '<h3 id="rblxShellAnimationGateTitle">Animations is available with <span class="rblx-shell-gate-plus">Plus</span> or <span class="rblx-shell-gate-pro">Pro</span>.</h3>' +
          '<p>Choose a membership to unlock the animation tool and the creator benefits that come with it.</p>' +
          '<div class="rblx-shell-gate-benefits"><section><strong>Plus</strong><span>Animation Studio</span><span>Texture Baker</span><span>Bulk Downloads (1-5)</span><span>Much More</span></section><section><strong>Pro</strong><span>Everything from Plus</span><span>Cool AI Features</span><span>No Annoying Ads</span><span>RBLXTools Discord Bot Access</span><span>Bulk Downloads (5-10)</span><span>Much More to Offer</span></section></div>' +
          '<div class="rblx-shell-membership-gate-actions"><button class="rblx-shell-membership-gate-cancel" type="button" data-rblx-animation-gate-cancel="true">Cancel</button><a class="rblx-shell-membership-gate-button" href="./subscriptions">View Plans</a></div>' +
          '</div>' +
        buildModalAdRailsMarkup() +
      '</div>'
    );
  }

  function initAnimationMembershipGate() {
    var gate = document.getElementById("rblxShellAnimationGate");
    if (!gate || gate.dataset.rblxBound === "true") return;
    gate.dataset.rblxBound = "true";

    function hasAnimationAccess(state) {
      var plan = String(state && state.plan || "").toLowerCase();
      return plan === "plus" || plan === "pro";
    }

    function showGate() {
      gate.classList.add("is-open");
      gate.setAttribute("aria-hidden", "false");
      mountModalVerticalAds(gate);
    }

    var cancelButton = gate.querySelector("[data-rblx-animation-gate-cancel]");
    if (cancelButton) cancelButton.addEventListener("click", function () {
      gate.classList.remove("is-open");
      gate.setAttribute("aria-hidden", "true");
    });

    document.addEventListener("click", function (event) {
      if (event.defaultPrevented || (typeof event.button === "number" && event.button !== 0) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      var href = String(link.getAttribute("href") || "");
      var path = href.split("?")[0].split("#")[0].replace(/^\.\//, "").replace(/\.html$/i, "");
      if (path !== "animation-spoofer") return;

      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();

      function continueOrGate(state) {
        if (hasAnimationAccess(state)) {
          window.location.href = href;
          return;
        }
        showGate();
      }

      if (shellState.authResolved) {
        continueOrGate(shellState.currentUser);
        return;
      }
      resolveUserState().then(function (state) {
        shellState.authResolved = true;
        updateAuthUi(state);
        continueOrGate(state);
      }).catch(function () {
        continueOrGate(getImmediateUserState());
      });
    }, true);
  }

  function initLoginRequiredNavigation() {
    if (!document.body || document.body.dataset.rblxLoginNavigationBound === "true") return;
    document.body.dataset.rblxLoginNavigationBound = "true";

    // Store and studio pages are public previews. Their individual actions gate login.
    var protectedPages = {};

    document.addEventListener("click", function (event) {
      if (event.defaultPrevented || (typeof event.button === "number" && event.button !== 0) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      var href = String(link.getAttribute("href") || "");
      var path = href.split("?")[0].split("#")[0].replace(/^\.\//, "").replace(/\.html$/i, "");
      var message = protectedPages[path];
      if (!message) return;

      function continueOrPrompt(state) {
        if (state && state.loggedIn) {
          window.location.href = href;
          return;
        }
        openAuthModal({ mode: "login", message: message, returnTo: getCleanCurrentUrl() });
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();

      if (shellState.authResolved) {
        continueOrPrompt(shellState.currentUser);
        return;
      }
      resolveUserState().then(function (state) {
        shellState.authResolved = true;
        updateAuthUi(state);
        continueOrPrompt(state);
      }).catch(function () {
        continueOrPrompt(getImmediateUserState());
      });
    }, true);
  }

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; }
    catch (_error) { return ""; }
  }

  function clearLegacyAuthTokenCache() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (_error) {}
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

  function maskEmailAddress(value) {
    var text = String(value || "").trim();
    if (!text || text.indexOf("@") === -1) return "";
    var parts = text.split("@");
    var local = parts[0] || "";
    var domain = parts.slice(1).join("@");
    if (!local || !domain) return "";
    var keep = Math.min(3, Math.max(1, local.length));
    return local.slice(0, keep) + "***@" + domain;
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
    if (!raw) raw = readRawStorage(SESSION_SNAPSHOT_KEY) || "";
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.user && typeof parsed.user === "object") {
        return parsed.user;
      }
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function clearVerifiedSessionSnapshot() {
    try { localStorage.removeItem(SESSION_SNAPSHOT_KEY); } catch (_error) {}
  }

  function saveCachedAuthUser(user) {
    try {
      if (user && typeof user === "object") {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        localStorage.setItem(SESSION_SNAPSHOT_KEY, JSON.stringify({
          user: user,
          verifiedAt: Date.now()
        }));
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
      deviceId: shellState.deviceId || getDeviceId(),
      room: "rblxtools-main",
      userId: shellState.currentUser && shellState.currentUser.userId ? String(shellState.currentUser.userId) : guestId,
      displayName: currentProfile.displayName || fallbackName,
      username: currentProfile.displayName || (shellState.currentUser && shellState.currentUser.username) || fallbackName,
      avatarUrl: currentProfile.avatarUrl || "",
      bio: currentProfile.bio || "",
      isPlus: shellState.currentUser && ["plus", "pro"].includes(String(shellState.currentUser.plan || "").toLowerCase()),
      isGuest: !isLoggedIn,
      plan: shellState.currentUser && shellState.currentUser.plan ? shellState.currentUser.plan : "guest",
      favoriteTools: []
    };
  }

  function getSocketJoinPayload() {
    var identity = getSocketChatIdentity();
    return {
      room: "rblxtools-main",
      deviceId: shellState.deviceId || getDeviceId(),
      userId: identity.userId,
      displayName: identity.displayName,
      username: identity.username,
      avatarUrl: identity.avatarUrl,
      bio: identity.bio,
      isPlus: identity.isPlus,
      isGuest: identity.isGuest,
      plan: identity.plan,
      favoriteTools: identity.favoriteTools || [],
      authToken: shellState.chatAuthToken || ""
    };
  }

  function setChatAuthToken(token) {
    var nextToken = String(token || "").trim();
    if (shellState.chatAuthToken === nextToken) return;
    shellState.chatAuthToken = nextToken;
    if (shellState.socket && shellState.socketReady) {
      shellState.socket.emit("join-room", getSocketJoinPayload());
    }
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

  function getEventRewardLabel(rewardType, amount) {
    if (rewardType === "tokens") return String(amount || 0) + " AI tokens";
    return String(amount || 0) + " " + (rewardType === "pro" ? "Pro days" : "Plus days");
  }

  function buildRewardBurstMarkup(className, count, rewardType) {
    var items = [];
    for (var index = 0; index < count; index += 1) {
      var symbol = rewardType === "tokens" ? "AI" : (index % 2 ? "&#128296;" : "&#127913;");
      items.push('<span class="' + className + '" style="--plus-left:' + ((index * 17) % 100) + '%;--plus-delay:' + (index * -0.18).toFixed(2) + 's;--plus-size:' + (12 + (index % 5) * 3) + 'px;">' + symbol + "</span>");
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
        '<p class="rblx-shell-special-copy">Join the live chat rain for <strong>' + escapeHtml(String(rain.winnersCount || 1)) + "</strong> " + escapeHtml(String(rain.rewardType === "tokens" ? "AI token" : rain.rewardType === "pro" ? "Pro" : "Plus")) + " winner" + ((rain.winnersCount || 1) === 1 ? "" : "s") + ".</p>" +
        '<div class="rblx-shell-event-progress"><span class="rblx-shell-event-progress-fill" style="width:' + rainProgressPercent.toFixed(2) + '%;"></span></div>' +
        '<div class="rblx-shell-special-meta"><span>' + escapeHtml(String(rain.participantCount || 0)) + " joined</span><span>" + escapeHtml(getEventRewardLabel(rain.rewardType || "plus", rain.amount || rain.days)) + "</span></div>" +
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
    if (shellState.chatRainOverlay.dataset.rewardType !== String(specials.chatRain && specials.chatRain.rewardType || "plus")) {
      shellState.chatRainOverlay.innerHTML = buildRewardBurstMarkup("rblx-shell-chat-rain-plus", 72, specials.chatRain && specials.chatRain.rewardType);
      shellState.chatRainOverlay.dataset.rewardType = String(specials.chatRain && specials.chatRain.rewardType || "plus");
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

  function applyMaintenanceState(settings) {
    shellState.maintenanceState = settings || null;
    if (!shellState.maintenanceOverlay || !shellState.maintenanceTitle || !shellState.maintenanceNotice) return;
    var enabled = Boolean(settings && settings.maintenanceEnabled);
    var shouldShow = enabled && !shellState.isAdmin;
    shellState.maintenanceOverlay.classList.toggle("is-open", shouldShow);
    shellState.maintenanceOverlay.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    shellState.maintenanceTitle.textContent = settings && settings.maintenanceTitle
      ? settings.maintenanceTitle
      : "Sorry, the site is under maintenance right now.";
    shellState.maintenanceNotice.textContent = settings && settings.maintenanceNotice
      ? settings.maintenanceNotice
      : "This does not mean the servers are down. The RBLXTeam is currently updating the site. Please come back later.";
  }

  async function refreshSiteMaintenanceState() {
    try {
      var response = await fetch(API_BASE + "/api/site-status", { cache: "no-store" });
      if (!response.ok) return;
      var payload = await response.json().catch(function () { return null; });
      applyMaintenanceState(payload && payload.settings ? payload.settings : null);
    } catch (_error) {
    }
  }

  function initSiteMaintenancePolling() {
    if (shellState.maintenanceRefreshTimer) return;
    refreshSiteMaintenanceState();
    shellState.maintenanceRefreshTimer = window.setInterval(refreshSiteMaintenanceState, 30000);
    window.addEventListener("focus", refreshSiteMaintenanceState);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refreshSiteMaintenanceState();
    });
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

        if (currentProfile && profile.userId && currentUser.userId && String(profile.userId) === String(currentUser.userId)) {
      profile.displayName = currentProfile.displayName || profile.displayName;
      profile.avatarUrl = currentProfile.avatarUrl || profile.avatarUrl;
      profile.bio = currentProfile.bio || profile.bio;
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
        var communityBadge = item.href === "./community" && shellState.communityUnreadCount > 0
          ? '<span class="rblx-shell-nav-notification-badge" aria-label="' + shellState.communityUnreadCount + ' unread community notifications">' + (shellState.communityUnreadCount > 99 ? '99+' : shellState.communityUnreadCount) + '</span>'
          : '';
        return (
          '<a class="rblx-shell-nav-link' + (active ? ' is-active' : '') + '" href="' + item.href + '">' +
            '<span class="rblx-shell-nav-icon">' + getNavIcon(item.icon) + '</span>' +
            '<span>' + escapeHtml(item.label) + '</span>' +
            communityBadge +
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


  function buildFooterLinkGroupMarkup(title, items) {
    if (!Array.isArray(items) || !items.length) return "";
    var links = items.map(function (item) {
      var externalAttrs = item.external ? ' target="_blank" rel="noopener noreferrer"' : "";
      return '<a href="' + item.href + '"' + externalAttrs + ">" + escapeHtml(item.label) + "</a>";
    }).join("");
    return (
      '<section class="rblx-shell-footer-group">' +
        '<h3 class="rblx-shell-footer-title">' + escapeHtml(title) + "</h3>" +
        '<div class="rblx-shell-footer-links">' + links + "</div>" +
      "</section>"
    );
  }

  function buildFooterMarkup() {
    var year = new Date().getFullYear();
    return (
      '<footer class="rblx-shell-footer">' +
        '<div class="rblx-shell-footer-top">' +
          '<section class="rblx-shell-footer-brand">' +
            '<div class="rblx-shell-footer-kicker">RBLXTools</div>' +
            '<h2>Creator tools, cleaner workflows, and more ways to earn.</h2>' +
            '<p>Browse creator tools, discover affiliate earnings, and move between every part of RBLXTools from one place.</p>' +
            '<div class="rblx-shell-footer-actions">' +
              '<a class="rblx-shell-footer-action is-primary" href="./subscriptions">View Plans</a>' +
            "</div>" +
          "</section>" +
          '<div class="rblx-shell-footer-grid">' +
            buildFooterLinkGroupMarkup("Tools", [
              { href: "./index", label: "Home" },
              { href: "./template-downloader", label: "Clothing" },
              { href: "./template-background-changer", label: "Background Changer" },
              { href: "./ugc-downloader", label: "UGC" },
              { href: "./media-downloader", label: "Media" },
              { href: "./audio-downloader", label: "Audio" },
              { href: "./robux-calculator", label: "Robux Calculator" },
              { href: "./animation-spoofer", label: "Animations" }
            ]) +
            buildFooterLinkGroupMarkup("Account", [
              { href: "./subscriptions", label: "Subscriptions" },
              { href: "./account-overview", label: "Account Overview" },
              { href: "https://discord.gg/TMmBQgYK32", label: "Discord", external: true },
              { href: "./login", label: "Login / Sign Up" }
            ]) +
            buildFooterLinkGroupMarkup("Info", [
              { href: "./about-us", label: "About Us" },
              { href: "./privacy-policy", label: "Privacy Policy" },
              { href: "./terms-and-conditions", label: "Terms & Conditions" }
            ]) +
            '<section class="rblx-shell-footer-group">' +
              '<h3 class="rblx-shell-footer-title">Community</h3>' +
              '<div class="rblx-shell-footer-links">' +
                '<a href="https://discord.gg/TMmBQgYK32" target="_blank" rel="noopener noreferrer">Discord</a>' +
                '<a href="https://x.com/Reese28575571" target="_blank" rel="noopener noreferrer">X</a>' +
                '<a href="https://www.youtube.com/@ItzReeseRBLX" target="_blank" rel="noopener noreferrer">YouTube</a>' +
                '<a href="https://www.twitch.tv/2muchreese" target="_blank" rel="noopener noreferrer">Twitch</a>' +
              "</div>" +
              '<div class="rblx-shell-footer-socials">' +
                '<a href="https://discord.gg/TMmBQgYK32" target="_blank" rel="noopener noreferrer" aria-label="Discord">' + getSocialIcon("discord") + "</a>" +
                '<a href="https://x.com/Reese28575571" target="_blank" rel="noopener noreferrer" aria-label="X">' + getSocialIcon("x") + "</a>" +
                '<a href="https://www.youtube.com/@ItzReeseRBLX" target="_blank" rel="noopener noreferrer" aria-label="YouTube">' + getSocialIcon("youtube") + "</a>" +
                '<a href="https://www.twitch.tv/2muchreese" target="_blank" rel="noopener noreferrer" aria-label="Twitch">' + getSocialIcon("twitch") + "</a>" +
              "</div>" +
            "</section>" +
          "</div>" +
        "</div>" +
        '<div class="rblx-shell-footer-bottom">' +
          '<span>© ' + year + ' RBLXTools. All rights reserved.</span>' +
          '<span>Built for Roblox creator workflows, cleaner access, and easier navigation.</span>' +
        "</div>" +
      "</footer>"
    );
  }

  function buildAuthMarkup() {
    var currentUser = shellState.currentUser || {};
    var currentProfile = shellState.currentProfile || readSavedProfile(currentUser.userId);
    var displayName = String(currentProfile && currentProfile.displayName || currentUser.displayName || "").trim();
    var maskedEmail = maskEmailAddress(currentUser.email);
    var title = displayName || maskedEmail || currentUser.username || "My Account";
    var subtitle = displayName ? (maskedEmail || "Personal profile") : "Personal profile";
    var avatarUrl = String(currentProfile && currentProfile.avatarUrl || "").trim();
    var avatarFallback = getInitials(displayName || getEmailNamePart(currentUser.email) || currentUser.username || "R");
    var isPro = String(currentUser.plan || "").toLowerCase() === "pro";
    var isPlus = String(currentUser.plan || "").toLowerCase() === "plus";
    if (currentUser.loggedIn) {
      return (
        '<div class="rblx-shell-auth" id="rblxShellAuth">' +
          '<a class="rblx-shell-referral-balance" href="./account-overview?tab=referrals" title="Open referral earnings"><span id="rblxShellReferralBalance">$0.00</span><small>Your balance</small></a>' +
          '<details class="rblx-shell-notification-menu" id="rblxShellNotificationMenu">' +
            '<summary class="rblx-shell-notification-trigger" aria-label="Open notifications">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 10.5a6 6 0 0 0-12 0c0 7-2.5 7-2.5 8.5h17C20.5 17.5 18 17.5 18 10.5ZM9.5 21h5"></path></svg>' +
              '<span class="rblx-shell-notification-count" id="rblxShellNotificationCount"' + (shellState.communityUnreadCount > 0 ? '' : ' hidden') + '>' + (shellState.communityUnreadCount > 99 ? '99+' : shellState.communityUnreadCount) + '</span>' +
            '</summary>' +
            '<div class="rblx-shell-notification-panel">' +
              '<div class="rblx-shell-notification-head"><strong>Notifications</strong><button type="button" data-shell-notifications-read-all="true">Mark all read</button></div>' +
              '<div class="rblx-shell-notification-list" id="rblxShellNotificationList"></div>' +
            '</div>' +
          '</details>' +
          '<details class="rblx-shell-profile-menu">' +
            '<summary class="rblx-shell-profile-menu-summary" aria-label="Open account menu">' +
              '<span class="rblx-shell-profile-card' + (isPro ? ' is-pro' : (isPlus ? ' is-plus' : '')) + '">' +
                ((isPro || isPlus) ? ('<span class="rblx-shell-profile-card-pluses" aria-hidden="true">' + (isPro ? buildHeaderProfileProMarkup() : buildHeaderProfilePlusMarkup()) + '</span>') : '') +
                '<span class="rblx-shell-profile-card-avatar' + (avatarUrl ? ' has-image' : '') + '">' +
                  (avatarUrl
                    ? ('<img src="' + escapeHtml(avatarUrl) + '" alt="" />')
                    : ('<span class="rblx-shell-profile-card-fallback">' + escapeHtml(avatarFallback) + '</span>')) +
                '</span>' +
                '<span class="rblx-shell-profile-card-copy">' +
                  '<span class="rblx-shell-profile-card-title">' + escapeHtml(title) + '</span>' +
                  '<span class="rblx-shell-profile-card-subtitle">' + escapeHtml(subtitle) + '</span>' +
                '</span>' +
                '<span class="rblx-shell-profile-card-arrow" aria-hidden="true">' +
                  '<svg viewBox="0 0 20 20"><path d="M5.6 7.4a1 1 0 0 1 1.4 0L10 10.38l2.99-2.99a1 1 0 1 1 1.41 1.42l-3.7 3.69a1 1 0 0 1-1.4 0L5.6 8.82a1 1 0 0 1 0-1.42Z"/></svg>' +
                '</span>' +
              '</span>' +
            '</summary>' +
            '<div class="rblx-shell-profile-menu-panel">' +
              '<a class="rblx-shell-profile-menu-item" href="./account-overview">Account Overview</a>' +
              '<button class="rblx-shell-profile-menu-item is-danger" type="button" data-shell-logout="true">Log Out</button>' +
            "</div>" +
          "</details>" +
        "</div>"
      );
    }

    return (
      '<div class="rblx-shell-auth" id="rblxShellAuth">' +
        '<a class="rblx-shell-btn rblx-shell-login-button" href="./login">Login / Sign Up</a>' +
      "</div>"
    );
  }

  async function logoutCurrentUser() {
    try {
      await fetch(API_BASE + "/auth/logout", { method: "POST", credentials: "include" });
    } catch (_error) {
    }
    clearLegacyAuthTokenCache();
    setChatAuthToken("");
    saveCachedAuthUser(null);
    clearVerifiedSessionSnapshot();
    writeCachedPlusStatus(false);
    updateAuthUi(getImmediateUserState());
    refreshCurrentProfile();
    if (shellState.socket && shellState.socketReady) {
      shellState.socket.emit("join-room", getSocketJoinPayload());
    }
    window.location.href = "./index";
  }

  function buildStatusPlusMarkup() {
    var specs = [
      ["12%", "56%", "11px", "-0.4s", "0.18"],
      ["28%", "24%", "13px", "-1.5s", "0.26"],
      ["44%", "66%", "10px", "-2.2s", "0.16"],
      ["61%", "20%", "14px", "-3.0s", "0.22"],
      ["76%", "62%", "12px", "-1.1s", "0.18"],
      ["90%", "30%", "10px", "-2.7s", "0.15"]
    ];

    return specs.map(function (spec) {
      return '<span class="rblx-shell-status-plus" style="--status-plus-left:' + spec[0] + ';--status-plus-top:' + spec[1] + ';--status-plus-size:' + spec[2] + ';--status-plus-delay:' + spec[3] + ';--status-plus-opacity:' + spec[4] + ';">+</span>';
    }).join("");
  }

  function buildHeaderProfilePlusMarkup() {
    var specs = [
      ["16%", "62%", "10px", "-0.8s", "0.16"],
      ["34%", "24%", "12px", "-2.0s", "0.24"],
      ["57%", "68%", "9px", "-1.2s", "0.14"],
      ["78%", "28%", "11px", "-2.8s", "0.18"]
    ];

    return specs.map(function (spec) {
      return '<span class="rblx-shell-profile-card-plus" style="--profile-card-plus-left:' + spec[0] + ';--profile-card-plus-top:' + spec[1] + ';--profile-card-plus-size:' + spec[2] + ';--profile-card-plus-delay:' + spec[3] + ';--profile-card-plus-opacity:' + spec[4] + ';">+</span>';
    }).join("");
  }

  function buildHeaderProfileProMarkup() {
    var specs = [["16%", "62%", "10px", "-0.8s", "0.32"], ["34%", "24%", "12px", "-2.0s", "0.42"], ["57%", "68%", "9px", "-1.2s", "0.28"], ["78%", "28%", "11px", "-2.8s", "0.36"]];
    return specs.map(function (spec) {
      return '<span class="rblx-shell-profile-card-plus rblx-shell-profile-card-pro" style="--profile-card-plus-left:' + spec[0] + ';--profile-card-plus-top:' + spec[1] + ';--profile-card-plus-size:' + spec[2] + ';--profile-card-plus-delay:' + spec[3] + ';--profile-card-plus-opacity:' + spec[4] + ';">&#128736;</span>';
    }).join("");
  }

  function buildSitePlusBackdropMarkup() {
    var specs = [
      ["6%", "12%", "18px", "8.4s", "-1.2s", "0.12"],
      ["15%", "34%", "14px", "7.1s", "-3.8s", "0.10"],
      ["24%", "72%", "20px", "9.0s", "-2.4s", "0.14"],
      ["38%", "18%", "16px", "7.8s", "-0.6s", "0.11"],
      ["46%", "58%", "13px", "8.7s", "-3.4s", "0.10"],
      ["59%", "26%", "21px", "9.3s", "-1.9s", "0.13"],
      ["66%", "82%", "15px", "7.0s", "-4.1s", "0.10"],
      ["78%", "12%", "19px", "8.8s", "-2.7s", "0.13"],
      ["88%", "48%", "14px", "7.6s", "-1.3s", "0.11"],
      ["92%", "80%", "17px", "8.2s", "-3.9s", "0.12"]
    ];

    return specs.map(function (spec) {
      return '<span class="rblx-shell-plus-sigil" style="--bg-plus-left:' + spec[0] + ';--bg-plus-top:' + spec[1] + ';--bg-plus-size:' + spec[2] + ';--bg-plus-duration:' + spec[3] + ';--bg-plus-delay:' + spec[4] + ';--bg-plus-opacity:' + spec[5] + ';">+</span>';
    }).join("");
  }

  function ensureSitePlusBackdrop() {
    if (!document.body || document.getElementById("rblxShellPlusBackdrop")) return;
    var layer = document.createElement("div");
    layer.className = "rblx-shell-plus-backdrop";
    layer.id = "rblxShellPlusBackdrop";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = buildSitePlusBackdropMarkup();
    document.body.appendChild(layer);
  }

  function applyPlanAtmosphere(plan) {
    if (!document.body) return;
    var normalizedPlan = String(plan || "guest").toLowerCase();
    var tier = normalizedPlan === "pro" ? "pro" : normalizedPlan === "plus" ? "plus" : "free";
    document.body.classList.toggle("rblx-shell-plus-user", tier === "plus");
    document.body.classList.toggle("rblx-shell-pro-user", tier === "pro");
    document.body.classList.toggle("rblx-shell-free-user", tier === "free");

    var layer = document.getElementById("rblxPlanAtmosphere");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "rblxPlanAtmosphere";
      layer.setAttribute("aria-hidden", "true");
      document.body.insertBefore(layer, document.body.firstChild);
    }

    if (layer.dataset.plan === tier) return;
    layer.dataset.plan = tier;
    layer.className = "rblx-plan-atmosphere is-" + tier;
    if (tier === "free") {
      layer.innerHTML = "";
      return;
    }

    var mark = tier === "pro" ? "&#128736;" : "+";
    var marks = [];
    for (var index = 0; index < 9; index += 1) marks.push("<span>" + mark + "</span>");
    layer.innerHTML = marks.join("");
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
            '<span class="rblx-shell-status-pluses" aria-hidden="true">' + buildStatusPlusMarkup() + '</span>' +
            '<span class="rblx-shell-status-dot"></span>' +
            '<span class="rblx-shell-status-text" id="rblxShellStatusText">You are browsing this website as a guest.</span>' +
          "</div>" +
          '<div class="rblx-shell-header-actions">' +
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
                '<div class="rblx-shell-box-ad" data-rblx-shell-box-ad aria-label="Advertisement"><span>Advertisement</span></div>' +
                '<div class="rblx-shell-token-banner" id="rblxShellTokenBanner" hidden><strong>AI Tokens</strong><span id="rblxShellTokenBalance">...</span><a class="rblx-shell-token-add" href="./ai-tokens" aria-label="Buy AI tokens" title="Buy AI tokens">+</a></div>' +
                '<div class="rblx-shell-plan-rotator" id="rblxShellPlanRotator"><a class="rblx-shell-mini-banner rblx-shell-mini-banner-pro" data-rblx-plan-slide="pro" href="./subscriptions"><strong>Pro Plan</strong><span><s>$5.00</s> $2.50 <em>50% off</em></span><i class="rblx-shell-plan-timer"><b></b></i></a><a class="rblx-shell-mini-banner rblx-shell-mini-banner-plus" data-rblx-plan-slide="plus" href="./subscriptions"><strong>Plus Plan</strong><span>$1.00 / month</span><i class="rblx-shell-plan-timer"><b></b></i></a></div>' +
                '<div class="rblx-shell-socials">' +
                  '<a href="https://x.com/Reese28575571" target="_blank" rel="noreferrer" aria-label="X">' + getSocialIcon("x") + '</a>' +
                  '<a href="https://www.youtube.com/@ItzReeseRBLX" target="_blank" rel="noreferrer" aria-label="YouTube">' + getSocialIcon("youtube") + '</a>' +
                  '<a href="https://discord.gg/TMmBQgYK32" target="_blank" rel="noreferrer" aria-label="Discord">' + getSocialIcon("discord") + '</a>' +
                  '<a href="https://www.twitch.tv/2muchreese" target="_blank" rel="noreferrer" aria-label="Twitch">' + getSocialIcon("twitch") + '</a>' +
                "</div>" +
              "</div>" +
            "</div>" +
          "</aside>" +
          '<div class="rblx-shell-center" role="main">' +
            '<div class="rblx-shell-page" id="rblxShellPage"></div>' +
          "</div>" +
          '<aside class="rblx-shell-right">' +
            '<div class="rblx-shell-right-inner">' +
              '<div class="rblx-shell-panel-head">' +
                '<h2 class="rblx-shell-panel-title">Community Chat</h2>' +
                '<button class="rblx-shell-toggle" type="button" id="rblxShellRightToggle" aria-label="Toggle chat">' + getChatToggleIcon() + '</button>' +
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
                '<div class="rblx-shell-chat-reply-banner" id="rblxShellChatReplyBanner" hidden><span id="rblxShellChatReplyText"></span><button type="button" data-chat-action="clear-reply" aria-label="Cancel reply">&times;</button></div>' +
                '<form class="rblx-shell-chat-compose" id="rblxShellChatForm">' +
                  '<input id="rblxShellChatInput" type="text" maxlength="160" placeholder="Enter a message..." />' +
                  '<div class="rblx-shell-chat-compose-actions">' +
                    '<button class="rblx-shell-chat-admin-button" type="button" id="rblxShellAdminButton" aria-label="Open admin panel" hidden>' + getNavIcon("shield") + '</button>' +
                    '<button class="rblx-shell-btn is-primary" type="submit" id="rblxShellChatSendButton">Send</button>' +
                  "</div>" +
                "</form>" +
                '<div class="rblx-shell-chat-foot">' +
                  '<a class="rblx-shell-chat-rules" href="#" id="rblxShellRulesLink">Chat Rules</a>' +
                "</div>" +
              "</div>" +
              '<div class="rblx-shell-box-ad" data-rblx-shell-box-ad aria-label="Advertisement"><span>Advertisement</span></div>' +
            "</div>" +
          "</aside>" +
        "</div>" +
        '<button class="rblx-mobile-side-menu-button" type="button" id="rblxMobileSideMenuButton" aria-label="Open navigation"><i></i><i></i><i></i></button>' +
        '<button class="rblx-mobile-overlay" type="button" id="rblxMobileOverlay" hidden aria-label="Close mobile panel"></button>' +
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
        '<div class="rblx-shell-checkout-overlay" id="rblxShellCheckoutOverlay" aria-hidden="true">' +
          '<div class="rblx-shell-checkout-modal" id="rblxShellCheckoutModal" role="dialog" aria-modal="true" aria-labelledby="rblxShellCheckoutTitle">' +
            '<div class="rblx-shell-checkout-confetti" aria-hidden="true">' + buildCheckoutConfetti() + '</div>' +
            '<div class="rblx-shell-checkout-kicker">Purchase Successful</div>' +
            '<h3 class="rblx-shell-checkout-title" id="rblxShellCheckoutTitle">Thanks for supporting RBLXTools</h3>' +
            '<p class="rblx-shell-checkout-copy" id="rblxShellCheckoutCopy">Your order went through and your account is being updated now.</p>' +
            '<div class="rblx-shell-checkout-grid">' +
              '<div class="rblx-shell-checkout-row"><span>Purchased</span><strong id="rblxShellCheckoutItem">RBTools Plus</strong></div>' +
              '<div class="rblx-shell-checkout-row"><span>Charged</span><strong id="rblxShellCheckoutAmount">$0.00</strong></div>' +
            '</div>' +
            '<div class="rblx-shell-checkout-thankyou">Thank you for supporting the tools, updates, and everything we are building next.</div>' +
            '<button class="rblx-shell-btn is-primary rblx-shell-checkout-button" type="button" id="rblxShellCheckoutClose" disabled>Back To Account (10)</button>' +
          '</div>' +
        '</div>' +
        '<div class="rblx-shell-reward-overlay" id="rblxShellRewardOverlay" aria-hidden="true">' +
          '<div class="rblx-shell-reward-modal" id="rblxShellRewardModal" role="dialog" aria-modal="true" aria-labelledby="rblxShellRewardTitle">' +
            '<div class="rblx-shell-reward-kicker">A gift from the RBLXTools team</div>' +
            '<h3 class="rblx-shell-reward-title" id="rblxShellRewardTitle">You\'ve received a reward!</h3>' +
            '<p class="rblx-shell-reward-value" id="rblxShellRewardValue"></p>' +
            '<div class="rblx-shell-reward-note"><span>Moderator note</span><p id="rblxShellRewardNote"></p></div>' +
            '<p class="rblx-shell-reward-wait" id="rblxShellRewardWait">Please take a moment to read this note.</p>' +
            '<button class="rblx-shell-btn is-primary rblx-shell-reward-claim" type="button" id="rblxShellRewardClaim" disabled>Claim reward</button>' +
            '<section class="rblx-shell-reward-feedback" id="rblxShellRewardFeedback" hidden><div class="rblx-shell-reward-feedback-head"><strong>Enjoying RBLXTools?</strong><span>Write a review</span></div><div class="rblx-shell-reward-stars" id="rblxShellRewardStars" role="radiogroup" aria-label="Rate RBLXTools from 1 to 5 stars"><button type="button" data-reward-rating="1" aria-label="1 star">★</button><button type="button" data-reward-rating="2" aria-label="2 stars">★</button><button type="button" data-reward-rating="3" aria-label="3 stars">★</button><button type="button" data-reward-rating="4" aria-label="4 stars">★</button><button type="button" data-reward-rating="5" aria-label="5 stars">★</button></div><label class="rblx-shell-reward-feedback-field"><span>Review title</span><input id="rblxShellRewardFeedbackTitle" type="text" maxlength="140" placeholder="What stood out?" /></label><label class="rblx-shell-reward-feedback-field"><span>Review</span><textarea id="rblxShellRewardFeedbackBody" maxlength="1200" placeholder="Tell us what you like or what we should improve."></textarea></label><p class="rblx-shell-reward-feedback-status" id="rblxShellRewardFeedbackStatus" aria-live="polite"></p><button class="rblx-shell-btn rblx-shell-reward-feedback-submit" type="button" id="rblxShellRewardFeedbackSubmit">Post feedback</button></section><p class="rblx-shell-reward-feedback-thanks" id="rblxShellRewardFeedbackThanks" hidden aria-live="polite">Your feedback has been documented. Thank you!</p>' +
          '</div>' +
          buildModalAdRailsMarkup() +
        '</div>' +
        '<div class="rblx-shell-auth-overlay" id="rblxShellAuthOverlay" aria-hidden="true">' +
          '<div class="rblx-shell-auth-modal" id="rblxShellAuthModal" role="dialog" aria-modal="true" aria-labelledby="rblxShellAuthTitle">' +
            '<button class="rblx-shell-auth-close" type="button" id="rblxShellAuthClose" aria-label="Close login">×</button>' +
            '<h3 class="rblx-shell-auth-title" id="rblxShellAuthTitle">Welcome back - sign in</h3>' +
            '<p class="rblx-shell-auth-copy" id="rblxShellAuthCopy">Sign in to keep your tools, membership, and account access connected.</p>' +
            '<div class="rblx-shell-auth-google hidden" id="rblxShellAuthGoogleSection">' +
              '<div class="rblx-shell-auth-google-wrap" id="rblxShellAuthGoogleWrap"></div>' +
              '<div class="rblx-shell-auth-google-note" id="rblxShellAuthGoogleNote"></div>' +
            '</div>' +
            '<div class="rblx-shell-auth-divider hidden" id="rblxShellAuthDivider"><span>or</span></div>' +
            '<form class="rblx-shell-auth-form" id="rblxShellAuthForm">' +
              '<label class="rblx-shell-auth-field">' +
                '<span>Email</span>' +
                '<input id="rblxShellAuthEmail" type="email" autocomplete="email" placeholder="you@example.com" />' +
              '</label>' +
              '<label class="rblx-shell-auth-field">' +
                '<span>Password</span>' +
                '<div class="rblx-shell-auth-password-wrap">' +
                  '<input id="rblxShellAuthPassword" type="password" autocomplete="current-password" placeholder="Enter your password" />' +
                  '<button class="rblx-shell-auth-password-toggle" type="button" id="rblxShellAuthTogglePassword">Show</button>' +
                '</div>' +
              '</label>' +
              '<div class="rblx-shell-auth-status" id="rblxShellAuthStatus"></div>' +
              '<button class="rblx-shell-btn is-primary rblx-shell-auth-submit" type="submit" id="rblxShellAuthSubmit">Sign In</button>' +
            '</form>' +
            '<div class="rblx-shell-auth-switch" id="rblxShellAuthSwitchPrompt">New to RBLXTools? <button type="button" id="rblxShellAuthSwitchButton">Start here</button></div>' +
          '</div>' +
          buildModalAdRailsMarkup() +
        '</div>' +
        '<div class="rblx-shell-support-overlay" id="rblxShellSupportOverlay" aria-hidden="true">' +
          '<div class="rblx-shell-support-modal" id="rblxShellSupportModal" role="dialog" aria-modal="true" aria-labelledby="rblxShellSupportTitle">' +
            '<div class="rblx-shell-support-kicker">Website Support</div>' +
            '<h3 class="rblx-shell-support-title" id="rblxShellSupportTitle">Send a report</h3>' +
            '<p class="rblx-shell-support-copy">Use this if something on the site, chat, or membership flow is off. Add a Discord username or an email so we can contact you back. If you are reporting a member, open their chat profile and copy the user ID shown there.</p>' +
            '<div class="rblx-shell-support-grid">' +
              '<label class="rblx-shell-support-field">' +
                '<span>Report reason</span>' +
                '<select id="rblxShellSupportCategory">' + getSupportCategoryOptionsMarkup() + '</select>' +
              '</label>' +
              '<label class="rblx-shell-support-field">' +
                '<span>Your user ID</span>' +
                '<input id="rblxShellSupportReporterId" type="text" placeholder="Your account user ID" maxlength="80" />' +
              '</label>' +
            '</div>' +
            '<div class="rblx-shell-support-grid">' +
              '<label class="rblx-shell-support-field">' +
                '<span>Discord username</span>' +
                '<input id="rblxShellSupportReporterDiscord" type="text" placeholder="Example: reese1234" maxlength="120" />' +
              '</label>' +
              '<label class="rblx-shell-support-field">' +
                '<span>Reply email</span>' +
                '<input id="rblxShellSupportReporterEmail" type="email" placeholder="name@example.com" maxlength="160" />' +
              '</label>' +
            '</div>' +
            '<div class="rblx-shell-support-help">At least one contact method is required so we can follow up with you.</div>' +
            '<div class="rblx-shell-support-target-wrap" id="rblxShellSupportReportedWrap" hidden>' +
              '<label class="rblx-shell-support-field">' +
                '<span>Reported user ID</span>' +
                '<input id="rblxShellSupportReportedId" type="text" placeholder="Open their chat profile and paste the user ID here" maxlength="80" />' +
              '</label>' +
              '<div class="rblx-shell-support-help">Tip: click their profile in live chat, then copy the user ID from the popup.</div>' +
            '</div>' +
            '<label class="rblx-shell-support-field">' +
              '<span>What happened?</span>' +
              '<textarea id="rblxShellSupportDetails" maxlength="1800" placeholder="Explain the issue as clearly as you can."></textarea>' +
            '</label>' +
            '<label class="rblx-shell-support-field">' +
              '<span>Picture / document (optional)</span>' +
              '<input id="rblxShellSupportAttachment" type="file" accept="image/*,.pdf,.txt,.doc,.docx,.zip" />' +
              '<div class="rblx-shell-support-help" id="rblxShellSupportAttachmentName">No file attached.</div>' +
            '</label>' +
            '<div class="rblx-shell-support-status" id="rblxShellSupportStatus"></div>' +
            '<div class="rblx-shell-support-actions">' +
              '<button class="rblx-shell-btn" type="button" id="rblxShellSupportCancel">Cancel</button>' +
              '<button class="rblx-shell-btn is-primary" type="button" id="rblxShellSupportSubmit">Submit Report</button>' +
            '</div>' +
          '</div>' +
        '</div>' +        '<div class="rblx-shell-site-lock" id="rblxShellSiteLock" aria-hidden="true">' +
          '<div class="rblx-shell-site-lock-card">' +
            '<div class="rblx-shell-site-lock-kicker">Website Locked</div>' +
            '<h3>Access Restricted</h3>' +
            '<p id="rblxShellSiteLockReason"></p>' +
          "</div>" +
        "</div>" +
        '<div class="rblx-shell-site-lock" id="rblxShellMaintenanceLock" aria-hidden="true">' +
          '<div class="rblx-shell-site-lock-card">' +
            '<div class="rblx-shell-site-lock-kicker">Maintenance Notice</div>' +
            '<h3 id="rblxShellMaintenanceTitle">Sorry, the site is under maintenance right now.</h3>' +
            '<p>This page is temporarily unavailable.</p>' +
            '<div class="rblx-shell-site-lock-note" id="rblxShellMaintenanceNote">This does not mean the servers are down. The RBLXTeam is currently updating the site. Please come back later.</div>' +
          "</div>" +
        "</div>" +
        buildAnimationMembershipGateMarkup() +
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
    var rewardType = drop && drop.rewardType || "plus";
    var rewardName = rewardType === "tokens" ? "AI Tokens" : rewardType === "pro" ? "Pro" : "Plus";
    var alreadyPlus = rewardType === "plus" && currentPlan === "plus";
    var expired = Boolean(drop && (drop.ended || new Date(drop.expiresAt).getTime() <= (Date.now() + (shellState.serverTimeOffset || 0))));
    var winnerLabel = claimedCount === 0 ? "No Winners" : (claimedCount === 1 ? "1 Winner" : claimedCount + " Winners");
    var buttonLabel = expired ? winnerLabel : (alreadyPlus ? "You Already Have Plus" : "Claim " + rewardName);
    var buttonAttrs = (expired || alreadyPlus) ? ' disabled aria-disabled="true"' : "";
    var durationMs = Math.max(1, new Date(drop.expiresAt).getTime() - new Date(drop.createdAt || drop.expiresAt).getTime());
    var remainingMs = Math.max(0, new Date(drop.expiresAt).getTime() - (Date.now() + (shellState.serverTimeOffset || 0)));
    var progressPercent = Math.max(0, Math.min(100, (remainingMs / durationMs) * 100));

    return (
      '<div class="rblx-shell-drop-message">' +
        '<div class="rblx-shell-drop-glare" aria-hidden="true"></div>' +
        '<div class="rblx-shell-drop-burst" aria-hidden="true">' + buildRewardBurstMarkup("rblx-shell-drop-plus", 16, rewardType) + "</div>" +
        '<div class="rblx-shell-drop-head">' +
          '<div class="rblx-shell-drop-kicker">Claimable ' + escapeHtml(rewardName) + " Drop</div>" +
          '<div class="rblx-shell-drop-chip' + (expired ? ' is-expired' : '') + '">' + (expired ? "Expired" : ("Ends In " + escapeHtml(formatCountdownTo(drop.expiresAt)))) + "</div>" +
        "</div>" +
        '<div class="rblx-shell-drop-title">' + escapeHtml(drop.title || ("Claim Free " + rewardName)) + "</div>" +
        '<div class="rblx-shell-event-progress"><span class="rblx-shell-event-progress-fill" style="width:' + progressPercent.toFixed(2) + '%;"></span></div>' +
        '<div class="rblx-shell-drop-meta"><span>' + escapeHtml(String(remainingClaims)) + " claims left</span><span>" + escapeHtml(getEventRewardLabel(rewardType, drop.amount || drop.days)) + "</span></div>" +
        '<div class="rblx-shell-drop-actions"><button class="rblx-shell-drop-btn" type="button" data-special-action="claim-drop"' + buttonAttrs + ">" + escapeHtml(buttonLabel) + "</button></div>" +
      "</div>"
    );
  }

  // rblx-shell-heart-burst
  function createShellHeartBurst(button) {
    if (!button) return;
    var rect = button.getBoundingClientRect();
    var heart = document.createElement("span");
    heart.className = "rblx-shell-heart-burst";
    heart.setAttribute("aria-hidden", "true");
    heart.innerHTML = "&#10084;";
    heart.style.left = (rect.left + rect.width / 2) + "px";
    heart.style.top = (rect.top + rect.height / 2) + "px";
    document.body.appendChild(heart);
    button.classList.add("is-hearting");
    window.setTimeout(function () { button.classList.remove("is-hearting"); }, 520);
    window.setTimeout(function () { heart.remove(); }, 900);
  }

  function renderChatMessages(target, messages, options) {
    var settings = options || {};
    var previousScrollTop = target.scrollTop;
    var previousScrollHeight = target.scrollHeight;
    var previousClientHeight = target.clientHeight;
    var distanceFromBottom = previousScrollHeight - (previousScrollTop + previousClientHeight);
    var shouldStickToBottom = Boolean(settings.forceBottom || distanceFromBottom <= 24);

    shellState.chatMessages = (Array.isArray(messages) ? messages : []).filter(function (message) {
      return !(message && message.specialType === "toolActivity");
    });
    shellState.profileCache = [];
    target.innerHTML = shellState.chatMessages.map(function (message, index) {
      var profile = getMessageProfile(message);
      shellState.profileCache[index] = profile;
      var isPro = String(profile.plan || "").toLowerCase() === "pro";
      var isPlus = String(profile.plan || "").toLowerCase() === "plus" || (!isPro && String(profile.badge || "").toLowerCase() === "plus");
      var isSystem = Boolean(profile.system);
      var isTimedOut = Boolean(profile.moderationTimeoutUntil && new Date(profile.moderationTimeoutUntil).getTime() > Date.now());
      var avatarMarkup = profile.avatarUrl
        ? '<img class="rblx-shell-chat-avatar-image" src="' + escapeHtml(profile.avatarUrl) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\';" />' +
          '<span class="rblx-shell-chat-avatar-fallback" style="display:none;">' + escapeHtml(profile.avatarText) + "</span>"
        : '<span class="rblx-shell-chat-avatar-fallback">' + escapeHtml(profile.avatarText) + "</span>";
      var badgeMarkup = "";
      var nameClass = isPro ? ' class="rblx-shell-chat-name-text is-pro"' : (isPlus ? ' class="rblx-shell-chat-name-text is-plus"' : ' class="rblx-shell-chat-name-text"');
      var messageBody = message && message.specialType === "claimDrop" && message.claimDrop
        ? buildClaimDropMessage(message, message.claimDrop)
        : '<div class="rblx-shell-chat-text">' + escapeHtml(message.text) + "</div>";
      var heartUserIds = Array.isArray(message && message.heartUserIds) ? message.heartUserIds.map(String) : [];
      var viewerId = String((shellState.currentUser && shellState.currentUser.userId) || "");
      var hearted = Boolean(viewerId && heartUserIds.includes(viewerId));
      var chatActions = !isSystem
        ? '<div class="rblx-shell-chat-actions"><button type="button" class="rblx-shell-chat-action' + (hearted ? ' is-active' : '') + '" data-chat-action="heart" data-chat-index="' + index + '">&#10084; ' + heartUserIds.length + '</button><button type="button" class="rblx-shell-chat-action" data-chat-action="reply" data-chat-index="' + index + '">&#8618; Reply</button></div>'
        : "";

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
                badgeMarkup +
                (isPro ? '<span class="rblx-shell-chat-plus-mark is-pro">&#128736;</span>' : (isPlus ? '<span class="rblx-shell-chat-plus-mark">+</span>' : "")) +
                '<span' + nameClass + '>' + escapeHtml(profile.displayName) + "</span>" +
              "</button>" +
            "</div>" +
            messageBody + chatActions +
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

  function renderChatMessagesFallback(target, messages) {
    if (!target) return;
    var safeMessages = Array.isArray(messages) ? messages : [];
    target.innerHTML = safeMessages.map(function (message) {
      var name = escapeHtml(String((message && (message.displayName || message.username || message.name)) || 'Guest'));
      var textValue = escapeHtml(String((message && message.text) || ''));
      var isPro = String((message && message.plan) || '').toLowerCase() === 'pro';
      var isPlus = String((message && message.plan) || '').toLowerCase() === 'plus' || (!isPro && Boolean(message && message.isPlus));
      var badgeMarkup = isPro ? '<span class="rblx-shell-chat-plus-mark is-pro">&#128736;</span>' : (isPlus ? '<span class="rblx-shell-chat-plus-mark">+</span>' : "");
      return '<article class="rblx-shell-chat-message">' +
        '<div class="rblx-shell-chat-avatar-button"><span class="rblx-shell-chat-avatar"><span class="rblx-shell-chat-avatar-fallback">' + name.charAt(0).toUpperCase() + '</span></span></div>' +
        '<div><div class="rblx-shell-chat-name">' + badgeMarkup + '<span class="rblx-shell-chat-name-text' + (isPro ? ' is-pro' : (isPlus ? ' is-plus' : '')) + '">' + name + '</span></div><div class="rblx-shell-chat-text">' + textValue + '</div></div>' +
      '</article>';
    }).join('');
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

  function buildProfileProFloats() {
    return buildProfilePlusFloats().replaceAll('rblx-shell-profile-plus-float', 'rblx-shell-profile-plus-float rblx-shell-profile-pro-float').replaceAll('>+</span>', '>&#128736;</span>');
  }

  function openProfileModal(message, anchorEl) {
    var index = message && message.__chatIndex != null ? Number(message.__chatIndex) : -1;
    if (!shellState.currentProfile || !shellState.currentProfile.displayName) {
      refreshCurrentProfile();
    }
    var profile = index >= 0 && shellState.profileCache[index] ? shellState.profileCache[index] : getMessageProfile(message);
    var isPro = String(profile.plan || "").toLowerCase() === "pro";
    var isPlus = String(profile.plan || "").toLowerCase() === "plus" || (!isPro && String(profile.badge || "").toLowerCase() === "plus");
    shellState.lastViewedProfileUserId = profile.userId || "";

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
    shellState.profileName.classList.toggle("is-pro", isPro);
    shellState.profileModal.classList.toggle("is-plus", isPlus);
    shellState.profileModal.classList.toggle("is-pro", isPro);
    if (shellState.profilePlan) {
      shellState.profilePlan.classList.toggle("is-plus", isPlus);
      shellState.profilePlan.classList.toggle("is-pro", isPro);
    }
    var profileFloats = shellState.profileModal && shellState.profileModal.querySelector(".rblx-shell-profile-pluses");
    if (profileFloats) profileFloats.innerHTML = isPro ? buildProfileProFloats() : buildProfilePlusFloats();
    if (shellState.profilePlusMark) shellState.profilePlusMark.innerHTML = isPro ? "&#128736;" : "+";
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

  window.RBLXToolsProfile = {
    open: function (profile, anchorEl) {
      if (!profile) return;
      openProfileModal(profile, anchorEl || null);
    },
    close: closeProfileModal,
    getCurrentIdentity: function () {
      var identity = getSocketChatIdentity() || {};
      return {
        userId: shellState.currentUser && shellState.currentUser.userId ? String(shellState.currentUser.userId) : "",
        displayName: identity.displayName || "",
        username: identity.username || "",
        avatarUrl: identity.avatarUrl || "",
        bio: identity.bio || "",
        plan: identity.plan || "free",
        isPlus: Boolean(identity.isPlus)
      };
    }
  };

  function setSupportStatus(message, tone) {
    if (!shellState.supportStatus) return;
    shellState.supportStatus.textContent = message || "";
    shellState.supportStatus.className = "rblx-shell-support-status" + (tone ? " is-" + tone : "");
  }

  function setAuthStatus(message, tone) {
    if (!shellState.authStatus) return;
    shellState.authStatus.textContent = message || "";
    shellState.authStatus.className = "rblx-shell-auth-status" + (tone ? " is-" + tone : "");
  }

  function getCleanCurrentUrl() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete("auth");
      return url.toString();
    } catch (_error) {
      return window.location.href;
    }
  }

  function saveAuthMode(mode) {
    try {
      localStorage.setItem(AUTH_MODE_KEY, mode === "signup" ? "signup" : "login");
    } catch (_error) {}
  }

  function loadGoogleScript() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      return Promise.resolve();
    }
    if (window.__rblxGoogleScriptPromise) {
      return window.__rblxGoogleScriptPromise;
    }

    window.__rblxGoogleScriptPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + GOOGLE_SCRIPT_SRC + '"]');
      if (existing) {
        existing.addEventListener("load", function () { resolve(); }, { once: true });
        existing.addEventListener("error", function () { reject(new Error("Could not load Google Sign-In.")); }, { once: true });
        return;
      }

      var script = document.createElement("script");
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("Could not load Google Sign-In.")); };
      document.head.appendChild(script);
    });

    return window.__rblxGoogleScriptPromise;
  }

  function setAuthMode(mode) {
    shellState.authMode = mode === "signup" ? "signup" : "login";
    saveAuthMode(shellState.authMode);
    if (shellState.authLoginTab) {
      shellState.authLoginTab.classList.toggle("is-active", shellState.authMode === "login");
    }
    if (shellState.authSignupTab) {
      shellState.authSignupTab.classList.toggle("is-active", shellState.authMode === "signup");
    }
    if (shellState.authTitle) {
      shellState.authTitle.textContent = shellState.authMode === "signup" ? "Create your account" : "Welcome back - sign in";
    }
    if (shellState.authCopy) {
      shellState.authCopy.textContent = shellState.authMode === "signup"
        ? "Create an account to connect your tools, membership, and future purchases to one profile."
        : "Sign in to keep your tools, membership, and account access connected.";
    }
    if (shellState.authSubmit) {
      shellState.authSubmit.textContent = shellState.authMode === "signup" ? "Create Account" : "Sign In";
      shellState.authSubmit.disabled = false;
    }
    if (shellState.authPassword) {
      shellState.authPassword.autocomplete = shellState.authMode === "signup" ? "new-password" : "current-password";
    }
    if (shellState.authSwitchPrompt && shellState.authSwitchButton) {
      shellState.authSwitchPrompt.firstChild.textContent = shellState.authMode === "signup" ? "Already have an account? " : "New to RBLXTools? ";
      shellState.authSwitchButton.textContent = shellState.authMode === "signup" ? "Sign in" : "Start here";
    }
    if (shellState.authGoogleNote) {
      shellState.authGoogleNote.textContent = shellState.authMode === "signup"
        ? "Use Google with the email you want tied to your RBLXTools account."
        : "Use the same Google email tied to your existing RBLXTools account.";
    }
    renderAuthGoogleButton();
    setAuthStatus("", "");
  }

  function closeAuthModal() {
    if (!shellState.authOverlay || !shellState.authModal) return;
    shellState.authOverlay.classList.remove("is-open");
    shellState.authOverlay.setAttribute("aria-hidden", "true");
    shellState.authModal.classList.remove("is-open");
    document.body.classList.remove("rblx-shell-modal-open");
    shellState.authReturnUrl = "";
    setAuthStatus("", "");
  }

  function openAuthModal(options) {
    options = options || {};
    if (!shellState.authOverlay || !shellState.authModal) return;
    var mode = options.mode || shellState.authMode || readRawStorage(AUTH_MODE_KEY) || "login";
    shellState.authReturnUrl = String(options.returnTo || getCleanCurrentUrl() || "").trim();
    setAuthMode(mode);
    if (shellState.authPassword) {
      shellState.authPassword.value = "";
      shellState.authPassword.type = "password";
    }
    if (shellState.authTogglePassword) {
      shellState.authTogglePassword.textContent = "Show";
    }
    setAuthStatus(options.message || "", "");
    shellState.authOverlay.classList.add("is-open");
    shellState.authOverlay.setAttribute("aria-hidden", "false");
    shellState.authModal.classList.add("is-open");
    document.body.classList.add("rblx-shell-modal-open");
    mountModalVerticalAds(shellState.authOverlay);
    if (shellState.authEmail && !shellState.authEmail.value) {
      var cachedUser = getCachedAuthUser();
      shellState.authEmail.value = String(cachedUser && cachedUser.email || "").trim();
    }
    window.setTimeout(function () {
      if (shellState.authEmail) {
        shellState.authEmail.focus();
      }
    }, 40);
    loadAuthGoogleConfig();
  }

  window.RBLXToolsAuth = window.RBLXToolsAuth || {};
  window.RBLXToolsAuth.open = function (options) {
    openAuthModal(options || { mode: "login" });
  };
  window.addEventListener("rblxtools-open-auth", function (event) {
    openAuthModal(event && event.detail ? event.detail : { mode: "login" });
  });

  function finishAuthSuccess(result, successMessage) {
    var user = result && result.user ? result.user : null;
    setChatAuthToken(result && result.token ? result.token : "");
    saveCachedAuthUser(user);
    writeCachedPlusStatus(hasPlusFromPayload(result) || hasPlusFromPayload(user));
    clearLegacyAuthTokenCache();
    setAuthStatus(successMessage, "success");
    var nextState = buildUserStateFromPayload(result, shellState.moderation) || resolveUserState();
    if (nextState && typeof nextState.then !== "function") {
      updateAuthUi(nextState);
    }
    dispatchMembershipUpdate({
      user: user || {},
      plan: hasPlusFromPayload(result) || hasPlusFromPayload(user) ? "plus" : "free"
    });
    window.setTimeout(function () {
      var destination = shellState.authReturnUrl || getCleanCurrentUrl();
      closeAuthModal();
      window.location.href = destination;
    }, 350);
  }

  function waitForAuthRetry(delay) {
    return new Promise(function (resolve) { window.setTimeout(resolve, delay); });
  }

  function isTemporaryAuthStatus(status) {
    return status === 429 || status === 502 || status === 503 || status === 504;
  }

  async function authApiRequest(path, options) {
    var requestOptions = Object.assign({ credentials: "include" }, options || {});

    // A brief retry covers a cold/restarting app server without showing a false failed login.
    for (var attempt = 0; attempt < 2; attempt += 1) {
      var response;
      try {
        response = await fetch(API_BASE + path, requestOptions);
      } catch (_error) {
        if (attempt === 0) {
          await waitForAuthRetry(600);
          continue;
        }
        throw new Error("The sign-in service is temporarily unavailable. Please try again in a moment.");
      }

      var contentType = response.headers.get("content-type") || "";
      var payload = contentType.indexOf("application/json") !== -1
        ? await response.json().catch(function () { return null; })
        : null;

      if (response.ok) return payload || {};

      if (isTemporaryAuthStatus(response.status) && attempt === 0) {
        await waitForAuthRetry(600);
        continue;
      }

      if (payload && payload.error) throw new Error(payload.error);
      throw new Error(isTemporaryAuthStatus(response.status)
        ? "The sign-in service is temporarily unavailable. Please try again in a moment."
        : "We could not complete that request. Please check your details and try again.");
    }

    throw new Error("The sign-in service is temporarily unavailable. Please try again in a moment.");
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!shellState.authEmail || !shellState.authPassword || !shellState.authSubmit) return;

    var email = String(shellState.authEmail.value || "").trim();
    var password = shellState.authPassword.value || "";
    if (!email || !password) {
      setAuthStatus("Enter your email and password first.", "error");
      return;
    }

    shellState.authSubmit.disabled = true;
    setAuthStatus(shellState.authMode === "signup" ? "Creating your account..." : "Signing you in...", "");

    try {
      var result = await authApiRequest(shellState.authMode === "signup" ? "/auth/signup" : "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password })
      });
      finishAuthSuccess(result, shellState.authMode === "signup" ? "Account created. Redirecting..." : "Login successful. Redirecting...");
    } catch (error) {
      setAuthStatus(error.message || "Request failed.", "error");
      shellState.authSubmit.disabled = false;
    }
  }

  function toggleAuthPasswordVisibility() {
    if (!shellState.authPassword || !shellState.authTogglePassword) return;
    var hidden = shellState.authPassword.type === "password";
    shellState.authPassword.type = hidden ? "text" : "password";
    shellState.authTogglePassword.textContent = hidden ? "Hide" : "Show";
  }

  async function handleGoogleCredential(response) {
    if (!response || !response.credential) {
      setAuthStatus("Google sign-in did not return a credential.", "error");
      return;
    }
    if (shellState.authSubmit) {
      shellState.authSubmit.disabled = true;
    }
    setAuthStatus("Signing you in with Google...", "");
    try {
      var result = await authApiRequest("/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: response.credential })
      });
      finishAuthSuccess(result, "Google sign-in successful. Redirecting...");
    } catch (error) {
      setAuthStatus(error.message || "Google sign-in failed.", "error");
      if (shellState.authSubmit) {
        shellState.authSubmit.disabled = false;
      }
    }
  }

  function renderAuthGoogleButton() {
    if (!shellState.authGoogleWrap || !shellState.authGoogleClientId || !window.google || !window.google.accounts || !window.google.accounts.id) {
      return;
    }
    shellState.authGoogleWrap.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: shellState.authGoogleClientId,
      callback: handleGoogleCredential
    });
    window.google.accounts.id.renderButton(shellState.authGoogleWrap, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: shellState.authMode === "signup" ? "signup_with" : "signin_with",
      logo_alignment: "left",
      width: Math.min(380, Math.max(240, Math.floor(window.innerWidth - 90)))
    });
  }

  async function loadAuthGoogleConfig() {
    if (shellState.authGoogleClientId) {
      renderAuthGoogleButton();
      return;
    }
    try {
      var config = await authApiRequest("/auth/google/config", { method: "GET", cache: "no-store" });
      if (!config || !config.enabled || !config.clientId) {
        return;
      }
      shellState.authGoogleClientId = String(config.clientId || "");
      if (shellState.authDivider) {
        shellState.authDivider.classList.remove("hidden");
      }
      if (shellState.authGoogleSection) {
        shellState.authGoogleSection.classList.remove("hidden");
      }
      await loadGoogleScript();
      renderAuthGoogleButton();
    } catch (_error) {}
  }

  function setupAuthModal() {
    shellState.authOverlay = document.getElementById("rblxShellAuthOverlay");
    shellState.authModal = document.getElementById("rblxShellAuthModal");
    shellState.authClose = document.getElementById("rblxShellAuthClose");
    shellState.authLoginTab = document.getElementById("rblxShellAuthLoginTab");
    shellState.authSignupTab = document.getElementById("rblxShellAuthSignupTab");
    shellState.authForm = document.getElementById("rblxShellAuthForm");
    shellState.authTitle = document.getElementById("rblxShellAuthTitle");
    shellState.authCopy = document.getElementById("rblxShellAuthCopy");
    shellState.authSubmit = document.getElementById("rblxShellAuthSubmit");
    shellState.authEmail = document.getElementById("rblxShellAuthEmail");
    shellState.authPassword = document.getElementById("rblxShellAuthPassword");
    shellState.authTogglePassword = document.getElementById("rblxShellAuthTogglePassword");
    shellState.authStatus = document.getElementById("rblxShellAuthStatus");
    shellState.authGoogleWrap = document.getElementById("rblxShellAuthGoogleWrap");
    shellState.authGoogleSection = document.getElementById("rblxShellAuthGoogleSection");
    shellState.authGoogleNote = document.getElementById("rblxShellAuthGoogleNote");
    shellState.authDivider = document.getElementById("rblxShellAuthDivider");
    shellState.authSwitchPrompt = document.getElementById("rblxShellAuthSwitchPrompt");
    shellState.authSwitchButton = document.getElementById("rblxShellAuthSwitchButton");
    shellState.authMode = readRawStorage(AUTH_MODE_KEY) === "signup" ? "signup" : "login";

    if (shellState.authClose) {
      shellState.authClose.addEventListener("click", closeAuthModal);
    }
    if (shellState.authOverlay) {
      shellState.authOverlay.addEventListener("click", function (event) {
        if (event.target === shellState.authOverlay) {
          closeAuthModal();
        }
      });
    }
    if (shellState.authLoginTab) {
      shellState.authLoginTab.addEventListener("click", function () { setAuthMode("login"); });
    }
    if (shellState.authSignupTab) {
      shellState.authSignupTab.addEventListener("click", function () { setAuthMode("signup"); });
    }
    if (shellState.authSwitchButton) {
      shellState.authSwitchButton.addEventListener("click", function () {
        setAuthMode(shellState.authMode === "signup" ? "login" : "signup");
      });
    }
    if (shellState.authTogglePassword) {
      shellState.authTogglePassword.addEventListener("click", toggleAuthPasswordVisibility);
    }
    if (shellState.authForm) {
      shellState.authForm.addEventListener("submit", handleAuthSubmit);
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && shellState.authOverlay && shellState.authOverlay.classList.contains("is-open")) {
        closeAuthModal();
      }
    });

    document.addEventListener("click", function (event) {
      var trigger = event.target && event.target.closest && event.target.closest('a[href="./login"], a[href="./login.html"], a[href*="./login?"], a[href="/login"], a[href="/login.html"], a[href*="/login?"]');
      if (!trigger) return;
      event.preventDefault();
      var href = trigger.getAttribute("href") || "";
      var mode = href.indexOf("mode=signup") !== -1 ? "signup" : "login";
      openAuthModal({ mode: mode, returnTo: getCleanCurrentUrl() });
    });

    window.RBLXToolsAuthModal = {
      open: openAuthModal,
      close: closeAuthModal
    };

    var queryMode = "";
    try {
      queryMode = new URLSearchParams(window.location.search || "").get("auth") || "";
    } catch (_error) {}
    var pendingOpen = "";
    try {
      pendingOpen = sessionStorage.getItem(AUTH_PENDING_OPEN_KEY) || "";
    } catch (_error) {}
    var pendingMode = "";
    try {
      pendingMode = sessionStorage.getItem(AUTH_PENDING_MODE_KEY) || "";
      sessionStorage.removeItem(AUTH_PENDING_OPEN_KEY);
      sessionStorage.removeItem(AUTH_PENDING_MODE_KEY);
    } catch (_error) {}
    if (queryMode === "login" || queryMode === "signup" || pendingOpen === "1") {
      openAuthModal({ mode: pendingMode || queryMode || "login" });
    } else {
      setAuthMode(shellState.authMode);
    }
  }

  function getCurrentSupportReporterId() {
    if (shellState.currentUser && shellState.currentUser.userId) {
      return String(shellState.currentUser.userId);
    }
    var cachedUser = getCachedAuthUser();
    return cachedUser && cachedUser.id ? String(cachedUser.id) : "";
  }

  function getCurrentSupportReplyEmail() {
    if (shellState.currentUser && shellState.currentUser.email) {
      return String(shellState.currentUser.email);
    }
    var cachedUser = getCachedAuthUser();
    return String(cachedUser && cachedUser.email || "");
  }

  function toggleSupportTargetField() {
    if (!shellState.supportCategory || !shellState.supportReportedIdWrap) return;
    var needsTarget = String(shellState.supportCategory.value || "") === "user_report";
    shellState.supportReportedIdWrap.hidden = !needsTarget;
    if (needsTarget && shellState.supportReportedId && !shellState.supportReportedId.value && shellState.lastViewedProfileUserId) {
      shellState.supportReportedId.value = shellState.lastViewedProfileUserId;
    }
  }

  function openSupportModal() {
    if (!(shellState.currentUser && shellState.currentUser.loggedIn)) {
      window.alert("Please log in before sending a support report.");
      return;
    }
    if (!shellState.supportOverlay) return;
    if (shellState.supportReporterId) {
      shellState.supportReporterId.value = getCurrentSupportReporterId();
    }
    if (shellState.supportReporterDiscord) {
      shellState.supportReporterDiscord.value = "";
    }
    if (shellState.supportReporterEmail) {
      shellState.supportReporterEmail.value = getCurrentSupportReplyEmail();
    }
    if (shellState.supportCategory) {
      shellState.supportCategory.value = shellState.supportCategory.value || "website_bug";
    }
    if (shellState.supportDetails) {
      shellState.supportDetails.value = "";
    }
    if (shellState.supportAttachment) {
      shellState.supportAttachment.value = "";
    }
    if (shellState.supportAttachmentName) {
      shellState.supportAttachmentName.textContent = "No file attached.";
    }
    if (shellState.supportReportedId) {
      shellState.supportReportedId.value = shellState.lastViewedProfileUserId || "";
    }
    toggleSupportTargetField();
    setSupportStatus("", "");
    shellState.supportOverlay.classList.add("is-open");
    shellState.supportOverlay.setAttribute("aria-hidden", "false");
  }

  function closeSupportModal() {
    if (!shellState.supportOverlay) return;
    shellState.supportOverlay.classList.remove("is-open");
    shellState.supportOverlay.setAttribute("aria-hidden", "true");
    setSupportStatus("", "");
  }

  function readSupportAttachment(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        resolve(null);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error("Attachment must be 5 MB or smaller."));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        resolve({
          name: file.name || "attachment",
          type: file.type || "application/octet-stream",
          size: file.size || 0,
          dataUrl: typeof reader.result === "string" ? reader.result : ""
        });
      };
      reader.onerror = function () {
        reject(new Error("Could not read that attachment."));
      };
      reader.readAsDataURL(file);
    });
  }

  async function submitSupportReport() {
    if (!(shellState.currentUser && shellState.currentUser.loggedIn)) {
      window.alert("Please log in before sending a support report.");
      return;
    }
    if (!shellState.supportCategory || !shellState.supportReporterId || !shellState.supportDetails || !shellState.supportSubmit) {
      return;
    }

    var category = String(shellState.supportCategory.value || "").trim();
    var reporterUserId = String(shellState.supportReporterId.value || "").trim();
    var reporterDiscordUsername = shellState.supportReporterDiscord ? String(shellState.supportReporterDiscord.value || "").trim() : "";
    var reporterEmail = shellState.supportReporterEmail ? String(shellState.supportReporterEmail.value || "").trim() : "";
    var details = String(shellState.supportDetails.value || "").trim();
    var reportedUserId = shellState.supportReportedId ? String(shellState.supportReportedId.value || "").trim() : "";

    if (!reporterUserId) {
      setSupportStatus("Your user ID is required.", "error");
      return;
    }
    if (!details) {
      setSupportStatus("Please explain what happened before sending the report.", "error");
      return;
    }
    if (!reporterDiscordUsername && !reporterEmail) {
      setSupportStatus("Add a Discord username or an email so we can contact you back.", "error");
      return;
    }
    if (category === "user_report" && !reportedUserId) {
      setSupportStatus("A reported user ID is required for member reports.", "error");
      return;
    }

    shellState.supportSubmit.disabled = true;
    if (shellState.supportCancel) {
      shellState.supportCancel.disabled = true;
    }
    setSupportStatus("Sending report...", "");

    try {
      var attachmentFile = shellState.supportAttachment && shellState.supportAttachment.files ? shellState.supportAttachment.files[0] : null;
      var attachment = await readSupportAttachment(attachmentFile);
      var response = await fetch(API_BASE + "/support/report", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          category: category,
          reporterUserId: reporterUserId,
          reporterDiscordUsername: reporterDiscordUsername,
          reporterEmail: reporterEmail,
          reportedUserId: reportedUserId,
          details: details,
          pageUrl: window.location.href,
          reporterDisplayName: shellState.currentUser && shellState.currentUser.displayName ? shellState.currentUser.displayName : "",
          attachment: attachment
        })
      });
      var result = await response.json().catch(function () { return null; });
      if (!response.ok) {
        throw new Error(result && result.error ? result.error : "Request failed.");
      }
      setSupportStatus("Report submitted successfully.", "success");
      window.setTimeout(function () {
        closeSupportModal();
      }, 700);
    } catch (error) {
      setSupportStatus(error.message || "Could not send the support report.", "error");
    } finally {
      shellState.supportSubmit.disabled = false;
      if (shellState.supportCancel) {
        shellState.supportCancel.disabled = false;
      }
    }
  }

  function syncChatIdentity() {
    if (!shellState.chatList || !shellState.chatMessages.length) return;
          renderChatMessages(shellState.chatList, shellState.chatMessages);
  }

  function updateChatReplyBanner() {
    var banner = document.getElementById("rblxShellChatReplyBanner");
    var text = document.getElementById("rblxShellChatReplyText");
    if (!banner || !text) return;
    var reply = shellState.chatReplyTo;
    if (!reply) {
      banner.hidden = true;
      text.textContent = "";
      return;
    }
    var name = String(reply.displayName || reply.username || "Member").trim() || "Member";
    var preview = String(reply.text || "").trim().replace(/\s+/g, " ").slice(0, 72);
    text.textContent = "Replying to " + name + (preview ? ": " + preview : "");
    banner.hidden = false;
  }

  async function postChatAction(path, body) {
    var response = await fetch(API_BASE + path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-RBLX-Device-Id": shellState.deviceId || getDeviceId() },
      body: JSON.stringify(body)
    });
    var payload = await response.json().catch(function () { return null; });
    if (!response.ok) throw new Error((payload && payload.error) || "Live chat action failed.");
    return payload || {};
  }

  function applyChatSyncSnapshot(payload) {
    if (!payload || typeof payload !== "object") return;
    var history = Array.isArray(payload.history) ? payload.history.filter(function (message) {
      return !(message && message.specialType === "toolActivity");
    }) : null;
    if (history) {
      var historyChanged = history.length !== shellState.chatMessages.length || history.some(function (message, index) {
        var current = shellState.chatMessages[index];
        return !current || !message || String(current.id || "") !== String(message.id || "") ||
          String(current.updatedAt || current.createdAt || "") !== String(message.updatedAt || message.createdAt || "");
      });
      shellState.chatMessages = history;
      cacheChatMessages(history);
      // Always paint the first server response. Later background syncs only repaint changes.
      if ((!shellState.chatHistoryHydrated || historyChanged) && shellState.chatList) {
        renderChatMessages(shellState.chatList, history, { forceBottom: !shellState.chatHistoryHydrated });
      }
      shellState.chatHistoryHydrated = true;
    }
    if (typeof payload.onlineCount === "number") {
      // OpenLiteSpeed can briefly report an empty room during a socket reconnect.
      // Preserve the last confirmed count instead of visibly dropping to zero.
      var reportedCount = Math.max(0, payload.onlineCount);
      if (reportedCount > 0 || shellState.onlineCount === 0) shellState.onlineCount = reportedCount;
      var onlineEl = document.getElementById("rblxShellOnlineCount");
      if (onlineEl) onlineEl.textContent = String(Math.max(0, shellState.onlineCount));
    }
  }

  async function syncChatFromServer() {
    if (shellState.chatSyncInFlight) return;
    shellState.chatSyncInFlight = true;
    try {
      var response = await fetch(API_BASE + "/chat/sync?room=rblxtools-main", {
        method: "GET",
        credentials: "include",
        cache: "no-store"
      });
      if (!response.ok) return;
      applyChatSyncSnapshot(await response.json().catch(function () { return null; }));
    } catch (_error) {
      // Socket.IO remains the primary live transport; polling is its OpenLiteSpeed-safe fallback.
    } finally {
      shellState.chatSyncInFlight = false;
    }
  }

  function initChatSyncPolling() {
    if (shellState.chatSyncTimer) return;
    if (!shellState.socketReady) syncChatFromServer();
    shellState.chatSyncTimer = window.setInterval(function () {
      // Use HTTP sync only while the live socket is unavailable.
      ensureChatSocketConnection();
      if (!shellState.socketReady) syncChatFromServer();
    }, 15000);
    window.addEventListener("focus", function () {
      ensureChatSocketConnection();
      if (!shellState.socketReady) syncChatFromServer();
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        ensureChatSocketConnection();
        if (!shellState.socketReady) syncChatFromServer();
      }
    });
  }

  function ensureChatSocketConnection() {
    if (shellState.socketReady || shellState.chatSocketBooting) return;
    if (shellState.socket && typeof shellState.socket.connect === "function") {
      try {
        shellState.socket.connect();
        return;
      } catch (_error) {}
    }
    connectChatSocket();
  }

  function initChat() {
    var list = document.getElementById("rblxShellChatScroll");
    var form = document.getElementById("rblxShellChatForm");
    var input = document.getElementById("rblxShellChatInput");
    var sendButton = document.getElementById("rblxShellChatSendButton");
    var adminButton = document.getElementById("rblxShellAdminButton");
    var reportButton = document.getElementById("rblxShellReportButton");
    var chatAlert = document.getElementById("rblxShellChatAlert");
    var chatAlertText = document.getElementById("rblxShellChatAlertText");
    var chatSpecials = document.getElementById("rblxShellChatSpecials");
    var chatBottom = document.getElementById("rblxShellChatBottom");
    var chatRainOverlay = document.getElementById("rblxShellChatRainOverlay");
    var replyBanner = document.getElementById("rblxShellChatReplyBanner");
    if (!list || !form || !input || !sendButton) return;

    shellState.chatList = list;
    shellState.chatInput = input;
    shellState.chatSendButton = sendButton;
    shellState.chatAdminButton = adminButton;
    shellState.chatReportButton = reportButton;
    shellState.chatAlert = chatAlert;
    shellState.chatAlertText = chatAlertText;
    shellState.chatSpecials = chatSpecials;
    shellState.chatBottom = chatBottom;
    shellState.chatRainOverlay = chatRainOverlay;
    if (shellState.chatAdminButton) {
      shellState.chatAdminButton.hidden = true;
      shellState.chatAdminButton.style.display = "none";
    }
    if (shellState.chatReportButton) {
      shellState.chatReportButton.addEventListener("click", openSupportModal);
    }
    updateChatReplyBanner();
    if (replyBanner) {
      replyBanner.addEventListener("click", function (event) {
        var clearButton = event.target && event.target.closest ? event.target.closest("[data-chat-action=\"clear-reply\"]") : null;
        if (!clearButton) return;
        shellState.chatReplyTo = null;
        input.placeholder = "Enter a message...";
        updateChatReplyBanner();
      });
    }
    var cachedMessages = getCachedChatMessages();
    renderChatMessages(list, cachedMessages.length ? cachedMessages : starterMessages, { forceBottom: true });
    initChatSyncPolling();

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
      var actionButton = target && target.closest ? target.closest("[data-chat-action]") : null;
      if (actionButton && actionButton.getAttribute("data-chat-action") === "heart") {
        if (!shellState.currentUser || !shellState.currentUser.loggedIn) return void openAuthModal({ mode: "login", message: "Log in or sign up to react in live chat." });
        if (!actionButton.classList.contains("is-active")) createShellHeartBurst(actionButton);
        var messageId = shellState.chatMessages[Number(actionButton.getAttribute("data-chat-index"))]?.id;
        if (messageId) postChatAction("/chat/react", { room: "rblxtools-main", messageId: messageId }).then(function (payload) {
          if (Array.isArray(payload.history)) {
            shellState.chatMessages = payload.history;
            cacheChatMessages(payload.history);
            renderChatMessages(shellState.chatList, payload.history);
          }
        }).catch(function (error) { setChatAlert(error.message || "Could not update that reaction.", "ban"); });
        return;
      }
      if (actionButton && actionButton.getAttribute("data-chat-action") === "reply") {
        var replyMessage = shellState.chatMessages[Number(actionButton.getAttribute("data-chat-index"))];
        if (replyMessage) { shellState.chatReplyTo = { id: replyMessage.id, displayName: replyMessage.displayName || replyMessage.name, username: replyMessage.username || replyMessage.displayName || replyMessage.name, text: replyMessage.text }; input.placeholder = "Enter a message..."; updateChatReplyBanner(); input.focus(); }
        return;
      }
      var button = target && target.closest ? target.closest("[data-chat-action='profile']") : null;
      if (!button) return;

      var index = Number(button.getAttribute("data-chat-index"));
      if (!isFinite(index) || index < 0 || index >= shellState.chatMessages.length) return;
      var message = shellState.chatMessages[index];
      message.__chatIndex = index;
      openProfileModal(message, button);
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!shellState.currentUser || !shellState.currentUser.loggedIn) {
        if (window.RBLXToolsAuth && typeof window.RBLXToolsAuth.open === "function") {
          window.RBLXToolsAuth.open({ mode: "login", message: "Log in or sign up to use live chat." });
        } else {
          window.dispatchEvent(new CustomEvent("rblxtools-open-auth", { detail: { mode: "login", message: "Log in or sign up to use live chat." } }));
        }
        return;
      }
      var value = input.value.trim();
      if (!value) return;
      try {
        var result = await postChatAction("/chat/message", {
        room: "rblxtools-main",
        text: value,
        displayName: getSocketChatIdentity().displayName,
        username: getSocketChatIdentity().username,
        avatarUrl: getSocketChatIdentity().avatarUrl,
        bio: getSocketChatIdentity().bio,
        plan: getSocketChatIdentity().plan,
        isPlus: getSocketChatIdentity().isPlus,
        isGuest: getSocketChatIdentity().isGuest,
        replyTo: shellState.chatReplyTo
        });
        if (result.message && !shellState.chatMessages.some(function (entry) { return entry && entry.id === result.message.id; })) {
          var nextMessages = shellState.chatMessages.concat(result.message).slice(-80);
          shellState.chatMessages = nextMessages;
          cacheChatMessages(nextMessages);
          renderChatMessages(shellState.chatList, nextMessages, { forceBottom: true });
        }
      } catch (error) {
        setChatAlert(error.message || "Could not send your message.", "ban");
        return;
      }
      shellState.chatReplyTo = null;
      input.placeholder = "Enter a message...";
      updateChatReplyBanner();
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
    if (shellState.chatSocketBooting) return;
    shellState.chatSocketBooting = true;
    loadSocketScript().then(function () {
      if (!window.io) return;

      if (shellState.socket) {
        try { shellState.socket.disconnect(); } catch (_error) {}
      }

      shellState.socket = window.io(API_BASE, {
        transports: ["websocket", "polling"],
        withCredentials: true
      });

        window.__rblxShellSocket = shellState.socket;

      shellState.socket.on("connect", function () {
          console.log("[RBLX chat] connect fired");
        shellState.socketReady = true;
        shellState.socket.emit("join-room", getSocketJoinPayload());
      });

      shellState.socket.on("disconnect", function () {
        shellState.socketReady = false;
        syncChatFromServer();
      });

      shellState.socket.on("connect_error", function (error) {
        shellState.socketReady = false;
        // The HTTP sync/post routes remain usable while Socket.IO retries.
        setChatComposeState(false);
        syncChatFromServer();
      });

      shellState.socket.on("chat-history", function (history) {
          console.log("[RBLX chat] history", Array.isArray(history) ? history.length : history);
        var messages = Array.isArray(history) ? history.filter(function (message) {
          return !(message && message.specialType === "toolActivity");
        }) : [];
        shellState.chatMessages = messages;
        cacheChatMessages(messages);
        renderChatMessages(shellState.chatList, messages, { forceBottom: true });
        if (shellState.chatList && messages.length && !String(shellState.chatList.innerHTML || '').trim()) {
          renderChatMessagesFallback(shellState.chatList, messages);
        }
      });

      shellState.socket.on("chat-message", function (message) {
          console.log("[RBLX chat] message", message);
        if (message && message.specialType === "toolActivity") {
          return;
        }
        var nextMessages = shellState.chatMessages.slice();
        if (message && message.id && nextMessages.some(function (entry) { return entry && entry.id === message.id; })) return;
        nextMessages.push(message);
        nextMessages = nextMessages.slice(-80);
        shellState.chatMessages = nextMessages;
        cacheChatMessages(nextMessages);
        renderChatMessages(shellState.chatList, nextMessages, { forceBottom: true });
        if (shellState.chatList && nextMessages.length && !String(shellState.chatList.innerHTML || '').trim()) {
          renderChatMessagesFallback(shellState.chatList, nextMessages);
        }
      });

      shellState.socket.on("room-users", function (users) {
          console.log("[RBLX chat] users", Array.isArray(users) ? users.length : users);
        var reportedCount = Array.isArray(users) ? users.length : 0;
        if (reportedCount > 0 || shellState.onlineCount === 0) shellState.onlineCount = reportedCount;
        var onlineEl = document.getElementById("rblxShellOnlineCount");
        if (onlineEl) onlineEl.textContent = String(Math.max(0, shellState.onlineCount));
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

      shellState.socket.on("member-reward-ready", function () {
        refreshMemberRewards();
      });

      shellState.socket.on("community-notifications-updated", function () {
        refreshCommunityNotifications();
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
        if (result.type === "authentication") {
          if (window.RBLXToolsAuth && typeof window.RBLXToolsAuth.open === "function") {
            window.RBLXToolsAuth.open({ mode: "login", message: result.error || "Log in or sign up to use live chat." });
          }
          return;
        }
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
    }).finally(function () {
      shellState.chatSocketBooting = false;
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

  function initSupportModal() {
    shellState.supportOverlay = document.getElementById("rblxShellSupportOverlay");
    shellState.supportModal = document.getElementById("rblxShellSupportModal");
    shellState.supportCategory = document.getElementById("rblxShellSupportCategory");
    shellState.supportReporterId = document.getElementById("rblxShellSupportReporterId");
    shellState.supportReporterDiscord = document.getElementById("rblxShellSupportReporterDiscord");
    shellState.supportReporterEmail = document.getElementById("rblxShellSupportReporterEmail");
    shellState.supportReportedIdWrap = document.getElementById("rblxShellSupportReportedWrap");
    shellState.supportReportedId = document.getElementById("rblxShellSupportReportedId");
    shellState.supportDetails = document.getElementById("rblxShellSupportDetails");
    shellState.supportAttachment = document.getElementById("rblxShellSupportAttachment");
    shellState.supportAttachmentName = document.getElementById("rblxShellSupportAttachmentName");
    shellState.supportStatus = document.getElementById("rblxShellSupportStatus");
    shellState.supportSubmit = document.getElementById("rblxShellSupportSubmit");
    shellState.supportCancel = document.getElementById("rblxShellSupportCancel");
    var contactSupportButton = document.getElementById("rblxShellContactSupport");

    if (shellState.supportCategory) {
      shellState.supportCategory.addEventListener("change", toggleSupportTargetField);
    }
    if (shellState.supportAttachment && shellState.supportAttachmentName) {
      shellState.supportAttachment.addEventListener("change", function () {
        var file = shellState.supportAttachment.files && shellState.supportAttachment.files[0];
        shellState.supportAttachmentName.textContent = file ? (file.name + " (" + Math.max(1, Math.round(file.size / 1024)) + " KB)") : "No file attached.";
      });
    }
    if (shellState.supportSubmit) {
      shellState.supportSubmit.addEventListener("click", submitSupportReport);
    }
    if (shellState.supportCancel) {
      shellState.supportCancel.addEventListener("click", closeSupportModal);
    }
    if (contactSupportButton) {
      contactSupportButton.addEventListener("click", openSupportModal);
    }
    if (shellState.supportOverlay) {
      shellState.supportOverlay.addEventListener("click", function (event) {
        if (event.target === shellState.supportOverlay) {
          closeSupportModal();
        }
      });
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && shellState.supportOverlay && shellState.supportOverlay.classList.contains("is-open")) {
        closeSupportModal();
      }
    });
  }

  function clearCheckoutSuccessTimer() {
    if (shellState.checkoutSuccessTimer) {
      clearInterval(shellState.checkoutSuccessTimer);
      shellState.checkoutSuccessTimer = null;
    }
  }

  function closeCheckoutSuccessModal() {
    clearCheckoutSuccessTimer();
    if (!shellState.checkoutSuccessOverlay || !shellState.checkoutSuccessModal) return;
    shellState.checkoutSuccessOverlay.classList.remove("is-open");
    shellState.checkoutSuccessOverlay.setAttribute("aria-hidden", "true");
    shellState.checkoutSuccessModal.classList.remove("is-open");
  }

  function openCheckoutSuccessModal(detail) {
    if (!shellState.checkoutSuccessOverlay || !shellState.checkoutSuccessModal) return;
    var itemName = detail && detail.itemName ? String(detail.itemName) : "RBTools Plus";
    var amountText = detail && detail.amountTotalFormatted ? String(detail.amountTotalFormatted) : "$0.00";
    var plusReady = Boolean(detail && detail.premiumActive);
    if (shellState.checkoutSuccessItem) {
      shellState.checkoutSuccessItem.textContent = itemName;
    }
    if (shellState.checkoutSuccessAmount) {
      shellState.checkoutSuccessAmount.textContent = amountText;
    }
    if (shellState.checkoutSuccessCopy) {
      shellState.checkoutSuccessCopy.textContent = plusReady
        ? "Your purchase went through and Plus is already active on this account."
        : "Your purchase went through and we are finishing your Plus sync now.";
    }
    if (shellState.checkoutSuccessClose) {
      shellState.checkoutSuccessClose.disabled = true;
      shellState.checkoutSuccessClose.textContent = "Back To Account (10)";
    }
    shellState.checkoutSuccessCountdown = 10;
    shellState.checkoutSuccessOverlay.classList.add("is-open");
    shellState.checkoutSuccessOverlay.setAttribute("aria-hidden", "false");
    shellState.checkoutSuccessModal.classList.add("is-open");
    clearCheckoutSuccessTimer();
    shellState.checkoutSuccessTimer = setInterval(function () {
      shellState.checkoutSuccessCountdown -= 1;
      if (!shellState.checkoutSuccessClose) return;
      if (shellState.checkoutSuccessCountdown <= 0) {
        clearCheckoutSuccessTimer();
        shellState.checkoutSuccessClose.disabled = false;
        shellState.checkoutSuccessClose.textContent = "Back To Account";
        return;
      }
      shellState.checkoutSuccessClose.textContent = "Back To Account (" + shellState.checkoutSuccessCountdown + ")";
    }, 1000);
  }

  function initCheckoutSuccessModal() {
    shellState.checkoutSuccessOverlay = document.getElementById("rblxShellCheckoutOverlay");
    shellState.checkoutSuccessModal = document.getElementById("rblxShellCheckoutModal");
    shellState.checkoutSuccessClose = document.getElementById("rblxShellCheckoutClose");
    shellState.checkoutSuccessItem = document.getElementById("rblxShellCheckoutItem");
    shellState.checkoutSuccessAmount = document.getElementById("rblxShellCheckoutAmount");
    shellState.checkoutSuccessCopy = document.getElementById("rblxShellCheckoutCopy");

    if (shellState.checkoutSuccessClose) {
      shellState.checkoutSuccessClose.addEventListener("click", closeCheckoutSuccessModal);
    }

    window.addEventListener("rblxtools-checkout-success", function (event) {
      var detail = event && event.detail ? event.detail : {};
      openCheckoutSuccessModal(detail);
    });
  }

  function applyCollapsedState(body) {
    if (isMobileShellViewport()) {
      body.classList.remove("rblx-shell-left-collapsed");
      body.classList.remove("rblx-shell-right-collapsed");
      return;
    }
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
        if (isMobileShellViewport()) {
          openMobilePanel("nav");
          return;
        }
        var next = !document.body.classList.contains("rblx-shell-left-collapsed");
        document.body.classList.toggle("rblx-shell-left-collapsed", next);
        writeStorage(LEFT_STATE_KEY, next);
      });
    }
    if (rightToggle) {
      rightToggle.addEventListener("click", function () {
        if (isMobileShellViewport()) {
          openMobilePanel("chat");
          return;
        }
        var next = !document.body.classList.contains("rblx-shell-right-collapsed");
        document.body.classList.toggle("rblx-shell-right-collapsed", next);
        writeStorage(RIGHT_STATE_KEY, next);
      });
    }

    var mobileSideMenuButton = document.getElementById("rblxMobileSideMenuButton");
    var mobileOverlay = document.getElementById("rblxMobileOverlay");
    if (mobileSideMenuButton) {
      mobileSideMenuButton.addEventListener("click", function () {
        if (document.body.classList.contains("rblx-mobile-nav-open")) {
          closeMobilePanels();
          return;
        }
        openMobilePanel("nav");
      });
    }
    if (mobileOverlay) {
      mobileOverlay.addEventListener("click", closeMobilePanels);
    }
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !isMobileShellViewport()) return;
      var actionLink = target.closest(".rblx-shell-left a, .rblx-shell-right a");
      if (actionLink) {
        closeMobilePanels();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeMobilePanels();
      }
    });
    window.addEventListener("resize", function () {
      syncMobileShellState();
      applyCollapsedState(document.body);
    });
  }

  function formatCommunityNotificationCategory(category) {
    var labels = { announcement: "Announcement", changelog: "Changelog", "known-issue": "Known issue" };
    return labels[String(category || "").toLowerCase()] || "Community update";
  }

  function getLocalCommunityNotificationReads() {
    var userId = String(shellState.currentUser && shellState.currentUser.userId || "");
    if (!userId) return [];
    try {
      var saved = JSON.parse(localStorage.getItem(COMMUNITY_NOTIFICATION_READ_KEY + ":" + userId) || "[]");
      return Array.isArray(saved) ? saved.map(String) : [];
    } catch (_error) { return []; }
  }

  function getCommunityNotificationCache() {
    var userId = String(shellState.currentUser && shellState.currentUser.userId || "");
    if (!userId) return null;
    try {
      var cached = JSON.parse(localStorage.getItem(COMMUNITY_NOTIFICATION_CACHE_KEY + ":" + userId) || "null");
      if (!cached || Date.now() - Number(cached.savedAt || 0) > 15 * 60 * 1000 || !Array.isArray(cached.items)) return null;
      return cached;
    } catch (_error) { return null; }
  }

  function saveCommunityNotificationCache() {
    var userId = String(shellState.currentUser && shellState.currentUser.userId || "");
    if (!userId) return;
    try {
      localStorage.setItem(COMMUNITY_NOTIFICATION_CACHE_KEY + ":" + userId, JSON.stringify({
        savedAt: Date.now(),
        items: Array.isArray(shellState.communityNotifications) ? shellState.communityNotifications : [],
        unreadCount: Math.max(0, Number(shellState.communityUnreadCount) || 0)
      }));
    } catch (_error) {}
  }

  function hydrateCommunityNotificationCache() {
    var cached = getCommunityNotificationCache();
    if (!cached) return;
    shellState.communityNotifications = cached.items;
    shellState.communityUnreadCount = Math.max(0, Number(cached.unreadCount) || 0);
  }

  function saveLocalCommunityNotificationReads(ids) {
    var userId = String(shellState.currentUser && shellState.currentUser.userId || "");
    if (!userId) return;
    try { localStorage.setItem(COMMUNITY_NOTIFICATION_READ_KEY + ":" + userId, JSON.stringify(Array.from(new Set(ids.map(String))).slice(-250))); } catch (_error) {}
  }

  async function getCommunityNotificationFallback() {
    var response = await fetch(API_BASE + "/api/community-posts", { credentials: "include" });
    var payload = await response.json().catch(function () { return null; });
    if (!response.ok) throw new Error("Could not load community updates.");
    var readIds = new Set(getLocalCommunityNotificationReads());
    var items = (Array.isArray(payload && payload.posts) ? payload.posts : [])
      .filter(function (post) {
        var category = String(post && post.category || "").toLowerCase();
        return category === "announcement" || category === "changelog" || category === "known-issue" || (category === "bug-report" && post && post.knownIssue);
      })
      .slice(0, 40)
      .map(function (post) {
        return {
          id: String(post.id || ""),
          title: String(post.title || "Official update"),
          category: post.knownIssue ? "known-issue" : String(post.category || ""),
          publishedAt: String(post.publishedAt || post.createdAt || ""),
          read: readIds.has(String(post.id || "")),
          href: "./community#post-" + encodeURIComponent(String(post.id || ""))
        };
      });
    return { items: items, unreadCount: items.filter(function (item) { return !item.read; }).length };
  }

  function rememberCommunityPostsSeen() {
    var unseenPostIds = shellState.communityNotifications.filter(function (item) { return !item.read && item.id; }).map(function (item) { return String(item.id); });
    var expiresAt = Date.now() + 60000;
    try { sessionStorage.setItem(COMMUNITY_RECENTLY_SEEN_KEY, JSON.stringify({ ids: unseenPostIds, expiresAt: expiresAt })); } catch (_storageError) {}
    window.dispatchEvent(new CustomEvent("rblxtools-community-posts-seen", { detail: { ids: unseenPostIds, expiresAt: expiresAt } }));
  }

  function renderCommunityNotifications() {
    var bellCount = document.getElementById("rblxShellNotificationCount");
    if (bellCount) {
      bellCount.hidden = shellState.communityUnreadCount <= 0;
      bellCount.textContent = shellState.communityUnreadCount > 99 ? "99+" : String(shellState.communityUnreadCount);
    }
    var list = document.getElementById("rblxShellNotificationList");
    if (list) {
      var items = Array.isArray(shellState.communityNotifications) ? shellState.communityNotifications : [];
      list.innerHTML = items.length
        ? items.map(function (item) {
            return '<a class="rblx-shell-notification-item' + (item.read ? '' : ' is-unread') + '" href="' + escapeHtml(item.href || './community') + '" data-shell-notification-post="' + escapeHtml(item.id || '') + '">' +
              '<span class="rblx-shell-notification-type">' + escapeHtml(formatCommunityNotificationCategory(item.category)) + '</span>' +
              '<strong>' + escapeHtml(item.title || 'Official community update') + '</strong>' +
              (item.read ? '' : '<span class="rblx-shell-notification-new">New</span>') +
            '</a>';
          }).join('')
        : '<div class="rblx-shell-notification-empty">You are all caught up.</div>';
    }
    var navScroll = document.getElementById("rblxShellNavScroll");
    if (navScroll && shellState.renderedCommunityUnreadCount !== shellState.communityUnreadCount) {
      navScroll.innerHTML = buildNavMarkup();
      shellState.renderedCommunityUnreadCount = shellState.communityUnreadCount;
    }
  }

  async function refreshCommunityNotifications() {
    var currentUser = shellState.currentUser || {};
    if (!currentUser.loggedIn || !currentUser.userId) {
      shellState.communityNotifications = [];
      shellState.communityUnreadCount = 0;
      shellState.notificationsForUserId = "";
      renderCommunityNotifications();
      return;
    }
    var requestedUserId = String(currentUser.userId);
    try {
      var response = await fetch(API_BASE + "/api/community-notifications", {
        credentials: "include",
        headers: { Authorization: "Bearer " + getToken() }
      });
      var payload = await response.json().catch(function () { return null; });
      if (String(shellState.currentUser && shellState.currentUser.userId || "") !== requestedUserId) return;
      if (!response.ok) throw new Error((payload && payload.error) || "Could not load notifications.");
      var items = Array.isArray(payload && payload.items) ? payload.items : [];
      // The Community feed is the durable source of official posts.  Use it as
      // a client fallback for a just-published update while an old VPS process
      // or notification-state file is catching up.
      if (!items.length) payload = await getCommunityNotificationFallback();
      shellState.communityNotifications = Array.isArray(payload && payload.items) ? payload.items : [];
      shellState.communityUnreadCount = Math.max(0, Number(payload && payload.unreadCount) || 0);
      shellState.notificationsForUserId = requestedUserId;
      saveCommunityNotificationCache();
      var currentPath = normalizePath(window.location.pathname);
      var visitReadKey = requestedUserId + ":" + currentPath;
      if ((currentPath.endsWith("/community") || currentPath.endsWith("/community.html")) && shellState.communityUnreadCount > 0 && shellState.communityVisitReadAttempt !== visitReadKey) {
        rememberCommunityPostsSeen();
        shellState.communityVisitReadAttempt = visitReadKey;
        await markCommunityNotificationsRead("", true);
        return;
      }
      renderCommunityNotifications();
    } catch (_error) {
      try {
        var fallback = await getCommunityNotificationFallback();
        shellState.communityNotifications = fallback.items;
        shellState.communityUnreadCount = fallback.unreadCount;
        saveCommunityNotificationCache();
        renderCommunityNotifications();
      } catch (_fallbackError) {}
    }
  }

  async function markCommunityNotificationsRead(postId, markAll) {
    if (!shellState.currentUser || !shellState.currentUser.loggedIn) return;
    var locallyRead = getLocalCommunityNotificationReads();
    var nextRead = markAll
      ? shellState.communityNotifications.map(function (item) { return String(item.id || ""); }).filter(Boolean)
      : locallyRead.concat(String(postId || ""));
    saveLocalCommunityNotificationReads(nextRead);
    shellState.communityNotifications = shellState.communityNotifications.map(function (item) {
      return Object.assign({}, item, { read: markAll || String(item.id || "") === String(postId || "") ? true : item.read });
    });
    shellState.communityUnreadCount = shellState.communityNotifications.filter(function (item) { return !item.read; }).length;
    saveCommunityNotificationCache();
    renderCommunityNotifications();
    try {
      await fetch(API_BASE + "/api/community-notifications/read", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify(markAll ? { all: true } : { postId: postId })
      });
      await refreshCommunityNotifications();
    } catch (_error) {}
  }

  function updateAuthUi(state) {
    var auth = document.getElementById("rblxShellAuth");
    var status = document.getElementById("rblxShellStatus");
    var statusText = document.getElementById("rblxShellStatusText");
    if (!auth || !status || !statusText) return;

    // Only rebuild the header for real session changes. Profile/name and token
    // refreshes are data updates, not a reason to visibly replace the UI.
    var nextSignature = [Boolean(state.loggedIn), state.userId || "", state.plan || "guest", Boolean(state.isAdmin)].join("|");
    var identityChanged = nextSignature !== shellState.authUiSignature;
    status.setAttribute("data-plan", state.plan);
    statusText.textContent = state.message;
    applyPlanAtmosphere(state.plan);
    shellState.currentUser = { loggedIn: Boolean(state.loggedIn), plan: state.plan || "guest", message: state.message || "", userId: state.userId || "", username: state.username || "", displayName: state.displayName || "", email: state.email || "", aiTokens: state.aiTokens != null && Number.isFinite(Number(state.aiTokens)) ? Math.max(0, Number(state.aiTokens)) : null };
    syncAdsterraPopunderForMember(state);
    syncMemberAdVisibility(state);
    var tokenBanner = document.getElementById("rblxShellTokenBanner");
    var tokenBalance = document.getElementById("rblxShellTokenBalance");
    if (tokenBanner && tokenBalance) {
      tokenBanner.hidden = false;
      tokenBalance.textContent = state.loggedIn && shellState.currentUser.aiTokens != null ? String(shellState.currentUser.aiTokens) : "0";
    }
    shellState.isAdmin = Boolean(state.isAdmin);
    shellState.authUiSignature = nextSignature;
    applyModerationState(state.moderation || shellState.moderation);
    applyMaintenanceState(shellState.maintenanceState);
    if (!identityChanged) return;
    var navScroll = document.getElementById("rblxShellNavScroll");
    if (navScroll) {
      navScroll.innerHTML = buildNavMarkup();
      shellState.renderedCommunityUnreadCount = shellState.communityUnreadCount;
    }
    refreshCurrentProfile();
    syncChatIdentity();
    if (shellState.socket && shellState.socketReady) shellState.socket.emit("join-room", getSocketJoinPayload());
    auth.innerHTML = buildAuthMarkup().replace('<div class="rblx-shell-auth" id="rblxShellAuth">', "").replace(/<\/div>$/, "");
    if (state.loggedIn) {
      fetch(API_BASE + "/referrals/me", { credentials: "include", headers: { Authorization: "Bearer " + getToken() } })
        .then(function (response) { return response.ok ? response.json() : null; })
        .then(function (payload) {
          var balance = document.getElementById("rblxShellReferralBalance");
          if (balance && payload && payload.referral) balance.textContent = "$" + ((Number(payload.referral.availableCents) || 0) / 100).toFixed(2);
        }).catch(function () {});
    }
    refreshCommunityNotifications();
    if (shellState.chatAdminButton) {
      shellState.chatAdminButton.hidden = !shellState.isAdmin;
      shellState.chatAdminButton.style.display = shellState.isAdmin ? "inline-flex" : "none";
    }
  }

  function hasPlusFromPayload(payload) {
    if (!payload || typeof payload !== "object") return false;
    var premiumFlag = payload.premiumActive === true || payload.plusActive === true || payload.plus === true || payload.isPlus === true || payload.hasPlus === true;
    var nestedPremiumFlag = payload.user && (
      payload.user.premiumActive === true ||
      payload.user.plusActive === true ||
      payload.user.plus === true ||
      payload.user.isPlus === true ||
      payload.user.hasPlus === true
    );
    return Boolean(premiumFlag || nestedPremiumFlag);
  }

  function getMembershipPlan(payload, user, premiumActive) {
    var rawPlan = String((user && user.plan) || (payload && payload.plan) || "").toLowerCase();
    if (rawPlan === "pro") return "pro";
    return premiumActive ? "plus" : "free";
  }

  function getMembershipMessage(plan, displayName) {
    var label = plan === "pro" ? "Pro member" : plan === "plus" ? "Plus subscriber" : "free plan user";
    return "You are browsing this website as a " + label + (displayName ? ", " + displayName : "") + ".";
  }

  window.addEventListener("rblxtools-ai-token-balance", function (event) {
    var nextBalance = Number(event && event.detail && event.detail.aiTokens);
    if (!Number.isFinite(nextBalance) || !shellState.currentUser || !shellState.currentUser.loggedIn) return;
    shellState.currentUser.aiTokens = Math.max(0, nextBalance);
    var cachedUser = getCachedAuthUser();
    if (cachedUser && (!cachedUser.id || !shellState.currentUser.userId || String(cachedUser.id) === String(shellState.currentUser.userId))) {
      cachedUser.aiTokens = shellState.currentUser.aiTokens;
      saveCachedAuthUser(cachedUser);
    }
    var tokenBalance = document.getElementById("rblxShellTokenBalance");
    if (tokenBalance) tokenBalance.textContent = String(shellState.currentUser.aiTokens);
  });

  function buildUserStateFromPayload(payload, moderationOverride) {
    var user = payload && payload.user ? payload.user : payload;
    if (!user || typeof user !== "object") return null;

    var plus = hasPlusFromPayload(payload) || hasPlusFromPayload(user);
    var displayName = getPreferredUserName(user, payload);
    var plan = getMembershipPlan(payload, user, plus);
    return {
      loggedIn: true,
      plan: plan,
      message: getMembershipMessage(plan, displayName),
      userId: user && user.id ? String(user.id) : "",
      username: user && user.username ? String(user.username) : "",
      displayName: displayName,
      email: user && user.email ? String(user.email) : "",
      aiTokens: user && user.aiTokens != null ? Number(user.aiTokens) : null,
      isAdmin: Boolean(user && user.isAdmin),
      moderation: moderationOverride || (payload && payload.moderation ? payload.moderation : shellState.moderation)
    };
  }

  async function refreshMembershipStateFromServer() {
    if (shellState.membershipRefreshInFlight) return;
    shellState.membershipRefreshInFlight = true;
    try {
      var response = await fetch(API_BASE + "/auth/me", {
        method: "GET",
        credentials: "include",
        headers: {
          "X-RBLX-Device-Id": shellState.deviceId || getDeviceId()
        }
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          clearLegacyAuthTokenCache();
          saveCachedAuthUser(null);
          clearVerifiedSessionSnapshot();
          updateAuthUi(getImmediateUserState());
        }
        return;
      }
      var payload = await response.json().catch(function () { return null; });
      if (payload && payload.user) {
        if (!shellState.chatAuthToken && payload.chatToken) setChatAuthToken(payload.chatToken);
        applyMembershipPayload(payload);
      }
    } catch (_error) {
    } finally {
      shellState.membershipRefreshInFlight = false;
    }
  }

  function initMembershipRefresh() {
    if (shellState.membershipRefreshTimer) return;
    shellState.membershipRefreshTimer = window.setInterval(refreshMembershipStateFromServer, 30000);
    window.addEventListener("focus", refreshMembershipStateFromServer);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refreshMembershipStateFromServer();
    });
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
    writeCachedPlusStatus(nextState.plan === "plus" || nextState.plan === "pro");
    updateAuthUi(nextState);
    dispatchMembershipUpdate({
      user: mergedUser,
      plan: nextState.plan,
      premiumActive: nextState.plan === "plus" || nextState.plan === "pro",
      membershipSource: mergedUser.membershipSource || null,
      plusDaysTotal: mergedUser.plusDaysTotal != null ? mergedUser.plusDaysTotal : null,
      plusDaysLeft: mergedUser.plusDaysLeft != null ? mergedUser.plusDaysLeft : 0,
      plusExpiresAt: mergedUser.plusExpiresAt || null,
      currentPeriodStartAt: mergedUser.currentPeriodStartAt || null,
      currentPeriodEndAt: mergedUser.currentPeriodEndAt || null
    });
  }

  function getImmediateUserState() {
    var cachedUser = getCachedAuthUser();
    if (!cachedUser) {
      return {
        loggedIn: false,
        plan: "guest",
        message: "You are browsing this website as a guest.",
        userId: getGuestHash(),
        username: "",
        displayName: "Guest",
        email: "",
        isAdmin: false,
        moderation: shellState.moderation
      };
    }

    var displayName = getPreferredUserName(cachedUser, cachedUser);
    var plus = hasPlusFromPayload(cachedUser);
    var plan = getMembershipPlan(cachedUser, cachedUser, plus);
    return {
      loggedIn: true,
      plan: plan,
      message: getMembershipMessage(plan, displayName),
      userId: cachedUser && cachedUser.id ? String(cachedUser.id) : "",
      username: cachedUser && cachedUser.username ? String(cachedUser.username) : "",
      displayName: displayName,
      email: cachedUser && cachedUser.email ? String(cachedUser.email) : "",
      aiTokens: cachedUser && cachedUser.aiTokens != null ? Number(cachedUser.aiTokens) : null,
      isAdmin: Boolean(cachedUser && cachedUser.isAdmin),
      moderation: shellState.moderation
    };
  }

  async function resolveUserState() {
    var cachedUser = getCachedAuthUser();
    var displayName = "";
    var plus = false;
    var membershipPlan = "";

    try {
      var premiumResponse = await fetch(API_BASE + "/auth/premium-status", {
        method: "GET",
        credentials: "include"
      });
      if (premiumResponse.ok) {
        var premiumPayload = await premiumResponse.json().catch(function () { return null; });
        plus = hasPlusFromPayload(premiumPayload);
        membershipPlan = getMembershipPlan(premiumPayload, premiumPayload, plus);
      }
    } catch (_error) {}

    var response;
    try {
      response = await fetch(API_BASE + "/auth/me", {
        method: "GET",
        credentials: "include",
        headers: {
          "X-RBLX-Device-Id": shellState.deviceId || getDeviceId()
        }
      });

    } catch (_networkError) {
      // Keep the last verified session rendered while a request is delayed or
      // temporarily fails. The next background refresh will reconcile it.
      return getImmediateUserState();
    }

    if (!response.ok) {
      // Only the server explicitly rejecting the session is a real logout.
      if (response.status === 401 || response.status === 403) {
        clearLegacyAuthTokenCache();
        saveCachedAuthUser(null);
        clearVerifiedSessionSnapshot();
      }
      return getImmediateUserState();
    }

    try {
      var payload = await response.json().catch(function () { return null; });
      var user = payload && payload.user ? payload.user : payload;
      if (!user || typeof user !== "object") return getImmediateUserState();
      if (!shellState.chatAuthToken && payload && payload.chatToken) setChatAuthToken(payload.chatToken);
      saveCachedAuthUser(user);
      displayName = getPreferredUserName(user, payload);
      plus = plus || hasPlusFromPayload(payload) || hasPlusFromPayload(user);
      membershipPlan = getMembershipPlan(payload, user, plus) === "pro" ? "pro" : (membershipPlan === "pro" ? "pro" : (plus ? "plus" : "free"));
      // The auth payload may omit billing flags, so retain the premium-status result.
      writeCachedPlusStatus(plus);
      return {
        loggedIn: true,
        plan: membershipPlan,
        message: getMembershipMessage(membershipPlan, displayName),
        userId: user && user.id ? String(user.id) : "",
        username: user && user.username ? String(user.username) : "",
        displayName: displayName,
        email: user && user.email ? String(user.email) : "",
        isAdmin: Boolean(user && user.isAdmin),
        moderation: payload && payload.moderation ? payload.moderation : null
      };
    } catch (_payloadError) {
      return getImmediateUserState();
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

  function placeSharedFooter(pageHost) {
    var footer = document.querySelector(".rblx-shell-footer");
    var shellCenter = pageHost && pageHost.parentElement;
    if (footer && shellCenter && footer.parentElement !== shellCenter) {
      shellCenter.appendChild(footer);
    }
  }

  function revealSharedFooter() {
    var footer = document.querySelector(".rblx-shell-footer");
    if (!footer) return;
    window.requestAnimationFrame(function () {
      footer.classList.add("rblx-shell-footer-ready");
    });
  }

  function captureStreamingPageContent(pageHost) {
    if (document.readyState !== "loading") return;

    var moveNode = function (node) {
      if (node === document.getElementById("rblxShellRoot")) return;
      pageHost.appendChild(node);
    };
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        Array.prototype.slice.call(record.addedNodes).forEach(function (node) {
          // Parser-inserted scripts must remain in body until they execute.
          if (node.nodeType === 1 && node.tagName === "SCRIPT") return;
          moveNode(node);
        });
      });
    });
    observer.observe(document.body, { childList: true });
    document.addEventListener("DOMContentLoaded", function () {
      observer.disconnect();
      Array.prototype.slice.call(document.body.childNodes).forEach(function (node) {
        if (node !== document.getElementById("rblxShellRoot")) moveNode(node);
      });
      // Content can arrive after the shell script; run the cleanup once parsing has completed too.
      removePageFaqs(pageHost);
      placeSharedFooter(pageHost);
      initSharedToolBannerAd();
      initSharedStoreFooterBannerAd();
      revealSharedFooter();
    }, { once: true });
  }

  function prefetchShellPage(href) {
    if (!href) return;
    var destination;
    try {
      destination = new URL(href, window.location.href);
    } catch (_error) {
      return;
    }

    if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
    var key = destination.pathname + destination.search;
    if (document.querySelector('link[data-rblx-page-prefetch="' + key.replace(/"/g, "\\\"") + '"]')) return;

    var link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "document";
    link.href = destination.href;
    link.setAttribute("data-rblx-page-prefetch", key);
    document.head.appendChild(link);
  }

  function initFastShellNavigation() {
    function getInternalLink(event) {
      var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!link || link.target || link.hasAttribute("download")) return null;
      return link;
    }

    document.addEventListener("pointerover", function (event) {
      var link = getInternalLink(event);
      if (link) prefetchShellPage(link.href);
    }, { passive: true });
    document.addEventListener("pointerdown", function (event) {
      var link = getInternalLink(event);
      if (link) prefetchShellPage(link.href);
    }, { passive: true });
    document.addEventListener("touchstart", function (event) {
      var link = getInternalLink(event);
      if (link) prefetchShellPage(link.href);
    }, { passive: true });
    document.addEventListener("focusin", function (event) {
      var link = getInternalLink(event);
      if (link) prefetchShellPage(link.href);
    });
    // Intent-based prefetch above keeps the next navigation quick without
    // downloading every tool page after every navigation.
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

  function mountSharedBannerAd(slot) {
    if (!slot || slot.dataset.rblxBannerLoaded === "true") return;
    slot.dataset.rblxBannerLoaded = "true";

    // This provider writes its iframe while its script is parsed. Isolate it in
    // a document so each slot loads reliably without competing global options.
    var adFrame = document.createElement("iframe");
    adFrame.className = "rblx-banner-ad-frame";
    adFrame.title = "Advertisement";
    adFrame.width = "728";
    adFrame.height = "90";
    adFrame.scrolling = "no";
    adFrame.setAttribute("frameborder", "0");
    adFrame.srcdoc = '<!doctype html><html><head><style>html,body{width:728px;height:90px;margin:0;overflow:hidden}</style></head><body><script>atOptions={key:"fb95715336abfc09031edf4e6ef208c5",format:"iframe",height:90,width:728,params:{}};<\/script><script src="https://professionalsusceptible.com/fb95715336abfc09031edf4e6ef208c5/invoke.js"><\/script></body></html>';
    slot.appendChild(adFrame);
  }

  function createSharedBannerAd(id, className) {
    var banner = document.createElement("section");
    banner.id = id;
    banner.className = className;
    banner.setAttribute("data-rblx-banner-ad", "");
    banner.setAttribute("aria-label", "Advertisement");

    var label = document.createElement("span");
    label.className = "rblx-banner-ad-label";
    label.textContent = "Advertisement";
    banner.appendChild(label);

    var slot = document.createElement("div");
    slot.className = "rblx-tool-banner-ad-slot";
    banner.appendChild(slot);
    return { banner: banner, slot: slot };
  }

  function mountMobileHomeBannerAd(slot) {
    if (!slot || !shouldShowMemberAds() || slot.dataset.rblxMobileBannerLoaded === "true") return;
    slot.dataset.rblxMobileBannerLoaded = "true";

    var adFrame = document.createElement("iframe");
    adFrame.className = "rblx-mobile-home-banner-ad-frame";
    adFrame.title = "Advertisement";
    adFrame.width = "320";
    adFrame.height = "50";
    adFrame.scrolling = "no";
    adFrame.setAttribute("frameborder", "0");
    adFrame.srcdoc = '<!doctype html><html><head><style>html,body{width:320px;height:50px;margin:0;overflow:hidden}</style></head><body><script>atOptions={key:"4f3f88a3c4de39df646d1819202a769b",format:"iframe",height:50,width:320,params:{}};<\/script><script src="https://professionalsusceptible.com/4f3f88a3c4de39df646d1819202a769b/invoke.js"><\/script></body></html>';
    slot.appendChild(adFrame);
  }

  function createMobileBannerAd(id, className) {
    var banner = document.createElement("section");
    banner.id = id;
    banner.className = "rblx-mobile-banner-ad " + className;
    banner.setAttribute("data-rblx-mobile-banner-ad", "");
    banner.setAttribute("aria-label", "Advertisement");
    banner.innerHTML = '<span class="rblx-banner-ad-label">Advertisement</span><div class="rblx-home-mobile-banner-ad-slot"></div>';
    return { banner: banner, slot: banner.querySelector(".rblx-home-mobile-banner-ad-slot") };
  }

  function mountMobileBannerAd(slot) {
    if (!shouldShowMemberAds()) return;
    mountMobileHomeBannerAd(slot);
  }

  function initSharedMobileBannerAds() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initSharedMobileBannerAds, { once: true });
      return;
    }

    var pageHost = document.getElementById("rblxShellPage");
    if (pageHost && pageHost.parentNode && !document.getElementById("rblxMobileHeaderBannerAd")) {
      var headerAd = createMobileBannerAd("rblxMobileHeaderBannerAd", "rblx-mobile-header-banner-ad");
      // The header is a shell-grid row. Keep this in the center page flow so it
      // sits below the header instead of becoming an overlapping grid child.
      pageHost.parentNode.insertBefore(headerAd.banner, pageHost);
      mountMobileBannerAd(headerAd.slot);
    }

    var showcaseCard = document.querySelector("#rblxShellPage .showcase-card");
    var toolPromo = document.querySelector("#rblxShellPage .plus-card");
    var tutorialCard = toolPromo && toolPromo.previousElementSibling;
    if (toolPromo && tutorialCard && tutorialCard.querySelector("video") && !document.getElementById("rblxMobileToolTutorialBannerAd")) {
      var tutorialAd = createMobileBannerAd("rblxMobileToolTutorialBannerAd", "rblx-mobile-tool-tutorial-banner-ad");
      toolPromo.parentNode.insertBefore(tutorialAd.banner, toolPromo);
      mountMobileBannerAd(tutorialAd.slot);
    }
    if (showcaseCard && toolPromo && !document.getElementById("rblxMobileToolPromoBannerAd")) {
      var toolAd = createMobileBannerAd("rblxMobileToolPromoBannerAd", "rblx-mobile-tool-promo-banner-ad");
      showcaseCard.parentNode.insertBefore(toolAd.banner, showcaseCard);
      mountMobileBannerAd(toolAd.slot);
    }

    var footer = document.querySelector(".rblx-shell-footer");
    if (footer && !document.getElementById("rblxMobileFooterBannerAd")) {
      var footerAd = createMobileBannerAd("rblxMobileFooterBannerAd", "rblx-mobile-footer-banner-ad");
      footer.parentNode.insertBefore(footerAd.banner, footer);
      mountMobileBannerAd(footerAd.slot);
    }
  }

  function initSharedToolBannerAd() {
    if (document.readyState === "loading") {
      if (!window.__rblxToolBannerQueued) {
        window.__rblxToolBannerQueued = true;
        document.addEventListener("DOMContentLoaded", function () {
          window.__rblxToolBannerQueued = false;
          initSharedToolBannerAd();
        }, { once: true });
      }
      return;
    }

    var showcaseCard = document.querySelector(".showcase-card");
    var shareCard = document.querySelector(".share-card");
    if (!showcaseCard || !shareCard || document.getElementById("rblxToolBannerAd")) return;

    var ad = createSharedBannerAd("rblxToolBannerAd", "rblx-tool-banner-ad");
    shareCard.parentNode.insertBefore(ad.banner, shareCard);
    mountSharedBannerAd(ad.slot);
  }

  function initSharedStoreFooterBannerAd() {
    var currentPath = String(window.location.pathname || "/").replace(/\/+$/g, "").replace(/^\//, "").replace(/\.html$/i, "");
    var storePages = ["subscriptions", "discord-bot", "ai-tokens"];
    if (storePages.indexOf(currentPath) === -1 || document.getElementById("rblxStoreFooterBannerAd")) return;

    var footer = document.querySelector(".rblx-shell-footer");
    if (!footer || !footer.parentNode) return;

    var ad = createSharedBannerAd("rblxStoreFooterBannerAd", "rblx-store-footer-banner-ad");
    footer.parentNode.insertBefore(ad.banner, footer);
    mountSharedBannerAd(ad.slot);
  }

  function initSharedToolHeaderBannerAd() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initSharedToolHeaderBannerAd, { once: true });
      return;
    }

    var toolPages = ["template-downloader", "template-background-changer", "ugc-downloader", "media-downloader", "audio-downloader", "robux-calculator", "animation-spoofer", "ai-clothing-studio", "game-launcher"];
    var currentPath = String(window.location.pathname || "/").replace(/\/+$/g, "").replace(/^\//, "").replace(/\.html$/i, "");
    if (toolPages.indexOf(currentPath) === -1 || document.getElementById("rblxToolHeaderBannerAd")) return;

    var hero = document.querySelector("#rblxShellPage main > .hero, #rblxShellPage .tool-hero, #rblxShellPage .page-hero, #rblxShellPage .calc-hero, #rblxShellPage #intro, #rblxShellPage .ai-hero");
    if (!hero) return;

    var ad = createSharedBannerAd("rblxToolHeaderBannerAd", "rblx-tool-header-banner-ad");
    hero.insertAdjacentElement("afterend", ad.banner);
    mountSharedBannerAd(ad.slot);
  }

  function initSharedHomeBannerAds() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initSharedHomeBannerAds, { once: true });
      return;
    }

    var currentPath = String(window.location.pathname || "/").replace(/\/+$/g, "").replace(/^\//, "").replace(/\.html$/i, "");
    if (currentPath !== "" && currentPath !== "index") return;

    var homeTop = document.querySelector("#rblxShellPage .home-grid-top");
    var toolsSection = document.getElementById("tools-section");
    if (homeTop && toolsSection && !document.getElementById("rblxHomeMobileBannerAd")) {
      var mobileAd = document.createElement("section");
      mobileAd.id = "rblxHomeMobileBannerAd";
      mobileAd.className = "rblx-home-mobile-banner-ad";
      mobileAd.setAttribute("aria-label", "Advertisement");
      mobileAd.innerHTML = '<span class="rblx-banner-ad-label">Advertisement</span><div class="rblx-home-mobile-banner-ad-slot"></div>';
      homeTop.insertAdjacentElement("afterend", mobileAd);
      mountMobileHomeBannerAd(mobileAd.querySelector(".rblx-home-mobile-banner-ad-slot"));
    }
    if (homeTop && toolsSection && !document.getElementById("rblxHomeToolsBannerAd")) {
      var toolsAd = createSharedBannerAd("rblxHomeToolsBannerAd", "rblx-home-banner-ad");
      toolsSection.parentNode.insertBefore(toolsAd.banner, toolsSection);
      mountSharedBannerAd(toolsAd.slot);
    }

    var socialGrid = document.querySelector("#rblxShellPage .social-grid");
    var socialSection = socialGrid && socialGrid.closest("section");
    if (socialSection && !document.getElementById("rblxHomeFooterBannerAd")) {
      var footerAd = createSharedBannerAd("rblxHomeFooterBannerAd", "rblx-home-banner-ad");
      socialSection.insertAdjacentElement("afterend", footerAd.banner);
      mountSharedBannerAd(footerAd.slot);
    }
  }

  function initSharedToolShowcase() {
    var currentPath = String(window.location.pathname || "/").replace(/\/+$|^\/+|\.html$/g, "");
    if (currentPath === "" || currentPath === "template-downloader") return;
    if (document.readyState === "loading") {
      if (!window.__rblxSharedShowcaseQueued) {
        window.__rblxSharedShowcaseQueued = true;
        document.addEventListener("DOMContentLoaded", function () {
          window.__rblxSharedShowcaseQueued = false;
          initSharedToolShowcase();
        }, { once: true });
      }
      return;
    }

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

    var SHOWCASE_INTERVAL_MS = window.matchMedia && window.matchMedia("(max-width: 820px)").matches ? 30000 : 45000;
    var showcaseTimer = null;
    var showcaseProgressTimer = null;
    var activeToolIndex = 0;
    var toolsData = [
      { name: "Clothing", desc: "Access supported Roblox clothing templates fast.", href: "./template-downloader", plus: false, icon: "spark", tag: "Clothing Tool", tone: "linear-gradient(180deg,#50395a,#2d2035)" },
      { name: "Template Background Changer", desc: "Remove marks and restore a clean classic template background.", href: "./template-background-changer", plus: false, icon: "spark", tag: "Cleanup Tool", tone: "linear-gradient(180deg,#31506a,#1f2f42)" },
      { name: "UGC", desc: "Access supported UGC accessory files for creator workflows.", href: "./ugc-downloader", plus: false, icon: "hat", tag: "UGC Tool", tone: "linear-gradient(180deg,#2a4a6c,#1e2f42)" },
      { name: "Robux Calculator", desc: "Fast conversion math for Robux and pricing plans.", href: "./robux-calculator", plus: false, icon: "calc", tag: "Value Tool", tone: "linear-gradient(180deg,#3e5b35,#27391f)" },
      { name: "Media", desc: "Access supported media assets quickly.", href: "./media-downloader", plus: false, icon: "media", tag: "Media Tool", tone: "linear-gradient(180deg,#5a3b61,#32213a)" },
      { name: "Audio", desc: "Fetch audio asset files from supported IDs.", href: "./audio-downloader", plus: false, icon: "audio", tag: "Audio Tool", tone: "linear-gradient(180deg,#6a3e3a,#3f2523)" },
      { name: "Animations", desc: "Premium animation utility for advanced workflows.", href: "./animation-spoofer", plus: true, icon: "rig", tag: "Plus Tool", tone: "linear-gradient(180deg,#3a456f,#212846)" }
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
      if (shellState.currentUser && ["plus", "pro"].includes(String(shellState.currentUser.plan || "").toLowerCase())) {
        window.location.href = tool.href;
        return;
      }
      try {
        var state = await resolveUserState();
        if (state && ["plus", "pro"].includes(String(state.plan || "").toLowerCase())) {
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
    if (plusGate && plusGate.dataset.rblxPersistentGate !== "true") {
      plusGate.addEventListener("click", function (event) {
        if (event.target && event.target.id === "plusGate") hidePlusGate();
      });
    }
    // Touch browsers can emit synthetic hover events, which used to pause this slider forever.
    var supportsHoverPause = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (supportsHoverPause) {
      showcaseViewport.addEventListener("mouseenter", function () {
        if (showcaseTimer) clearInterval(showcaseTimer);
        if (showcaseProgressTimer) clearInterval(showcaseProgressTimer);
      });
      showcaseViewport.addEventListener("mouseleave", restartShowcaseTimer);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        if (showcaseTimer) clearInterval(showcaseTimer);
        if (showcaseProgressTimer) clearInterval(showcaseProgressTimer);
        return;
      }
      restartShowcaseTimer();
    });

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

  function getToolStatsLabel(element, index) {
    var labels = {
      activeAssetId: "Asset ID",
      activeTemplateId: "Template ID",
      idPill: "Animation ID",
      playablePill: "Playable ID",
      typePill: "Asset type",
      countPill: "Selection",
      audioPreviewTitle: "Audio title",
      audioPreviewFile: "Audio file",
      audioPreviewCounter: "Selection",
      previewModePill: "Preview type",
      activeItemTitle: "Media title",
      previewCounter: "Selection"
    };
    return labels[element.id] || element.getAttribute("data-stat-label") || "Property " + (index + 1);
  }

  function appendToolStat(grid, label, value) {
    if (!value) return;
    var stat = document.createElement("div");
    stat.className = "rblx-tool-stat";
    var statLabel = document.createElement("span");
    statLabel.textContent = label;
    var statValue = document.createElement("strong");
    statValue.textContent = value;
    stat.appendChild(statLabel);
    stat.appendChild(statValue);
    grid.appendChild(stat);
  }

  function renderToolStats(panel, row) {
    panel.replaceChildren();
    var heading = document.createElement("h4");
    heading.textContent = "Asset stats for nerds";
    var grid = document.createElement("div");
    grid.className = "rblx-tool-stats-grid";
    Array.prototype.slice.call(row.querySelectorAll(".metaPill, .rblx-meta-pill")).forEach(function (pill, index) {
      appendToolStat(grid, getToolStatsLabel(pill, index), String(pill.textContent || "").trim());
    });
    var image = document.querySelector("#activeTemplateImage, #activePreviewImage, #thumbnailImage");
    if (image && image.src) {
      appendToolStat(grid, "Preview image", image.currentSrc || image.src);
      if (image.naturalWidth && image.naturalHeight) appendToolStat(grid, "Image resolution", image.naturalWidth + " × " + image.naturalHeight);
    }
    var audio = document.getElementById("audioPreviewPlayer");
    if (audio && audio.src) {
      appendToolStat(grid, "Audio source", audio.currentSrc || audio.src);
      if (Number.isFinite(audio.duration)) appendToolStat(grid, "Duration", audio.duration.toFixed(1) + " seconds");
    }
    appendToolStat(grid, "Tool page", document.title || window.location.pathname);
    panel.appendChild(heading);
    panel.appendChild(grid);
  }

  function initSharedToolStats() {
    var pageHost = document.getElementById("rblxShellPage");
    if (!pageHost) return;
    function installStatsControls() {
      Array.prototype.slice.call(pageHost.querySelectorAll("#metaRow, .rblx-meta-row")).forEach(function (row) {
        if (row.querySelector("#statsForNerdsBtn") || row.querySelector(".rblx-tool-stats-toggle")) return;
        if (!row.querySelector(".metaPill, .rblx-meta-pill")) return;
        var toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "rblx-tool-stats-toggle";
        toggle.textContent = "Stats for Nerds";
        toggle.setAttribute("aria-expanded", "false");
        var panel = document.createElement("section");
        panel.className = "rblx-tool-stats-panel";
        panel.setAttribute("aria-live", "polite");
        toggle.addEventListener("click", function () {
          var isOpen = panel.classList.toggle("is-open");
          toggle.setAttribute("aria-expanded", String(isOpen));
          if (isOpen) renderToolStats(panel, row);
        });
        row.appendChild(toggle);
        row.insertAdjacentElement("afterend", panel);
      });
    }
    installStatsControls();
    var queued = false;
    var observer = new MutationObserver(function () {
      if (queued) return;
      queued = true;
      window.setTimeout(function () {
        queued = false;
        installStatsControls();
      }, 0);
    });
    observer.observe(pageHost, { childList: true, subtree: true });
  }

  function decorateMembershipText(root) {
    if (!root || !document.createTreeWalker) return;
    var matcher = /\b(plus|pro)\b/gi;
    var ignoredSelector = ".rblx-plus-word, .rblx-pro-word, .rblx-shell-gate-plus, .rblx-shell-gate-pro, .gate-plus, .gate-pro, .rblx-membership-promo-included, .rblx-no-membership-text-treatment, script, style, textarea, select, option, input, pre, code";
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!matcher.test(node.nodeValue || "")) return NodeFilter.FILTER_REJECT;
        matcher.lastIndex = 0;
        var parent = node.parentElement;
        return parent && !parent.closest(ignoredSelector)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var value = node.nodeValue;
      matcher.lastIndex = 0;
      var match;
      var cursor = 0;
      var fragment = document.createDocumentFragment();
      while ((match = matcher.exec(value))) {
        if (match.index > cursor) fragment.appendChild(document.createTextNode(value.slice(cursor, match.index)));
        var word = document.createElement("span");
        word.className = match[0].toLowerCase() === "pro" ? "rblx-pro-word" : "rblx-plus-word";
        word.textContent = match[0];
        fragment.appendChild(word);
        cursor = match.index + match[0].length;
      }
      if (cursor < value.length) fragment.appendChild(document.createTextNode(value.slice(cursor)));
      if (node.parentNode) node.parentNode.replaceChild(fragment, node);
    });
  }

  function initMembershipTextTreatment() {
    decorateMembershipText(document.body);
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        Array.prototype.forEach.call(record.addedNodes, function (node) {
          if (node.nodeType === 3) decorateMembershipText(node.parentNode);
          else if (node.nodeType === 1 && !node.classList.contains("rblx-plus-word") && !node.classList.contains("rblx-pro-word")) decorateMembershipText(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function buildMembershipPromoMarkup(plan, actionLabel, showBoxAd) {
    var isPro = plan === "pro";
    var floatingMark = isPro ? "&#128736;" : "+";
    var config = isPro ? {
      price: "$2.50",
      originalPrice: "$5.00",
      discount: "50% off",
      subtitle: "With code PROCREATOR",
      title: "Pro",
      action: actionLabel || "Try Now",
      perks: ["20 AI Credits Every Month", "Includes All Plus Benefits", "30 Saved Thumbnail Chats", "No Annoying Ads", "Bulk Downloads (5-10)", "6 AI Thumbnail Attachments", "All Aspect Ratios", "1440p - 4K AI Thumbnail Quality", "Premium Giveaways", "Custom Chat Tag", "Premium Looking Website Included"]
    } : {
      price: "$1.00",
      subtitle: "Monthly membership",
      title: "Plus",
      action: actionLabel || "Try Now",
      perks: ["Chat Tag Cosmetic", "Animation Tool", "Textured UGCs", "10 Saved Thumbnail Chats", "Bulk Downloads (1-5)", "1080p AI Thumbnail Quality", "Premium Looking Website"]
    };
    return [
      '<div class="rblx-membership-promo-floaters ' + (isPro ? 'is-pro' : 'is-plus') + '" aria-hidden="true"><span>' + floatingMark + '</span><span>' + floatingMark + '</span><span>' + floatingMark + '</span><span>' + floatingMark + '</span><span>' + floatingMark + '</span><span>' + floatingMark + '</span></div>',
      '<h3 class="rblx-membership-promo-title">' + config.title + '</h3>',
      '<div class="rblx-membership-promo-price-box' + (isPro ? ' is-discounted' : '') + '">' + (isPro ? '<span class="rblx-membership-promo-discount">' + config.discount + '</span><div class="rblx-membership-promo-price-row"><s>' + config.originalPrice + '</s><span class="rblx-membership-promo-price">' + config.price + '</span></div>' : '<span class="rblx-membership-promo-price">' + config.price + '</span>') + '<small>' + config.subtitle + '</small></div>',
      '<div class="rblx-membership-promo-perks">' + config.perks.map(function (perk) { return perk === "Includes All Plus Benefits" ? '<span class="rblx-membership-promo-included"><b>+</b>Includes All Plus Benefits</span>' : '<span><b>+</b>' + perk + '</span>'; }).join("") + '</div>',
      showBoxAd ? '<div class="rblx-token-promo-ad" data-rblx-promo-box-ad aria-label="Advertisement"><span>Advertisement</span></div>' : '',
      '<div class="rblx-membership-promo-footer"><div class="rblx-membership-promo-nav"><button type="button" class="rblx-membership-promo-arrow" data-membership-promo-prev aria-label="Show previous membership plan"></button><div class="rblx-membership-promo-progress" aria-label="Membership plan rotation timer"><span></span></div><button type="button" class="rblx-membership-promo-arrow" data-membership-promo-next aria-label="Show next membership plan"></button></div><a class="rblx-membership-promo-action" href="./subscriptions">' + config.action + '</a></div>'
    ].join("");
  }

  function buildAiTokenPromoMarkup(tokenPack) {
    return [
      '<div class="rblx-token-promo-kicker">AI Generation Tokens</div>',
      '<h3 class="rblx-token-promo-title">Keep creating<br><span>without waiting</span></h3>',
      '<p class="rblx-token-promo-copy">Power RBLXTools AI features with a token pack whenever you need more generations.</p>',
      '<div class="rblx-token-promo-pack"><div class="rblx-token-promo-coin">AI</div><strong>' + tokenPack.tokens + ' Tokens</strong><span>AI generation credits</span><b>' + tokenPack.price + '</b><small>' + tokenPack.note + '</small></div>',
      shouldShowMemberAds() ? '<div class="rblx-token-promo-ad" data-rblx-promo-box-ad aria-label="Advertisement"><span>Advertisement</span></div>' : '',
      '<div class="rblx-membership-promo-footer"><div class="rblx-membership-promo-nav"><button type="button" class="rblx-membership-promo-arrow" data-membership-promo-prev aria-label="Show previous offer"></button><div class="rblx-membership-promo-progress" aria-label="Offer rotation timer"><span></span></div><button type="button" class="rblx-membership-promo-arrow" data-membership-promo-next aria-label="Show next offer"></button></div><a class="rblx-membership-promo-action" href="./ai-tokens">Buy tokens</a></div>'
    ].join("");
  }

  function mountAiTokenPromoAd(promo) {
    var host = promo.querySelector("[data-rblx-promo-box-ad]");
    if (!host || !shouldShowMemberAds()) return;

    mountBoxAd(host);
  }

  function mountBoxAd(host) {
    if (!host || !shouldShowMemberAds() || host.dataset.rblxBoxAdMounted === "true") return;
    // Isolate each provider call so one ad placement cannot overwrite another's options.
    var adFrame = document.createElement("iframe");
    adFrame.className = "rblx-box-ad-frame";
    adFrame.title = "Advertisement";
    adFrame.width = "300";
    adFrame.height = "250";
    adFrame.scrolling = "no";
    adFrame.setAttribute("frameborder", "0");
    adFrame.srcdoc = '<!doctype html><html><head><style>html,body{width:300px;height:250px;margin:0;overflow:hidden}</style></head><body><script>atOptions={key:"d0b55a0366cbbdb50c4c68fe13fa1e3f",format:"iframe",height:250,width:300,params:{}};</script><script src="https://professionalsusceptible.com/d0b55a0366cbbdb50c4c68fe13fa1e3f/invoke.js"></script></body></html>';
    host.appendChild(adFrame);
    host.dataset.rblxBoxAdMounted = "true";
  }

  function mountDesktopShellBoxAds() {
    if (!shouldShowMemberAds() || !window.matchMedia("(min-width: 1180px)").matches) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-rblx-shell-box-ad]"), mountBoxAd);
  }

  function mountVerticalAd(host) {
    if (!host || !shouldShowMemberAds() || host.dataset.rblxVerticalAdMounted === "true") return;
    var adFrame = document.createElement("iframe");
    adFrame.className = "rblx-vertical-ad-frame";
    adFrame.title = "Advertisement";
    adFrame.width = "160";
    adFrame.height = "600";
    adFrame.scrolling = "no";
    adFrame.setAttribute("frameborder", "0");
    adFrame.srcdoc = '<!doctype html><html><head><style>html,body{width:160px;height:600px;margin:0;overflow:hidden}</style></head><body><script>atOptions={key:"c56a103ad60efdb3686d500b49552f97",format:"iframe",height:600,width:160,params:{}};</script><script src="https://professionalsusceptible.com/c56a103ad60efdb3686d500b49552f97/invoke.js"></script></body></html>';
    host.appendChild(adFrame);
    host.dataset.rblxVerticalAdMounted = "true";
  }

  function mountModalVerticalAds(overlay) {
    if (!overlay || !shouldShowMemberAds() || !window.matchMedia("(min-width: 1280px) and (min-height: 820px)").matches) return;
    Array.prototype.forEach.call(overlay.querySelectorAll("[data-rblx-modal-ad]"), mountVerticalAd);
  }

  function mountDesktopVerticalAds() {
    if (!shouldShowMemberAds() || !window.matchMedia("(min-width: 1180px)").matches) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-rblx-vertical-ad]"), mountVerticalAd);
  }

  function initMembershipPromoRotation() {
    var selector = ".plus-promo, body.rblx-home-page .home-grid-top > .plus-card";
    Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (promo) {
      if (promo.dataset.rblxPromoRotationBound === "true") return;
      promo.dataset.rblxPromoRotationBound = "true";
      var timerId = null;
      var activePlan = (shellState.currentUser && shellState.currentUser.plan) || "free";
      var offerIndex = 0;
      var rotationKey = "rblxtools_membership_promo_started:" + activePlan;
      var tokenPacks = [
        { tokens: 20, price: "$3.79", note: "Great for a quick project" },
        { tokens: 45, price: "$5.99", note: "More room to experiment" },
        { tokens: 130, price: "$14.49", note: "Built for active creators" },
        { tokens: 245, price: "$24.99", note: "Stock up for bigger ideas" },
        { tokens: 500, price: "$47.99", note: "Best value · Save 49%" }
      ];

      function getOffers() {
        if (document.body.classList.contains("rblx-home-page")) return [{ type: "plan", plan: "plus" }, { type: "plan", plan: "pro" }];
        if (activePlan === "pro") return tokenPacks.map(function (pack) { return { type: "token", pack: pack }; });
        if (activePlan === "plus") return [{ type: "plan", plan: "pro" }].concat(tokenPacks.map(function (pack) { return { type: "token", pack: pack }; }));
        return [{ type: "plan", plan: "plus" }, { type: "plan", plan: "pro" }];
      }

      function getOfferDuration(offer) {
        return offer && offer.type === "token" ? 6500 : 30000;
      }

      function getSavedRotationStart() {
        var start = 0;
        try { start = Number(sessionStorage.getItem(rotationKey)) || 0; } catch (_error) {}
        if (!start || start > Date.now()) {
          start = Date.now();
          try { sessionStorage.setItem(rotationKey, String(start)); } catch (_error) {}
        }
        return start;
      }

      function getRotationSnapshot(offers) {
        var total = offers.reduce(function (sum, offer) { return sum + getOfferDuration(offer); }, 0);
        var elapsed = total ? (Date.now() - getSavedRotationStart()) % total : 0;
        for (var index = 0; index < offers.length; index += 1) {
          var duration = getOfferDuration(offers[index]);
          if (elapsed < duration) return { index: index, elapsed: elapsed };
          elapsed -= duration;
        }
        return { index: 0, elapsed: 0 };
      }

      function render(nextIndex, elapsedInOffer) {
        var offers = getOffers();
        offerIndex = (nextIndex + offers.length) % offers.length;
        var offer = offers[offerIndex];
        var elapsed = Math.max(0, Math.min(getOfferDuration(offer) - 1, Number(elapsedInOffer) || 0));
        if (timerId) window.clearTimeout(timerId);
        promo.classList.toggle("rblx-pro-promo", offer.type === "plan" && offer.plan === "pro");
        promo.classList.toggle("rblx-token-promo", offer.type === "token");
        if (promo.parentElement) promo.parentElement.classList.toggle("rblx-token-promo-card", offer.type === "token");
        var showPromoBoxAd = shouldShowMemberAds() && !document.body.classList.contains("rblx-home-page") && !document.body.classList.contains("rblx-subscription-store") && !document.body.classList.contains("rblx-token-store-page");
        promo.innerHTML = offer.type === "token"
          ? buildAiTokenPromoMarkup(offer.pack)
          : buildMembershipPromoMarkup(offer.plan, document.body.classList.contains("rblx-home-page") ? "View" : "Try Now", showPromoBoxAd);
        if (showPromoBoxAd) mountAiTokenPromoAd(promo);

        var progress = promo.querySelector(".rblx-membership-promo-progress span");
        var duration = getOfferDuration(offer);
        if (progress) {
          progress.style.animation = "none";
          window.requestAnimationFrame(function () {
            progress.style.animation = "membershipPromoTimer " + duration + "ms linear forwards";
            progress.style.animationDelay = "-" + elapsed + "ms";
          });
        }
        Array.prototype.forEach.call(promo.querySelectorAll("[data-membership-promo-prev], [data-membership-promo-next]"), function (button) {
          button.addEventListener("click", function () {
            try { sessionStorage.setItem(rotationKey, String(Date.now())); } catch (_error) {}
            render(offerIndex + (button.hasAttribute("data-membership-promo-prev") ? -1 : 1), 0);
          });
        });
        timerId = window.setTimeout(function () {
          render(offerIndex + 1, 0);
        }, duration - elapsed);
      }

      promo._rblxSetMembershipPromoPlan = function (nextPlan) {
        var normalizedPlan = nextPlan === "pro" ? "pro" : nextPlan === "plus" ? "plus" : "free";
        if (normalizedPlan === activePlan) return;
        activePlan = normalizedPlan;
        rotationKey = "rblxtools_membership_promo_started:" + activePlan;
        try { sessionStorage.setItem(rotationKey, String(Date.now())); } catch (_error) {}
        render(0, 0);
      };
      var snapshot = getRotationSnapshot(getOffers());
      render(snapshot.index, snapshot.elapsed);
    });
  }

  function initSidebarPlanRotation() {
    var rotator = document.getElementById("rblxShellPlanRotator");
    if (!rotator) return;
    function sync() {
      var now = Date.now();
      var activePlan = Math.floor(now / 30000) % 2 === 0 ? "pro" : "plus";
      var progress = ((now % 30000) / 30000) * 100;
      rotator.dataset.activePlan = activePlan;
      Array.prototype.forEach.call(rotator.querySelectorAll("[data-rblx-plan-slide]"), function (slide) {
        slide.classList.toggle("is-active", slide.getAttribute("data-rblx-plan-slide") === activePlan);
        var timer = slide.querySelector(".rblx-shell-plan-timer b");
        if (timer) timer.style.width = progress.toFixed(2) + "%";
      });
    }
    sync();
    window.setInterval(sync, 1000);
  }

  function removePageFaqs(pageHost) {
    if (!pageHost) return;
    var sections = Array.prototype.slice.call(pageHost.querySelectorAll("section"));
    sections.forEach(function (section) {
      var heading = section.querySelector("h1, h2, h3");
      var hasFaqContent = section.matches(".faq-wrap, .faq-card, .faq-section") ||
        Boolean(section.querySelector(".faq-wrap, .faq-card, .faq-section, #rblx-hub-faq")) ||
        Boolean(heading && /\b(faqs?|frequently asked questions)\b/i.test(String(heading.textContent || "")));
      if (hasFaqContent) section.remove();
    });

    Array.prototype.slice.call(pageHost.querySelectorAll(".faq-wrap, .faq-card, .faq-section")).forEach(function (faq) {
      var section = faq.closest("section");
      (section || faq).remove();
    });

    Array.prototype.slice.call(pageHost.querySelectorAll("#rblx-hub-faq")).forEach(function (faq) {
      var card = faq.closest(".calc-side-card");
      (card || faq).remove();
    });
  }

  function getRewardValueLabel(reward) {
    var amount = Math.max(0, Number(reward && reward.amount) || 0);
    if (reward && reward.rewardType === "tokens") return amount + " AI tokens have been added to your balance.";
    return "You have been granted " + (reward && reward.rewardType === "pro" ? "Pro" : "Plus") + " for " + amount + " days.";
  }

  function getRewardFeedbackNodes() {
    return {
      panel: document.getElementById("rblxShellRewardFeedback"),
      stars: document.getElementById("rblxShellRewardStars"),
      title: document.getElementById("rblxShellRewardFeedbackTitle"),
      body: document.getElementById("rblxShellRewardFeedbackBody"),
      status: document.getElementById("rblxShellRewardFeedbackStatus"),
      submit: document.getElementById("rblxShellRewardFeedbackSubmit"),
      thanks: document.getElementById("rblxShellRewardFeedbackThanks")
    };
  }

  function setRewardFeedbackRating(stars, rating, previewRating) {
    if (!stars) return;
    var selected = Math.max(0, Math.min(5, Number(rating) || 0));
    var preview = Math.max(0, Math.min(5, Number(previewRating) || selected));
    stars.dataset.rating = String(selected);
    Array.prototype.forEach.call(stars.querySelectorAll("[data-reward-rating]"), function (button) {
      var value = Number(button.getAttribute("data-reward-rating")) || 0;
      button.classList.toggle("is-selected", value === selected);
      button.classList.toggle("is-preview", value <= preview);
      button.setAttribute("aria-checked", value === selected ? "true" : "false");
    });
  }

  function resetRewardFeedback() {
    var nodes = getRewardFeedbackNodes();
    if (!nodes.panel) return;
    nodes.panel.hidden = true;
    if (nodes.thanks) nodes.thanks.hidden = true;
    if (nodes.title) nodes.title.value = "";
    if (nodes.body) nodes.body.value = "";
    if (nodes.status) nodes.status.textContent = "";
    if (nodes.submit) { nodes.submit.disabled = false; nodes.submit.textContent = "Post feedback"; }
    setRewardFeedbackRating(nodes.stars, 0);
  }

  async function maybeShowRewardFeedback(overlay) {
    var userId = String(shellState.currentUser && shellState.currentUser.userId || "").trim();
    if (!overlay || !userId) return;
    try {
      var response = await fetch(API_BASE + "/api/community-posts?filter=feedback", { credentials: "include", cache: "no-store" });
      var payload = await response.json().catch(function () { return null; });
      if (!response.ok || !payload || !Array.isArray(payload.posts) || !overlay.classList.contains("is-open")) return;
      var hasFeedback = payload.posts.some(function (post) {
        return String(post && post.category || "") === "feedback" && String(post && post.authorId || "") === userId;
      });
      var nodes = getRewardFeedbackNodes();
      if (!nodes.panel || hasFeedback) return;
      nodes.panel.hidden = false;
      Array.prototype.forEach.call(nodes.stars.querySelectorAll("[data-reward-rating]"), function (button) {
        button.onmouseenter = function () { setRewardFeedbackRating(nodes.stars, nodes.stars.dataset.rating, button.getAttribute("data-reward-rating")); };
        button.onfocus = function () { setRewardFeedbackRating(nodes.stars, nodes.stars.dataset.rating, button.getAttribute("data-reward-rating")); };
        button.onclick = function () { setRewardFeedbackRating(nodes.stars, button.getAttribute("data-reward-rating")); };
      });
      nodes.stars.onmouseleave = function () { setRewardFeedbackRating(nodes.stars, nodes.stars.dataset.rating); };
      if (nodes.submit) nodes.submit.onclick = async function () {
        var rating = Number(nodes.stars && nodes.stars.dataset.rating || 0);
        var title = String(nodes.title && nodes.title.value || "").trim();
        var body = String(nodes.body && nodes.body.value || "").trim();
        if (!rating) { if (nodes.status) nodes.status.textContent = "Choose a rating from 1 to 5 stars."; return; }
        if (!title || !body) { if (nodes.status) nodes.status.textContent = "Add a review title and a short description."; return; }
        nodes.submit.disabled = true;
        nodes.submit.textContent = "Posting...";
        if (nodes.status) nodes.status.textContent = "";
        try {
          var submitResponse = await fetch(API_BASE + "/api/community-posts/member-posts", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: title, body: body, category: "feedback", rating: rating, plan: String(shellState.currentUser && shellState.currentUser.plan || "free") })
          });
          var submitPayload = await submitResponse.json().catch(function () { return null; });
          if (!submitResponse.ok) throw new Error(submitPayload && submitPayload.error || "Could not post feedback.");
          nodes.panel.hidden = true;
          if (nodes.thanks) nodes.thanks.hidden = false;
        } catch (error) {
          nodes.submit.disabled = false;
          nodes.submit.textContent = "Post feedback";
          if (nodes.status) nodes.status.textContent = error.message || "Could not post feedback.";
        }
      };
    } catch (_error) {
      // Do not show a review form if feedback history cannot be verified.
    }
  }

  function showMemberReward(reward) {
    var overlay = document.getElementById("rblxShellRewardOverlay");
    var modal = document.getElementById("rblxShellRewardModal");
    var title = document.getElementById("rblxShellRewardTitle");
    var value = document.getElementById("rblxShellRewardValue");
    var note = document.getElementById("rblxShellRewardNote");
    var wait = document.getElementById("rblxShellRewardWait");
    var claim = document.getElementById("rblxShellRewardClaim");
    if (!overlay || !modal || !claim || !reward) return;
    title.textContent = reward.title || "You've received a RBLXTools reward!";
    value.textContent = getRewardValueLabel(reward);
    note.textContent = reward.note || "Enjoy your reward from the RBLXTools team.";
    resetRewardFeedback();
    overlay.classList.add("is-open"); overlay.setAttribute("aria-hidden", "false"); modal.classList.add("is-open"); document.body.classList.add("rblx-shell-modal-open");
    mountModalVerticalAds(overlay);
    maybeShowRewardFeedback(overlay);
    // The server sends the remaining delay so an inaccurate device clock cannot stretch five seconds into minutes.
    var unlockAt = Date.now() + Math.max(0, Number(reward.claimDelayMs) || 0);
    function updateClaimState() {
      var seconds = Math.max(0, Math.ceil((unlockAt - Date.now()) / 1000));
      claim.disabled = seconds > 0;
      claim.textContent = seconds > 0 ? "Please read the note (" + seconds + ")" : "Claim reward";
      wait.textContent = seconds > 0 ? "Your claim unlocks in " + seconds + " second" + (seconds === 1 ? "" : "s") + "." : "Everything is ready. Claim your reward when you are ready.";
      return seconds;
    }
    var timer = window.setInterval(function () { if (updateClaimState() === 0) window.clearInterval(timer); }, 250);
    updateClaimState();
    claim.onclick = async function () {
      if (claim.disabled) return;
      claim.disabled = true; claim.textContent = "Claiming...";
      try {
        var response = await fetch(API_BASE + "/member-rewards/claim", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() }, body: JSON.stringify({ rewardId: reward.id }) });
        var payload = await response.json().catch(function () { return null; });
        if (!response.ok) throw new Error(payload && payload.error || "Could not claim this reward.");
        overlay.classList.remove("is-open"); overlay.setAttribute("aria-hidden", "true"); modal.classList.remove("is-open"); document.body.classList.remove("rblx-shell-modal-open");
        refreshMembershipStateFromServer(); refreshMemberRewards();
      } catch (error) { claim.disabled = false; wait.textContent = error.message || "Could not claim this reward."; updateClaimState(); }
    };
  }

  async function refreshMemberRewards() {
    var currentUser = shellState.currentUser || {};
    if (!currentUser.loggedIn || !currentUser.userId) return;
    try {
      var response = await fetch(API_BASE + "/member-rewards/pending", { credentials: "include", cache: "no-store", headers: { Authorization: "Bearer " + getToken() } });
      var payload = await response.json().catch(function () { return null; });
      if (!response.ok || !Array.isArray(payload && payload.rewards) || !payload.rewards.length) return;
      showMemberReward(payload.rewards[0]);
    } catch (_error) {}
  }

  function initShell() {
    var initialState = getImmediateUserState();
    shellState.currentUser = {
      loggedIn: Boolean(initialState.loggedIn),
      plan: initialState.plan || "guest",
      message: initialState.message || "",
      userId: initialState.userId || "",
      username: initialState.username || "",
      displayName: initialState.displayName || "",
      email: initialState.email || ""
    };
    shellState.isAdmin = Boolean(initialState.isAdmin);
    hydrateCommunityNotificationCache();
    refreshCurrentProfile();

    document.body.insertAdjacentHTML("beforeend", buildShellMarkup());
    shellState.renderedCommunityUnreadCount = shellState.communityUnreadCount;
    ensureSitePlusBackdrop();
    applyPlanAtmosphere(initialState.plan);
    var pageHost = document.getElementById("rblxShellPage");
    movePageContent(pageHost);
    removePageFaqs(pageHost);
    // Keep the shared footer outside individual page layouts so it always spans the shell center.
    pageHost.parentElement.insertAdjacentHTML("beforeend", buildFooterMarkup());
    captureStreamingPageContent(pageHost);
    window.setTimeout(function () {
      placeSharedFooter(pageHost);
      initSharedStoreFooterBannerAd();
      if (document.readyState !== "loading") revealSharedFooter();
    }, 0);
    syncMobileShellState();
    closeMobilePanels();
    initFaqAccordions();
    initSharedToolBannerAd();
    initSharedToolHeaderBannerAd();
    initSharedHomeBannerAds();
    initSharedMobileBannerAds();
    initSharedToolShowcase();
    initSharedToolStats();
    document.body.classList.add("rblx-shell-ready");
    initMembershipTextTreatment();
    initMembershipPromoRotation();
    initSidebarPlanRotation();
    mountDesktopShellBoxAds();
    mountDesktopVerticalAds();
    window.addEventListener("resize", mountDesktopShellBoxAds, { passive: true });
    window.addEventListener("resize", mountDesktopVerticalAds, { passive: true });
    initAnimationMembershipGate();
    window.addEventListener("rblxtools-membership-updated", function (event) {
      var detail = event && event.detail ? event.detail : {};
      var plan = detail.plan === "pro" ? "pro" : detail.plan === "plus" ? "plus" : "free";
      syncMemberAdVisibility({ plan: plan });
      Array.prototype.slice.call(document.querySelectorAll(".plus-promo, body.rblx-home-page .home-grid-top > .plus-card")).forEach(function (promo) {
        if (typeof promo._rblxSetMembershipPromoPlan === "function") promo._rblxSetMembershipPromoPlan(plan);
      });
    });
    // Tool pages load this shell before their promo markup, so bind again after parsing.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initMembershipPromoRotation, { once: true });
    }
    shellState.deviceId = getDeviceId();
    applyCollapsedState(document.body);
    initProfileOverlay();
    initCheckoutSuccessModal();
    initSupportModal();
    setupAuthModal();
    initLoginRequiredNavigation();
    document.addEventListener("click", function (event) {
      var profileMenu = document.querySelector(".rblx-shell-profile-menu[open]");
      if (profileMenu && !profileMenu.contains(event.target)) profileMenu.open = false;
      var markAllTrigger = event.target && event.target.closest ? event.target.closest("[data-shell-notifications-read-all]") : null;
      if (markAllTrigger) {
        event.preventDefault();
        markCommunityNotificationsRead("", true);
        return;
      }
      var notificationLink = event.target && event.target.closest ? event.target.closest("[data-shell-notification-post]") : null;
      if (notificationLink) {
        event.preventDefault();
        var destination = notificationLink.getAttribute("href") || "./community";
        markCommunityNotificationsRead(notificationLink.getAttribute("data-shell-notification-post") || "", false)
          .finally(function () { window.location.href = destination; });
        return;
      }
      var communityLink = event.target && event.target.closest ? event.target.closest('a[href="./community"], a[href="./community.html"]') : null;
      if (communityLink && shellState.communityUnreadCount > 0) {
        // Clear the indicator immediately; the server marks the same updates
        // read as the Community page opens.
        rememberCommunityPostsSeen();
        shellState.communityUnreadCount = 0;
        renderCommunityNotifications();
        markCommunityNotificationsRead("", true);
      }
      var logoutTrigger = event.target && event.target.closest ? event.target.closest("[data-shell-logout]") : null;
      if (!logoutTrigger) return;
      event.preventDefault();
      logoutCurrentUser();
    });
    initToggles();
    initFastShellNavigation();
    initChat();
    connectChatSocket();
    initAdminWindow();
    initRulesLink();
    loadPublicModerationState();
    initMembershipRefresh();
    refreshMemberRewards();
    initSiteMaintenancePolling();
    // Socket events update immediately. This short fallback also catches a
    // notification published while the visitor was briefly disconnected.
    window.setInterval(refreshCommunityNotifications, 30000);
    window.setInterval(refreshMemberRewards, 60000);
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
        shellState.socket.emit("join-room", getSocketJoinPayload());
      }
    });
    window.addEventListener("storage", function (event) {
      if (!event || !event.key) return;
      if (event.key === PROFILE_KEY || event.key.indexOf(PROFILE_KEY + ":") === 0) {
        refreshCurrentProfile();
        syncChatIdentity();
        if (shellState.socket && shellState.socketReady) {
          shellState.socket.emit("join-room", getSocketJoinPayload());
        }
        return;
      }
      if (event.key === USER_KEY || event.key === PLUS_STATUS_KEY) {
        var nextState = getImmediateUserState();
        updateAuthUi(nextState);
        dispatchMembershipUpdate({
          user: getCachedAuthUser(),
          plan: nextState.plan,
          premiumActive: nextState.plan === "plus" || nextState.plan === "pro"
        });
      }
    });
    updateAuthUi(initialState);
    resolveUserState().then(function (state) {
      shellState.authResolved = true;
      updateAuthUi(state);
      refreshSiteMaintenanceState();
      refreshMembershipStateFromServer();
    }).catch(function () {
      shellState.authResolved = true;
      updateAuthUi(getImmediateUserState());
    }).finally(function () {});
  }


  if (document.body) initShell();
  else document.addEventListener("DOMContentLoaded", initShell, { once: true });
}());
