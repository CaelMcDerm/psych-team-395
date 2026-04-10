/**
 * Client-side state store.
 * State is keyed by "groupId:topicId:speciesId" for full isolation.
 */
const AppState = (() => {
  let activeGroup = null;
  let activeTopic = null;
  let activeSpecies = null;
  let groups = [];
  const store = {}; // "group:topic:species" -> {controls, chatHistory, simState}

  function stateKey(g, t, s) {
    return `${g || activeGroup}:${t || activeTopic}:${s || activeSpecies}`;
  }

  // Control configs keyed by "group:topic:species"
  const controlConfigs = {
    "chimps_bonobos:aggression:chimpanzees": [
      { key: "popSize",   label: "Population",           min: 20,   max: 60,   step: 2,    default: 36  },
      { key: "mutRate",   label: "Mutation Rate",         min: 0.01, max: 0.15, step: 0.01, default: 0.05 },
      { key: "advantage", label: "Aggression Advantage",  min: 0.5,  max: 3,    step: 0.1,  default: 1.8 },
    ],
    "chimps_bonobos:aggression:bonobos": [
      { key: "popSize",   label: "Population",            min: 20,   max: 60,   step: 2,    default: 36  },
      { key: "mutRate",   label: "Mutation Rate",          min: 0.01, max: 0.15, step: 0.01, default: 0.05 },
      { key: "threshold", label: "Coalition Selectivity",  min: 0.2,  max: 0.8,  step: 0.05, default: 0.5 },
    ],
    "dogs_wolves:gaze_following:dogs": [
      { key: "targetDistance", label: "Target Distance",    min: 0.0, max: 1.0, step: 0.05, default: 0.7 },
      { key: "trialSpeed",     label: "Trial Speed",        min: 0.5, max: 2.0, step: 0.1,  default: 1.0 },
    ],
    "dogs_wolves:gaze_following:wolves": [
      { key: "targetDistance", label: "Target Distance",    min: 0.0, max: 1.0, step: 0.05, default: 0.7 },
      { key: "trialSpeed",     label: "Trial Speed",        min: 0.5, max: 2.0, step: 0.1,  default: 1.0 },
    ],
  };

  // Info text keyed by "group:topic:species"
  const infoTexts = {
    "chimps_bonobos:aggression:chimpanzees": `<p><strong>Chimpanzees</strong> live in patriarchal hierarchies where males compete aggressively for status and mating access.</p>
<p>More aggressive males win more confrontations, accumulating higher <em>reproductive fitness</em>. Over generations, this selection pressure drives mean population aggression <strong>upward</strong>.</p>
<p>Watch blue (calm) males lose fights to orange/red (aggressive) ones — their traits dominate future generations.</p>
<div class="legend-block">
  <div class="legend-row"><span class="dot" style="background:#378add"></span> Low aggression</div>
  <div class="legend-row"><span class="dot" style="background:#ef9f27"></span> Mid aggression</div>
  <div class="legend-row"><span class="dot" style="background:#e24b4a"></span> High aggression</div>
  <div class="legend-row"><span class="dot ring"></span> Male (ring)</div>
  <div class="legend-row"><span class="dot" style="background:#8b8fa3"></span> Female (solid)</div>
</div>`,

    "chimps_bonobos:aggression:bonobos": `<p><strong>Bonobos</strong> are governed by female coalitions. Females cluster together and collectively reject aggressive males.</p>
<p>Only low-aggression males are accepted as mates (watch for ✓ and ✕ symbols). This female-driven selection <strong>reverses</strong> the evolutionary pressure seen in chimpanzees, reducing mean aggression across generations.</p>
<p>The <em>Coalition Selectivity</em> slider controls how strict the rejection threshold is.</p>
<div class="legend-block">
  <div class="legend-row"><span class="dot" style="background:#378add"></span> Low aggression</div>
  <div class="legend-row"><span class="dot" style="background:#ef9f27"></span> Mid aggression</div>
  <div class="legend-row"><span class="dot" style="background:#e24b4a"></span> High aggression</div>
  <div class="legend-row"><span class="dot ring"></span> Male (ring)</div>
  <div class="legend-row"><span class="dot" style="background:#8b8fa3"></span> Female (solid)</div>
</div>`,

    "dogs_wolves:gaze_following:dogs": `<p><strong>Dogs</strong> show <em>face-fixation</em>. When a human gives a gaze cue toward a distant object, dogs orient to the <strong>human's face</strong> rather than following the gaze into distant space.</p>
<p>This is not a learned behavior. Hand-reared dogs and wolves raised under identical conditions still differ — face-gazing appears to be a <strong>genetic predisposition</strong> in dogs, the result of domestication producing a specific attentional bias toward human faces.</p>
<p>Watch the dog's gaze vector lock onto the human's head even when the human is clearly looking elsewhere. Try sliding <em>Target Distance</em> all the way down so the target sits right next to the human, then back out to the far edge — the dog still fixates on the face either way.</p>
<div class="legend-block">
  <div class="legend-row"><span class="dot" style="background:#9FE1CB"></span> Dog gaze vector</div>
  <div class="legend-row"><span class="dot" style="background:#ef9f27"></span> Human gaze cone</div>
  <div class="legend-row"><span class="dot" style="background:#e24b4a"></span> Target object</div>
</div>
<p class="citation"><small>Miklósi, Á., Kubinyi, E., Topál, J., Gácsi, M., Virányi, Z., &amp; Csányi, V. (2003). A simple reason for a big difference: Wolves do not look back at humans, but dogs do. <em>Current Biology, 13</em>(9), 763–766.</small></p>`,

    "dogs_wolves:gaze_following:wolves": `<p><strong>Wolves</strong> follow human gaze into distant space. When a human looks toward a distant target, wolves orient their attention along the gaze axis — they do <em>not</em> fixate on the human's face.</p>
<p>This holds even for pack-raised wolves under identical conditions to dogs. The dog/wolf contrast suggests domestication produced a <strong>specific attentional bias</strong> in dogs (face-fixation) rather than a general improvement in human-gaze reading. Wolves are not worse at reading gaze; they read it differently.</p>
<p>Watch the wolf's gaze vector align with the human's gaze cone and track outward to the target. Slide <em>Target Distance</em> to move the target closer or farther — the wolf follows it either way, because the difference from dogs is genetic, not learned.</p>
<div class="legend-block">
  <div class="legend-row"><span class="dot" style="background:#9FE1CB"></span> Wolf gaze vector</div>
  <div class="legend-row"><span class="dot" style="background:#ef9f27"></span> Human gaze cone</div>
  <div class="legend-row"><span class="dot" style="background:#e24b4a"></span> Target object</div>
</div>
<p class="citation"><small>Miklósi, Á., Kubinyi, E., Topál, J., Gácsi, M., Virányi, Z., &amp; Csányi, V. (2003). A simple reason for a big difference: Wolves do not look back at humans, but dogs do. <em>Current Biology, 13</em>(9), 763–766.</small></p>`,
  };

  function initState(key) {
    if (store[key]) return;
    const cfg = controlConfigs[key] || [];
    const controls = {};
    cfg.forEach(c => { controls[c.key] = c.default; });
    store[key] = { controls, chatHistory: [], simState: {} };
  }

  return {
    get activeGroup() { return activeGroup; },
    set activeGroup(id) { activeGroup = id; },
    get activeTopic() { return activeTopic; },
    set activeTopic(id) { activeTopic = id; },
    get activeSpecies() { return activeSpecies; },
    set activeSpecies(id) { activeSpecies = id; },
    get groups() { return groups; },
    set groups(g) { groups = g; },

    /** Current composite key */
    get activeKey() { return stateKey(); },

    getControlConfigs(key) { return controlConfigs[key || stateKey()] || []; },
    getInfoText(key) { return infoTexts[key || stateKey()] || "<p>No information available.</p>"; },

    getState(key) {
      const k = key || stateKey();
      initState(k);
      return store[k];
    },

    setControl(key, controlKey, value) {
      const k = key || stateKey();
      initState(k);
      store[k].controls[controlKey] = value;
    },

    getChatHistory(key) {
      const k = key || stateKey();
      initState(k);
      return store[k].chatHistory;
    },

    appendChat(key, role, content) {
      const k = key || stateKey();
      initState(k);
      store[k].chatHistory.push({ role, content });
    },

    clearChat(key) {
      const k = key || stateKey();
      initState(k);
      store[k].chatHistory = [];
    },
  };
})();
