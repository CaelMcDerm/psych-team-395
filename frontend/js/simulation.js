/**
 * Simulation viewport: agent-based evolutionary simulations.
 * Renderers are keyed by "groupId:topicId:speciesId".
 */
const Simulation = (() => {
  let canvas, ctx;
  let animId = null;
  let currentKey = null;
  let lastTime = 0;
  
  // Per-key population state
  const pops = {};

  function init() {
    canvas = document.getElementById("sim-canvas");
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    
    window.addEventListener("control-change", (e) => {
      const { key, controlKey } = e.detail;
      if (controlKey === "popSize") resetPop(key);
    });
  }

  function resize() {
    const col = document.getElementById("sim-column");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = col.clientWidth * dpr;
    canvas.height = col.clientHeight * dpr;
    canvas.style.width = col.clientWidth + "px";
    canvas.style.height = col.clientHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cw() { return canvas.width / (window.devicePixelRatio || 1); }
  function ch() { return canvas.height / (window.devicePixelRatio || 1); }

  function stop() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
  }

  function start(key) {
    stop();
    currentKey = key;
    lastTime = 0;

    const placeholder = document.getElementById("sim-placeholder");
    if (getRenderer(key)) {
      canvas.classList.remove("hidden");
      placeholder.classList.add("hidden");
      resize();
      if (!pops[key]) resetPop(key);
      loop();
    } else {
      canvas.classList.add("hidden");
      placeholder.classList.remove("hidden");
    }
  }

  function resetPop(key) {
    resize();
    const k = key || currentKey;
    const [, topic, species] = k.split(":");

    if (topic === "gaze_following") {
      pops[k] = {
        kind: "gaze",
        species,
        phase: "setup", phaseT: 0,
        trial: 0, faceCount: 0, gazeCount: 0,
        humanAngle: 0,        // current head angle of human
        humanTargetAngle: 0,  // angle the human's head is animating toward
        animalAngle: Math.PI, // animal initially faces left toward human
        animalTargetAngle: Math.PI,
        lastResult: null, resultTmr: 0,
      };
      return;
    }

    const s = AppState.getState(k);
    const cv = s.controls;
    const w = cw(), h = ch();
    const half = Math.floor(cv.popSize / 2);
    const mean = species === "chimpanzees" ? 0.55 : 0.45;
    const agents = [];
    for (let i = 0; i < half; i++) agents.push(mkAgent(w, h, mean + (Math.random() - 0.5) * 0.4, "M"));
    for (let i = 0; i < half; i++) agents.push(mkAgent(w, h, mean + (Math.random() - 0.5) * 0.4, "F"));
    pops[k] = {
      agents, gen: 0, frame: 0,
      history: [{ gen: 0, mean, mMean: mean, fMean: mean }],
      flashMsg: null, flashTmr: 0,
    };
  }

  window.resetSimulation = function () {
    if (currentKey) { resetPop(currentKey); }
  };

  function loop() {
    animId = requestAnimationFrame((ts) => {
      if (!lastTime) lastTime = ts;
      const dt = Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      ctx.clearRect(0, 0, cw(), ch());
      const renderer = getRenderer(currentKey);
      if (renderer) renderer(dt, currentKey);
      loop();
    });
  }

  // === Helpers ===

  function mkAgent(w, h, agg, sex) {
    return {
      x: Math.random() * (w - 40) + 20, y: Math.random() * (h - 40) + 20,
      vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60,
      agg: Math.max(0, Math.min(1, agg)), sex,
      r: sex === "M" ? 8 : 6, fitness: 0, cooldown: 0,
      flash: 0, flashCol: "#fff", rejected: 0, accepted: 0,
    };
  }

  function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

  function aggCol(a) {
    let r, g, b;
    if (a < 0.5) {
      r = Math.round(55 + (239 - 55) * a * 2);
      g = Math.round(138 + (159 - 138) * a * 2);
      b = Math.round(221 + (39 - 221) * a * 2);
    } else {
      r = Math.round(239 + (226 - 239) * (a - 0.5) * 2);
      g = Math.round(159 + (75 - 159) * (a - 0.5) * 2);
      b = Math.round(39 + (74 - 39) * (a - 0.5) * 2);
    }
    return `rgb(${r},${g},${b})`;
  }

  // === Shared physics ===

  function physUpdate(pop, dt) {
    const ag = pop.agents, w = cw(), h = ch();
    const REPEL = 24, RF = 200, CAP = 70;
    ag.forEach((a) => {
      if (a.cooldown > 0) a.cooldown--;
      if (a.flash > 0) a.flash--;
      if (a.rejected > 0) a.rejected--;
      if (a.accepted > 0) a.accepted--;
      a.vx += (Math.random() - 0.5) * 25 * dt * 60;
      a.vy += (Math.random() - 0.5) * 25 * dt * 60;
      const spd = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
      if (spd > CAP) { a.vx = (a.vx / spd) * CAP; a.vy = (a.vy / spd) * CAP; }
      a.vx *= 0.97; a.vy *= 0.97;
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (a.x < a.r) { a.x = a.r; a.vx = Math.abs(a.vx); }
      if (a.x > w - a.r) { a.x = w - a.r; a.vx = -Math.abs(a.vx); }
      if (a.y < a.r) { a.y = a.r; a.vy = Math.abs(a.vy); }
      if (a.y > h - a.r) { a.y = h - a.r; a.vy = -Math.abs(a.vy); }
    });
    for (let i = 0; i < ag.length; i++) {
      for (let j = i + 1; j < ag.length; j++) {
        const a = ag[i], b = ag[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < REPEL && d > 0) {
          const f = ((REPEL - d) / REPEL) * RF * dt;
          const nx = dx / d, ny = dy / d;
          a.vx -= nx * f; a.vy -= ny * f;
          b.vx += nx * f; b.vy += ny * f;
        }
      }
    }
  }

  // === Species-specific update logic ===

  function chimpUpdate(pop, key, dt) {
    const ag = pop.agents;
    const cv = AppState.getState(key).controls;
    const adv = cv.advantage;
    const males = ag.filter((a) => a.sex === "M");
    const females = ag.filter((a) => a.sex === "F");

    females.forEach((f) => {
      f.fitness += 0.5 * dt;
      if (males.length) {
        const t = males[Math.floor(Math.random() * males.length)];
        const dx = t.x - f.x, dy = t.y - f.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 40 && d < 180) { f.vx += (dx / d) * 5 * dt; f.vy += (dy / d) * 5 * dt; }
      }
    });

    for (let i = 0; i < males.length; i++) {
      for (let j = i + 1; j < males.length; j++) {
        const a = males[i], b = males[j];
        if (a.cooldown > 0 || b.cooldown > 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 26) {
          const aw = a.agg / (a.agg + b.agg + 0.001);
          const [win, lose] = Math.random() < aw ? [a, b] : [b, a];
          win.fitness += 1 + win.agg * adv;
          win.flash = 16; win.flashCol = "#ef9f27";
          lose.flash = 16; lose.flashCol = "#e24b4a";
          const nd = d || 1, dir = win === a ? 1 : -1;
          lose.vx += (dx / nd) * dir * 75; lose.vy += (dy / nd) * dir * 75;
          a.cooldown = b.cooldown = 80 + Math.floor(Math.random() * 60);
        }
      }
    }
  }

  function bonoboUpdate(pop, key, dt) {
    const ag = pop.agents;
    const cv = AppState.getState(key).controls;
    const thr = cv.threshold;
    const females = ag.filter((a) => a.sex === "F");
    const males = ag.filter((a) => a.sex === "M");
    if (!females.length) return;

    const cx = avg(females.map((f) => f.x));
    const cy = avg(females.map((f) => f.y));

    females.forEach((f) => {
      const dx = cx - f.x, dy = cy - f.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 8) { f.vx += (dx / d) * 28 * dt; f.vy += (dy / d) * 28 * dt; }
      f.fitness += 0.3 * dt;
    });

    males.forEach((m) => {
      const dx = cx - m.x, dy = cy - m.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 35) { m.vx += (dx / d) * 18 * dt; m.vy += (dy / d) * 18 * dt; }
    });

    males.forEach((m) => {
      if (m.cooldown > 0) return;
      females.forEach((f) => {
        const dx = m.x - f.x, dy = m.y - f.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 28) {
          if (m.agg > thr) {
            m.rejected = 24; m.flash = 14; m.flashCol = "#e24b4a";
            const nd = d || 1;
            m.vx += (dx / nd) * 95; m.vy += (dy / nd) * 95;
            m.cooldown = 115;
          } else {
            m.accepted = 24; m.flash = 14; m.flashCol = "#1d9e75";
            m.fitness += 2 * (1 - m.agg); f.fitness += 0.8;
            m.cooldown = 90;
          }
        }
      });
    });
  }

  // === Generational reproduction ===

  function nextGen(key, pop) {
    const ag = pop.agents;
    const cv = AppState.getState(key).controls;
    ag.forEach((a) => { a.fitness = Math.max(a.fitness, 0.1); });
    const males = ag.filter((a) => a.sex === "M");
    const females = ag.filter((a) => a.sex === "F");

    function sample(pool) {
      const tot = pool.reduce((s, a) => s + a.fitness, 0);
      let r = Math.random() * tot;
      for (const a of pool) { r -= a.fitness; if (r <= 0) return a; }
      return pool[pool.length - 1];
    }

    const w = cw(), h = ch(), half = Math.floor(cv.popSize / 2);
    const next = [];
    for (let i = 0; i < half && males.length; i++) {
      const p = sample(males);
      const a = Math.max(0, Math.min(1, p.agg + (Math.random() - 0.5) * 2 * cv.mutRate));
      next.push(mkAgent(w, h, a, "M"));
    }
    for (let i = 0; i < half && females.length; i++) {
      const p = sample(females);
      const a = Math.max(0, Math.min(1, p.agg + (Math.random() - 0.5) * 2 * cv.mutRate));
      next.push(mkAgent(w, h, a, "F"));
    }

    pop.agents = next; pop.gen++;
    const all = pop.agents;
    const m2 = all.filter((a) => a.sex === "M");
    const f2 = all.filter((a) => a.sex === "F");
    pop.history.push({
      gen: pop.gen, mean: avg(all.map((a) => a.agg)),
      mMean: m2.length ? avg(m2.map((a) => a.agg)) : 0,
      fMean: f2.length ? avg(f2.map((a) => a.agg)) : 0,
    });
    if (pop.history.length > 45) pop.history.shift();
    pop.flashMsg = `Generation ${pop.gen}`; pop.flashTmr = 55;
    }

  // === Rendering helpers ===

  function drawAgents(pop, species) {
    const ag = pop.agents;

    if (species === "bonobos") {
      const fems = ag.filter((a) => a.sex === "F");
      if (fems.length > 1) {
        const fcx = avg(fems.map((f) => f.x));
        const fcy = avg(fems.map((f) => f.y));
        const mxd = Math.max(...fems.map((f) => Math.sqrt((f.x - fcx) ** 2 + (f.y - fcy) ** 2)));
        const rad = Math.max(mxd + 22, 35);
        ctx.beginPath(); ctx.arc(fcx, fcy, rad, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(159,225,203,0.22)"; ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
        for (let i = 1; i < fems.length; i++) {
          ctx.beginPath(); ctx.moveTo(fems[0].x, fems[0].y); ctx.lineTo(fems[i].x, fems[i].y);
          ctx.strokeStyle = "rgba(29,158,117,0.12)"; ctx.lineWidth = 1; ctx.stroke();
        }
      }
    }

    ag.forEach((a) => {
      if (a.flash > 0) {
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r + 8, 0, Math.PI * 2);
        const alpha = Math.floor((a.flash / 16) * 48).toString(16).padStart(2, "0");
        ctx.fillStyle = a.flashCol + alpha; ctx.fill();
      }
      if (a.rejected > 0) {
        const al = a.rejected / 24;
        ctx.strokeStyle = `rgba(226,75,74,${al})`; ctx.lineWidth = 2;
        const s = 7;
    ctx.beginPath();
        ctx.moveTo(a.x - s, a.y - s); ctx.lineTo(a.x + s, a.y + s);
        ctx.moveTo(a.x + s, a.y - s); ctx.lineTo(a.x - s, a.y + s);
    ctx.stroke();
      }
      if (a.accepted > 0 && species === "bonobos") {
        const al = a.accepted / 24;
        ctx.strokeStyle = `rgba(29,158,117,${al})`; ctx.lineWidth = 2;
    ctx.beginPath();
        ctx.moveTo(a.x - 6, a.y + 1); ctx.lineTo(a.x - 1, a.y + 6); ctx.lineTo(a.x + 7, a.y - 5);
    ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fillStyle = aggCol(a.agg); ctx.fill();
      if (a.sex === "M") {
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 1.5; ctx.stroke();
      }
    });
  }

  function drawOverlay(pop) {
    const w = cw(), h = ch();
    const hist = pop.history;

    if (hist.length >= 2) {
      const cWidth = 185, cHeight = 78, cxp = w - cWidth - 14, cyp = h - cHeight - 40;
      ctx.fillStyle = "rgba(15,17,23,0.88)";
      ctx.fillRect(cxp - 8, cyp - 18, cWidth + 16, cHeight + 26);
      ctx.strokeStyle = "rgba(42,45,58,0.8)"; ctx.lineWidth = 0.5;
      ctx.strokeRect(cxp - 8, cyp - 18, cWidth + 16, cHeight + 26);
      ctx.font = "10px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
      ctx.fillText("Aggression / generation", cxp, cyp - 5);

      [{ k: "mean", c: "#378add" }, { k: "mMean", c: "#ef9f27" }, { k: "fMean", c: "#9FE1CB" }].forEach(({ k, c }) => {
    ctx.beginPath();
        hist.forEach((pt, i) => {
          const x = cxp + (i / (hist.length - 1)) * cWidth;
          const y = cyp + cHeight - pt[k] * cHeight;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();
      });

      [["All", "#378add"], ["Males", "#ef9f27"], ["Females", "#9FE1CB"]].forEach(([l, c], i) => {
        const lx = cxp + i * 58;
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(lx + 4, cyp + cHeight + 10, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#8b8fa3"; ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillText(l, lx + 10, cyp + cHeight + 14);
      });
    }

    ctx.font = "12px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    const cm = hist.length ? hist[hist.length - 1].mean : 0;
    ctx.fillText(`Gen ${pop.gen}   mean aggression: ${cm.toFixed(3)}`, 14, h - 20);

    const pct = (pop.frame % 300) / 300;
    ctx.fillStyle = "#2a2d3a"; ctx.fillRect(14, h - 10, w - 28, 3);
    ctx.fillStyle = "#378add"; ctx.fillRect(14, h - 10, (w - 28) * pct, 3);

    if (pop.flashTmr > 0) {
      const al = Math.min(pop.flashTmr / 20, 1);
      ctx.font = "bold 15px 'JetBrains Mono', monospace";
      ctx.fillStyle = `rgba(225,228,237,${al})`;
      ctx.textAlign = "center"; ctx.fillText(pop.flashMsg, w / 2, h / 2); ctx.textAlign = "left";
      pop.flashTmr--;
    }
  }

  // === Main renderers ===
  // Pattern: "group:topic:species" -> function(dt, key)

  function drawAggressionSim(dt, key) {
    const pop = pops[key];
    if (!pop) return;
    const w = cw(), h = ch();
    const species = key.split(":")[2];

    ctx.fillStyle = "#0f1117"; ctx.fillRect(0, 0, w, h);
    physUpdate(pop, dt);

    if (species === "chimpanzees") chimpUpdate(pop, key, dt);
    else bonoboUpdate(pop, key, dt);

    drawAgents(pop, species);
    drawOverlay(pop);

    pop.frame++;
    if (pop.frame % 300 === 0) nextGen(key, pop);
  }

  // === Gaze-following behavioral sim (dogs vs wolves) ===

  // Geometry helpers for the gaze scene.
  function gazeScene() {
    const w = cw(), h = ch();
    return {
      w, h,
      humanX: w * 0.18, humanY: h * 0.55,
      animalX: w * 0.42, animalY: h * 0.62,
      // Target sits to the right; distance scaled by control.
      targetBaseX: w * 0.55, targetMaxX: w * 0.92,
      targetY: h * 0.30,
    };
  }

  function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return a + d * t;
  }

  function drawHuman(x, y, headAngle) {
    // Body
    ctx.strokeStyle = "#c8ccd8"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 42);            // torso
    ctx.moveTo(x, y + 16); ctx.lineTo(x - 12, y + 32);      // left arm
    ctx.moveTo(x, y + 16); ctx.lineTo(x + 12, y + 32);      // right arm
    ctx.moveTo(x, y + 42); ctx.lineTo(x - 9, y + 64);       // left leg
    ctx.moveTo(x, y + 42); ctx.lineTo(x + 9, y + 64);       // right leg
    ctx.stroke();
    // Head
    ctx.beginPath(); ctx.arc(x, y - 8, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#e1e4ed"; ctx.fill();
    // Eye direction marker (small dot at front of head)
    const ex = x + Math.cos(headAngle) * 7;
    const ey = y - 8 + Math.sin(headAngle) * 7;
    ctx.beginPath(); ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = "#0f1117"; ctx.fill();
    // Nose line
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x + Math.cos(headAngle) * 13, y - 8 + Math.sin(headAngle) * 13);
    ctx.strokeStyle = "#8b8fa3"; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function drawCanid(x, y, headAngle, species) {
    const bodyCol = species === "dogs" ? "#d8b48a" : "#9aa1ad";
    const outline = species === "dogs" ? "#8a6f4f" : "#5c6270";
    // Body ellipse
    ctx.beginPath();
    ctx.ellipse(x, y, 18, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = bodyCol; ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 1.5; ctx.stroke();
    // Legs
    ctx.beginPath();
    ctx.moveTo(x - 11, y + 6); ctx.lineTo(x - 11, y + 16);
    ctx.moveTo(x - 5, y + 8);  ctx.lineTo(x - 5, y + 17);
    ctx.moveTo(x + 5, y + 8);  ctx.lineTo(x + 5, y + 17);
    ctx.moveTo(x + 11, y + 6); ctx.lineTo(x + 11, y + 16);
    ctx.stroke();
    // Tail (wolves: straight, dogs: curled up)
    ctx.beginPath();
    if (species === "dogs") {
      ctx.moveTo(x + 16, y - 1);
      ctx.quadraticCurveTo(x + 24, y - 12, x + 18, y - 16);
    } else {
      ctx.moveTo(x + 16, y + 2);
      ctx.lineTo(x + 28, y + 6);
    }
    ctx.stroke();
    // Head — placed on the side of the body in the direction of headAngle
    const hx = x + Math.cos(headAngle) * 16;
    const hy = y + Math.sin(headAngle) * 6 - 2;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 7, 5.5, headAngle, 0, Math.PI * 2);
    ctx.fillStyle = bodyCol; ctx.fill(); ctx.stroke();
    // Ears
    ctx.beginPath();
    ctx.moveTo(hx - Math.cos(headAngle) * 2, hy - 5);
    ctx.lineTo(hx - Math.cos(headAngle) * 4, hy - 10);
    ctx.lineTo(hx + 2, hy - 5);
    ctx.fillStyle = outline; ctx.fill();
    // Eye
    const exd = hx + Math.cos(headAngle) * 5;
    const eyd = hy + Math.sin(headAngle) * 5;
    ctx.beginPath(); ctx.arc(exd, eyd, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = "#0f1117"; ctx.fill();
  }

  function drawTarget(tx, ty) {
    // Cup / treat
    ctx.beginPath();
    ctx.moveTo(tx - 9, ty - 8);
    ctx.lineTo(tx + 9, ty - 8);
    ctx.lineTo(tx + 6, ty + 9);
    ctx.lineTo(tx - 6, ty + 9);
    ctx.closePath();
    ctx.fillStyle = "#e24b4a"; ctx.fill();
    ctx.strokeStyle = "#7a1f1f"; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function drawGazeCone(ox, oy, angle, length, opacity, color) {
    const spread = 0.18;
    const x1 = ox + Math.cos(angle - spread) * length;
    const y1 = oy + Math.sin(angle - spread) * length;
    const x2 = ox + Math.cos(angle + spread) * length;
    const y2 = oy + Math.sin(angle + spread) * length;
    const grad = ctx.createLinearGradient(ox, oy, (x1 + x2) / 2, (y1 + y2) / 2);
    grad.addColorStop(0, color + Math.floor(opacity * 180).toString(16).padStart(2, "0"));
    grad.addColorStop(1, color + "00");
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
  }

  function drawGazeVector(ox, oy, angle, length, color) {
    const x2 = ox + Math.cos(angle) * length;
    const y2 = oy + Math.sin(angle) * length;
    ctx.beginPath();
    ctx.moveTo(ox, oy); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    // Arrowhead
    ctx.beginPath();
    ctx.arc(x2, y2, 3, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }

  function drawGazeOverlay(pop) {
    const w = cw(), h = ch();
    const cWidth = 200, cHeight = 78, cxp = w - cWidth - 14, cyp = h - cHeight - 40;
    ctx.fillStyle = "rgba(15,17,23,0.88)";
    ctx.fillRect(cxp - 8, cyp - 18, cWidth + 16, cHeight + 26);
    ctx.strokeStyle = "rgba(42,45,58,0.8)"; ctx.lineWidth = 0.5;
    ctx.strokeRect(cxp - 8, cyp - 18, cWidth + 16, cHeight + 26);
    ctx.font = "10px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText("Attention bias / trials", cxp, cyp - 5);

    const total = Math.max(pop.trial, 1);
    const facePct = pop.faceCount / total;
    const gazePct = pop.gazeCount / total;
    const barW = cWidth - 80;

    ctx.fillStyle = "#8b8fa3"; ctx.fillText("Face-fix", cxp, cyp + 14);
    ctx.fillStyle = "#2a2d3a"; ctx.fillRect(cxp + 60, cyp + 6, barW, 10);
    ctx.fillStyle = "#9FE1CB"; ctx.fillRect(cxp + 60, cyp + 6, barW * facePct, 10);
    ctx.fillStyle = "#e1e4ed"; ctx.fillText(`${Math.round(facePct * 100)}%`, cxp + 62 + barW + 4, cyp + 14);

    ctx.fillStyle = "#8b8fa3"; ctx.fillText("Gaze-foll", cxp, cyp + 34);
    ctx.fillStyle = "#2a2d3a"; ctx.fillRect(cxp + 60, cyp + 26, barW, 10);
    ctx.fillStyle = "#ef9f27"; ctx.fillRect(cxp + 60, cyp + 26, barW * gazePct, 10);
    ctx.fillStyle = "#e1e4ed"; ctx.fillText(`${Math.round(gazePct * 100)}%`, cxp + 62 + barW + 4, cyp + 34);

    ctx.fillStyle = "#8b8fa3";
    ctx.fillText(`Trials: ${pop.trial}`, cxp, cyp + 56);
    ctx.fillText(`Phase: ${pop.phase}`, cxp + 90, cyp + 56);

    // Footer status line
    const cv = AppState.getState(currentKey).controls;
    const reared = cv.handReared >= 0.5 ? "Hand-reared • identical conditions" : "Standard rearing";
    ctx.font = "12px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText(`${pop.species === "dogs" ? "Dog" : "Wolf"} • ${reared}`, 14, h - 20);

    if (pop.resultTmr > 0) {
      const al = Math.min(pop.resultTmr / 30, 1);
      ctx.font = "bold 14px 'JetBrains Mono', monospace";
      ctx.fillStyle = `rgba(225,228,237,${al})`;
      ctx.textAlign = "center";
      ctx.fillText(pop.lastResult, w / 2, 32);
      ctx.textAlign = "left";
      pop.resultTmr--;
    }
  }

  function drawGazeSim(dt, key) {
    const pop = pops[key];
    if (!pop) return;
    const cv = AppState.getState(key).controls;
    const sc = gazeScene();

    // Background
    ctx.fillStyle = "#0f1117"; ctx.fillRect(0, 0, sc.w, sc.h);

    // Target position based on slider
    const tx = sc.targetBaseX + (sc.targetMaxX - sc.targetBaseX) * cv.targetDistance;
    const ty = sc.targetY;

    // Angles to references
    const humanHeadX = sc.humanX, humanHeadY = sc.humanY - 8;
    const animalHeadX = sc.animalX + 16, animalHeadY = sc.animalY - 2;
    const angHumanToTarget = Math.atan2(ty - humanHeadY, tx - humanHeadX);
    const angAnimalToHuman = Math.atan2(humanHeadY - animalHeadY, humanHeadX - animalHeadX);
    const angAnimalToTarget = Math.atan2(ty - animalHeadY, tx - animalHeadX);

    // Trial state machine — phases scaled by trialSpeed
    const speed = cv.trialSpeed;
    pop.phaseT += dt * speed;

    switch (pop.phase) {
      case "setup":
        pop.humanTargetAngle = 0;        // human looks forward
        pop.animalTargetAngle = angAnimalToHuman; // animal faces human
        if (pop.phaseT > 0.5) { pop.phase = "cue"; pop.phaseT = 0; }
        break;
      case "cue":
        pop.humanTargetAngle = angHumanToTarget; // human turns to look at target
        if (pop.phaseT > 1.5) { pop.phase = "response"; pop.phaseT = 0; }
        break;
      case "response":
        if (pop.species === "dogs") {
          // Face-fixation: animal locks onto human's face
          pop.animalTargetAngle = angAnimalToHuman;
          // occasional micro-glance toward target then back
          if (pop.phaseT > 1.3 && pop.phaseT < 1.5) {
            pop.animalTargetAngle = angAnimalToTarget;
          }
        } else {
          // Wolf: follow gaze axis to distant target
          pop.animalTargetAngle = angAnimalToTarget;
        }
        if (pop.phaseT > 3.0) {
          pop.phase = "resolve"; pop.phaseT = 0;
          pop.trial++;
          if (pop.species === "dogs") {
            pop.faceCount++;
            pop.lastResult = "Dog looked at human face";
          } else {
            pop.gazeCount++;
            pop.lastResult = "Wolf followed gaze to target";
          }
          pop.resultTmr = 60;
        }
        break;
      case "resolve":
        if (pop.phaseT > 1.0) { pop.phase = "setup"; pop.phaseT = 0; }
        break;
    }

    // Smoothly animate angles
    const easing = Math.min(1, dt * 6 * speed);
    pop.humanAngle = lerpAngle(pop.humanAngle, pop.humanTargetAngle, easing);
    pop.animalAngle = lerpAngle(pop.animalAngle, pop.animalTargetAngle, easing);

    // Draw target
    drawTarget(tx, ty);

    // Draw human gaze cone (only during cue + response phases, with strength from slider)
    if (pop.phase === "cue" || pop.phase === "response") {
      const dist = Math.hypot(tx - humanHeadX, ty - humanHeadY) + 30;
      drawGazeCone(humanHeadX, humanHeadY, pop.humanAngle, dist, cv.cueStrength, "#ef9f27");
    }

    // Draw human and animal
    drawHuman(sc.humanX, sc.humanY, pop.humanAngle);
    drawCanid(sc.animalX, sc.animalY, pop.animalAngle, pop.species);

    // Draw animal gaze vector (where it's actually looking)
    if (pop.phase === "response" || pop.phase === "resolve") {
      const ahx = sc.animalX + Math.cos(pop.animalAngle) * 16;
      const ahy = sc.animalY + Math.sin(pop.animalAngle) * 6 - 2;
      const vlen = pop.species === "dogs"
        ? Math.hypot(humanHeadX - ahx, humanHeadY - ahy)
        : Math.hypot(tx - ahx, ty - ahy);
      drawGazeVector(ahx, ahy, pop.animalAngle, vlen, "#9FE1CB");
    }

    // Indicator on human face when dog is fixating (during response phase)
    if (pop.species === "dogs" && (pop.phase === "response" || pop.phase === "resolve")) {
      const pulse = 0.5 + 0.5 * Math.sin(pop.phaseT * 6);
      ctx.beginPath();
      ctx.arc(humanHeadX, humanHeadY, 14 + pulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(159,225,203,${0.3 + pulse * 0.4})`;
      ctx.lineWidth = 1.5; ctx.stroke();
    }

    drawGazeOverlay(pop);
  }

  // Renderer registry — maps key patterns to render functions.
  // Uses exact match first, then pattern match on "group:topic:*".
  const renderers = {
    "chimps_bonobos:aggression:chimpanzees": drawAggressionSim,
    "chimps_bonobos:aggression:bonobos": drawAggressionSim,
    "dogs_wolves:gaze_following:dogs": drawGazeSim,
    "dogs_wolves:gaze_following:wolves": drawGazeSim,
  };

  function getRenderer(key) {
    return renderers[key] || null;
  }

  return { init, start, stop, resize };
})();
