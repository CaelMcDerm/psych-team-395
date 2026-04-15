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
      if (controlKey === "popSize" || controlKey === "groupSize" || controlKey === "predatorCount" || controlKey === "initialProsocial") resetPop(key);
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
        humanAngle: 0,
        humanTargetAngle: 0,
        animalAngle: Math.PI,
        animalTargetAngle: Math.PI,
        lastResult: null, resultTmr: 0,
      };
      return;
    }

    if (topic === "culture") {
      const s = AppState.getState(k);
      const cv = s.controls;
      const isCumulative = species === "cumulative_culture";
      const baseSkill = 1.0;
      const baseWalnuts = Math.round(cv.groupSize * baseSkill * (3 + Math.random()));
      pops[k] = {
        kind: "culture",
        species,
        gen: 0,
        skill: baseSkill,
        frame: 0,
        monkeys: [],
        history: [{ gen: 0, walnuts: baseWalnuts, skill: baseSkill }],
        flashMsg: null, flashTmr: 0,
        crackEvents: [],
      };
      const w = cw(), h = ch();
      for (let i = 0; i < cv.groupSize; i++) {
        pops[k].monkeys.push({
          x: w * 0.15 + Math.random() * w * 0.5,
          y: h * 0.25 + Math.random() * h * 0.45,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30,
          cracking: 0,
        });
      }
      return;
    }

    if (topic === "self_domestication") {
      const s = AppState.getState(k);
      const cv = s.controls;
      const w = cw(), h = ch();
      const agents = [];
      for (let i = 0; i < cv.popSize; i++) {
        const prosociality = Math.random() < cv.initialProsocial
          ? 0.6 + Math.random() * 0.4   // prosocial: 0.6–1.0
          : Math.random() * 0.4;          // aggressive: 0.0–0.4
        agents.push({
          x: Math.random() * (w - 40) + 20,
          y: Math.random() * (h - 80) + 20,
          vx: (Math.random() - 0.5) * 40,
          vy: (Math.random() - 0.5) * 40,
          prosociality,
          fitness: 1,
          alive: true,
          flash: 0, flashCol: "#fff",
          groupId: -1,
        });
      }
      const predators = [];
      for (let i = 0; i < cv.predatorCount; i++) {
        predators.push({
          x: Math.random() * w,
          y: Math.random() * (h - 80),
          vx: (Math.random() - 0.5) * 50,
          vy: (Math.random() - 0.5) * 50,
          attackCooldown: 0,
          attacking: null,
        });
      }
      const prosocialPct = agents.filter(a => a.prosociality >= 0.5).length / agents.length;
      pops[k] = {
        kind: "selfdom",
        agents, predators,
        gen: 0, frame: 0,
        history: [{ gen: 0, prosocialPct, alive: agents.length }],
        flashMsg: null, flashTmr: 0,
        deathEvents: [],
        shieldEvents: [],
      };
      return;
    }

    if (topic === "theory_of_mind" && species === "cooperative_pulling") {
      pops[k] = {
        kind: "coop_pull",
        phase: "approach",
        phaseT: 0,
        trial: 0,
        successes: 0, failures: 0,
        history: [],
        eAx: 0, eAy: 0, eBx: 0, eBy: 0,
        eATargetX: 0, eBTargetX: 0,
        platformX: 0, platformY: 0,
        ropeOffset: 0,
        aPulling: false, bPulling: false,
        aArrived: false, bArrived: false,
        bDelay: 0,
        lastResult: null, resultTmr: 0,
      };
      resetCoopPositions(k);
      return;
    }

    if (topic === "theory_of_mind" && species === "human_pointing") {
      pops[k] = {
        kind: "pointing",
        phase: "setup",
        phaseT: 0,
        trial: 0,
        condition: "facing",
        targetSide: "left",
        facingCorrect: 0, facingTotal: 0,
        turnedCorrect: 0, turnedTotal: 0,
        history: [],
        elephantX: 0, elephantY: 0,
        elephantTargetX: 0,
        chosenSide: null,
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

  // === Gaze-following behavioral sim (dogs vs wolves) ===

  // Geometry helpers for the gaze scene.
  function gazeScene() {
    const w = cw(), h = ch();
    return {
      w, h,
      humanX: w * 0.18, humanY: h * 0.55,
      animalX: w * 0.42, animalY: h * 0.62,
      // Target travels from just past the human to the far right edge.
      targetBaseX: w * 0.24, targetMaxX: w * 0.96,
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
    ctx.font = "12px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText(`${pop.species === "dogs" ? "Dog" : "Wolf"} • Hand-reared, identical conditions`, 14, h - 20);

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
      drawGazeCone(humanHeadX, humanHeadY, pop.humanAngle, dist, 0.7, "#ef9f27");
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

  // === Culture simulation (vervet monkeys — normative vs cumulative) ===

  function drawMonkey(x, y, cracking) {
    // Tail (drawn first so it sits behind the body)
    ctx.beginPath();
    ctx.moveTo(x + 9, y);
    ctx.bezierCurveTo(x + 24, y - 4, x + 28, y - 20, x + 18, y - 30);
    ctx.strokeStyle = "#5a6e4a"; ctx.lineWidth = 2; ctx.stroke();

    // Body — grey-green
    ctx.beginPath();
    ctx.ellipse(x, y, 11, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#7d9070"; ctx.fill();
    ctx.strokeStyle = "#4a5a3e"; ctx.lineWidth = 1; ctx.stroke();

    // Cream underside
    ctx.beginPath();
    ctx.ellipse(x + 1, y + 1, 6, 5.5, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "#d4c9a8"; ctx.fill();

    // White facial fringe — distinctive vervet ring around the face
    ctx.beginPath();
    ctx.arc(x - 10, y - 6, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = "#e8e0c8"; ctx.fill();

    // Head — black face mask
    ctx.beginPath();
    ctx.arc(x - 10, y - 6, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a1a"; ctx.fill();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 0.8; ctx.stroke();

    // Ears
    ctx.beginPath();
    ctx.arc(x - 4, y - 12, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#c4a882"; ctx.fill();
    ctx.strokeStyle = "#4a5a3e"; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 16, y - 12, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#c4a882"; ctx.fill();
    ctx.strokeStyle = "#4a5a3e"; ctx.lineWidth = 0.8; ctx.stroke();

    // Eyes — amber/yellow irises on the black face
    ctx.beginPath(); ctx.arc(x - 8, y - 7, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "#c8a030"; ctx.fill();
    ctx.beginPath(); ctx.arc(x - 13, y - 7, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "#c8a030"; ctx.fill();
    // Pupils
    ctx.beginPath(); ctx.arc(x - 8, y - 7, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = "#080808"; ctx.fill();
    ctx.beginPath(); ctx.arc(x - 13, y - 7, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = "#080808"; ctx.fill();

    // Legs
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 8); ctx.lineTo(x - 7, y + 18);
    ctx.moveTo(x + 4, y + 8); ctx.lineTo(x + 7, y + 18);
    ctx.strokeStyle = "#4a5a3e"; ctx.lineWidth = 2; ctx.stroke();
    // Feet
    ctx.beginPath();
    ctx.ellipse(x - 7, y + 19, 3, 1.5, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = "#c4a882"; ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 7, y + 19, 3, 1.5, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = "#c4a882"; ctx.fill();

    // Arms — if cracking, raise left arm with rock, place walnut on ground
    if (cracking > 0) {
      const lift = Math.sin(cracking * 8) * 7;
      // Right arm resting
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 4); ctx.lineTo(x + 6, y + 13);
      ctx.strokeStyle = "#4a5a3e"; ctx.lineWidth = 2; ctx.stroke();
      // Left arm raised
      ctx.beginPath();
      ctx.moveTo(x - 5, y + 2); ctx.lineTo(x - 13, y + 10 + lift);
      ctx.strokeStyle = "#4a5a3e"; ctx.lineWidth = 2; ctx.stroke();
      // Rock in hand
      ctx.beginPath();
      ctx.arc(x - 13, y + 10 + lift, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#9a9a9a"; ctx.fill();
      ctx.strokeStyle = "#666"; ctx.lineWidth = 0.8; ctx.stroke();
      // Walnut on the ground below the raised arm
      drawWalnut(x - 13, y + 17, false);
    } else {
      ctx.beginPath();
      ctx.moveTo(x - 5, y + 2); ctx.lineTo(x - 9, y + 12);
      ctx.moveTo(x + 3, y + 4); ctx.lineTo(x + 6, y + 13);
      ctx.strokeStyle = "#4a5a3e"; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  function drawWalnut(x, y, cracked) {
    if (cracked) {
      // Two halves separated
    ctx.beginPath();
      ctx.ellipse(x - 3, y, 4, 3.5, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = "#6b4f2a"; ctx.fill();
    ctx.strokeStyle = "#4a3510"; ctx.lineWidth = 1; ctx.stroke();
      // Inner meat visible
      ctx.beginPath();
      ctx.ellipse(x - 3, y, 2.5, 2, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = "#c9a96e"; ctx.fill();
      // Second half
      ctx.beginPath();
      ctx.ellipse(x + 3, y + 1, 3.5, 3, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "#5e4422"; ctx.fill();
      ctx.strokeStyle = "#4a3510"; ctx.lineWidth = 1; ctx.stroke();
    } else {
      // Whole walnut — rounder, with ridge
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#8B6914"; ctx.fill();
      ctx.strokeStyle = "#6b5210"; ctx.lineWidth = 1.2; ctx.stroke();
      // Ridge line
      ctx.beginPath();
      ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5);
      ctx.strokeStyle = "#7a5c12"; ctx.lineWidth = 0.8; ctx.stroke();
    }
  }

  function drawCultureGraph(pop) {
    const w = cw(), h = ch();
    const hist = pop.history;
    if (hist.length < 1) return;

    // Graph dimensions - bottom right
    const gW = 240, gH = 120;
    const gx = w - gW - 20, gy = h - gH - 100;

    // Background
    ctx.fillStyle = "rgba(15,17,23,0.92)";
    ctx.fillRect(gx - 12, gy - 24, gW + 24, gH + 40);
    ctx.strokeStyle = "rgba(42,45,58,0.8)"; ctx.lineWidth = 0.5;
    ctx.strokeRect(gx - 12, gy - 24, gW + 24, gH + 40);

    // Title
    ctx.font = "10px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText("Walnuts cracked / generation", gx, gy - 10);

    // Axes
    ctx.strokeStyle = "#2a2d3a"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gH);
    ctx.lineTo(gx + gW, gy + gH);
    ctx.stroke();

    if (hist.length < 2) return;

    // Find max walnuts for scaling
    const maxW = Math.max(...hist.map(h => h.walnuts), 1) * 1.15;
    const maxGen = Math.max(hist.length - 1, 1);

    // Draw walnut line
    const color = pop.species === "cumulative_culture" ? "#ef9f27" : "#9FE1CB";
    ctx.beginPath();
    hist.forEach((pt, i) => {
      const px = gx + (i / maxGen) * gW;
      const py = gy + gH - (pt.walnuts / maxW) * gH;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();

    // Draw dots
    hist.forEach((pt, i) => {
      const px = gx + (i / maxGen) * gW;
      const py = gy + gH - (pt.walnuts / maxW) * gH;
      ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    });

    // Draw skill line (secondary)
    const maxSkill = Math.max(...hist.map(h => h.skill), 1) * 1.15;
    const skillColor = pop.species === "cumulative_culture" ? "#378add" : "#8b8fa3";
    ctx.beginPath();
    hist.forEach((pt, i) => {
      const px = gx + (i / maxGen) * gW;
      const py = gy + gH - (pt.skill / maxSkill) * gH;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.strokeStyle = skillColor; ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);

    // Axis labels
    ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText("Gen 0", gx, gy + gH + 12);
    ctx.textAlign = "right";
    ctx.fillText(`Gen ${hist[hist.length - 1].gen}`, gx + gW, gy + gH + 12);
    ctx.textAlign = "left";

    // Latest walnut count
    const latest = hist[hist.length - 1];
    ctx.font = "11px 'JetBrains Mono', monospace"; ctx.fillStyle = "#e1e4ed";
    ctx.fillText(`${latest.walnuts} walnuts`, gx + gW - 80, gy - 10);

    // Inline legend
    const ly = gy + gH + 10;
    ctx.beginPath(); ctx.arc(gx + 4, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText("Walnuts", gx + 10, ly + 3);
    ctx.beginPath(); ctx.arc(gx + 72, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = skillColor; ctx.fill();
    ctx.fillStyle = "#8b8fa3";
    ctx.fillText("Skill", gx + 78, ly + 3);
  }

  function drawCultureSim(dt, key) {
    const pop = pops[key];
    if (!pop) return;
    const w = cw(), h = ch();
    const cv = AppState.getState(key).controls;
    const isCumulative = pop.species === "cumulative_culture";
    const speed = cv.genSpeed;

    ctx.fillStyle = "#0f1117"; ctx.fillRect(0, 0, w, h);

    // Ground
    ctx.fillStyle = "#1a1f12";
    ctx.fillRect(0, h * 0.75, w, h * 0.25);
    ctx.strokeStyle = "#2a3418"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h * 0.75); ctx.lineTo(w, h * 0.75); ctx.stroke();

    // Move monkeys gently
    pop.monkeys.forEach(m => {
      m.vx += (Math.random() - 0.5) * 15 * dt;
      m.vy += (Math.random() - 0.5) * 15 * dt;
      const spd = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      if (spd > 25) { m.vx = (m.vx / spd) * 25; m.vy = (m.vy / spd) * 25; }
      m.vx *= 0.96; m.vy *= 0.96;
      m.x += m.vx * dt; m.y += m.vy * dt;
      // Bounds
      if (m.x < 30) { m.x = 30; m.vx = Math.abs(m.vx); }
      if (m.x > w * 0.6) { m.x = w * 0.6; m.vx = -Math.abs(m.vx); }
      if (m.y < h * 0.25) { m.y = h * 0.25; m.vy = Math.abs(m.vy); }
      if (m.y > h * 0.68) { m.y = h * 0.68; m.vy = -Math.abs(m.vy); }
      // Cracking timer
      if (m.cracking > 0) m.cracking -= dt * speed;
    });

    // Randomly trigger cracking animations
    if (Math.random() < 0.03 * speed) {
      const m = pop.monkeys[Math.floor(Math.random() * pop.monkeys.length)];
      if (m.cracking <= 0) {
        m.cracking = 1.5;
        // Add a crack event at the walnut position on the ground (foot level)
        pop.crackEvents.push({
          x: m.x - 12, y: m.y + 17,
          t: 1.0,
        });
      }
    }

    // Draw scattered walnuts on the ground
    const walnutSeed = pop.gen * 137;
    const walnutCount = Math.min(Math.round(pop.history[pop.history.length - 1].walnuts / 2), 30);
    for (let i = 0; i < walnutCount; i++) {
      const wx = 20 + ((walnutSeed + i * 73) % (Math.floor(w * 0.6))) ;
      const wy = h * 0.76 + ((walnutSeed + i * 47) % Math.floor(h * 0.18));
      const cracked = i < walnutCount * 0.6;
      drawWalnut(wx, wy, cracked);
    }

    // Draw crack events
    pop.crackEvents = pop.crackEvents.filter(e => {
      e.t -= dt * speed;
      if (e.t <= 0) return false;
      const al = e.t;
      ctx.font = "bold 12px sans-serif";
      ctx.fillStyle = `rgba(239,159,39,${al})`;
      ctx.textAlign = "center";
      ctx.fillText("💥", e.x, e.y - (1 - e.t) * 15);
      ctx.textAlign = "left";
      return true;
    });

    // Draw monkeys
    pop.monkeys.forEach(m => drawMonkey(m.x, m.y, m.cracking));

    // Generation timer
    pop.frame += dt * speed * 60;
    const genLength = 360;
    if (pop.frame >= genLength) {
      pop.frame = 0;
      pop.gen++;

      if (isCumulative) {
        const innovRate = cv.innovationRate || 0.15;
        pop.skill += pop.skill * innovRate * (0.7 + Math.random() * 0.6);
      }
      // Slight random variation but no improvement for normative
      const variation = 0.95 + Math.random() * 0.1;
      const walnuts = Math.round(cv.groupSize * pop.skill * (3 + Math.random()) * variation);
      pop.history.push({ gen: pop.gen, walnuts, skill: pop.skill });
      if (pop.history.length > 40) pop.history.shift();

      pop.flashMsg = `Generation ${pop.gen}`;
      pop.flashTmr = 55;

      // Rebuild monkeys for new generation
      pop.monkeys = [];
      for (let i = 0; i < cv.groupSize; i++) {
        pop.monkeys.push({
          x: w * 0.15 + Math.random() * w * 0.5,
          y: h * 0.25 + Math.random() * h * 0.45,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30,
          cracking: 0,
        });
      }
    }

    // Draw graph
    drawCultureGraph(pop);

    // Generation progress bar
    const pct = pop.frame / genLength;
    ctx.fillStyle = "#2a2d3a"; ctx.fillRect(14, h - 50, w - 28, 3);
    ctx.fillStyle = "#9FE1CB"; ctx.fillRect(14, h - 50, (w - 28) * pct, 3);

    // Footer
    ctx.font = "12px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    const modeLabel = isCumulative ? "Cumulative Culture (hypothetical)" : "Normative Conformity";
    ctx.fillText(`Vervet Monkeys • ${modeLabel} • Gen ${pop.gen}`, 14, h - 60);

    // Flash message
    if (pop.flashTmr > 0) {
      const al = Math.min(pop.flashTmr / 20, 1);
      ctx.font = "bold 15px 'JetBrains Mono', monospace";
      ctx.fillStyle = `rgba(225,228,237,${al})`;
      ctx.textAlign = "center"; ctx.fillText(pop.flashMsg, w / 2, h * 0.15); ctx.textAlign = "left";
      pop.flashTmr--;
    }
  }

  // === Self-Domestication simulation (humans) ===

  function isProsocial(a) { return a.prosociality >= 0.5; }

  function selfdomPhysics(pop, dt) {
    const ag = pop.agents.filter(a => a.alive);
    const w = cw(), h = ch();
    const simH = h - 70; // keep above footer area

    // Prosocial humans attract each other
    const prosocials = ag.filter(a => isProsocial(a));
    prosocials.forEach(a => {
      prosocials.forEach(b => {
        if (a === b) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 20 && d < 160) {
          const pull = 35 * a.prosociality * dt;
          a.vx += (dx / d) * pull;
          a.vy += (dy / d) * pull;
        }
      });
    });

    // Aggressive humans pushed away from groups
    ag.forEach(a => {
      if (isProsocial(a)) return;
      prosocials.forEach(b => {
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 50 && d > 0) {
          const push = 60 * (1 - a.prosociality) * dt;
          a.vx += (dx / d) * push;
          a.vy += (dy / d) * push;
        }
      });
    });

    // Basic movement + repulsion
    const REPEL = 16, RF = 150, CAP = 60;
    ag.forEach(a => {
      if (a.flash > 0) a.flash--;
      a.vx += (Math.random() - 0.5) * 20 * dt * 60;
      a.vy += (Math.random() - 0.5) * 20 * dt * 60;
      const spd = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
      if (spd > CAP) { a.vx = (a.vx / spd) * CAP; a.vy = (a.vy / spd) * CAP; }
      a.vx *= 0.96; a.vy *= 0.96;
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (a.x < 12) { a.x = 12; a.vx = Math.abs(a.vx); }
      if (a.x > w - 12) { a.x = w - 12; a.vx = -Math.abs(a.vx); }
      if (a.y < 12) { a.y = 12; a.vy = Math.abs(a.vy); }
      if (a.y > simH - 12) { a.y = simH - 12; a.vy = -Math.abs(a.vy); }
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

    // Assign group IDs: prosocial humans within 55px of each other cluster
    ag.forEach(a => { a.groupId = -1; });
    let gid = 0;
    prosocials.forEach(a => {
      if (a.groupId >= 0) return;
      // BFS to find connected cluster
      const cluster = [a];
      a.groupId = gid;
      let qi = 0;
      while (qi < cluster.length) {
        const cur = cluster[qi++];
        prosocials.forEach(b => {
          if (b.groupId >= 0) return;
          const dx = b.x - cur.x, dy = b.y - cur.y;
          if (Math.sqrt(dx * dx + dy * dy) < 55) {
            b.groupId = gid;
            cluster.push(b);
          }
        });
      }
      gid++;
    });
  }

  function selfdomPredators(pop, dt) {
    const w = cw(), h = ch();
    const simH = h - 70;
    const alive = pop.agents.filter(a => a.alive);

    pop.predators.forEach(p => {
      if (p.attackCooldown > 0) { p.attackCooldown -= dt; return; }

      // Find nearest lone human (groupId === -1 OR group size < 3)
      // Count group sizes
      const groupSizes = {};
      alive.forEach(a => {
        if (a.groupId >= 0) groupSizes[a.groupId] = (groupSizes[a.groupId] || 0) + 1;
      });
      const loners = alive.filter(a => a.groupId < 0 || (groupSizes[a.groupId] || 0) < 3);

      let target = null, minD = Infinity;
      loners.forEach(a => {
        const dx = a.x - p.x, dy = a.y - p.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD) { minD = d; target = a; }
      });

      if (target && minD < 250) {
        // Chase
        const dx = target.x - p.x, dy = target.y - p.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        p.vx += (dx / d) * 120 * dt;
        p.vy += (dy / d) * 120 * dt;

        // Attack if close enough
        if (d < 18) {
          if (Math.random() < 0.75) {
            // Successful predation
            target.alive = false;
            target.fitness = 0;
            pop.deathEvents.push({ x: target.x, y: target.y, t: 1.5 });
          } else {
            // Failed — target escapes
            target.vx += (target.x - p.x) / d * 120;
            target.vy += (target.y - p.y) / d * 120;
            target.flash = 20; target.flashCol = "#ef9f27";
          }
          p.attackCooldown = 3.0;
          p.vx *= -0.5; p.vy *= -0.5;
        }
      } else {
        // Wander near groups but get deterred
        p.vx += (Math.random() - 0.5) * 60 * dt;
        p.vy += (Math.random() - 0.5) * 60 * dt;

        // Check if near a group — back off
        alive.forEach(a => {
          if (a.groupId < 0) return;
          const gs = groupSizes[a.groupId] || 0;
          if (gs < 3) return;
          const dx = p.x - a.x, dy = p.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 70) {
            p.vx += (dx / (d || 1)) * 80 * dt;
            p.vy += (dy / (d || 1)) * 80 * dt;
            // Shield flash
            if (Math.random() < 0.02) {
              pop.shieldEvents.push({ x: a.x, y: a.y, gid: a.groupId, t: 0.8 });
            }
          }
        });
      }

      // Predator movement
      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (spd > 80) { p.vx = (p.vx / spd) * 80; p.vy = (p.vy / spd) * 80; }
      p.vx *= 0.97; p.vy *= 0.97;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
      if (p.x > w) { p.x = w; p.vx = -Math.abs(p.vx); }
      if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
      if (p.y > simH) { p.y = simH; p.vy = -Math.abs(p.vy); }
    });

    // Grouped prosocial humans gain fitness
    alive.forEach(a => {
      const groupSizes = {};
      alive.forEach(b => {
        if (b.groupId >= 0) groupSizes[b.groupId] = (groupSizes[b.groupId] || 0) + 1;
      });
      if (a.groupId >= 0 && (groupSizes[a.groupId] || 0) >= 3) {
        a.fitness += 1.5 * dt;
      } else {
        a.fitness += 0.3 * dt;
      }
    });
  }

  function selfdomNextGen(key, pop) {
    const cv = AppState.getState(key).controls;
    const alive = pop.agents.filter(a => a.alive);
    if (!alive.length) return;
    alive.forEach(a => { a.fitness = Math.max(a.fitness, 0.1); });

    function sample(pool) {
      const tot = pool.reduce((s, a) => s + a.fitness, 0);
      let r = Math.random() * tot;
      for (const a of pool) { r -= a.fitness; if (r <= 0) return a; }
      return pool[pool.length - 1];
    }

    const w = cw(), h = ch();
    const next = [];
    for (let i = 0; i < cv.popSize; i++) {
      const parent = sample(alive);
      const pro = Math.max(0, Math.min(1,
        parent.prosociality + (Math.random() - 0.5) * 2 * cv.mutRate));
      next.push({
        x: Math.random() * (w - 40) + 20,
        y: Math.random() * (h - 120) + 20,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        prosociality: pro,
        fitness: 1,
        alive: true,
        flash: 0, flashCol: "#fff",
        groupId: -1,
      });
    }

    // Reset predators
    pop.predators.forEach(p => {
      p.x = Math.random() * w;
      p.y = Math.random() * (h - 120);
      p.vx = (Math.random() - 0.5) * 50;
      p.vy = (Math.random() - 0.5) * 50;
      p.attackCooldown = 0;
    });

    pop.agents = next;
    pop.gen++;
    const prosocialPct = next.filter(a => isProsocial(a)).length / next.length;
    pop.history.push({ gen: pop.gen, prosocialPct, alive: next.length });
    if (pop.history.length > 45) pop.history.shift();
    pop.flashMsg = `Generation ${pop.gen}`;
    pop.flashTmr = 55;
  }

  function drawHumanAgent(x, y, prosociality, alive, flash, flashCol) {
    if (!alive) return;
    const pro = isProsocial({ prosociality });
    const baseCol = pro
      ? `rgb(${Math.round(74 + (1 - prosociality) * 60)},${Math.round(180 + prosociality * 42)},${Math.round(100 + prosociality * 28)})`
      : `rgb(${Math.round(200 + (1 - prosociality) * 39)},${Math.round(68 + prosociality * 50)},${Math.round(68 + prosociality * 20)})`;

    // Flash effect
    if (flash > 0) {
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2);
      const al = Math.floor((flash / 20) * 60).toString(16).padStart(2, "0");
      ctx.fillStyle = flashCol + al; ctx.fill();
    }

    // Body — stick figure
    ctx.strokeStyle = baseCol; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 18);       // torso
    ctx.moveTo(x, y + 8); ctx.lineTo(x - 7, y + 16);   // left arm
    ctx.moveTo(x, y + 8); ctx.lineTo(x + 7, y + 16);   // right arm
    ctx.moveTo(x, y + 18); ctx.lineTo(x - 5, y + 28);  // left leg
    ctx.moveTo(x, y + 18); ctx.lineTo(x + 5, y + 28);  // right leg
    ctx.stroke();

    // Head
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = baseCol; ctx.fill();

    // Label
    ctx.font = "bold 7px 'JetBrains Mono', monospace";
    ctx.fillStyle = pro ? "rgba(74,222,128,0.7)" : "rgba(239,68,68,0.7)";
    ctx.textAlign = "center";
    ctx.fillText(pro ? "+" : "−", x, y - 8);
    ctx.textAlign = "left";
  }

  function drawPredator(x, y, cooldown) {
    const al = cooldown > 0 ? 0.4 : 0.85;
    // Body — angular predator shape
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 9, y + 2);
    ctx.lineTo(x + 6, y + 10);
    ctx.lineTo(x - 6, y + 10);
    ctx.lineTo(x - 9, y + 2);
    ctx.closePath();
    ctx.fillStyle = `rgba(120,30,30,${al})`; ctx.fill();
    ctx.strokeStyle = `rgba(200,60,60,${al})`; ctx.lineWidth = 1.5; ctx.stroke();
    // Eyes
    ctx.beginPath();
    ctx.arc(x - 3, y - 2, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 2, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,200,50,${al})`; ctx.fill();
  }

  function drawSelfDomGraph(pop) {
    const w = cw(), h = ch();
    const hist = pop.history;
    if (hist.length < 1) return;

    const gW = 240, gH = 110;
    const gx = w - gW - 20, gy = h - gH - 100;

    ctx.fillStyle = "rgba(15,17,23,0.92)";
    ctx.fillRect(gx - 12, gy - 24, gW + 24, gH + 48);
    ctx.strokeStyle = "rgba(42,45,58,0.8)"; ctx.lineWidth = 0.5;
    ctx.strokeRect(gx - 12, gy - 24, gW + 24, gH + 48);

    ctx.font = "10px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText("Prosocial % / generation", gx, gy - 10);

    // Axes
    ctx.strokeStyle = "#2a2d3a"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gH);
    ctx.lineTo(gx + gW, gy + gH);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = "#555"; ctx.font = "8px 'JetBrains Mono', monospace";
    ctx.fillText("100%", gx - 4, gy + 4); ctx.textAlign = "left";
    ctx.fillText("0%", gx - 2, gy + gH - 2);

    if (hist.length < 2) return;
    const maxGen = Math.max(hist.length - 1, 1);

    // Prosocial line (green)
    ctx.beginPath();
    hist.forEach((pt, i) => {
      const px = gx + (i / maxGen) * gW;
      const py = gy + gH - pt.prosocialPct * gH;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 2; ctx.stroke();

    // Aggressive line (red) = 1 - prosocial
    ctx.beginPath();
    hist.forEach((pt, i) => {
      const px = gx + (i / maxGen) * gW;
      const py = gy + gH - (1 - pt.prosocialPct) * gH;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);

    // Dots on latest point
    const last = hist[hist.length - 1];
    const lpx = gx + gW, lpy = gy + gH - last.prosocialPct * gH;
    ctx.beginPath(); ctx.arc(lpx, lpy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#4ade80"; ctx.fill();

    // Axis labels
    ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText("Gen 0", gx, gy + gH + 12);
    ctx.textAlign = "right";
    ctx.fillText(`Gen ${last.gen}`, gx + gW, gy + gH + 12);
    ctx.textAlign = "left";

    // Current %
    ctx.font = "11px 'JetBrains Mono', monospace"; ctx.fillStyle = "#e1e4ed";
    ctx.fillText(`${Math.round(last.prosocialPct * 100)}% prosocial`, gx + gW - 100, gy - 10);

    // Inline legend
    const ly = gy + gH + 22;
    ctx.beginPath(); ctx.arc(gx + 4, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#4ade80"; ctx.fill();
    ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText("Prosocial", gx + 10, ly + 3);
    ctx.beginPath(); ctx.arc(gx + 80, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444"; ctx.fill();
    ctx.fillStyle = "#8b8fa3";
    ctx.fillText("Aggressive", gx + 86, ly + 3);
  }

  function drawSelfDomSim(dt, key) {
    const pop = pops[key];
    if (!pop) return;
    const w = cw(), h = ch();

    ctx.fillStyle = "#0f1117"; ctx.fillRect(0, 0, w, h);

    // Run physics
    selfdomPhysics(pop, dt);
    selfdomPredators(pop, dt);

    // Draw group circles for clusters of 3+
    const alive = pop.agents.filter(a => a.alive);
    const groupSizes = {};
    const groupCenters = {};
    alive.forEach(a => {
      if (a.groupId >= 0) {
        if (!groupSizes[a.groupId]) { groupSizes[a.groupId] = 0; groupCenters[a.groupId] = { sx: 0, sy: 0 }; }
        groupSizes[a.groupId]++;
        groupCenters[a.groupId].sx += a.x;
        groupCenters[a.groupId].sy += a.y;
      }
    });
    Object.entries(groupSizes).forEach(([gid, size]) => {
      if (size < 3) return;
      const cx = groupCenters[gid].sx / size;
      const cy = groupCenters[gid].sy / size;
      // Find radius
      let maxR = 0;
      alive.filter(a => a.groupId === parseInt(gid)).forEach(a => {
        const d = Math.sqrt((a.x - cx) ** 2 + (a.y - cy) ** 2);
        if (d > maxR) maxR = d;
      });
      const r = Math.max(maxR + 20, 30);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(74,222,128,0.06)"; ctx.fill();
      ctx.strokeStyle = "rgba(74,222,128,0.25)"; ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
      // Group label
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(74,222,128,0.4)";
      ctx.textAlign = "center";
      ctx.fillText(`group (${size})`, cx, cy - r - 4);
      ctx.textAlign = "left";
    });

    // Draw death events
    pop.deathEvents = pop.deathEvents.filter(e => {
      e.t -= dt;
      if (e.t <= 0) return false;
      const al = e.t / 1.5;
      ctx.font = "16px sans-serif"; ctx.fillStyle = `rgba(239,68,68,${al})`;
      ctx.textAlign = "center";
      ctx.fillText("💀", e.x, e.y - (1.5 - e.t) * 12);
      ctx.textAlign = "left";
      return true;
    });

    // Draw shield events
    pop.shieldEvents = pop.shieldEvents.filter(e => {
      e.t -= dt;
      if (e.t <= 0) return false;
      const al = e.t / 0.8;
      ctx.font = "12px sans-serif"; ctx.fillStyle = `rgba(74,222,128,${al})`;
      ctx.textAlign = "center";
      ctx.fillText("🛡", e.x, e.y - (0.8 - e.t) * 10);
      ctx.textAlign = "left";
      return true;
    });

    // Draw predators
    pop.predators.forEach(p => drawPredator(p.x, p.y, p.attackCooldown));

    // Draw humans
    alive.forEach(a => drawHumanAgent(a.x, a.y, a.prosociality, a.alive, a.flash, a.flashCol));

    // Draw graph
    drawSelfDomGraph(pop);

    // Generation timer
    pop.frame++;
    if (pop.frame % 400 === 0) {
      selfdomNextGen(key, pop);
    }

    // Progress bar
    const pct = (pop.frame % 400) / 400;
    ctx.fillStyle = "#2a2d3a"; ctx.fillRect(14, h - 50, w - 28, 3);
    ctx.fillStyle = "#4ade80"; ctx.fillRect(14, h - 50, (w - 28) * pct, 3);

    // Footer
    const aliveCount = pop.agents.filter(a => a.alive).length;
    const prosCount = pop.agents.filter(a => a.alive && isProsocial(a)).length;
    ctx.font = "12px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText(`Gen ${pop.gen}  •  alive: ${aliveCount}  •  prosocial: ${prosCount}  •  aggressive: ${aliveCount - prosCount}`, 14, h - 60);

    // Flash
    if (pop.flashTmr > 0) {
      const al = Math.min(pop.flashTmr / 20, 1);
      ctx.font = "bold 15px 'JetBrains Mono', monospace";
      ctx.fillStyle = `rgba(225,228,237,${al})`;
      ctx.textAlign = "center"; ctx.fillText(pop.flashMsg, w / 2, 30); ctx.textAlign = "left";
      pop.flashTmr--;
    }
  }

  // === Elephant Theory of Mind Simulations ===

  function resetCoopPositions(k) {
    const w = cw(), h = ch();
    const pop = pops[k];
    const cy = h * 0.5;
    pop.platformX = w * 0.5;
    pop.platformY = cy;
    pop.eAx = w * 0.12; pop.eAy = cy;
    pop.eBx = w * 0.88; pop.eBy = cy;
    pop.eATargetX = pop.platformX - 80;
    pop.eBTargetX = pop.platformX + 80;
    pop.ropeOffset = 0;
    pop.aPulling = false; pop.bPulling = false;
    pop.aArrived = false; pop.bArrived = false;
    pop.bDelay = 1.0 + Math.random() * 3.0;
    pop.phase = "approach";
    pop.phaseT = 0;
  }

  function drawElephant(x, y, facing, label) {
    // facing: -1 = left, 1 = right
    const f = facing;
    // Body
    ctx.beginPath();
    ctx.ellipse(x, y, 28, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#8a8a8a"; ctx.fill();
    ctx.strokeStyle = "#5a5a5a"; ctx.lineWidth = 2; ctx.stroke();
    // Head
    const hx = x + f * 26, hy = y - 6;
    ctx.beginPath();
    ctx.arc(hx, hy, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#9a9a9a"; ctx.fill();
    ctx.strokeStyle = "#5a5a5a"; ctx.stroke();
    // Ear
    ctx.beginPath();
    ctx.ellipse(hx - f * 8, hy - 4, 10, 14, f * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = "#7a7a7a"; ctx.fill();
    ctx.strokeStyle = "#5a5a5a"; ctx.lineWidth = 1.5; ctx.stroke();
    // Eye
    ctx.beginPath();
    ctx.arc(hx + f * 6, hy - 3, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#222"; ctx.fill();
    ctx.beginPath();
    ctx.arc(hx + f * 6.5, hy - 3.5, 0.8, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    // Trunk
    ctx.beginPath();
    ctx.moveTo(hx + f * 12, hy + 4);
    ctx.quadraticCurveTo(hx + f * 24, hy + 2, hx + f * 22, hy + 16);
    ctx.quadraticCurveTo(hx + f * 18, hy + 22, hx + f * 14, hy + 18);
    ctx.strokeStyle = "#7a7a7a"; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = "#5a5a5a"; ctx.lineWidth = 1;
    // Legs
    const legPositions = [-14, -4, 8, 18];
    legPositions.forEach(lx => {
      ctx.beginPath();
      ctx.moveTo(x + lx, y + 14); ctx.lineTo(x + lx, y + 30);
      ctx.strokeStyle = "#6a6a6a"; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = "#555"; ctx.lineWidth = 1;
    });
    // Tail
    ctx.beginPath();
    ctx.moveTo(x - f * 26, y - 2);
    ctx.quadraticCurveTo(x - f * 38, y - 12, x - f * 36, y - 18);
    ctx.strokeStyle = "#6a6a6a"; ctx.lineWidth = 2; ctx.stroke();
    // Tusk
    ctx.beginPath();
    ctx.moveTo(hx + f * 6, hy + 8);
    ctx.quadraticCurveTo(hx + f * 16, hy + 18, hx + f * 10, hy + 22);
    ctx.strokeStyle = "#e8dcc8"; ctx.lineWidth = 2.5; ctx.stroke();
    // Label
    if (label) {
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#e1e4ed";
      ctx.textAlign = "center";
      ctx.fillText(label, x, y - 26);
      ctx.textAlign = "left";
    }
  }

  function drawPlatform(px, py, ropeOffset, w) {
    // Platform (table)
    const pw = 60, ph = 12;
    ctx.fillStyle = "#5c4a2a"; ctx.fillRect(px - pw / 2, py - ph / 2, pw, ph);
    ctx.strokeStyle = "#3a2e18"; ctx.lineWidth = 1.5;
    ctx.strokeRect(px - pw / 2, py - ph / 2, pw, ph);
    // Table legs
    ctx.fillStyle = "#4a3a20";
    ctx.fillRect(px - pw / 2 + 4, py + ph / 2, 4, 20);
    ctx.fillRect(px + pw / 2 - 8, py + ph / 2, 4, 20);
    // Food on platform
    ctx.beginPath();
    ctx.arc(px, py - 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#4ade80"; ctx.fill();
    ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = "10px sans-serif"; ctx.fillStyle = "#166534";
    ctx.textAlign = "center"; ctx.fillText("🍎", px, py + 2); ctx.textAlign = "left";
    // Rope through platform
    const ropeY = py + 2;
    ctx.beginPath();
    ctx.moveTo(px - pw / 2 - 50 + ropeOffset, ropeY);
    ctx.lineTo(px - pw / 2, ropeY);
    ctx.moveTo(px + pw / 2, ropeY);
    ctx.lineTo(px + pw / 2 + 50 - ropeOffset, ropeY);
    ctx.strokeStyle = "#ef9f27"; ctx.lineWidth = 3;
    ctx.setLineDash([6, 3]); ctx.stroke(); ctx.setLineDash([]);
    // Rope ends (the parts elephants grab)
    ctx.beginPath();
    ctx.arc(px - pw / 2 - 50 + ropeOffset, ropeY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ef9f27"; ctx.fill();
    ctx.beginPath();
    ctx.arc(px + pw / 2 + 50 - ropeOffset, ropeY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ef9f27"; ctx.fill();
  }

  function drawCoopGraph(pop) {
    const w = cw(), h = ch();
    const hist = pop.history;
    if (hist.length < 1) return;

    const gW = 220, gH = 90;
    const gx = w - gW - 20, gy = h - gH - 100;

    ctx.fillStyle = "rgba(15,17,23,0.92)";
    ctx.fillRect(gx - 12, gy - 24, gW + 24, gH + 48);
    ctx.strokeStyle = "rgba(42,45,58,0.8)"; ctx.lineWidth = 0.5;
    ctx.strokeRect(gx - 12, gy - 24, gW + 24, gH + 48);

    ctx.font = "10px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText("Success rate / trial window", gx, gy - 10);

    // Current stats
    const total = Math.max(pop.trial, 1);
    ctx.font = "11px 'JetBrains Mono', monospace"; ctx.fillStyle = "#e1e4ed";
    ctx.fillText(`${Math.round(pop.successes / total * 100)}%`, gx + gW - 30, gy - 10);

    ctx.strokeStyle = "#2a2d3a"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gH);
    ctx.lineTo(gx + gW, gy + gH); ctx.stroke();

    if (hist.length < 2) return;
    const maxT = Math.max(hist.length - 1, 1);

    // Success rate line
    ctx.beginPath();
    hist.forEach((pt, i) => {
      const px = gx + (i / maxT) * gW;
      const py = gy + gH - pt.rate * gH;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 2; ctx.stroke();

    // Dots
    hist.forEach((pt, i) => {
      const px = gx + (i / maxT) * gW;
      const py = gy + gH - pt.rate * gH;
      ctx.beginPath(); ctx.arc(px, py, pt.success ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = pt.success ? "#4ade80" : "#ef4444"; ctx.fill();
    });

    // Legend
    const ly = gy + gH + 12;
    ctx.beginPath(); ctx.arc(gx + 4, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#4ade80"; ctx.fill();
    ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText("Success", gx + 10, ly + 3);
    ctx.beginPath(); ctx.arc(gx + 70, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444"; ctx.fill();
    ctx.fillStyle = "#8b8fa3";
    ctx.fillText("Failure", gx + 76, ly + 3);
    ctx.fillText(`Trials: ${pop.trial}`, gx + 130, ly + 3);
  }

  function drawCoopPullSim(dt, key) {
    const pop = pops[key];
    if (!pop) return;
    const w = cw(), h = ch();
    const cv = AppState.getState(key).controls;
    const speed = cv.trialSpeed;
    const waitTol = cv.waitTolerance;

    ctx.fillStyle = "#0f1117"; ctx.fillRect(0, 0, w, h);

    // Ground
    ctx.fillStyle = "#1a1a14";
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    ctx.strokeStyle = "#2a2a1a"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h * 0.78); ctx.lineTo(w, h * 0.78); ctx.stroke();

    pop.phaseT += dt * speed;

    const cy = pop.platformY;
    const approachSpeed = 120 * speed;

    switch (pop.phase) {
      case "approach": {
        // Elephant A approaches steadily
        if (!pop.aArrived) {
          pop.eAx += approachSpeed * dt;
          if (pop.eAx >= pop.eATargetX) { pop.eAx = pop.eATargetX; pop.aArrived = true; }
        }
        // Elephant B delays then approaches
        if (pop.phaseT > pop.bDelay && !pop.bArrived) {
          pop.eBx -= approachSpeed * dt;
          if (pop.eBx <= pop.eBTargetX) { pop.eBx = pop.eBTargetX; pop.bArrived = true; }
        }
        // A waits at rope — if wait tolerance exceeded before B arrives, A pulls alone
        if (pop.aArrived && !pop.bArrived && pop.phaseT > pop.bDelay + waitTol + 1) {
          pop.phase = "pull_alone"; pop.phaseT = 0;
        }
        // Both arrived
        if (pop.aArrived && pop.bArrived) {
          pop.phase = "pull_together"; pop.phaseT = 0;
        }
        break;
      }
      case "pull_together": {
        pop.aPulling = true; pop.bPulling = true;
        pop.ropeOffset += 35 * speed * dt;
        if (pop.ropeOffset >= 45) {
          pop.phase = "result"; pop.phaseT = 0;
          pop.trial++;
          pop.successes++;
          pop.lastResult = "✓ Cooperation successful!";
          pop.resultTmr = 80;
          const total = Math.max(pop.trial, 1);
          pop.history.push({ trial: pop.trial, success: true, rate: pop.successes / total });
          if (pop.history.length > 30) pop.history.shift();
        }
        break;
      }
      case "pull_alone": {
        pop.aPulling = true; pop.bPulling = false;
        // Rope slips — show it wiggling
        pop.ropeOffset = Math.sin(pop.phaseT * 8) * 5;
        if (pop.phaseT > 1.5) {
          pop.phase = "result"; pop.phaseT = 0;
          pop.trial++;
          pop.failures++;
          pop.lastResult = "✕ Rope slipped — partner needed!";
          pop.resultTmr = 80;
          const total = Math.max(pop.trial, 1);
          pop.history.push({ trial: pop.trial, success: false, rate: pop.successes / total });
          if (pop.history.length > 30) pop.history.shift();
        }
        break;
      }
      case "result": {
        pop.aPulling = false; pop.bPulling = false;
        if (pop.phaseT > 2.0) {
          resetCoopPositions(key);
        }
        break;
      }
    }

    // Draw platform and rope
    drawPlatform(pop.platformX, pop.platformY, pop.ropeOffset, w);

    // Draw elephants
    drawElephant(pop.eAx, pop.eAy, 1, "Elephant A");
    drawElephant(pop.eBx, pop.eBy, -1, "Elephant B");

    // Pull indicators
    if (pop.aPulling) {
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#ef9f27"; ctx.textAlign = "center";
      ctx.fillText("← PULL", pop.eAx + 40, pop.eAy - 35);
      ctx.textAlign = "left";
    }
    if (pop.bPulling) {
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#ef9f27"; ctx.textAlign = "center";
      ctx.fillText("PULL →", pop.eBx - 40, pop.eBy - 35);
      ctx.textAlign = "left";
    }

    // Waiting indicator
    if (pop.aArrived && !pop.bArrived && pop.phase === "approach") {
      const waitTime = pop.phaseT - (pop.bDelay > pop.phaseT ? 0 : pop.phaseT - pop.bDelay);
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#ef9f27"; ctx.textAlign = "center";
      ctx.fillText("waiting for partner...", pop.eAx, pop.eAy - 40);
      ctx.textAlign = "left";
    }

    // B delay indicator
    if (!pop.bArrived && pop.phaseT < pop.bDelay && pop.phase === "approach") {
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#8b8fa3"; ctx.textAlign = "center";
      ctx.fillText("(delayed start)", pop.eBx, pop.eBy - 40);
      ctx.textAlign = "left";
    }

    // Draw graph
    drawCoopGraph(pop);

    // Result text
    if (pop.resultTmr > 0) {
      const al = Math.min(pop.resultTmr / 30, 1);
      ctx.font = "bold 16px 'JetBrains Mono', monospace";
      const isSuccess = pop.lastResult && pop.lastResult.startsWith("✓");
      ctx.fillStyle = isSuccess
        ? `rgba(74,222,128,${al})`
        : `rgba(239,68,68,${al})`;
      ctx.textAlign = "center";
      ctx.fillText(pop.lastResult, w / 2, h * 0.15);
      ctx.textAlign = "left";
      pop.resultTmr--;
    }

    // Footer
    ctx.font = "12px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText(`Cooperative Rope Pulling • Trial ${pop.trial} • Success: ${pop.successes}/${pop.trial}`, 14, h - 60);
    // Progress bar
    const phasePct = Math.min(pop.phaseT / 4, 1);
    ctx.fillStyle = "#2a2d3a"; ctx.fillRect(14, h - 50, w - 28, 3);
    ctx.fillStyle = "#ef9f27"; ctx.fillRect(14, h - 50, (w - 28) * phasePct, 3);
  }

  // === Human Pointing Simulation ===

  function drawPointingHuman(x, y, facing, pointDir) {
    // facing: 1 = toward elephant (right), -1 = away
    const f = facing;
    // Body
    ctx.strokeStyle = "#c8ccd8"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 42);
    ctx.moveTo(x, y + 42); ctx.lineTo(x - 9, y + 64);
    ctx.moveTo(x, y + 42); ctx.lineTo(x + 9, y + 64);
    ctx.stroke();
    // Arms — one pointing
    ctx.beginPath();
    ctx.moveTo(x, y + 16);
    ctx.lineTo(x - 12, y + 32); // passive arm
    ctx.stroke();
    // Pointing arm
    if (pointDir !== 0) {
      const armEndX = x + pointDir * 35;
      const armEndY = y + 10;
      ctx.beginPath();
      ctx.moveTo(x, y + 16);
      ctx.lineTo(armEndX, armEndY);
      ctx.strokeStyle = "#e1e4ed"; ctx.lineWidth = 2.5; ctx.stroke();
      // Pointing hand
      ctx.beginPath();
      ctx.arc(armEndX, armEndY, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#e1e4ed"; ctx.fill();
      // Pointing line (direction indicator)
      ctx.beginPath();
      ctx.moveTo(armEndX, armEndY);
      ctx.lineTo(armEndX + pointDir * 40, armEndY - 5);
      ctx.strokeStyle = "#ef9f27"; ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y + 16);
      ctx.lineTo(x + 12, y + 32);
      ctx.strokeStyle = "#c8ccd8"; ctx.lineWidth = 2.5; ctx.stroke();
    }
    // Head
    ctx.beginPath(); ctx.arc(x, y - 8, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#e1e4ed"; ctx.fill();
    // Face direction indicator
    const ex = x + f * 7;
    ctx.beginPath(); ctx.arc(ex, y - 9, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = "#0f1117"; ctx.fill();
    // Nose line
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x + f * 13, y - 8);
    ctx.strokeStyle = "#8b8fa3"; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function drawContainer(x, y, hasFood, chosen, correct) {
    // Container (bucket)
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 12);
    ctx.lineTo(x + 14, y - 12);
    ctx.lineTo(x + 10, y + 12);
    ctx.lineTo(x - 10, y + 12);
    ctx.closePath();
    ctx.fillStyle = chosen ? (correct ? "rgba(74,222,128,0.3)" : "rgba(239,68,68,0.3)") : "#2a2d3a";
    ctx.fill();
    ctx.strokeStyle = chosen ? (correct ? "#4ade80" : "#ef4444") : "#555";
    ctx.lineWidth = 2; ctx.stroke();
    // Food inside (if revealed)
    if (hasFood && chosen) {
      ctx.font = "14px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("🍎", x, y + 4); ctx.textAlign = "left";
    }
    // Question mark if not chosen
    if (!chosen) {
      ctx.font = "bold 14px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#555"; ctx.textAlign = "center";
      ctx.fillText("?", x, y + 4); ctx.textAlign = "left";
    }
  }

  function drawSmallElephant(x, y, facing) {
    const f = facing;
    ctx.beginPath();
    ctx.ellipse(x, y, 20, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#8a8a8a"; ctx.fill();
    ctx.strokeStyle = "#5a5a5a"; ctx.lineWidth = 1.5; ctx.stroke();
    // Head
    const hx = x + f * 18, hy = y - 4;
    ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#9a9a9a"; ctx.fill();
    ctx.strokeStyle = "#5a5a5a"; ctx.stroke();
    // Ear
    ctx.beginPath();
    ctx.ellipse(hx - f * 5, hy - 2, 7, 10, f * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = "#7a7a7a"; ctx.fill();
    ctx.strokeStyle = "#5a5a5a"; ctx.stroke();
    // Eye
    ctx.beginPath(); ctx.arc(hx + f * 4, hy - 2, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "#222"; ctx.fill();
    // Trunk
    ctx.beginPath();
    ctx.moveTo(hx + f * 8, hy + 3);
    ctx.quadraticCurveTo(hx + f * 16, hy + 1, hx + f * 14, hy + 12);
    ctx.strokeStyle = "#7a7a7a"; ctx.lineWidth = 3; ctx.stroke();
    // Legs
    [-10, -3, 5, 12].forEach(lx => {
      ctx.beginPath();
      ctx.moveTo(x + lx, y + 10); ctx.lineTo(x + lx, y + 20);
      ctx.strokeStyle = "#6a6a6a"; ctx.lineWidth = 3.5; ctx.stroke();
    });
  }

  function drawPointingGraph(pop) {
    const w = cw(), h = ch();
    const gW = 220, gH = 100;
    const gx = w - gW - 20, gy = h - gH - 100;

    ctx.fillStyle = "rgba(15,17,23,0.92)";
    ctx.fillRect(gx - 12, gy - 24, gW + 24, gH + 52);
    ctx.strokeStyle = "rgba(42,45,58,0.8)"; ctx.lineWidth = 0.5;
    ctx.strokeRect(gx - 12, gy - 24, gW + 24, gH + 52);

    ctx.font = "10px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText("Accuracy by condition", gx, gy - 10);

    // Bar chart: facing vs turned away
    const barW = 70, barH = gH - 10;
    const facingRate = pop.facingTotal ? pop.facingCorrect / pop.facingTotal : 0;
    const turnedRate = pop.turnedTotal ? pop.turnedCorrect / pop.turnedTotal : 0;

    // Facing bar
    const b1x = gx + 30;
    ctx.fillStyle = "#2a2d3a";
    ctx.fillRect(b1x, gy, barW, barH);
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(b1x, gy + barH - facingRate * barH, barW, facingRate * barH);
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1;
    ctx.strokeRect(b1x, gy, barW, barH);

    // Turned away bar
    const b2x = gx + 120;
    ctx.fillStyle = "#2a2d3a";
    ctx.fillRect(b2x, gy, barW, barH);
    ctx.fillStyle = "#ef9f27";
    ctx.fillRect(b2x, gy + barH - turnedRate * barH, barW, turnedRate * barH);
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1;
    ctx.strokeRect(b2x, gy, barW, barH);

    // Labels
    ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.textAlign = "center";
    ctx.fillText("Facing", b1x + barW / 2, gy + barH + 12);
    ctx.fillText(`${Math.round(facingRate * 100)}%`, b1x + barW / 2, gy + barH + 23);
    ctx.fillText(`(n=${pop.facingTotal})`, b1x + barW / 2, gy + barH + 33);
    ctx.fillText("Turned", b2x + barW / 2, gy + barH + 12);
    ctx.fillText(`${Math.round(turnedRate * 100)}%`, b2x + barW / 2, gy + barH + 23);
    ctx.fillText(`(n=${pop.turnedTotal})`, b2x + barW / 2, gy + barH + 33);
    ctx.textAlign = "left";

    // Y axis
    ctx.fillStyle = "#555"; ctx.font = "8px 'JetBrains Mono', monospace";
    ctx.fillText("100%", gx, gy + 6);
    ctx.fillText("50%", gx + 2, gy + barH / 2 + 3);
    // 50% line (chance level)
    ctx.beginPath();
    ctx.moveTo(gx + 28, gy + barH / 2);
    ctx.lineTo(gx + gW, gy + barH / 2);
    ctx.strokeStyle = "#555"; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#555";
    ctx.fillText("chance", gx + gW - 36, gy + barH / 2 - 4);
  }

  function drawPointingSim(dt, key) {
    const pop = pops[key];
    if (!pop) return;
    const w = cw(), h = ch();
    const cv = AppState.getState(key).controls;
    const speed = cv.trialSpeed;

    ctx.fillStyle = "#0f1117"; ctx.fillRect(0, 0, w, h);

    // Ground
    ctx.fillStyle = "#1a1a14";
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    ctx.strokeStyle = "#2a2a1a"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h * 0.78); ctx.lineTo(w, h * 0.78); ctx.stroke();

    // Scene layout
    const humanX = w * 0.35, humanY = h * 0.38;
    const contLeftX = w * 0.15, contRightX = w * 0.55;
    const contY = h * 0.55;
    const elephantStartX = w * 0.7, elephantBaseY = h * 0.52;

    pop.phaseT += dt * speed;

    const isFacing = pop.condition === "facing";
    const pointDir = pop.targetSide === "left" ? -1 : 1;

    switch (pop.phase) {
      case "setup": {
        pop.elephantX = elephantStartX;
        pop.elephantY = elephantBaseY;
        pop.targetSide = Math.random() < 0.5 ? "left" : "right";
        pop.condition = pop.trial % 2 === 0 ? "facing" : "turned_away";
        pop.chosenSide = null;
        if (pop.phaseT > 1.0) { pop.phase = "point"; pop.phaseT = 0; }
        break;
      }
      case "point": {
        // Human points, wait for elephant response
        if (pop.phaseT > 2.0) {
          pop.phase = "response"; pop.phaseT = 0;
          // Decide elephant's choice
          if (pop.condition === "facing") {
            // ~75% follow pointing when human faces them
            pop.chosenSide = Math.random() < 0.75 ? pop.targetSide : (pop.targetSide === "left" ? "right" : "left");
          } else {
            // ~45% when turned away — near chance
            pop.chosenSide = Math.random() < 0.45 ? pop.targetSide : (pop.targetSide === "left" ? "right" : "left");
          }
          pop.elephantTargetX = pop.chosenSide === "left" ? contLeftX + 40 : contRightX + 40;
        }
        break;
      }
      case "response": {
        // Elephant walks toward chosen container
        const dx = pop.elephantTargetX - pop.elephantX;
        const targetY = contY + 5;
        const dy = targetY - pop.elephantY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          pop.elephantX += (dx / dist) * 80 * speed * dt;
          pop.elephantY += (dy / dist) * 80 * speed * dt;
        } else {
          pop.phase = "result"; pop.phaseT = 0;
          pop.trial++;
          const correct = pop.chosenSide === pop.targetSide;
          if (pop.condition === "facing") {
            pop.facingTotal++;
            if (correct) pop.facingCorrect++;
          } else {
            pop.turnedTotal++;
            if (correct) pop.turnedCorrect++;
          }
          pop.lastResult = correct ? "✓ Correct container!" : "✕ Wrong container";
          pop.resultTmr = 70;
        }
        break;
      }
      case "result": {
        if (pop.phaseT > 2.5) {
          pop.phase = "setup"; pop.phaseT = 0;
        }
        break;
      }
    }

    // Condition label
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.fillStyle = isFacing ? "#4ade80" : "#ef9f27";
    ctx.textAlign = "center";
    ctx.fillText(isFacing ? "FACING CONDITION" : "TURNED-AWAY CONDITION", w * 0.35, h * 0.1);
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#8b8fa3";
    ctx.fillText(isFacing ? "Human faces elephant and points" : "Human faces away while pointing", w * 0.35, h * 0.14);
    ctx.textAlign = "left";

    // Draw containers
    const showResult = pop.phase === "result";
    drawContainer(contLeftX, contY, pop.targetSide === "left",
      showResult && pop.chosenSide === "left", showResult && pop.chosenSide === "left" && pop.targetSide === "left");
    drawContainer(contRightX, contY, pop.targetSide === "right",
      showResult && pop.chosenSide === "right", showResult && pop.chosenSide === "right" && pop.targetSide === "right");

    // Container labels
    ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.textAlign = "center";
    ctx.fillText("Container A", contLeftX, contY + 22);
    ctx.fillText("Container B", contRightX, contY + 22);
    ctx.textAlign = "left";

    // Draw human
    const humanFacing = isFacing ? 1 : -1;
    const showPointing = pop.phase === "point" || pop.phase === "response" || pop.phase === "result";
    drawPointingHuman(humanX, humanY, humanFacing, showPointing ? pointDir : 0);

    // Draw elephant
    drawSmallElephant(pop.elephantX, pop.elephantY, -1);

    // Draw graph
    drawPointingGraph(pop);

    // Result text
    if (pop.resultTmr > 0) {
      const al = Math.min(pop.resultTmr / 30, 1);
      ctx.font = "bold 16px 'JetBrains Mono', monospace";
      const isCorrect = pop.lastResult && pop.lastResult.startsWith("✓");
      ctx.fillStyle = isCorrect
        ? `rgba(74,222,128,${al})`
        : `rgba(239,68,68,${al})`;
      ctx.textAlign = "center";
      ctx.fillText(pop.lastResult, w * 0.4, h * 0.22);
      ctx.textAlign = "left";
      pop.resultTmr--;
    }

    // Footer
    ctx.font = "12px 'JetBrains Mono', monospace"; ctx.fillStyle = "#8b8fa3";
    ctx.fillText(`Human Pointing • Trial ${pop.trial} • Facing: ${pop.facingCorrect}/${pop.facingTotal} • Turned: ${pop.turnedCorrect}/${pop.turnedTotal}`, 14, h - 60);
    const phasePct = Math.min(pop.phaseT / 3, 1);
    ctx.fillStyle = "#2a2d3a"; ctx.fillRect(14, h - 50, w - 28, 3);
    ctx.fillStyle = "#9FE1CB"; ctx.fillRect(14, h - 50, (w - 28) * phasePct, 3);
  }

  // Renderer registry — maps key patterns to render functions.
  const renderers = {
    "chimps_bonobos:aggression:chimpanzees": drawAggressionSim,
    "chimps_bonobos:aggression:bonobos": drawAggressionSim,
    "chimps_bonobos:culture:normative_conformity": drawCultureSim,
    "chimps_bonobos:culture:cumulative_culture": drawCultureSim,
    "dogs_wolves:gaze_following:dogs": drawGazeSim,
    "dogs_wolves:gaze_following:wolves": drawGazeSim,
    "humans:self_domestication:humans": drawSelfDomSim,
    "elephants:theory_of_mind:cooperative_pulling": drawCoopPullSim,
    "elephants:theory_of_mind:human_pointing": drawPointingSim,
  };

  function getRenderer(key) {
    return renderers[key] || null;
  }

  return { init, start, stop, resize };
})();
