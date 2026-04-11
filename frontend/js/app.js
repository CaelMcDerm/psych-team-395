/**
 * Boot: build tabs (groups), sub-nav (topic pills + species toggle), wire switching.
 */
(async function boot() {
  let groups;
  try {
    const resp = await fetch("/api/groups");
    groups = await resp.json();
  } catch {
    // Fallback when backend isn't running
    groups = [
      {
        id: "chimps_bonobos",
        label: "Nonhuman Primates",
        species: [
          { id: "chimpanzees", label: "Chimpanzees" },
          { id: "bonobos", label: "Bonobos" },
        ],
        topics: [
          { id: "aggression", label: "Aggression" },
          {
            id: "culture",
            label: "Culture",
            species: [
              { id: "normative_conformity", label: "Normative Conformity" },
              { id: "cumulative_culture", label: "Cumulative Culture" },
            ],
          },
        ],
      },
      {
        id: "humans",
        label: "Humans",
        species: [
          { id: "humans", label: "Humans" },
        ],
        topics: [
          { id: "self_domestication", label: "Self-Domestication" },
        ],
      },
    ];
  }
  AppState.groups = groups;

  // Render group tabs
  const tabBar = document.getElementById("tab-bar");
  groups.forEach(group => {
    const tab = document.createElement("div");
    tab.className = "tab";
    tab.dataset.groupId = group.id;
    tab.textContent = group.label;
    tab.addEventListener("click", () => switchGroup(group.id));
    tabBar.appendChild(tab);
  });

  // Init modules
  Simulation.init();
  Chat.init();

  // Activate first group
  switchGroup(groups[0].id);
})();

/** Get the species list for a given topic (topic-level override or group default) */
function getSpeciesForTopic(group, topicId) {
  const topic = group.topics.find(t => t.id === topicId);
  return (topic && topic.species) || group.species;
}

/** Switch the top-level group tab */
function switchGroup(groupId) {
  const group = AppState.groups.find(g => g.id === groupId);
  if (!group) return;

  AppState.activeGroup = groupId;

  // Highlight active tab
  document.querySelectorAll("#tab-bar .tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.groupId === groupId);
  });

  // Render topic pills
  renderTopicPills(group);

  // Activate first topic + its species
  const firstTopic = group.topics[0];
  AppState.activeTopic = firstTopic.id;
  const speciesList = getSpeciesForTopic(group, firstTopic.id);
  renderSpeciesToggle(speciesList);
  AppState.activeSpecies = speciesList[0].id;
  highlightTopicPill(firstTopic.id);
  highlightSpeciesBtn(speciesList[0].id);
  activateCurrent();
}

/** Switch the topic within the current group */
function switchTopic(topicId) {
  const group = AppState.groups.find(g => g.id === AppState.activeGroup);
  AppState.activeTopic = topicId;
  highlightTopicPill(topicId);

  // Re-render species toggle for this topic
  const speciesList = getSpeciesForTopic(group, topicId);
  renderSpeciesToggle(speciesList);
  AppState.activeSpecies = speciesList[0].id;
  highlightSpeciesBtn(speciesList[0].id);
  activateCurrent();
}

/** Switch the species within the current group + topic */
function switchSpecies(speciesId) {
  AppState.activeSpecies = speciesId;
  highlightSpeciesBtn(speciesId);
  activateCurrent();
}

/** Refresh all panels for the current group:topic:species */
function activateCurrent() {
  const key = AppState.activeKey;
  ControlPanel.render();
  document.getElementById("info-content").innerHTML = AppState.getInfoText(key);
  Simulation.start(key);
  Chat.renderHistory();
}

// === Sub-nav rendering ===

function renderTopicPills(group) {
  const container = document.getElementById("topic-pills");
  container.innerHTML = "";

  // Label
  const label = document.createElement("span");
  label.className = "sub-nav-label";
  label.textContent = "Topic";
  container.appendChild(label);

  group.topics.forEach(topic => {
    const pill = document.createElement("button");
    pill.className = "topic-pill";
    pill.dataset.topicId = topic.id;
    pill.textContent = topic.label;
    pill.addEventListener("click", () => switchTopic(topic.id));
    container.appendChild(pill);
  });
}

function renderSpeciesToggle(speciesList) {
  const container = document.getElementById("species-toggle");
  container.innerHTML = "";

  // Label
  const label = document.createElement("span");
  label.className = "sub-nav-label";
  label.textContent = "Species";
  container.appendChild(label);

  const toggleWrap = document.createElement("div");
  toggleWrap.className = "species-toggle-wrap";

  speciesList.forEach(sp => {
    const btn = document.createElement("button");
    btn.className = "species-btn";
    btn.dataset.speciesId = sp.id;
    btn.textContent = sp.label;
    btn.addEventListener("click", () => switchSpecies(sp.id));
    toggleWrap.appendChild(btn);
  });

  container.appendChild(toggleWrap);
}

function highlightTopicPill(topicId) {
  document.querySelectorAll(".topic-pill").forEach(p => {
    p.classList.toggle("active", p.dataset.topicId === topicId);
  });
}

function highlightSpeciesBtn(speciesId) {
  document.querySelectorAll(".species-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.speciesId === speciesId);
  });
}
