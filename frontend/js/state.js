/**
 * Client-side state store.
 * State is keyed by "groupId:topicId:speciesId" for full isolation.
 */
const AppState = (() => {
  let activeGroup = null;
  let activeTopic = null;
  let activeSpecies = null;
  let groups = [];
  const store = {}; // "group:topic:species" -> {controls, simState}
  const chatStore = {}; // "group:topic" -> [{role, content}]

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
    "chimps_bonobos:culture:normative_conformity": [
      { key: "groupSize",     label: "Group Size",          min: 3,   max: 12,  step: 1,    default: 6   },
      { key: "genSpeed",      label: "Generation Speed",    min: 0.5, max: 3.0, step: 0.25, default: 1.0 },
    ],
    "chimps_bonobos:culture:cumulative_culture": [
      { key: "groupSize",     label: "Group Size",          min: 3,   max: 12,  step: 1,    default: 6   },
      { key: "genSpeed",      label: "Generation Speed",    min: 0.5, max: 3.0, step: 0.25, default: 1.0 },
      { key: "innovationRate", label: "Innovation Rate",    min: 0.05, max: 0.5, step: 0.05, default: 0.15 },
    ],
    "humans:self_domestication:humans": [
      { key: "popSize",       label: "Population",          min: 16,  max: 60,  step: 2,    default: 30  },
      { key: "predatorCount", label: "Predator Count",      min: 1,   max: 8,   step: 1,    default: 3   },
      { key: "mutRate",       label: "Mutation Rate",        min: 0.01, max: 0.15, step: 0.01, default: 0.05 },
      { key: "initialProsocial", label: "Initial Prosocial %", min: 0.2, max: 0.8, step: 0.05, default: 0.5 },
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

  // Culture info texts
  infoTexts["chimps_bonobos:culture:normative_conformity"] = `<p><strong>Normative Conformity</strong> — Vervet monkeys learn to crack walnuts by observing others. Once a technique is acquired, it is transmitted faithfully across generations <strong>without improvement</strong>.</p>
<p>Each generation cracks roughly the <strong>same number</strong> of walnuts as the one before. Monkeys imitate because they see the behavior, not because they have a concept of cultural norms — but the effect mimics conformity.</p>
<p>Watch the graph: walnut output stays <strong>flat</strong> across generations. This is what real nonhuman primate cultural transmission looks like.</p>
<div class="legend-block">
  <div class="legend-row"><span class="dot" style="background:#8B6914"></span> Whole walnut (uncracked)</div>
  <div class="legend-row"><span class="dot" style="background:#6b4f2a"></span> Cracked walnut (split open)</div>
  <div class="legend-row"><span class="dot" style="background:#9FE1CB"></span> Walnuts cracked / generation (graph)</div>
  <div class="legend-row"><span class="dot" style="background:#8b8fa3"></span> Technique skill (graph, flat)</div>
</div>`;

  infoTexts["chimps_bonobos:culture:cumulative_culture"] = `<p><strong>Cumulative Culture</strong> — A hypothetical scenario: what if vervet monkeys <em>could</em> build on previous generations' innovations?</p>
<p>In this simulation, each generation improves on the walnut-cracking technique inherited from the last. Over time, efficiency <strong>increases</strong> and more walnuts are cracked per generation — a cultural ratchet effect.</p>
<p>This is what nonhuman primates do <strong>NOT</strong> actually do. Cumulative culture requires high-fidelity imitation, teaching, and intentional innovation — capacities associated with human cultural evolution, not nonhuman primates.</p>
<p>Watch the graph: walnut output <strong>climbs</strong> across generations, illustrating the ratchet effect absent in real primate populations.</p>
<div class="legend-block">
  <div class="legend-row"><span class="dot" style="background:#8B6914"></span> Whole walnut (uncracked)</div>
  <div class="legend-row"><span class="dot" style="background:#6b4f2a"></span> Cracked walnut (split open)</div>
  <div class="legend-row"><span class="dot" style="background:#ef9f27"></span> Walnuts cracked / generation (graph)</div>
  <div class="legend-row"><span class="dot" style="background:#378add"></span> Technique skill (graph, rising)</div>
</div>`;

  // Self-domestication info text
  infoTexts["humans:self_domestication:humans"] = `<p><strong>Self-Domestication Hypothesis</strong> — Humans may have undergone "domestication syndrome" without intentional breeding: selection for tolerance and reduced aggression led to behavioral, morphological, and cognitive changes.</p>
<p><strong>Prosocial</strong> humans (green) form cooperative groups, sharing resources and gaining protection from predators. <strong>Aggressive</strong> humans (red) are rejected from groups and remain alone.</p>
<p>Predators (dark shapes) target lone individuals with a <strong>75% success rate</strong>, but cannot take down groups. Over generations, prosocial humans survive more and pass on their traits — the population self-domesticates.</p>
<p style="margin-top:0.75rem; padding:0.5rem 0.75rem; background:rgba(59,130,246,0.1); border-left:2px solid var(--accent); border-radius:3px; font-size:0.8125rem;"><strong>Tip:</strong> Explore <em>Nonhuman Primates → Aggression</em> first to see how aggression and mate choice interact in chimpanzees and bonobos — it provides useful context for this simulation.</p>
<div class="legend-block">
  <div class="legend-row"><span class="dot" style="background:#4ade80"></span> Prosocial human</div>
  <div class="legend-row"><span class="dot" style="background:#ef4444"></span> Aggressive human</div>
  <div class="legend-row"><span class="dot" style="background:#1e1e2e; border:2px solid #e24b4a"></span> Predator</div>
  <div class="legend-row"><span class="dot" style="background:rgba(74,222,128,0.2); border:1.5px dashed #4ade80"></span> Cooperative group</div>
</div>`;

  function initState(key) {
    if (store[key]) return;
    const cfg = controlConfigs[key] || [];
    const controls = {};
    cfg.forEach(c => { controls[c.key] = c.default; });
    store[key] = { controls, simState: {} };
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

    /** Chat key (shared across species within a topic) */
    get chatKey() { return `${activeGroup}:${activeTopic}`; },

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
      if (!chatStore[key]) chatStore[key] = [];
      return chatStore[key];
    },

    appendChat(key, role, content) {
      if (!chatStore[key]) chatStore[key] = [];
      chatStore[key].push({ role, content });
    },

    clearChat(key) {
      chatStore[key] = [];
    },
  };
})();
