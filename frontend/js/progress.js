/**
 * Transfer task progress: modal display and server sync.
 * Only active for authenticated users; guests see nothing.
 */
const Progress = (() => {
  // All transfer tasks in display order, matching backend group_id:topic_id keys.
  const TASKS = [
    { group_id: "chimps_bonobos", topic_id: "aggression",        label: "Nonhuman Primates — Aggression" },
    { group_id: "chimps_bonobos", topic_id: "culture",           label: "Nonhuman Primates — Culture" },
    { group_id: "dogs_wolves",    topic_id: "gaze_following",    label: "Dogs & Wolves — Gaze Following" },
    { group_id: "humans",         topic_id: "self_domestication", label: "Humans — Self-Domestication" },
    { group_id: "elephants",      topic_id: "theory_of_mind",    label: "Elephants — Theory of Mind" },
  ];

  let passed = new Set(); // "group_id:topic_id" keys that are passed
  let isAuthenticated = false;

  function init(authenticated) {
    isAuthenticated = authenticated;

    document.getElementById("progress-btn").addEventListener("click", show);
    document.getElementById("progress-close-btn").addEventListener("click", hide);
    document.getElementById("progress-overlay").addEventListener("click", e => {
      if (e.target === document.getElementById("progress-overlay")) hide();
    });

    if (authenticated) refresh();
  }

  async function refresh() {
    if (!isAuthenticated) return;
    try {
      const resp = await fetch("/api/progress", { credentials: "include" });
      if (!resp.ok) return;
      const data = await resp.json();
      passed = new Set(data.progress.map(r => `${r.group_id}:${r.topic_id}`));
      _renderList();
      _updateBadge();
    } catch { /* silently ignore network errors */ }
  }

  function show() {
    _renderList();
    document.getElementById("progress-overlay").classList.remove("hidden");
  }

  function hide() {
    document.getElementById("progress-overlay").classList.add("hidden");
  }

  function _renderList() {
    const list = document.getElementById("progress-list");
    list.innerHTML = "";

    if (!isAuthenticated) {
      const msg = document.createElement("p");
      msg.className = "progress-guest-msg";
      msg.textContent = "Create an account to track your progress across transfer tasks. Your completions are saved to your profile and persist between sessions.";
      list.appendChild(msg);

      const registerBtn = document.createElement("button");
      registerBtn.className = "progress-register-btn";
      registerBtn.textContent = "Register";
      registerBtn.addEventListener("click", () => { hide(); Auth.showModal(); });
      list.appendChild(registerBtn);

      _appendReplayLink(list);
      return;
    }

    TASKS.forEach(task => {
      const key = `${task.group_id}:${task.topic_id}`;
      const done = passed.has(key);
      const row = document.createElement("div");
      row.className = `progress-row${done ? " done" : ""}`;

      const icon = document.createElement("span");
      icon.className = "progress-icon";
      icon.textContent = done ? "✓" : "○";

      const label = document.createElement("span");
      label.className = "progress-label";
      label.textContent = task.label;

      const status = document.createElement("span");
      status.className = "progress-status";
      status.textContent = done ? "Passed" : "Not yet completed";

      row.appendChild(icon);
      row.appendChild(label);
      row.appendChild(status);
      list.appendChild(row);
    });

    _appendReplayLink(list);
  }

  function _appendReplayLink(container) {
    const link = document.createElement("button");
    link.className = "progress-replay-btn";
    link.textContent = "Replay tutorial";
    link.addEventListener("click", () => { hide(); Tutorial.start(); });
    container.appendChild(link);
  }

  function _updateBadge() {
    const btn = document.getElementById("progress-btn");
    if (!btn) return;
    const count = passed.size;
    const total = TASKS.length;
    btn.textContent = count > 0 ? `Progress (${count}/${total})` : "Progress";
  }

  return { init, refresh, show, hide };
})();
