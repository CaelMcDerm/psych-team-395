/**
 * Chat accordion: expand/collapse, per-key message history, send & reset.
 */
const Chat = (() => {
  let drawer, header, messagesEl, form, input, sendBtn, resetBtn;
  let sending = false;
  let responseMode = "concise";
  const loadedFromServer = new Set();

  function init() {
    drawer     = document.getElementById("chat-drawer");
    header     = document.getElementById("chat-header");
    messagesEl = document.getElementById("chat-messages");
    form       = document.getElementById("chat-form");
    input      = document.getElementById("chat-input");
    sendBtn    = document.getElementById("chat-send-btn");
    resetBtn   = document.getElementById("chat-reset-btn");

    header.addEventListener("click", toggle);
    form.addEventListener("submit", onSubmit);
    resetBtn.addEventListener("click", onReset);

    document.querySelectorAll(".mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        responseMode = btn.dataset.mode;
        document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  }

  function toggle(e) {
    if (e && (e.target.id === "chat-reset-btn" || e.target.classList.contains("mode-btn"))) return;
    drawer.classList.toggle("open");
  }

  function renderHistory() {
    const key = AppState.chatKey;
    const history = AppState.getChatHistory(key);
    messagesEl.innerHTML = "";
    const greeting = AppState.getGreeting(key);
    if (greeting) appendBubble("assistant", greeting);
    history.forEach(msg => appendBubble(msg.role, msg.content));
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function loadHistory() {
    const key = AppState.chatKey;
    if (loadedFromServer.has(key)) {
      renderHistory();
      return;
    }
    fetch(`/api/chat/history?groupId=${AppState.activeGroup}&topicId=${AppState.activeTopic}`, {
      credentials: "include",
    })
      .then(r => {
        if (r.status === 401) { Auth.showModal(); return null; }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        loadedFromServer.add(key);
        AppState.clearChat(key);
        data.history.forEach(m => AppState.appendChat(key, m.role, m.content));
        renderHistory();
      })
      .catch(() => renderHistory());
  }

  function appendBubble(role, content) {
    const div = document.createElement("div");
    div.className = `chat-msg ${role}`;
    div.textContent = content;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "chat-typing";
    div.id = "typing-indicator";
    div.textContent = "Thinking...";
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeTyping() {
    const el = document.getElementById("typing-indicator");
    if (el) el.remove();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const message = input.value.trim();
    if (!message || sending) return;

    const key = AppState.chatKey;
    AppState.appendChat(key, "user", message);
    appendBubble("user", message);
    input.value = "";
    sending = true;
    sendBtn.disabled = true;

    showTyping();

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          groupId: AppState.activeGroup,
          topicId: AppState.activeTopic,
          message,
          responseMode,
        }),
      });

      const data = await resp.json();
      removeTyping();

      if (resp.ok) {
        AppState.appendChat(key, "assistant", data.reply);
        appendBubble("assistant", data.reply);
        if (data.transfer_passed) Progress.refresh();
      } else {
        appendBubble("error", data.error || "Failed to get response");
      }
    } catch (err) {
      removeTyping();
      appendBubble("error", "Network error — is the backend running?");
    } finally {
      sending = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  async function onReset(e) {
    e.stopPropagation();
    const key = AppState.chatKey;
    AppState.clearChat(key);
    loadedFromServer.add(key); // mark as loaded (now empty)
    messagesEl.innerHTML = "";
    const greeting = AppState.getGreeting(key);
    if (greeting) appendBubble("assistant", greeting);

    try {
      await fetch("/api/chat/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          groupId: AppState.activeGroup,
          topicId: AppState.activeTopic,
        }),
      });
    } catch { /* local history already cleared */ }
  }

  return { init, toggle, renderHistory, loadHistory };
})();
