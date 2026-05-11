const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const touchLeft = document.getElementById("touchLeft");
const touchRight = document.getElementById("touchRight");

const BASE_W = 900;
const BASE_H = 600;
const LANES = [0.19, 0.32, 0.45, 0.58, 0.71, 0.84];
const FREQUENCIES = [
  { name: "cyan", fill: "#58e8e0", glow: "#b5fff7" },
  { name: "amber", fill: "#ffd166", glow: "#fff0a8" },
  { name: "violet", fill: "#b58cff", glow: "#eadcff" }
];

const keys = Object.create(null);
let audioCtx = null;
let muted = false;
let lastTime = 0;

const state = {
  mode: "title",
  score: 0,
  highScore: Number(localStorage.getItem("lumenRelayHighScore") || 0),
  lives: 3,
  level: 1,
  time: 0,
  levelClock: 0,
  spawnClock: 0,
  spawnDelay: 1.05,
  target: 0,
  combo: 0,
  relay: 0,
  sweep: 0,
  shake: 0,
  flash: 0,
  fade: 1,
  message: "Press Space",
  objects: [],
  particles: [],
  labels: [],
  stars: [],
  player: {
    x: BASE_W * 0.5,
    y: BASE_H - 76,
    width: 118,
    height: 34,
    vx: 0,
    tilt: 0
  }
};

function random(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resetStars() {
  state.stars = [];
  for (let i = 0; i < 84; i += 1) {
    state.stars.push({
      x: Math.random() * BASE_W,
      y: Math.random() * BASE_H,
      r: random(0.7, 2.1),
      speed: random(7, 22),
      phase: Math.random() * Math.PI * 2
    });
  }
}

function startGame() {
  state.mode = "play";
  state.score = 0;
  state.lives = 3;
  state.level = 1;
  state.time = 0;
  state.levelClock = 0;
  state.spawnClock = 0.45;
  state.spawnDelay = 1.05;
  state.target = 0;
  state.combo = 0;
  state.relay = 0;
  state.sweep = 0;
  state.shake = 0;
  state.flash = 0;
  state.fade = 1;
  state.message = "";
  state.objects = [];
  state.particles = [];
  state.labels = [];
  state.player.x = BASE_W * 0.5;
  spawnObject(true);
}

function endGame() {
  state.mode = "gameover";
  state.message = "Relay Broken";
  state.highScore = Math.max(state.highScore, state.score);
  localStorage.setItem("lumenRelayHighScore", String(state.highScore));
}

function togglePause() {
  if (state.mode === "play") {
    state.mode = "pause";
    state.message = "Paused";
  } else if (state.mode === "pause") {
    state.mode = "play";
    state.message = "";
  }
}

function playTone(freq, length, type = "sine", volume = 0.035) {
  if (muted) return;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.frequency.value = freq;
  osc.type = type;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + length);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + length);
}

function spawnObject(forceSignal = false) {
  const lane = LANES[Math.floor(Math.random() * LANES.length)];
  const isStatic = !forceSignal && Math.random() < clamp(0.22 + state.level * 0.025, 0.22, 0.42);
  const isCharge = !isStatic && !forceSignal && Math.random() < 0.09;
  const freq = Math.floor(Math.random() * FREQUENCIES.length);
  const radius = isStatic ? random(18, 24) : isCharge ? 23 : random(16, 22);
  state.objects.push({
    x: lane * BASE_W + random(-18, 18),
    y: -40,
    r: radius,
    type: isStatic ? "static" : isCharge ? "charge" : "signal",
    freq,
    speed: random(96, 136) + state.level * 12,
    drift: random(-24, 24),
    spin: random(-2.4, 2.4),
    angle: random(0, Math.PI * 2),
    pulse: random(0, Math.PI * 2),
    caught: false
  });
}

function loseLife(reason, x, y) {
  state.lives -= 1;
  state.combo = 0;
  state.shake = 0.42;
  state.flash = 0.38;
  addLabel(reason, x, y, "#ff8fa3");
  burst(x, y, "#ff6b81", 18, 1.1);
  playTone(130, 0.18, "sawtooth", 0.025);
  if (state.lives <= 0) {
    endGame();
  }
}

function scoreSignal(obj) {
  const match = obj.freq === state.target;
  const points = obj.type === "charge" ? 25 : match ? 15 + Math.min(state.combo, 8) * 2 : 6;
  state.score += points;
  state.combo = match || obj.type === "charge" ? state.combo + 1 : 0;
  state.relay = clamp(state.relay + (obj.type === "charge" ? 34 : match ? 18 : 7), 0, 100);
  addLabel(`+${points}`, obj.x, obj.y, match ? FREQUENCIES[obj.freq].glow : "#f3f0e8");
  burst(obj.x, obj.y, obj.type === "charge" ? "#ffffff" : FREQUENCIES[obj.freq].fill, obj.type === "charge" ? 30 : 18, 0.8);
  playTone(match ? 520 + obj.freq * 110 : 260, 0.11, "triangle", 0.03);

  if (state.relay >= 100) {
    state.relay = 0;
    state.sweep = 0.75;
    state.target = (state.target + 1) % FREQUENCIES.length;
    addLabel("SWEEP", BASE_W * 0.5, BASE_H * 0.28, "#ffffff", 30);
    burst(BASE_W * 0.5, BASE_H * 0.48, "#c7fff8", 52, 1.35);
    state.objects = state.objects.filter((item) => item.type !== "static");
    playTone(720, 0.22, "sine", 0.045);
  }
}

function addLabel(text, x, y, color, size = 22) {
  state.labels.push({ text, x, y, color, size, life: 1, maxLife: 1 });
}

function burst(x, y, color, count, power) {
  for (let i = 0; i < count; i += 1) {
    const a = random(0, Math.PI * 2);
    const s = random(65, 190) * power;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - random(10, 60),
      r: random(2, 5),
      color,
      life: random(0.45, 0.9),
      maxLife: 0.9
    });
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update(dt) {
  state.fade = Math.max(0, state.fade - dt * 1.7);
  if (state.mode !== "play") return;

  state.time += dt;
  state.levelClock += dt;
  state.spawnClock -= dt;
  state.shake = Math.max(0, state.shake - dt);
  state.flash = Math.max(0, state.flash - dt);
  state.sweep = Math.max(0, state.sweep - dt);

  if (state.levelClock >= 24) {
    state.levelClock = 0;
    state.level += 1;
    state.spawnDelay = Math.max(0.42, state.spawnDelay * 0.88);
    state.target = (state.target + 1) % FREQUENCIES.length;
    addLabel(`LEVEL ${state.level}`, BASE_W * 0.5, BASE_H * 0.22, "#ffffff", 28);
  }

  if (state.spawnClock <= 0) {
    spawnObject();
    state.spawnClock = random(state.spawnDelay * 0.72, state.spawnDelay * 1.15);
  }

  const left = keys.ArrowLeft || keys.KeyA;
  const right = keys.ArrowRight || keys.KeyD;
  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  const accel = 1500;
  const friction = Math.pow(0.001, dt);
  state.player.vx += dir * accel * dt;
  state.player.vx *= dir ? 0.94 : friction;
  state.player.vx = clamp(state.player.vx, -430, 430);
  state.player.x = clamp(state.player.x + state.player.vx * dt, 72, BASE_W - 72);
  state.player.tilt += ((state.player.vx / 430) * 0.24 - state.player.tilt) * clamp(dt * 9, 0, 1);

  const catchBox = {
    x: state.player.x - state.player.width * 0.48,
    y: state.player.y - 12,
    w: state.player.width * 0.96,
    h: state.player.height + 18
  };

  for (const obj of state.objects) {
    obj.y += obj.speed * dt;
    obj.x += Math.sin(state.time * 1.6 + obj.pulse) * obj.drift * dt;
    obj.angle += obj.spin * dt;
    const box = { x: obj.x - obj.r, y: obj.y - obj.r, w: obj.r * 2, h: obj.r * 2 };
    if (rectsOverlap(catchBox, box)) {
      obj.caught = true;
      if (obj.type === "static") {
        loseLife("-1", obj.x, obj.y);
      } else {
        scoreSignal(obj);
      }
    } else if (obj.y > BASE_H + 45) {
      obj.caught = true;
      if (obj.type === "signal" && obj.freq === state.target) {
        loseLife("miss", obj.x, BASE_H - 42);
      }
    }
  }

  state.objects = state.objects.filter((obj) => !obj.caught);

  for (const p of state.particles) {
    p.life -= dt;
    p.vy += 270 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  for (const label of state.labels) {
    label.life -= dt;
    label.y -= 38 * dt;
  }
  state.labels = state.labels.filter((label) => label.life > 0);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, BASE_H);
  const shift = Math.min(state.level * 0.025, 0.22);
  gradient.addColorStop(0, `hsl(${220 + shift * 80}, 42%, 12%)`);
  gradient.addColorStop(0.55, "#171827");
  gradient.addColorStop(1, "#241923");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  for (const star of state.stars) {
    const y = (star.y + state.time * star.speed) % BASE_H;
    const alpha = 0.35 + Math.sin(state.time * 2 + star.phase) * 0.18;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#f8fbff";
    ctx.beginPath();
    ctx.arc(star.x, y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(-(state.time * 18) % 260, 0);
  for (let x = -260; x < BASE_W + 260; x += 260) {
    drawNebulaBand(x, 88, 0.34);
    drawNebulaBand(x + 90, 178, 0.2);
  }
  ctx.restore();

  ctx.save();
  ctx.translate(-(state.time * 44) % 180, 0);
  for (let x = -180; x < BASE_W + 180; x += 180) {
    ctx.strokeStyle = "rgba(110, 231, 216, 0.13)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, BASE_H - 118);
    ctx.lineTo(x + 65, BASE_H - 146);
    ctx.lineTo(x + 128, BASE_H - 112);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNebulaBand(x, y, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#6ee7d8";
  ctx.beginPath();
  ctx.ellipse(x + 45, y, 62, 18, 0.15, 0, Math.PI * 2);
  ctx.ellipse(x + 96, y + 9, 72, 22, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHud() {
  ctx.save();
  ctx.fillStyle = "rgba(8, 9, 14, 0.55)";
  ctx.fillRect(18, 16, BASE_W - 36, 58);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.strokeRect(18, 16, BASE_W - 36, 58);

  ctx.fillStyle = "#f3f0e8";
  ctx.font = "700 22px Arial";
  ctx.fillText(`Score ${state.score}`, 38, 52);
  ctx.font = "16px Arial";
  ctx.fillStyle = "#b8b4a8";
  ctx.fillText(`Best ${state.highScore}`, 164, 52);
  ctx.fillText(`Level ${state.level}`, 276, 52);

  for (let i = 0; i < 3; i += 1) {
    drawLife(BASE_W - 190 + i * 30, 45, i < state.lives);
  }

  const freq = FREQUENCIES[state.target];
  ctx.fillStyle = "#b8b4a8";
  ctx.fillText("Frequency", BASE_W - 350, 39);
  ctx.fillStyle = freq.fill;
  ctx.shadowColor = freq.glow;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(BASE_W - 265, 45, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.strokeRect(BASE_W - 145, 35, 88, 14);
  ctx.fillStyle = "#6ee7d8";
  ctx.fillRect(BASE_W - 145, 35, 88 * (state.relay / 100), 14);
  ctx.fillStyle = "#b8b4a8";
  ctx.font = "12px Arial";
  ctx.fillText("Relay", BASE_W - 145, 28);
  ctx.restore();
}

function drawLife(x, y, on) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = on ? "#ff6b81" : "rgba(255, 255, 255, 0.17)";
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.bezierCurveTo(-18, -4, -5, -18, 0, -6);
  ctx.bezierCurveTo(5, -18, 18, -4, 0, 10);
  ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.tilt);
  ctx.shadowColor = "#6ee7d8";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#17232b";
  ctx.strokeStyle = "#b5fff7";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-p.width * 0.48, -3);
  ctx.quadraticCurveTo(0, 32, p.width * 0.48, -3);
  ctx.lineTo(p.width * 0.36, -18);
  ctx.quadraticCurveTo(0, 3, -p.width * 0.36, -18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = FREQUENCIES[state.target].fill;
  ctx.beginPath();
  ctx.ellipse(0, -12, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawObject(obj) {
  const depthScale = 0.82 + clamp(obj.y / BASE_H, 0, 1) * 0.38;
  ctx.save();
  ctx.translate(obj.x, obj.y);
  ctx.rotate(obj.angle);
  ctx.scale(depthScale, depthScale);

  if (obj.type === "static") {
    ctx.shadowColor = "#ff6b81";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "#ff8fa3";
    ctx.fillStyle = "rgba(255, 64, 102, 0.22)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const r = i % 2 ? obj.r * 0.55 : obj.r;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    const freq = FREQUENCIES[obj.freq];
    ctx.shadowColor = obj.type === "charge" ? "#ffffff" : freq.glow;
    ctx.shadowBlur = obj.type === "charge" ? 24 : 15;
    ctx.fillStyle = obj.type === "charge" ? "#ffffff" : freq.fill;
    ctx.strokeStyle = "#101015";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -obj.r);
    ctx.lineTo(obj.r * 0.78, -obj.r * 0.1);
    ctx.lineTo(obj.r * 0.38, obj.r);
    ctx.lineTo(-obj.r * 0.52, obj.r * 0.82);
    ctx.lineTo(-obj.r * 0.86, -obj.r * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.62)";
    ctx.beginPath();
    ctx.moveTo(0, -obj.r);
    ctx.lineTo(0, obj.r * 0.82);
    ctx.moveTo(-obj.r * 0.7, -obj.r * 0.08);
    ctx.lineTo(obj.r * 0.74, -obj.r * 0.08);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawLabels() {
  for (const label of state.labels) {
    ctx.save();
    ctx.globalAlpha = clamp(label.life / label.maxLife, 0, 1);
    ctx.fillStyle = label.color;
    ctx.shadowColor = label.color;
    ctx.shadowBlur = 14;
    ctx.font = `700 ${label.size}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText(label.text, label.x, label.y);
    ctx.restore();
  }
}

function drawSweep() {
  if (state.sweep <= 0) return;
  const a = state.sweep / 0.75;
  ctx.save();
  ctx.globalAlpha = a * 0.55;
  ctx.fillStyle = "#c7fff8";
  ctx.beginPath();
  ctx.ellipse(BASE_W * 0.5, BASE_H * 0.5, (1 - a) * 640 + 80, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOverlay() {
  if (state.mode === "play") return;
  ctx.save();
  ctx.fillStyle = "rgba(8, 9, 14, 0.68)";
  ctx.fillRect(0, 0, BASE_W, BASE_H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f3f0e8";
  ctx.font = "700 54px Arial";
  ctx.fillText("Lumen Relay", BASE_W * 0.5, BASE_H * 0.37);
  ctx.font = "700 24px Arial";
  ctx.fillStyle = "#6ee7d8";
  ctx.fillText(state.message, BASE_W * 0.5, BASE_H * 0.47);
  ctx.font = "18px Arial";
  ctx.fillStyle = "#d7d2c8";
  const line = state.mode === "gameover"
    ? `Final score ${state.score}. Press Space to play again.`
    : "Move continuously, match the active frequency, and charge the relay sweep.";
  ctx.fillText(line, BASE_W * 0.5, BASE_H * 0.55);
  ctx.fillText("A/D or Arrow Keys - Space - P - M", BASE_W * 0.5, BASE_H * 0.62);
  ctx.restore();
}

function render() {
  ctx.save();
  ctx.clearRect(0, 0, BASE_W, BASE_H);

  if (state.shake > 0) {
    const amount = state.shake * 12;
    ctx.translate(random(-amount, amount), random(-amount, amount));
  }

  drawBackground();
  drawSweep();
  for (const obj of state.objects) drawObject(obj);
  drawPlayer();
  drawParticles();
  drawLabels();
  drawHud();

  if (state.flash > 0) {
    ctx.globalAlpha = state.flash * 1.8;
    ctx.fillStyle = "#ff6b81";
    ctx.fillRect(0, 0, BASE_W, BASE_H);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  if (state.fade > 0) {
    ctx.save();
    ctx.globalAlpha = state.fade;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, BASE_W, BASE_H);
    ctx.restore();
  }

  drawOverlay();
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function handleAction(code) {
  if (code === "Space" || code === "Enter") {
    if (state.mode === "title" || state.mode === "gameover") startGame();
  }
  if (code === "KeyP" || code === "Escape") togglePause();
  if (code === "KeyM") muted = !muted;
}

window.addEventListener("keydown", (event) => {
  keys[event.code] = true;
  if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  handleAction(event.code);
});

window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

function bindTouch(button, code) {
  const down = (event) => {
    event.preventDefault();
    keys[code] = true;
    if (state.mode === "title" || state.mode === "gameover") startGame();
  };
  const up = (event) => {
    event.preventDefault();
    keys[code] = false;
  };
  button.addEventListener("pointerdown", down);
  button.addEventListener("pointerup", up);
  button.addEventListener("pointercancel", up);
  button.addEventListener("pointerleave", up);
}

bindTouch(touchLeft, "ArrowLeft");
bindTouch(touchRight, "ArrowRight");
resetStars();
if (new URLSearchParams(window.location.search).has("demo")) {
  startGame();
  state.score = 45;
  state.combo = 3;
  state.relay = 62;
  state.objects.push(
    { x: BASE_W * 0.28, y: 155, r: 22, type: "signal", freq: 0, speed: 122, drift: 8, spin: 1.4, angle: 0.4, pulse: 0, caught: false },
    { x: BASE_W * 0.52, y: 245, r: 20, type: "static", freq: 1, speed: 130, drift: -10, spin: -1.8, angle: 0.1, pulse: 2, caught: false },
    { x: BASE_W * 0.72, y: 105, r: 23, type: "charge", freq: 2, speed: 116, drift: 12, spin: 1.1, angle: 0.8, pulse: 4, caught: false }
  );
  burst(BASE_W * 0.38, BASE_H * 0.52, FREQUENCIES[0].fill, 20, 0.65);
}
requestAnimationFrame(frame);
