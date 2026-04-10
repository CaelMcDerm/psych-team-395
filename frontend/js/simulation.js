/**
 * Simulation viewport: agent-based evolutionary simulations.
 * Renderers are keyed by "groupId:topicId:speciesId".
 */
const Simulation = (() => {
  let canvas, ctx;
  let animId = null;
  let currentKey = null;
  let lastTime = 0;

  const happyImg = new Image();
  happyImg.src = "/images/joyfulsoul.png";
  const neutralImg = new Image();
  neutralImg.src = "/images/gettingAngry.png";
  const angryImg = new Image();
  angryImg.src = "/images/anger.png";
  
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
    const s = AppState.getState(k);
    const cv = s.controls;
    const w = cw(), h = ch();
    const half = Math.floor(cv.popSize / 2);
    const species = k.split(":")[2]; // extract species from key
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
      const img = a.agg < 0.4 ? happyImg : a.agg < 0.7 ? neutralImg : angryImg;
      const size = 28;
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, a.x - size / 2, a.y - size / 2, size, size);
      }
      if (a.sex === "M") {
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 3; ctx.stroke();
      }
      ctx.font = "bold 10px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(a.sex === "M" ? "♂" : "♀", a.x, a.y + size / 2 + 7);
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

  // Renderer registry — maps key patterns to render functions.
  // Uses exact match first, then pattern match on "group:topic:*".
  const renderers = {
    "chimps_bonobos:aggression:chimpanzees": drawAggressionSim,
    "chimps_bonobos:aggression:bonobos": drawAggressionSim,
  };

  function getRenderer(key) {
    return renderers[key] || null;
  }

  return { init, start, stop, resize };
})();
