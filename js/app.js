import "./firebase.js";
import { initAuth } from "./auth.js";
import { initMatchViews, loadMatches, loadMyTips } from "./matches.js";
import { loadLeaderboard } from "./leaderboard.js";
import { initAdmin, loadAdminMatches } from "./admin.js";
import { state } from "./state.js";

function initTabs(){
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      panels.forEach((panel) => panel.classList.add("hidden"));

      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.remove("hidden");

      if (btn.dataset.tab === "tab-mytips") loadMyTips();
      if (btn.dataset.tab === "tab-table") loadLeaderboard();
      if (btn.dataset.tab === "tab-admin" && state.isAdmin) loadAdminMatches();
    });
  });
}

function initApp(){
  initTabs();
  initMatchViews();
  initAdmin();
  initAuth();

  document.addEventListener("auth-changed", () => {
    loadMatches();
    loadMyTips();
    loadLeaderboard();
    if (state.isAdmin) loadAdminMatches();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
