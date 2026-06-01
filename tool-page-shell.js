const SHELL_API_BASE = window.location.origin;
const SHELL_TOKEN_KEY = "rblxtools_auth_token";
const SHELL_PROFILE_KEY = "rblxtools_profile_overview";
const SHOWCASE_INTERVAL_MS = 45000;

const showcasePanel = document.getElementById("showcasePanel");
const showcaseViewport = document.getElementById("showcaseViewport");
const showcaseProgress = document.getElementById("showcaseProgress");
const toolMount = document.getElementById("toolMount");

let cachedActivityIdentity = null;
let knownPlus = null;
let showcaseTimer = null;
let showcaseProgressTimer = null;
let activeToolIndex = 0;

const toolsData = [
  { name: "Template Background Changer", desc: "Remove marks and restore a clean classic template background.", href: "./template-background-changer", plus: false, icon: "spark", tag: "Cleanup Tool", tone: "linear-gradient(180deg,#31506a,#1f2f42)" },
  { name: "UGC Downloader", desc: "Download supported UGC accessory files for creator workflows.", href: "./ugc-downloader", plus: false, icon: "hat", tag: "UGC Tool", tone: "linear-gradient(180deg,#2a4a6c,#1e2f42)" },
  { name: "Robux Calculator", desc: "Fast conversion math for Robux and pricing plans.", href: "./robux-calculator", plus: false, icon: "calc", tag: "Value Tool", tone: "linear-gradient(180deg,#3e5b35,#27391f)" },
  { name: "Media Downloader", desc: "Pull supported media assets quickly.", href: "./media-downloader", plus: false, icon: "media", tag: "Media Tool", tone: "linear-gradient(180deg,#5a3b61,#32213a)" },
  { name: "Audio Downloader", desc: "Fetch audio asset files from supported IDs.", href: "./audio-downloader", plus: false, icon: "audio", tag: "Audio Tool", tone: "linear-gradient(180deg,#6a3e3a,#3f2523)" },
  { name: "Texture Baker", desc: "Premium texture workflow and cleaner UGC output.", href: "./texture-baker", plus: true, icon: "texture", tag: "Plus Tool", tone: "linear-gradient(180deg,#4a406b,#2a2441)" },
  { name: "Animation Spoofer", desc: "Premium animation utility for advanced workflows.", href: "./animation-spoofer", plus: true, icon: "rig", tag: "Plus Tool", tone: "linear-gradient(180deg,#3a456f,#212846)" }
];

function getStoredToken() {
  try { return localStorage.getItem(SHELL_TOKEN_KEY) || ""; } catch (_e) { return ""; }
}

function hasPlusFromPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  return Boolean(
    payload.plus === true || payload.isPlus === true || payload.hasPlus === true ||
    payload.plusActive === true || payload.subscription === "plus" || payload.plan === "plus" || payload.tier === "plus"
  );
}

function normalizeFavoriteTools(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5);
  if (typeof value === "string" && value.trim()) return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 5);
  return [];
}

function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }

function readPath(source, path) {
  if (!source || typeof source !== "object") return undefined;
  const parts = path.split(".");
  let value = source;
  for (let i = 0; i < parts.length; i += 1) {
    if (!value || typeof value !== "object" || !(parts[i] in value)) return undefined;
    value = value[parts[i]];
  }
  return value;
}

function firstString(source, paths) {
  for (let i = 0; i < paths.length; i += 1) {
    const value = readPath(source, paths[i]);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function loadStoredProfile(userId, userEmail) {
  const profile = { displayName: "", avatarUrl: "", favoriteTools: [] };
  const normalizedUserId = String(userId || "").trim();
  const normalizedUserEmail = normalizeEmail(userEmail);

  function applyProfile(parsed) {
    if (!parsed || typeof parsed !== "object") return;
    if (!profile.displayName && parsed.displayName) profile.displayName = String(parsed.displayName).trim();
    if (!profile.avatarUrl && parsed.avatarUrl) profile.avatarUrl = String(parsed.avatarUrl).trim();
    if (!profile.favoriteTools.length && parsed.favoriteTools) profile.favoriteTools = normalizeFavoriteTools(parsed.favoriteTools);
  }

  function readProfileKey(key) {
    try {
      const raw = localStorage.getItem(key) || "";
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  if (normalizedUserId) applyProfile(readProfileKey(SHELL_PROFILE_KEY + ":" + normalizedUserId));

  const genericProfile = readProfileKey(SHELL_PROFILE_KEY);
  if (genericProfile) {
    const genericUserId = String(genericProfile.userId || genericProfile.id || genericProfile.accountId || genericProfile.profileId || "").trim();
    const genericEmail = normalizeEmail(genericProfile.email || genericProfile.userEmail || genericProfile.accountEmail);
    const matchesCurrentUser =
      (!normalizedUserId && !normalizedUserEmail) ||
      (normalizedUserId && genericUserId && genericUserId === normalizedUserId) ||
      (normalizedUserEmail && genericEmail && genericEmail === normalizedUserEmail);
    if (matchesCurrentUser) applyProfile(genericProfile);
  }

  return profile;
}

async function resolveActivityIdentity() {
  if (cachedActivityIdentity) return cachedActivityIdentity;
  const token = getStoredToken();
  if (!token) {
    cachedActivityIdentity = { userId: "", displayName: "", username: "", avatarUrl: "", plan: "guest", isPlus: false };
    return cachedActivityIdentity;
  }

  let isPlus = false;
  try {
    const premiumResponse = await fetch(SHELL_API_BASE + "/auth/premium-status", { method: "GET", headers: { Authorization: "Bearer " + token } });
    if (premiumResponse.ok) {
      const premiumPayload = await premiumResponse.json().catch(() => null);
      isPlus = hasPlusFromPayload(premiumPayload);
    }
  } catch (_error) {}

  try {
    const response = await fetch(SHELL_API_BASE + "/auth/me", { method: "GET", headers: { Authorization: "Bearer " + token } });
    if (!response.ok) throw new Error("Could not load account.");
    const payload = await response.json().catch(() => null);
    const userId = firstString(payload, ["id","userId","user.id","user.userId","profile.id","account.id"]);
    const fallbackEmail = firstString(payload, ["email","user.email","account.email"]);
    const storedProfile = loadStoredProfile(userId, fallbackEmail);
    const accountPlan = firstString(payload, ["plan","subscription","tier","user.plan","user.subscription","user.tier","account.plan"]).toLowerCase();
    const fetchedDisplayName = firstString(payload, ["displayName","username","name","user.displayName","user.username","user.name","profile.displayName","profile.username","account.displayName","account.username"]);
    const displayName = storedProfile.displayName || fetchedDisplayName || (fallbackEmail ? fallbackEmail.split("@")[0] : "");
    const username = firstString(payload, ["username","user.username","profile.username","account.username"]) || displayName;
    const avatarUrl = storedProfile.avatarUrl || firstString(payload, ["avatarUrl","avatar","avatarURL","profilePicture","profileImage","profilePhoto","imageUrl","user.avatarUrl","user.avatar","user.profilePicture","user.profileImage","user.imageUrl","profile.avatarUrl","profile.profilePicture","profile.imageUrl","account.avatarUrl","account.profilePicture"]) || "";
    const plan = isPlus || accountPlan === "plus" || accountPlan === "premium" ? "plus" : (accountPlan || "free");
    cachedActivityIdentity = { userId: String(userId || ""), displayName: String(displayName || ""), username: String(username || ""), avatarUrl: String(avatarUrl || ""), plan: plan, isPlus: plan === "plus" };
    return cachedActivityIdentity;
  } catch (_error) {
    cachedActivityIdentity = { userId: "", displayName: "", username: "", avatarUrl: "", plan: isPlus ? "plus" : "free", isPlus: isPlus };
    return cachedActivityIdentity;
  }
}

async function fetchPlusStatus() {
  const token = getStoredToken();
  if (!token) return false;
  try {
    const premiumResponse = await fetch(SHELL_API_BASE + "/auth/premium-status", { method: "GET", headers: { Authorization: "Bearer " + token } });
    if (premiumResponse.ok) {
      const premiumPayload = await premiumResponse.json().catch(() => null);
      return hasPlusFromPayload(premiumPayload);
    }
    if (premiumResponse.status === 401 || premiumResponse.status === 403) return false;
    const response = await fetch(SHELL_API_BASE + "/auth/me", { method: "GET", headers: { Authorization: "Bearer " + token } });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => null);
    return hasPlusFromPayload(payload);
  } catch (_e) {
    return false;
  }
}

async function bootstrapPlusStatus() {
  if (knownPlus === true) return true;
  knownPlus = await fetchPlusStatus();
  return knownPlus;
}

function getToolShowcaseIcon(kind) {
  const icons = {
    spark: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6l2.9 8.1L35 17l-8.1 2.9L24 28l-2.9-8.1L13 17l8.1-2.9L24 6z"></path><path d="M36 26l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8 1.8-5z"></path><path d="M13 28l1.5 4.1 4.1 1.5-4.1 1.5L13 39l-1.5-4.1-4.1-1.5 4.1-1.5L13 28z"></path></svg>`,
    hat: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 26c1.9-5.8 6.1-9 10-9s8.1 3.2 10 9"></path><path d="M8 28.5c4.9-2.7 10.4-4 16-4s11.1 1.3 16 4"></path><path d="M10 29v3.5c0 2.5 6.3 4.5 14 4.5s14-2 14-4.5V29"></path></svg>`,
    calc: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="13" y="7" width="22" height="34" rx="5"></rect><rect x="17" y="12" width="14" height="6" rx="2"></rect><path d="M18 25h4"></path><path d="M18 31h4"></path><path d="M18 37h4"></path><path d="M26 25h4"></path><path d="M26 31h4"></path><path d="M26 37h4"></path></svg>`,
    media: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="11" width="32" height="26" rx="5"></rect><circle cx="17" cy="19" r="3"></circle><path d="M13 32l7-7 5 5 5-4 5 6"></path></svg>`,
    audio: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 29h5l7 7V12l-7 7h-5z"></path><path d="M32 18c2.8 2 4.5 5.2 4.5 8.5S34.8 33 32 35"></path><path d="M35.5 13.5c4.1 3.1 6.5 7.8 6.5 13s-2.4 9.9-6.5 13"></path></svg>`,
    texture: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="10" width="28" height="28" rx="5"></rect><path d="M19.5 10v28"></path><path d="M28.5 10v28"></path><path d="M10 19.5h28"></path><path d="M10 28.5h28"></path></svg>`,
    rig: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="11" r="4"></circle><path d="M24 15v10"></path><path d="M24 19l-8 4"></path><path d="M24 19l8 4"></path><path d="M24 25l-6 10"></path><path d="M24 25l6 10"></path><path d="M18 35h12"></path></svg>`
  };
  return icons[kind] || icons.spark;
}

function updateShowcaseProgress() {
  if (!showcaseProgress) return;
  showcaseProgress.style.width = "0%";
  const start = Date.now();
  if (showcaseProgressTimer) clearInterval(showcaseProgressTimer);
  showcaseProgressTimer = setInterval(() => {
    const elapsed = Date.now() - start;
    const percent = Math.min(100, (elapsed / SHOWCASE_INTERVAL_MS) * 100);
    showcaseProgress.style.width = percent + "%";
    if (percent >= 100) clearInterval(showcaseProgressTimer);
  }, 200);
}

function renderToolSlide() {
  const tool = toolsData[activeToolIndex];
  document.getElementById("slidePills").innerHTML = `
    <span class="tool-pill">Other Tool</span>
    ${tool.plus ? '<span class="tool-pill plus"><span class="plus-word">Plus</span> Required</span>' : '<span class="tool-pill">Free Access</span>'}
  `;
  document.getElementById("slideName").textContent = tool.name;
  document.getElementById("slideDesc").textContent = tool.desc;
  document.getElementById("slideGlyph").innerHTML = getToolShowcaseIcon(tool.icon);
  document.getElementById("slideTag").textContent = tool.tag;
  document.getElementById("slideLogoPreview").style.background = tool.tone;
}

function animateToolSlide(nextIndex) {
  if (nextIndex === activeToolIndex) return;
  showcasePanel.classList.add("animating");
  window.setTimeout(() => {
    activeToolIndex = nextIndex;
    renderToolSlide();
    showcasePanel.classList.remove("animating");
  }, 220);
}

function restartShowcaseTimer() {
  if (showcaseTimer) clearInterval(showcaseTimer);
  updateShowcaseProgress();
  showcaseTimer = setInterval(() => {
    animateToolSlide((activeToolIndex + 1) % toolsData.length);
    updateShowcaseProgress();
  }, SHOWCASE_INTERVAL_MS);
}

function goToTool(nextIndex) {
  const normalizedIndex = (nextIndex + toolsData.length) % toolsData.length;
  animateToolSlide(normalizedIndex);
  restartShowcaseTimer();
}

function showShellPlusGate() { document.getElementById("plusGate").classList.add("open"); }
function hideShellPlusGate() { document.getElementById("plusGate").classList.remove("open"); }

async function openCurrentTool() {
  const tool = toolsData[activeToolIndex];
  if (!tool.plus) { window.location.href = tool.href; return; }
  if (knownPlus === true) { window.location.href = tool.href; return; }
  const hasPlus = await bootstrapPlusStatus();
  if (hasPlus) { window.location.href = tool.href; return; }
  showShellPlusGate();
}

function sanitizeEmbeddedStyle(cssText) {
  return String(cssText || "")
    .replace(/html\s*,\s*body\s*\{[\s\S]*?\}/gi, "")
    .replace(/(^|\n)\s*body\s*\{[\s\S]*?\}/gi, "\n")
    .concat(
      "\n#toolMount,#toolMount *{box-sizing:border-box;}" +
      "\n#toolMount #rblx-audio-stack,#toolMount #rblx-media-stack,#toolMount #roblox-ugc-app,#toolMount #rblx-template-cleaner,#toolMount #animation-spoofer-embed{padding:0!important;justify-content:stretch!important;}" +
      "\n#toolMount #rblx-audio-shell,#toolMount #rblx-media-shell,#toolMount #roblox-ugc-stack-shell,#toolMount .rblx-cleaner-stack,#toolMount #animation-spoofer-shell,#toolMount .tool-stack{max-width:none!important;width:100%!important;}" +
      "\n#toolMount .promo-card,#toolMount #media-downloader-card,#toolMount #roblox-ugc-coming-card,#toolMount .rblx-cleaner-promo-card,#toolMount #dev-assets-promo{display:none!important;}" +
      "\n#toolMount #accessGate{display:none!important;}" +
      "\n#toolMount #toolContent{display:block!important;filter:none!important;pointer-events:auto!important;user-select:auto!important;}"
    );
}

async function executeEmbeddedScripts(host, sourceScripts) {
  for (const sourceScript of sourceScripts) {
    await new Promise((resolve, reject) => {
      const newScript = document.createElement("script");
      Array.from(sourceScript.attributes).forEach((attribute) => newScript.setAttribute(attribute.name, attribute.value));

      if (sourceScript.src) {
        newScript.onload = () => resolve();
        newScript.onerror = () => reject(new Error("Could not load embedded script."));
      }

      if (sourceScript.textContent) newScript.textContent = sourceScript.textContent;
      host.appendChild(newScript);

      if (!sourceScript.src) {
        resolve();
      }
    });
  }
}

async function loadInlineTool() {
  if (!toolMount) return;
  const src = toolMount.dataset.src;
  if (!src) return;

  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error("Could not load tool.");
    const markup = await response.text();
    const parsed = new DOMParser().parseFromString(markup, "text/html");
    const sourceScripts = Array.from(parsed.querySelectorAll("script"));
    const sourceStyles = Array.from(parsed.querySelectorAll("style"));
    toolMount.innerHTML = "";

    sourceStyles.forEach((styleNode) => {
      const style = document.createElement("style");
      style.textContent = sanitizeEmbeddedStyle(styleNode.textContent);
      toolMount.appendChild(style);
    });

    Array.from(parsed.body.childNodes).forEach((node) => {
      if (node.nodeType === 1 && (node.tagName === "SCRIPT" || node.tagName === "STYLE")) return;
      toolMount.appendChild(document.importNode(node, true));
    });

    const removeSelectors = String(toolMount.dataset.removeSelectors || "").trim();
    if (removeSelectors) {
      removeSelectors.split(",").map((value) => value.trim()).filter(Boolean).forEach((selector) => {
        toolMount.querySelectorAll(selector).forEach((node) => node.remove());
      });
    }

    await executeEmbeddedScripts(toolMount, sourceScripts);
  } catch (_error) {
    toolMount.innerHTML = "<article class=\"card\"><div class=\"badge\">Tool Load Error</div><h2><span>Could Not</span><span>Load Tool</span></h2><p class=\"subtitle\">Refresh the page and try again.</p></article>";
  }
}

document.getElementById("prevTool").addEventListener("click", () => goToTool(activeToolIndex - 1));
document.getElementById("nextTool").addEventListener("click", () => goToTool(activeToolIndex + 1));
document.getElementById("openTool").addEventListener("click", openCurrentTool);
document.getElementById("closeGate").addEventListener("click", hideShellPlusGate);
document.getElementById("plusGate").addEventListener("click", (e) => { if (e.target.id === "plusGate") hideShellPlusGate(); });
showcaseViewport.addEventListener("mouseenter", () => {
  if (showcaseTimer) clearInterval(showcaseTimer);
  if (showcaseProgressTimer) clearInterval(showcaseProgressTimer);
});
showcaseViewport.addEventListener("mouseleave", restartShowcaseTimer);
document.querySelectorAll(".faq-q").forEach((button) => {
  button.addEventListener("click", () => button.parentElement.classList.toggle("open"));
});

renderToolSlide();
restartShowcaseTimer();
bootstrapPlusStatus();
loadInlineTool();
