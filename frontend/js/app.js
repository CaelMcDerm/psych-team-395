/**
 * Boot: fetch topics, render tabs, wire up switching.
 */
(async function boot() {
  // Fetch topics from backend
  let topics;
  try {
    const resp = await fetch("/api/topics");
    topics = await resp.json();
  } catch {
    // Fallback if backend isn't running
    topics = [
      { id: "topic_1", label: "Pendulum", description: "" },
      { id: "topic_2", label: "Wave Interference", description: "" },
      { id: "topic_3", label: "Projectile Motion", description: "" },
      { id: "topic_4", label: "Spring-Mass System", description: "" },
    ];
  }
  AppState.topics = topics;

  // Render tab bar
  const tabBar = document.getElementById("tab-bar");
  topics.forEach(topic => {
    const tab = document.createElement("div");
    tab.className = "tab";
    tab.dataset.topicId = topic.id;
    tab.textContent = topic.label;
    tab.addEventListener("click", () => switchTopic(topic.id));
    tabBar.appendChild(tab);
  });

  // Init modules
  Simulation.init();
  Chat.init();

  // Activate first topic
  switchTopic(topics[0].id);
})();

function switchTopic(topicId) {
  if (AppState.activeTopic === topicId) return;
  AppState.activeTopic = topicId;

  // Update tabs
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.topicId === topicId);
  });

  // Update control panel
  ControlPanel.render(topicId);

  // Update info panel
  document.getElementById("info-content").innerHTML = AppState.getInfoText(topicId);

  // Swap simulation
  Simulation.start(topicId);

  // Swap chat history
  Chat.renderHistory(topicId);
}
