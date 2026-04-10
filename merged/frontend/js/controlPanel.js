/**
 * Control panel: renders sliders for the active group:topic:species, emits 'control-change' events.
 */
const ControlPanel = (() => {
  const container = () => document.getElementById("controls-container");
  let debounceTimers = {};

  function render() {
    const el = container();
    el.innerHTML = "";
    const key = AppState.activeKey;
    const configs = AppState.getControlConfigs(key);
    const state = AppState.getState(key);

    configs.forEach(cfg => {
      const item = document.createElement("div");
      item.className = "control-item";

      const label = document.createElement("label");
      const nameSpan = document.createElement("span");
      nameSpan.textContent = cfg.label;
      const valueSpan = document.createElement("span");
      valueSpan.className = "value-readout";
      valueSpan.textContent = state.controls[cfg.key];
      label.appendChild(nameSpan);
      label.appendChild(valueSpan);

      const input = document.createElement("input");
      input.type = "range";
      input.min = cfg.min;
      input.max = cfg.max;
      input.step = cfg.step;
      input.value = state.controls[cfg.key];

      input.addEventListener("input", () => {
        const val = parseFloat(input.value);
        valueSpan.textContent = val;
        AppState.setControl(key, cfg.key, val);

        clearTimeout(debounceTimers[cfg.key]);
        debounceTimers[cfg.key] = setTimeout(() => {
          window.dispatchEvent(new CustomEvent("control-change", {
            detail: { key, controlKey: cfg.key, value: val }
          }));
        }, 150);
      });

      item.appendChild(label);
      item.appendChild(input);
      el.appendChild(item);
    });

    // Reset button
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset Simulation";
    resetBtn.className = "sim-reset-btn";
    resetBtn.addEventListener("click", () => {
      if (window.resetSimulation) window.resetSimulation();
    });
    el.appendChild(resetBtn);
  }

  return { render };
})();
