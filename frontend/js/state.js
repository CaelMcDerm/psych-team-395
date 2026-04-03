/**
 * Client-side state store.
 * Each topic gets an independent state object: controls, chatHistory, simState.
 */
const AppState = (() => {
  let activeTopic = null;
  let topics = [];  // [{id, label, description}]
  const store = {}; // topicId -> {controls, chatHistory, simState}

  // Default control configs per topic
  const controlConfigs = {
    topic_1: [
      { key: "length",  label: "Length (m)",   min: 0.5, max: 5,   step: 0.1, default: 2   },
      { key: "gravity", label: "Gravity (m/s²)", min: 1,  max: 20,  step: 0.5, default: 9.8 },
      { key: "damping", label: "Damping",      min: 0,   max: 1,   step: 0.01, default: 0.05 },
    ],
    topic_2: [
      { key: "freq1",      label: "Frequency 1 (Hz)", min: 0.5, max: 10,  step: 0.1, default: 2   },
      { key: "freq2",      label: "Frequency 2 (Hz)", min: 0.5, max: 10,  step: 0.1, default: 3   },
      { key: "amplitude",  label: "Amplitude",        min: 0.1, max: 2,   step: 0.1, default: 1   },
      { key: "phase",      label: "Phase Offset (rad)", min: 0,  max: 6.28, step: 0.01, default: 0 },
    ],
    topic_3: [
      { key: "angle",    label: "Launch Angle (°)", min: 5,  max: 85, step: 1,   default: 45 },
      { key: "velocity", label: "Initial Velocity (m/s)", min: 5, max: 100, step: 1, default: 40 },
      { key: "drag",     label: "Air Resistance",   min: 0,  max: 0.5, step: 0.01, default: 0  },
    ],
    topic_4: [
      { key: "springK", label: "Spring Constant (N/m)", min: 1,  max: 50, step: 0.5, default: 10 },
      { key: "mass",    label: "Mass (kg)",             min: 0.1, max: 10, step: 0.1, default: 1  },
      { key: "displacement", label: "Initial Displacement (m)", min: 0.1, max: 3, step: 0.1, default: 1 },
    ],
  };

  // Info text per topic
  const infoTexts = {
    topic_1: `<p>A <strong>simple pendulum</strong> consists of a mass suspended from a pivot point by a string of length <em>L</em>.</p>
<p>The period of oscillation is approximately:</p>
<p style="font-family:var(--font-mono); text-align:center; margin:0.75rem 0;">T ≈ 2π √(L / g)</p>
<p>Increasing <strong>damping</strong> causes the amplitude to decay over time. Adjust the sliders to observe how each parameter affects the pendulum's motion.</p>`,

    topic_2: `<p><strong>Wave interference</strong> occurs when two waves overlap. The result depends on their frequencies, amplitudes, and relative phase.</p>
<p><em>Constructive interference</em> happens when waves are in phase; <em>destructive interference</em> occurs when they are out of phase.</p>
<p>The combined wave is: y(t) = A·sin(2πf₁t) + A·sin(2πf₂t + φ)</p>
<p>Try setting the two frequencies close together to observe <strong>beat frequencies</strong>.</p>`,

    topic_3: `<p><strong>Projectile motion</strong> describes an object launched near Earth's surface, subject to gravity and optionally air resistance.</p>
<p>Without drag, the range is:</p>
<p style="font-family:var(--font-mono); text-align:center; margin:0.75rem 0;">R = v₀² sin(2θ) / g</p>
<p>Maximum range occurs at 45°. Adding <strong>air resistance</strong> reduces the range and makes the trajectory asymmetric.</p>`,

    topic_4: `<p>A <strong>spring-mass system</strong> undergoes simple harmonic motion when displaced from equilibrium.</p>
<p>The angular frequency is:</p>
<p style="font-family:var(--font-mono); text-align:center; margin:0.75rem 0;">ω = √(k / m)</p>
<p>The period is T = 2π / ω. A stiffer spring (larger k) or lighter mass oscillates faster. Adjust the controls to explore these relationships.</p>`,
  };

  function initTopic(topicId) {
    if (store[topicId]) return;
    const cfg = controlConfigs[topicId] || [];
    const controls = {};
    cfg.forEach(c => { controls[c.key] = c.default; });
    store[topicId] = {
      controls,
      chatHistory: [],
      simState: {},
    };
  }

  return {
    get activeTopic() { return activeTopic; },
    set activeTopic(id) { activeTopic = id; },

    get topics() { return topics; },
    set topics(t) { topics = t; },

    getControlConfigs(topicId) { return controlConfigs[topicId] || []; },
    getInfoText(topicId) { return infoTexts[topicId] || "<p>No information available.</p>"; },

    getState(topicId) {
      initTopic(topicId);
      return store[topicId];
    },

    setControl(topicId, key, value) {
      initTopic(topicId);
      store[topicId].controls[key] = value;
    },

    getChatHistory(topicId) {
      initTopic(topicId);
      return store[topicId].chatHistory;
    },

    appendChat(topicId, role, content) {
      initTopic(topicId);
      store[topicId].chatHistory.push({ role, content });
    },

    clearChat(topicId) {
      initTopic(topicId);
      store[topicId].chatHistory = [];
    },
  };
})();
