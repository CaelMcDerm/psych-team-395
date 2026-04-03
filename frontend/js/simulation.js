/**
 * Simulation viewport: canvas-based renderers per topic.
 */
const Simulation = (() => {
  let canvas, ctx;
  let animId = null;
  let currentTopic = null;
  let lastTime = 0;
  let simTime = 0;

  function init() {
    canvas = document.getElementById("sim-canvas");
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("control-change", () => {
      // For non-animated sims (projectile), re-render immediately
      if (currentTopic === "topic_3") {
        drawProjectile();
      }
    });
  }

  function resize() {
    const col = document.getElementById("sim-column");
    canvas.width = col.clientWidth;
    canvas.height = col.clientHeight;
  }

  function stop() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function start(topicId) {
    stop();
    currentTopic = topicId;
    simTime = 0;
    lastTime = 0;

    const placeholder = document.getElementById("sim-placeholder");
    const renderer = renderers[topicId];
    if (renderer) {
      canvas.classList.remove("hidden");
      placeholder.classList.add("hidden");
      resize();
      loop(renderer);
    } else {
      canvas.classList.add("hidden");
      placeholder.classList.remove("hidden");
    }
  }

  function loop(renderer) {
    animId = requestAnimationFrame((timestamp) => {
      if (!lastTime) lastTime = timestamp;
      const dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;
      simTime += dt;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderer(dt);
      loop(renderer);
    });
  }

  // === Renderers ===

  function drawPendulum() {
    const s = AppState.getState("topic_1");
    const { length, gravity, damping } = s.controls;
    const w = canvas.width, h = canvas.height;

    // Simple pendulum physics (small angle approx)
    const omega = Math.sqrt(gravity / length);
    const amp = Math.exp(-damping * simTime) * 0.8; // radians max
    const angle = amp * Math.sin(omega * simTime);

    const pivotX = w / 2;
    const pivotY = h * 0.1;
    const scale = Math.min(w, h) * 0.12;
    const bobX = pivotX + Math.sin(angle) * length * scale;
    const bobY = pivotY + Math.cos(angle) * length * scale;

    // Draw string
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.strokeStyle = "#8b8fa3";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw pivot
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();

    // Draw bob
    ctx.beginPath();
    ctx.arc(bobX, bobY, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Readout
    ctx.font = "13px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#8b8fa3";
    ctx.fillText(`θ = ${(angle * 180 / Math.PI).toFixed(1)}°`, 16, h - 16);
    ctx.fillText(`t = ${simTime.toFixed(1)}s`, 16, h - 34);
  }

  function drawWaveform() {
    const s = AppState.getState("topic_2");
    const { freq1, freq2, amplitude, phase } = s.controls;
    const w = canvas.width, h = canvas.height;
    const midY = h / 2;
    const scaleY = h * 0.18;

    // Draw individual waves (faint)
    drawSingleWave(freq1, amplitude, 0, "rgba(59,130,246,0.3)");
    drawSingleWave(freq2, amplitude, phase, "rgba(239,68,68,0.3)");

    // Draw combined wave
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const t = simTime + (x / w) * 4;
      const y1 = amplitude * Math.sin(2 * Math.PI * freq1 * t);
      const y2 = amplitude * Math.sin(2 * Math.PI * freq2 * t + phase);
      const py = midY - (y1 + y2) * scaleY;
      if (x === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Labels
    ctx.font = "13px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#8b8fa3";
    ctx.fillText(`f₁=${freq1}Hz  f₂=${freq2}Hz  Δφ=${phase.toFixed(2)}rad`, 16, h - 16);
  }

  function drawSingleWave(freq, amplitude, phase, color) {
    const w = canvas.width, h = canvas.height;
    const midY = h / 2;
    const scaleY = h * 0.18;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const t = simTime + (x / w) * 4;
      const y = amplitude * Math.sin(2 * Math.PI * freq * t + phase);
      const py = midY - y * scaleY;
      if (x === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawProjectile() {
    const s = AppState.getState("topic_3");
    const { angle, velocity, drag } = s.controls;
    const w = canvas.width, h = canvas.height;
    const g = 9.8;
    const rad = angle * Math.PI / 180;
    const vx0 = velocity * Math.cos(rad);
    const vy0 = velocity * Math.sin(rad);

    // Compute trajectory points
    const points = [];
    const dtSim = 0.02;
    let px = 0, py = 0, vx = vx0, vy = vy0;
    for (let i = 0; i < 5000; i++) {
      points.push([px, py]);
      const speed = Math.sqrt(vx * vx + vy * vy);
      const ax = -drag * speed * vx;
      const ay = -g - drag * speed * vy;
      vx += ax * dtSim;
      vy += ay * dtSim;
      px += vx * dtSim;
      py += vy * dtSim;
      if (py < 0 && i > 0) break;
    }

    if (points.length === 0) return;

    // Scale to canvas
    const maxX = Math.max(...points.map(p => p[0]), 1);
    const maxY = Math.max(...points.map(p => p[1]), 1);
    const margin = 60;
    const scaleX = (w - 2 * margin) / maxX;
    const scaleY = (h - 2 * margin) / maxY;
    const scale = Math.min(scaleX, scaleY);
    const baseY = h - margin;

    // Draw ground line
    ctx.beginPath();
    ctx.moveTo(margin, baseY);
    ctx.lineTo(w - margin, baseY);
    ctx.strokeStyle = "#2a2d3a";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw trajectory
    ctx.beginPath();
    points.forEach((p, i) => {
      const sx = margin + p[0] * scale;
      const sy = baseY - p[1] * scale;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw launch point
    ctx.beginPath();
    ctx.arc(margin, baseY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();

    // Landing point
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(margin + last[0] * scale, baseY - last[1] * scale, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();

    // Readout
    ctx.font = "13px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#8b8fa3";
    ctx.fillText(`Range ≈ ${last[0].toFixed(1)}m  Max Height ≈ ${maxY.toFixed(1)}m`, 16, h - 16);
  }

  function drawSpringMass() {
    const s = AppState.getState("topic_4");
    const { springK, mass, displacement } = s.controls;
    const w = canvas.width, h = canvas.height;

    const omega = Math.sqrt(springK / mass);
    const x = displacement * Math.cos(omega * simTime);

    const anchorX = w * 0.15;
    const centerY = h / 2;
    const restX = w * 0.5;
    const scale = w * 0.15;
    const bobX = restX + x * scale;

    // Draw wall
    ctx.fillStyle = "#2a2d3a";
    ctx.fillRect(anchorX - 8, centerY - 60, 8, 120);

    // Draw spring (zigzag)
    const coils = 12;
    const springLen = bobX - anchorX;
    const coilW = springLen / coils;
    const zigH = 16;
    ctx.beginPath();
    ctx.moveTo(anchorX, centerY);
    for (let i = 0; i < coils; i++) {
      const sx = anchorX + coilW * i;
      const dir = i % 2 === 0 ? -1 : 1;
      ctx.lineTo(sx + coilW * 0.5, centerY + zigH * dir);
      ctx.lineTo(sx + coilW, centerY);
    }
    ctx.strokeStyle = "#8b8fa3";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw mass block
    const blockW = 40, blockH = 40;
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(bobX - blockW / 2, centerY - blockH / 2, blockW, blockH);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.strokeRect(bobX - blockW / 2, centerY - blockH / 2, blockW, blockH);

    // Equilibrium line
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(restX, centerY - 80);
    ctx.lineTo(restX, centerY + 80);
    ctx.strokeStyle = "#2a2d3a";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Readout
    ctx.font = "13px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#8b8fa3";
    ctx.fillText(`x = ${x.toFixed(2)}m  ω = ${omega.toFixed(2)} rad/s`, 16, h - 16);
    ctx.fillText(`t = ${simTime.toFixed(1)}s`, 16, h - 34);
  }

  const renderers = {
    topic_1: drawPendulum,
    topic_2: drawWaveform,
    topic_3: drawProjectile,
    topic_4: drawSpringMass,
  };

  return { init, start, stop, resize };
})();
