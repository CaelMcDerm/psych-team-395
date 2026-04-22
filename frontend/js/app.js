/** Maps composite key → local image path + alt text for the animal photo. */
const animalPhotoMap = {
  "chimps_bonobos:aggression:chimpanzees":        { src: "images/animals/chimpanzee.jpg",   alt: "Chimpanzee"   },
  "chimps_bonobos:aggression:bonobos":            { src: "images/animals/bonobo.jpg",        alt: "Bonobo"       },
  "chimps_bonobos:culture:normative_conformity":  { src: "images/animals/vervet_monkey.jpg", alt: "Vervet Monkey" },
  "chimps_bonobos:culture:cumulative_culture":    { src: "images/animals/vervet_monkey.jpg", alt: "Vervet Monkey" },
  "dogs_wolves:gaze_following:dogs":              { src: "images/animals/dog.jpg",           alt: "Dog"          },
  "dogs_wolves:gaze_following:wolves":            { src: "images/animals/wolf.jpg",          alt: "Wolf"         },
  "humans:self_domestication:humans":             { src: "images/animals/human.jpg",         alt: "Human"        },
  "elephants:theory_of_mind:cooperative_pulling": { src: "images/animals/elephant.jpg",      alt: "Elephant"     },
  "elephants:theory_of_mind:human_pointing":      { src: "images/animals/elephant.jpg",      alt: "Elephant"     },
};

/**
 * Boot: build tabs (groups), sub-nav (topic pills + species toggle), wire switching.
 */
(async function boot() {
  // Wait for authentication before loading the app
  const username = await Auth.init();
  Progress.init(!!username);

  let groups;
  try {
    const resp = await fetch("/api/groups", { credentials: "include" });
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
      {
        id: "elephants",
        label: "Elephants",
        species: [
          { id: "elephants", label: "Elephants" },
        ],
        topics: [
          {
            id: "theory_of_mind",
            label: "Theory of Mind",
            species: [
              { id: "cooperative_pulling", label: "Cooperative Pulling" },
              { id: "human_pointing", label: "Human Pointing" },
            ],
          },
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

  const infoEl = document.getElementById("info-content");
  infoEl.innerHTML = AppState.getInfoText(key);

  const photo = animalPhotoMap[key];
  if (photo) {
    const wrap = document.createElement("div");
    wrap.className = "animal-photo-wrap";
    const img = document.createElement("img");
    img.src = photo.src;
    img.alt = photo.alt;
    img.className = "animal-photo";
    wrap.appendChild(img);
    const legend = infoEl.querySelector(".legend-block");
    if (legend) {
      infoEl.insertBefore(wrap, legend);
    } else {
      infoEl.appendChild(wrap);
    }
  }

  Simulation.start(key);
  Chat.loadHistory();
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
