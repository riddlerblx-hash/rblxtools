(function () {
  var API_BASE = window.location.origin;
  var TOKEN_KEY = "rblxtools_auth_token";

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; }
    catch (_error) { return ""; }
  }

  function setStatus(message, tone) {
    var node = document.getElementById("maintenanceStatus");
    if (!node) return;
    node.textContent = message || "";
    node.className = "admin-result" + (tone ? " " + tone : "");
  }

  async function fetchJson(url, options) {
    var response = await fetch(url, options);
    var payload = await response.json().catch(function () { return null; });
    if (!response.ok) {
      throw new Error(payload && payload.error ? payload.error : "Request failed.");
    }
    return payload || {};
  }

  async function loadMaintenanceSettings() {
    var token = getToken();
    if (!token) {
      setStatus("Log into an approved admin account first.", "error");
      return;
    }

    try {
      var payload = await fetchJson(API_BASE + "/admin/site-maintenance", {
        headers: { Authorization: "Bearer " + token }
      });
      var settings = payload && payload.settings ? payload.settings : {};
      var enabledNode = document.getElementById("maintenanceEnabled");
      var titleNode = document.getElementById("maintenanceTitle");
      var noticeNode = document.getElementById("maintenanceNotice");
      if (enabledNode) enabledNode.checked = Boolean(settings.maintenanceEnabled);
      if (titleNode) titleNode.value = settings.maintenanceTitle || "Sorry, the site is under maintenance right now.";
      if (noticeNode) noticeNode.value = settings.maintenanceNotice || "This does not mean the servers are down. The RBLXTeam is currently updating the site. Please come back later.";
      setStatus("Maintenance settings loaded.", "success");
    } catch (error) {
      setStatus(error.message || "Could not load maintenance settings.", "error");
    }
  }

  async function saveMaintenanceSettings() {
    var token = getToken();
    if (!token) {
      setStatus("Log into an approved admin account first.", "error");
      return;
    }

    var enabledNode = document.getElementById("maintenanceEnabled");
    var titleNode = document.getElementById("maintenanceTitle");
    var noticeNode = document.getElementById("maintenanceNotice");
    var saveButton = document.getElementById("saveMaintenanceButton");
    if (saveButton) saveButton.disabled = true;
    setStatus("Saving maintenance settings...");

    try {
      var payload = await fetchJson(API_BASE + "/admin/site-maintenance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          maintenanceEnabled: Boolean(enabledNode && enabledNode.checked),
          maintenanceTitle: titleNode ? String(titleNode.value || "").trim() : "",
          maintenanceNotice: noticeNode ? String(noticeNode.value || "").trim() : ""
        })
      });
      setStatus(payload.message || "Maintenance settings saved.", "success");
    } catch (error) {
      setStatus(error.message || "Could not save maintenance settings.", "error");
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  }

  function init() {
    var saveButton = document.getElementById("saveMaintenanceButton");
    var refreshButton = document.getElementById("refreshMaintenanceButton");
    if (!saveButton || !refreshButton) return;
    saveButton.addEventListener("click", saveMaintenanceSettings);
    refreshButton.addEventListener("click", loadMaintenanceSettings);
    loadMaintenanceSettings();
  }

  init();
})();
