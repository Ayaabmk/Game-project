'use strict';

(() => {
  // ---------------------------------------------------------------------------
  // Réglages du gameplay. Toutes les distances sont en unités "monde"
  // (le monde fait 400 de large, la hauteur s'adapte à l'écran).
  // ---------------------------------------------------------------------------
  const CFG = {
    worldW: 400,
    groundH: 90,
    gravity: 1650,
    flapVel: -480,
    maxFall: 760,
    birdX: 110,
    birdR: 17,
    pipeW: 68,
    capH: 26,
    speedStart: 155,
    speedMax: 275,
    speedPerPoint: 3.2,
    gapStart: 158,
    gapMin: 118,
    gapPerPoint: 1.4,
    spacingStart: 235,
    spacingMin: 195,
    movingFrom: 5,        // score à partir duquel des tuyaux bougent
    maxCenterJump: 210,   // écart vertical max entre deux trous consécutifs (équité)
    perfectZone: 0.15,    // fraction du trou considérée "pile au centre"
    themeEvery: 15,
  };

  const STEP = 1 / 120;

  const SKINS = [
    { name: 'Jaune', body: '#ffd54f', belly: '#fff3c4', wing: '#ffb300', unlock: 0 },
    { name: 'Tomate', body: '#ef5350', belly: '#ffcdd2', wing: '#c62828', unlock: 10 },
    { name: 'Glacier', body: '#4fc3f7', belly: '#e1f5fe', wing: '#0288d1', unlock: 25 },
    { name: 'Ninja', body: '#37474f', belly: '#90a4ae', wing: '#212121', unlock: 40 },
    { name: 'Or massif', body: '#ffca28', belly: '#fff8e1', wing: '#ff8f00', unlock: 60, shine: true },
    { name: 'Arc-en-ciel', body: 'rainbow', belly: '#ffffff', wing: '#ffffff', unlock: 100 },
  ];

  const MEDALS = [
    { min: 100, cls: 'platinum', icon: '💎', name: 'platine' },
    { min: 50, cls: 'gold', icon: '🏆', name: 'or' },
    { min: 25, cls: 'silver', icon: '🥈', name: 'argent' },
    { min: 10, cls: 'bronze', icon: '🥉', name: 'bronze' },
  ];

  const THEMES = [
    { skyTop: '#4fc3f7', skyBot: '#c8ecff', far: '#9fd8b0', near: '#6cbf6f', pipe: '#5cb85c', pipeDark: '#2e7d32', pipeLight: '#9be29b', ground: '#ded895', groundTop: '#7cc94f', stars: 0, cloud: 1 },
    { skyTop: '#ff7e5f', skyBot: '#ffd29b', far: '#c98b7a', near: '#9c5f5a', pipe: '#8e6bd6', pipeDark: '#4d2f99', pipeLight: '#c2a8ff', ground: '#e0b98a', groundTop: '#b0704f', stars: 0, cloud: 0.8 },
    { skyTop: '#0b1d3a', skyBot: '#2c5170', far: '#20405e', near: '#132a42', pipe: '#3d8fa8', pipeDark: '#1d4e60', pipeLight: '#8fd3e8', ground: '#3a4a5a', groundTop: '#56708a', stars: 1, cloud: 0.25 },
    { skyTop: '#16002b', skyBot: '#46006b', far: '#3a0a5e', near: '#22003d', pipe: '#ff2bd6', pipeDark: '#8a0073', pipeLight: '#ff9cf0', ground: '#2a0b3d', groundTop: '#00e5ff', stars: 1, cloud: 0 },
  ];

  // ---------------------------------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);

  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const mixColor = (c1, c2, t) => {
    const a = hexToRgb(c1);
    const b = hexToRgb(c2);
    return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
  };

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('floppy.' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem('floppy.' + key, JSON.stringify(value));
      } catch {
        /* stockage indisponible (navigation privée) : on ignore */
      }
    },
  };

  // ---------------------------------------------------------------------------
  // Audio : petits sons synthétisés, aucun fichier à charger.
  // ---------------------------------------------------------------------------
  const Sound = {
    ctx: null,
    muted: store.get('muted', false),
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(f1, f2, dur, type = 'square', vol = 0.1, delay = 0) {
      if (this.muted || !this.ctx) return;
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f1, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },
    noise(dur, vol = 0.3) {
      if (this.muted || !this.ctx) return;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      gain.gain.value = vol;
      src.buffer = buf;
      src.connect(filter).connect(gain).connect(this.ctx.destination);
      src.start();
    },
    flap() { this.tone(380, 760, 0.08, 'triangle', 0.12); },
    point() { this.tone(988, 988, 0.06, 'square', 0.05); this.tone(1319, 1319, 0.12, 'square', 0.05, 0.06); },
    perfect(combo) {
      const base = 660 * Math.pow(1.06, Math.min(combo, 12));
      this.tone(base, base, 0.06, 'square', 0.06);
      this.tone(base * 1.26, base * 1.26, 0.06, 'square', 0.06, 0.05);
      this.tone(base * 1.5, base * 1.5, 0.14, 'square', 0.06, 0.1);
    },
    hit() { this.noise(0.25, 0.4); this.tone(220, 55, 0.35, 'sawtooth', 0.12); },
    fall() { this.tone(600, 120, 0.45, 'triangle', 0.08, 0.1); },
    record() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.14, 'square', 0.06, i * 0.1)); },
    click() { this.tone(700, 500, 0.05, 'triangle', 0.08); },
  };

  const vibrate = (pattern) => {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch { /* ignoré */ }
    }
  };

  // ---------------------------------------------------------------------------
  // Canvas et mise à l'échelle
  // ---------------------------------------------------------------------------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = CFG.worldW;
  let H = 700;
  let groundY = H - CFG.groundH;
  let viewScale = 1;
  let dpr = 1;

  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    H = Math.round(clamp((W * vh) / vw, 620, 880));
    groundY = H - CFG.groundH;
    viewScale = Math.min(vw / W, vh / H);
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = `${Math.round(W * viewScale)}px`;
    canvas.style.height = `${Math.round(H * viewScale)}px`;
    canvas.width = Math.round(W * viewScale * dpr);
    canvas.height = Math.round(H * viewScale * dpr);
    if (state === 'menu' || state === 'ready') bird.y = H * 0.45;
  }

  // ---------------------------------------------------------------------------
  // État du jeu
  // ---------------------------------------------------------------------------
  let state = 'menu'; // menu | ready | play | dying | over | paused
  let score = 0;
  let combo = 0;
  let best = store.get('best', 0);
  let gamesPlayed = store.get('games', 0);
  let skinIndex = 0;
  const pickSkin = () => {
    skinIndex = SKINS.reduce((acc, sk, i) => (sk.unlock <= best ? i : acc), 0);
  };
  pickSkin();

  const bird = { y: 350, vy: 0, rot: 0, wing: 0, bob: 0 };
  let pipes = [];
  let particles = [];
  let popups = [];
  let clouds = [];
  let stars = [];

  let time = 0;
  let scroll = 0;          // distance parcourue (parallaxe)
  let speed = CFG.speedStart;
  let shake = 0;
  let flash = 0;
  let hitStop = 0;
  let deadTimer = 0;
  let overShownAt = 0;
  let lastCenter = null;
  let isNewBest = false;
  let prevBest = best;

  let themeFrom = 0;
  let themeTo = 0;
  let themeBlend = 1;

  function initScenery() {
    clouds = Array.from({ length: 6 }, (_, i) => ({
      x: i * 90 + rand(0, 60),
      y: rand(40, 300),
      s: rand(0.6, 1.3),
      v: rand(0.15, 0.35),
    }));
    stars = Array.from({ length: 60 }, () => ({
      x: rand(0, W),
      y: rand(0, 520),
      r: rand(0.6, 1.8),
      tw: rand(0, Math.PI * 2),
    }));
  }

  // ---------------------------------------------------------------------------
  // Difficulté : tout dépend du score au moment où le tuyau apparaît.
  // ---------------------------------------------------------------------------
  function difficulty(s) {
    const moving = s < CFG.movingFrom ? 0 : Math.min(0.65, 0.18 + (s - CFG.movingFrom) * 0.025);
    return {
      speed: Math.min(CFG.speedMax, CFG.speedStart + s * CFG.speedPerPoint),
      gap: Math.max(CFG.gapMin, CFG.gapStart - s * CFG.gapPerPoint),
      spacing: Math.max(CFG.spacingMin, CFG.spacingStart - s * 1.2),
      movingChance: moving,
      amp: Math.min(70, 22 + Math.max(0, s - CFG.movingFrom) * 1.4),
    };
  }

  function spawnPipe(x) {
    const d = difficulty(score);
    const moving = Math.random() < d.movingChance;
    const amp = moving ? d.amp : 0;
    const margin = 60;
    const minC = margin + d.gap / 2 + amp;
    const maxC = groundY - margin - d.gap / 2 - amp;
    let center = rand(minC, maxC);
    if (lastCenter !== null) {
      center = clamp(center, lastCenter - CFG.maxCenterJump, lastCenter + CFG.maxCenterJump);
      center = clamp(center, minC, maxC);
    }
    lastCenter = center;
    pipes.push({
      x,
      base: center,
      y: center,
      gap: d.gap,
      amp,
      phase: rand(0, Math.PI * 2),
      freq: rand(1.4, 2.2),
      scored: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Transitions d'état
  // ---------------------------------------------------------------------------
  const ui = {
    menu: document.getElementById('menu'),
    over: document.getElementById('over'),
    start: document.getElementById('btn-start'),
    overScore: document.getElementById('over-score'),
    overBest: document.getElementById('over-best'),
    newBest: document.getElementById('new-best'),
    medal: document.getElementById('medal'),
    retry: document.getElementById('btn-retry'),
    mute: document.getElementById('mute'),
  };

  function resetRun() {
    score = 0;
    combo = 0;
    pipes = [];
    particles = [];
    popups = [];
    lastCenter = null;
    isNewBest = false;
    speed = CFG.speedStart;
    bird.y = H * 0.45;
    bird.vy = 0;
    bird.rot = 0;
    themeFrom = themeTo = currentThemeIndex();
    themeBlend = 1;
  }

  function goReady() {
    state = 'ready';
    pickSkin();
    resetRun();
    ui.menu.classList.add('hidden');
    ui.over.classList.add('hidden');
  }

  function startPlay() {
    state = 'play';
    spawnPipe(W + 60);
    flap();
  }

  function die() {
    if (state !== 'play') return;
    state = 'dying';
    combo = 0;
    hitStop = 0.09;
    shake = 14;
    flash = 0.7;
    deadTimer = 0;
    Sound.hit();
    Sound.fall();
    vibrate([60, 40, 90]);
    burst(CFG.birdX, bird.y, 22, ['#ffffff', SKINS[skinIndex].wing === '#ffffff' ? '#ff80ab' : SKINS[skinIndex].wing], 260);
    bird.vy = Math.min(bird.vy, -150);

    gamesPlayed += 1;
    store.set('games', gamesPlayed);
    prevBest = best;
    if (score > best) {
      isNewBest = true;
      best = score;
      store.set('best', best);
    }
  }

  function showGameOver() {
    state = 'over';
    overShownAt = performance.now();
    ui.overScore.textContent = score;
    ui.overBest.textContent = best;
    ui.newBest.classList.toggle('hidden', !isNewBest);

    const medal = MEDALS.find((m) => score >= m.min);
    ui.medal.className = 'medal' + (medal ? ' ' + medal.cls : '');
    ui.medal.textContent = medal ? medal.icon : '';
    ui.medal.title = medal ? `Médaille ${medal.name}` : 'Pas de médaille';

    ui.over.classList.remove('hidden');

    if (isNewBest) {
      Sound.record();
      for (let i = 0; i < 4; i++) burst(rand(60, W - 60), rand(80, 260), 18, confettiColors, 320);
    }
  }

  const confettiColors = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb'];

  // ---------------------------------------------------------------------------
  // Actions joueur
  // ---------------------------------------------------------------------------
  function flap() {
    bird.vy = CFG.flapVel;
    bird.wing = 1;
    Sound.flap();
    for (let i = 0; i < 4; i++) {
      particles.push({
        x: CFG.birdX - 10,
        y: bird.y + 6,
        vx: rand(-120, -60),
        vy: rand(20, 90),
        life: 0.35,
        max: 0.35,
        size: rand(2, 4),
        color: 'rgba(255,255,255,0.9)',
        g: 0,
      });
    }
  }

  function onPress() {
    Sound.unlock();
    switch (state) {
      case 'menu':
        Sound.click();
        goReady();
        break;
      case 'ready':
        startPlay();
        break;
      case 'play':
        flap();
        break;
      case 'paused':
        state = 'play';
        flap();
        break;
      case 'over':
        // Petite sécurité pour ne pas relancer par erreur en tapotant.
        if (performance.now() - overShownAt > 550) goReady();
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Particules et textes flottants
  // ---------------------------------------------------------------------------
  function burst(x, y, n, colors, force) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const f = rand(force * 0.3, force);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * f,
        vy: Math.sin(a) * f - 80,
        life: rand(0.5, 1.1),
        max: 1.1,
        size: rand(3, 6),
        color: colors[i % colors.length],
        g: 700,
      });
    }
  }

  function popup(text, color, size = 26) {
    popups.push({ text, color, size, x: CFG.birdX + 40, y: bird.y - 30, life: 0.9 });
  }

  // ---------------------------------------------------------------------------
  // Mise à jour (pas fixe)
  // ---------------------------------------------------------------------------
  function currentThemeIndex() {
    return Math.floor(score / CFG.themeEvery) % THEMES.length;
  }

  function onScore(pipe) {
    const off = Math.abs(bird.y - pipe.y);
    const perfect = off < pipe.gap * CFG.perfectZone;
    let gained = 1;
    if (perfect) {
      combo += 1;
      gained += Math.min(combo, 5);
      Sound.perfect(combo);
      vibrate(15);
      burst(CFG.birdX, bird.y, 10, ['#fff59d', '#ffffff'], 180);
      popup(combo > 1 ? `PARFAIT x${combo}` : 'PARFAIT', '#fff176', combo > 1 ? 28 : 24);
    } else {
      combo = 0;
      Sound.point();
    }
    score += gained;
    if (gained > 1) popups.push({ text: `+${gained}`, color: '#ffffff', size: 20, x: CFG.birdX + 40, y: bird.y + 4, life: 0.8 });

    const ti = currentThemeIndex();
    if (ti !== themeTo) {
      themeFrom = themeTo;
      themeTo = ti;
      themeBlend = 0;
    }
  }

  function update(dt) {
    time += dt;

    if (themeBlend < 1) themeBlend = Math.min(1, themeBlend + dt / 1.5);
    if (flash > 0) flash = Math.max(0, flash - dt * 2.5);
    if (shake > 0) shake = Math.max(0, shake - dt * 50);
    bird.wing = Math.max(0, bird.wing - dt * 6);

    const scrolling = state === 'menu' || state === 'ready' || state === 'play';
    if (scrolling) {
      if (state === 'play') speed = difficulty(score).speed;
      scroll += speed * dt;
      for (const c of clouds) {
        c.x -= speed * c.v * dt;
        if (c.x < -120) {
          c.x = W + rand(20, 120);
          c.y = rand(40, 300);
        }
      }
    }

    if (state === 'menu' || state === 'ready') {
      bird.bob += dt * 4;
      bird.y = H * 0.45 + Math.sin(bird.bob) * 10;
      bird.rot = 0;
      if (Math.sin(bird.bob * 2.2) > 0.6) bird.wing = 1;
    } else if (state === 'play') {
      updateBird(dt);
      updatePipes(dt);
      checkCollisions();
    } else if (state === 'dying') {
      bird.vy = Math.min(CFG.maxFall * 1.3, bird.vy + CFG.gravity * dt);
      bird.y += bird.vy * dt;
      bird.rot = lerp(bird.rot, Math.PI / 2, dt * 6);
      if (bird.y + CFG.birdR >= groundY) {
        bird.y = groundY - CFG.birdR;
        deadTimer += dt;
        if (deadTimer > 0.45) showGameOver();
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.life -= dt;
      p.y -= 40 * dt;
      if (p.life <= 0) popups.splice(i, 1);
    }
  }

  function updateBird(dt) {
    bird.vy = Math.min(CFG.maxFall, bird.vy + CFG.gravity * dt);
    bird.y += bird.vy * dt;
    if (bird.y < -40) {
      bird.y = -40;
      bird.vy = 0;
    }
    const target = bird.vy < 0 ? -0.42 : Math.min(1.35, (bird.vy / CFG.maxFall) * 1.6);
    bird.rot = lerp(bird.rot, target, Math.min(1, dt * (bird.vy < 0 ? 18 : 5)));
  }

  function updatePipes(dt) {
    for (const p of pipes) {
      p.x -= speed * dt;
      if (p.amp) {
        p.phase += p.freq * dt;
        p.y = p.base + Math.sin(p.phase) * p.amp;
      }
      if (!p.scored && p.x + CFG.pipeW / 2 < CFG.birdX) {
        p.scored = true;
        onScore(p);
      }
    }
    if (pipes.length && pipes[0].x < -CFG.pipeW - 20) pipes.shift();
    const last = pipes[pipes.length - 1];
    if (!last || last.x < W - difficulty(score).spacing) spawnPipe((last ? last.x : W) + difficulty(score).spacing);
  }

  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function checkCollisions() {
    const r = CFG.birdR;
    if (bird.y + r >= groundY) {
      bird.y = groundY - r;
      die();
      return;
    }
    for (const p of pipes) {
      if (p.x > CFG.birdX + r || p.x + CFG.pipeW < CFG.birdX - r) continue;
      const top = p.y - p.gap / 2;
      const bottom = p.y + p.gap / 2;
      if (
        circleRect(CFG.birdX, bird.y, r, p.x, -2000, CFG.pipeW, top + 2000) ||
        circleRect(CFG.birdX, bird.y, r, p.x, bottom, CFG.pipeW, groundY - bottom)
      ) {
        die();
        return;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------
  function themeColor(key) {
    const a = THEMES[themeFrom][key];
    const b = THEMES[themeTo][key];
    if (typeof a === 'number') return lerp(a, b, themeBlend);
    return themeBlend >= 1 ? b : mixColor(a, b, themeBlend);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, themeColor('skyTop'));
    g.addColorStop(1, themeColor('skyBot'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const starAlpha = themeColor('stars');
    if (starAlpha > 0.01) {
      for (const s of stars) {
        ctx.globalAlpha = starAlpha * (0.5 + 0.5 * Math.sin(time * 2 + s.tw));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
    }

    const cloudAlpha = themeColor('cloud');
    if (cloudAlpha > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${0.85 * cloudAlpha})`;
      for (const c of clouds) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 22 * c.s, 0, Math.PI * 2);
        ctx.arc(c.x + 24 * c.s, c.y - 10 * c.s, 26 * c.s, 0, Math.PI * 2);
        ctx.arc(c.x + 50 * c.s, c.y, 20 * c.s, 0, Math.PI * 2);
        ctx.rect(c.x, c.y, 50 * c.s, 20 * c.s);
        ctx.fill();
      }
    }

    drawHills(themeColor('far'), 0.2, groundY - 150, 40, 0.012, 0.031);
    drawHills(themeColor('near'), 0.45, groundY - 70, 28, 0.02, 0.047);
  }

  function drawHills(color, parallax, base, amp, k1, k2) {
    const off = scroll * parallax;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (let x = 0; x <= W; x += 8) {
      const wx = x + off;
      ctx.lineTo(x, base - Math.sin(wx * k1) * amp - Math.sin(wx * k2 + 1.3) * amp * 0.45);
    }
    ctx.lineTo(W, groundY);
    ctx.closePath();
    ctx.fill();
  }

  function drawPipe(p) {
    const top = p.y - p.gap / 2;
    const bottom = p.y + p.gap / 2;
    const w = CFG.pipeW;
    const cap = CFG.capH;
    const body = themeColor('pipe');
    const dark = themeColor('pipeDark');
    const light = themeColor('pipeLight');

    const part = (x, y, pw, ph) => {
      if (ph <= 0) return;
      ctx.fillStyle = body;
      ctx.fillRect(x, y, pw, ph);
      ctx.fillStyle = light;
      ctx.fillRect(x + 6, y, 8, ph);
      ctx.fillStyle = dark;
      ctx.fillRect(x + pw - 12, y, 12, ph);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y, pw - 3, ph);
    };

    part(p.x, -10, w, top - cap + 10);
    part(p.x, bottom + cap, w, groundY - bottom - cap);

    const capPart = (y) => {
      roundRect(p.x - 5, y, w + 10, cap, 5);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.fillStyle = light;
      ctx.fillRect(p.x + 2, y + 4, 8, cap - 8);
      ctx.lineWidth = 3;
      ctx.strokeStyle = dark;
      roundRect(p.x - 5, y, w + 10, cap, 5);
      ctx.stroke();
    };
    capPart(top - cap);
    capPart(bottom);

    if (p.amp) {
      // Petites flèches pour signaler un tuyau mobile.
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      const cx = p.x + w / 2;
      for (const [y, dir] of [[top - cap - 12, -1], [bottom + cap + 12, 1]]) {
        ctx.beginPath();
        ctx.moveTo(cx - 7, y);
        ctx.lineTo(cx + 7, y);
        ctx.lineTo(cx, y + dir * 9);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawGround() {
    ctx.fillStyle = themeColor('ground');
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = themeColor('groundTop');
    ctx.fillRect(0, groundY, W, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    const off = scroll % 28;
    for (let x = -off - 28; x < W + 28; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, groundY + 16);
      ctx.lineTo(x + 14, groundY + 16);
      ctx.lineTo(x + 4, groundY + 28);
      ctx.lineTo(x - 10, groundY + 28);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, groundY, W, 3);
  }

  function drawBird() {
    const skin = SKINS[skinIndex];
    const rainbow = skin.body === 'rainbow';
    const body = rainbow ? `hsl(${(time * 160) % 360},90%,60%)` : skin.body;
    const wing = rainbow ? `hsl(${(time * 160 + 120) % 360},90%,70%)` : skin.wing;

    ctx.save();
    if (state === 'menu') {
      ctx.translate(W / 2, bird.y);
      ctx.scale(2.2, 2.2);
    } else {
      ctx.translate(CFG.birdX, bird.y);
      ctx.scale(CFG.birdR / 13, CFG.birdR / 13);
    }
    ctx.rotate(bird.rot);

    // corps
    ctx.fillStyle = body;
    ctx.strokeStyle = '#3b2a00';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // ventre
    ctx.fillStyle = skin.belly;
    ctx.beginPath();
    ctx.ellipse(-2, 6, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    if (skin.shine) {
      ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(time * 6)})`;
      ctx.beginPath();
      ctx.ellipse(-6, -7, 5, 2.5, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // oeil
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(7, -5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(state === 'dying' || state === 'over' ? 8 : 9, -5, 2.6, 0, Math.PI * 2);
    ctx.fill();
    if (state === 'dying' || state === 'over') {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, -9); ctx.lineTo(11, -1);
      ctx.moveTo(11, -9); ctx.lineTo(4, -1);
      ctx.stroke();
      ctx.strokeStyle = '#3b2a00';
      ctx.lineWidth = 2.5;
    }

    // bec
    ctx.fillStyle = '#ff7043';
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(25, 3);
    ctx.lineTo(13, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // aile (battement)
    const flapAngle = bird.wing > 0 ? -0.9 * bird.wing : 0.25 * Math.sin(time * 10);
    ctx.save();
    ctx.translate(-6, 2);
    ctx.rotate(flapAngle);
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.ellipse(-3, 0, 10, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  function drawText(text, x, y, size, color, align = 'center', stroke = '#2b1a00') {
    ctx.font = `900 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size / 6);
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawHud() {
    if (state === 'play' || state === 'dying' || state === 'paused') {
      drawText(String(score), W / 2, 80, 64, '#ffffff');
      if (combo > 1 && state === 'play') drawText(`COMBO x${combo}`, W / 2, 128, 20, '#fff176');
    }
    if (state === 'ready') {
      const y = H * 0.62 + Math.sin(time * 8) * 6;
      drawText('', W / 2, y, 44, '#ffffff', 'center', 'rgba(0,0,0,0)');
    }
    if (state === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
      drawText('❚❚', W / 2, H * 0.45, 64, '#ffffff');
    }
  }

  function render() {
    ctx.setTransform(viewScale * dpr, 0, 0, viewScale * dpr, 0, 0);
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);

    drawBackground();
    for (const p of pipes) drawPipe(p);
    drawGround();

    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    drawBird();

    for (const p of popups) {
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      drawText(p.text, p.center ? p.x : clamp(p.x, 70, W - 70), p.y, p.size, p.color);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
    drawHud();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------------------------------------------------------------------------
  // Boucle principale (pas fixe => même physique à 60 Hz ou 120 Hz)
  // ---------------------------------------------------------------------------
  let lastFrame = performance.now();
  let acc = 0;

  function frame(now) {
    let dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (hitStop > 0) {
      hitStop -= dt;
      dt = 0;
    }
    if (state !== 'paused') {
      acc += dt;
      while (acc >= STEP) {
        update(STEP);
        acc -= STEP;
      }
    }
    render();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Menu : sélection d'oiseau
  // ---------------------------------------------------------------------------
  function refreshMute() {
    ui.mute.textContent = Sound.muted ? '🔇' : '🔊';
    ui.mute.setAttribute('aria-label', Sound.muted ? 'Activer le son' : 'Couper le son');
  }

  // ---------------------------------------------------------------------------
  // Entrées
  // ---------------------------------------------------------------------------
  const stop = (e) => e.stopPropagation();

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onPress();
  });

  ui.menu.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    onPress();
  });

  ui.start.addEventListener('click', () => {
    if (state === 'menu') onPress();
  });

  ui.over.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    onPress();
  });


  ui.retry.addEventListener('click', () => {
    Sound.unlock();
    Sound.click();
    goReady();
  });

  ui.mute.addEventListener('pointerdown', stop);
  ui.mute.addEventListener('click', () => {
    Sound.muted = !Sound.muted;
    store.set('muted', Sound.muted);
    refreshMute();
    Sound.unlock();
    Sound.click();
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') {
      e.preventDefault();
      onPress();
    } else if (e.code === 'KeyM') {
      ui.mute.click();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'play') state = 'paused';
  });
  window.addEventListener('blur', () => {
    if (state === 'play') state = 'paused';
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  // ---------------------------------------------------------------------------
  // Démarrage
  // ---------------------------------------------------------------------------
  initScenery();
  resize();
  resetRun();
  refreshMute();
  requestAnimationFrame((t) => {
    lastFrame = t;
    frame(t);
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  // Petit accès pour les tests automatisés.
  window.__floppy = {
    get state() { return state; },
    get score() { return score; },
    get bird() { return bird; },
    get pipes() { return pipes; },
    press: onPress,
  };
})();
