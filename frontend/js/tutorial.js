/**
 * First-time tutorial tour. Shows a step-by-step guide on first login/visit.
 * Authenticated users: completion stored server-side via POST /api/tutorial/complete.
 * Guests: completion stored in localStorage.
 */
const Tutorial = (() => {
  const STORAGE_KEY = 'psych_tutorial_seen';

  const STEPS = [
    {
      title: "Welcome to the Simulation Dashboard",
      body: "This app lets you explore animal behavior through interactive simulations and an AI tutor. This short tour covers the key features — it only takes a minute.",
      target: null,
    },
    {
      title: "Animal Groups",
      body: "Use the tabs at the top to switch between animal groups: nonhuman primates, dogs and wolves, humans, and elephants. Each group has its own simulations.",
      target: "#tab-bar",
    },
    {
      title: "Topics and Species",
      body: "Within each group, choose a research topic and toggle between species using these controls. Different species show different behavioral patterns.",
      target: "#sub-nav",
    },
    {
      title: "Control Panel",
      body: "Adjust simulation parameters — like population size and mutation rate — using these sliders. Changes take effect immediately in the simulation.",
      target: "#control-panel",
    },
    {
      title: "Live Simulation",
      body: "Watch agents evolve in real time on this canvas. Observe patterns, form hypotheses, and adjust controls to test your ideas.",
      target: "#sim-canvas",
    },
    {
      title: "AI Tutor",
      body: "Click the Chat bar at the bottom to open your AI tutor. Ask questions about what you observe. After a few exchanges, the tutor will pose a transfer question to test your understanding.",
      target: "#chat-drawer",
    },
    {
      title: "Transfer Task Progress",
      body: "This button tracks your transfer task completions. Each simulation has one transfer task — you earn it by demonstrating you can apply what you learned to a new species.",
      target: "#progress-btn",
    },
  ];

  let currentStep = 0;
  let isAuthenticated = false;
  let currentTarget = null;

  function init({ username, tutorialSeen }) {
    isAuthenticated = !!username;

    document.getElementById('tutorial-next-btn').addEventListener('click', next);
    document.getElementById('tutorial-back-btn').addEventListener('click', back);
    document.getElementById('tutorial-skip-btn').addEventListener('click', finish);

    const shouldShow = isAuthenticated
      ? tutorialSeen === false
      : !localStorage.getItem(STORAGE_KEY);

    if (shouldShow) start();
  }

  function start() {
    currentStep = 0;
    _showStep(0);
  }

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
    document.getElementById('tutorial-overlay').classList.add('hidden');
    document.getElementById('tutorial-card').classList.add('hidden');

    if (isAuthenticated) {
      fetch('/api/tutorial/complete', { method: 'POST', credentials: 'include' }).catch(() => {});
    } else {
      localStorage.setItem(STORAGE_KEY, '1');
    }
  }

  function _showStep(i) {
    const step = STEPS[i];
    const total = STEPS.length;

    document.getElementById('tutorial-step-indicator').textContent = `Step ${i + 1} of ${total}`;
    document.getElementById('tutorial-title').textContent = step.title;
    document.getElementById('tutorial-body').textContent = step.body;

    const backBtn = document.getElementById('tutorial-back-btn');
    const nextBtn = document.getElementById('tutorial-next-btn');
    backBtn.style.visibility = i === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = i === total - 1 ? 'Finish' : 'Next';

    _clearHighlight();
    if (step.target) {
      const el = document.querySelector(step.target);
      if (el) {
        el.classList.add('tutorial-highlight');
        currentTarget = el;
      }
    } else {
      currentTarget = null;
    }

    document.getElementById('tutorial-overlay').classList.remove('hidden');
    document.getElementById('tutorial-card').classList.remove('hidden');
  }

  function _clearHighlight() {
    if (currentTarget) {
      currentTarget.classList.remove('tutorial-highlight');
      currentTarget = null;
    }
  }

  return { init, start };
})();
