/**
 * First-time tutorial tour.
 * Authenticated users: completion stored server-side via POST /api/tutorial/complete.
 * Guests: completion stored in localStorage.
 *
 * Spotlight technique: the highlighted element gets a large box-shadow that dims
 * the rest of the viewport while the element stays fully visible and interactive.
 * The overlay is only used for the welcome step (no target).
 *
 * Each step carries a `placement` hint so the card is never positioned on top of
 * the thing being described:
 *   'below'  — card below the element (default)
 *   'above'  — card above the element
 *   'right'  — card to the right, vertically centered (left-column panels)
 *   'inside' — card in the top-left corner of the element (large areas like canvas)
 *
 * The chat drawer is locked (pointer-events: none) until the chat step so users
 * cannot open it prematurely. A MutationObserver on the chat step repositions the
 * card after the drawer's slide animation finishes when the user opens or closes it.
 */
const Tutorial = (() => {
  const STEPS = [
    {
      title: "Welcome to the Simulation Dashboard",
      body: "This app lets you study animal behavior through interactive simulations and an AI tutor. This short tour covers the key features — it only takes a minute.",
      target: null,
    },
    {
      title: "Animal Groups",
      body: "Use these tabs to switch between animal groups: nonhuman primates, dogs and wolves, humans, and elephants. Try clicking a tab to switch groups.",
      target: "#tab-bar",
      placement: "below",
    },
    {
      title: "Topics and Species",
      body: "Choose a research topic and toggle between species using these controls. Different species show different behavioral patterns in the same simulation.",
      target: "#sub-nav",
      placement: "below",
    },
    {
      title: "Control Panel",
      body: "Adjust simulation parameters with these sliders — try moving one and watch the simulation respond. Changes take effect immediately.",
      target: "#control-panel",
      placement: "right",
    },
    {
      title: "Information Panel",
      body: "This panel explains what the simulation is modeling and what each color or shape represents. Read it to orient yourself before exploring.",
      target: "#info-panel",
      placement: "right",
    },
    {
      title: "Live Simulation",
      body: "Watch agents evolve in real time here. Observe the patterns that emerge, form a hypothesis, then head back to the control panel to test it.",
      target: "#sim-canvas",
      placement: "inside",
    },
    {
      title: "AI Tutor",
      body: "Click this bar to open your AI tutor chat. Ask questions about what you observe — after a few exchanges the tutor will pose a transfer question to test your understanding.",
      target: "#chat-drawer",
      placement: "above",
    },
    {
      title: "Transfer Task Progress",
      body: "This button tracks your transfer task completions. Each simulation has one — earn it by demonstrating you can apply what you learned to a new species.",
      target: "#progress-btn",
      placement: "below",
    },
  ];

  const CHAT_STEP_INDEX = STEPS.findIndex(s => s.target === '#chat-drawer');

  let currentStep = 0;
  let isAuthenticated = false;
  let currentTarget = null;
  let chatObserver = null;

  // ─── Public API ────────────────────────────────────────────────────────────

  function init({ username, tutorialSeen }) {
    isAuthenticated = !!username;

    document.getElementById('tutorial-next-btn').addEventListener('click', next);
    document.getElementById('tutorial-back-btn').addEventListener('click', back);
    document.getElementById('tutorial-skip-btn').addEventListener('click', finish);
    document.getElementById('tutorial-btn').addEventListener('click', start);

    // Authenticated users: show once (tutorial_seen persisted server-side).
    // Guests: always show — their session has no persistent state.
    const shouldShow = isAuthenticated ? tutorialSeen === false : true;

    if (shouldShow) start();
  }

  function start() {
    currentStep = 0;
    // Close the chat if it happens to be open, then lock it.
    document.getElementById('chat-drawer').classList.remove('open');
    _lockChat();
    _showStep(0);
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  function next() {
    if (currentStep < STEPS.length - 1) {
      _showStep(++currentStep);
    } else {
      finish();
    }
  }

  function back() {
    if (currentStep > 0) _showStep(--currentStep);
  }

  function finish() {
    _clearHighlight();
    _stopChatObserver();
    _unlockChat();
    document.getElementById('tutorial-overlay').classList.add('hidden');
    document.getElementById('tutorial-card').classList.add('hidden');

    if (isAuthenticated) {
      fetch('/api/tutorial/complete', { method: 'POST', credentials: 'include' }).catch(() => {});
    }
  }

  // ─── Step rendering ────────────────────────────────────────────────────────

  function _showStep(i) {
    const step = STEPS[i];
    const total = STEPS.length;

    // Update card text.
    document.getElementById('tutorial-step-indicator').textContent = `Step ${i + 1} of ${total}`;
    document.getElementById('tutorial-title').textContent = step.title;
    document.getElementById('tutorial-body').textContent = step.body;

    const backBtn = document.getElementById('tutorial-back-btn');
    const nextBtn = document.getElementById('tutorial-next-btn');
    backBtn.style.visibility = i === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = i === total - 1 ? 'Finish' : 'Next';

    _clearHighlight();
    _stopChatObserver();

    // Chat lock: locked for all steps before the chat step.
    if (i >= CHAT_STEP_INDEX) {
      _unlockChat();
    } else {
      _lockChat();
    }

    const overlay = document.getElementById('tutorial-overlay');
    const card = document.getElementById('tutorial-card');
    card.classList.remove('hidden');

    // Welcome step: overlay dims everything, card is centered.
    if (!step.target) {
      overlay.classList.remove('hidden');
      card.style.top = '50%';
      card.style.left = '50%';
      card.style.transform = 'translate(-50%, -50%)';
      return;
    }

    overlay.classList.add('hidden');

    const el = document.querySelector(step.target);
    if (!el) return;

    // position: fixed/absolute elements already create a stacking context; just
    // bump their z-index. Static/relative elements need position: relative first.
    const pos = getComputedStyle(el).position;
    el.classList.add(
      (pos === 'fixed' || pos === 'absolute') ? 'tutorial-highlight-fixed' : 'tutorial-highlight'
    );
    currentTarget = el;

    // Move card off-screen so we can measure it after paint, then position it.
    card.style.transform = 'none';
    card.style.top = '-9999px';
    card.style.left = '-9999px';

    requestAnimationFrame(() => _positionCard(el, card, step.placement || 'below'));

    // On the chat step, reposition whenever the drawer opens or closes.
    if (step.target === '#chat-drawer') {
      _watchChat(el, card, step.placement || 'above');
    }
  }

  // ─── Card positioning ──────────────────────────────────────────────────────

  function _positionCard(el, card, placement) {
    const rect = el.getBoundingClientRect();
    const cardH = card.offsetHeight;
    const cardW = card.offsetWidth;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 14;
    const edge = 12;

    let top, left;

    switch (placement) {
      case 'right':
        // Place to the right of the element, vertically centered on it.
        left = rect.right + gap;
        if (left + cardW > vw - edge) left = Math.max(edge, rect.left - cardW - gap);
        top = rect.top + rect.height / 2 - cardH / 2;
        top = Math.max(edge, Math.min(top, vh - cardH - edge));
        break;

      case 'above':
        top = rect.top - gap - cardH;
        if (top < edge) top = rect.bottom + gap; // flip below if no room
        left = rect.left + rect.width / 2 - cardW / 2;
        left = Math.max(edge, Math.min(left, vw - cardW - edge));
        break;

      case 'inside':
        // Top-left corner inside the element — used for large areas like the canvas.
        top = Math.max(edge, Math.min(rect.top + gap, vh - cardH - edge));
        left = Math.max(edge, Math.min(rect.left + gap, vw - cardW - edge));
        break;

      default: // 'below'
        top = rect.bottom + gap;
        if (top + cardH > vh - edge) top = rect.top - gap - cardH; // flip above
        top = Math.max(edge, top);
        left = rect.left + rect.width / 2 - cardW / 2;
        left = Math.max(edge, Math.min(left, vw - cardW - edge));
    }

    card.style.top = top + 'px';
    card.style.left = left + 'px';
  }

  // ─── Chat drawer observation ───────────────────────────────────────────────

  function _watchChat(chatEl, card, placement) {
    chatObserver = new MutationObserver(() => {
      // Wait for the drawer's CSS transition (0.35s) to finish before repositioning.
      setTimeout(
        () => requestAnimationFrame(() => _positionCard(chatEl, card, placement)),
        360
      );
    });
    chatObserver.observe(chatEl, { attributes: true, attributeFilter: ['class'] });
  }

  function _stopChatObserver() {
    if (chatObserver) {
      chatObserver.disconnect();
      chatObserver = null;
    }
  }

  // ─── Chat lock ─────────────────────────────────────────────────────────────

  function _lockChat() {
    document.getElementById('chat-drawer').classList.add('tutorial-locked');
  }

  function _unlockChat() {
    document.getElementById('chat-drawer').classList.remove('tutorial-locked');
  }

  // ─── Highlight management ──────────────────────────────────────────────────

  function _clearHighlight() {
    if (currentTarget) {
      currentTarget.classList.remove('tutorial-highlight', 'tutorial-highlight-fixed');
      currentTarget = null;
    }
  }

  return { init, start };
})();
