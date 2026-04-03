/**
 * Chat accordion: expand/collapse, per-topic message history, send & reset.
 */
const Chat = (() => {
  let drawer, header, messagesEl, form, input, sendBtn, resetBtn;
  let sending = false;

  function init() {
    drawer    = document.getElementById("chat-drawer");
    header    = document.getElementById("chat-header");
    messagesEl = document.getElementById("chat-messages");
    form      = document.getElementById("chat-form");
    input     = document.getElementById("chat-input");
    sendBtn   = document.getElementById("chat-send-btn");
    resetBtn  = document.getElementById("chat-reset-btn");

    header.addEventListener("click", toggle);
    form.addEventListener("submit", onSubmit);
    resetBtn.addEventListener("click", onReset);
  }

  function toggle(e) {
    // Don't toggle when clicking the reset button
    if (e && e.target.id === "chat-reset-btn") return;
    drawer.classList.toggle("open");
  }

  function renderHistory(topicId) {
    const history = AppState.getChatHistory(topicId);
    messagesEl.innerHTML = "";
    history.forEach(msg => appendBubble(msg.role, msg.content));
    messagesEl.scrollTop = messagesEl.scrollHeight;
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

    const topicId = AppState.activeTopic;
    AppState.appendChat(topicId, "user", message);
    appendBubble("user", message);
    input.value = "";
    sending = true;
    sendBtn.disabled = true;

    showTyping();

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, message }),
      });
      const data = await resp.json();
      removeTyping();

      if (resp.ok) {
        AppState.appendChat(topicId, "assistant", data.reply);
        appendBubble("assistant", data.reply);
      } else {
        const errMsg = data.error || "Failed to get response";
        appendBubble("error", errMsg);
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
    const topicId = AppState.activeTopic;
    AppState.clearChat(topicId);
    messagesEl.innerHTML = "";

    try {
      await fetch("/api/chat/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      });
    } catch {
      // Silently fail — local history is already cleared
    }
  }

  return { init, toggle, renderHistory };
})();
