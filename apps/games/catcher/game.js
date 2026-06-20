// Catcher game — plain JS, no dependencies, runs with file://
// During a session preview, sprites are loaded from localStorage by the session app.

const params  = new URLSearchParams(location.search);
const sprites = JSON.parse(localStorage.getItem("kidsproject_sprites") ?? "{}");

const ASSETS = {
  character:  sprites.idle       ?? params.get("idle")       ?? "assets/character_idle.png",
  falling:    sprites.action     ?? params.get("falling")    ?? "assets/collectible.png",
  background: sprites.background ?? params.get("background") ?? "assets/background.png",
};

const SOUND_IDS = {
  catch: params.get("sound_catch") ?? "catch",
  miss:  params.get("sound_miss")  ?? "miss",
};

const canvas = document.getElementById("game");
const ctx    = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const CATCHER_W     = 80;
const CATCHER_H     = 80;
const CATCHER_SPEED = 8;
const FALL_SPEED    = 4;
const SPAWN_EVERY   = 90; // frames

const state = {
  score:   0,
  catcher: { x: W / 2 - CATCHER_W / 2, y: H - CATCHER_H - 16 },
  fallers: [],
  frame:   0,
  keys:    {},
};

const images = {};

function loadImage(key, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => { images[key] = img; resolve(); };
    img.onerror = () => resolve(); // silently skip missing assets
    img.src = src;
  });
}

function playSound(id) {
  try { new Audio(`assets/sounds/${id}.mp3`).play(); } catch { /* autoplay blocked */ }
}

function spawnFaller() {
  state.fallers.push({ x: Math.random() * (W - 48), y: -48, size: 48 });
}

function update() {
  state.frame++;
  if (state.keys["ArrowLeft"])  state.catcher.x = Math.max(0, state.catcher.x - CATCHER_SPEED);
  if (state.keys["ArrowRight"]) state.catcher.x = Math.min(W - CATCHER_W, state.catcher.x + CATCHER_SPEED);
  if (state.frame % SPAWN_EVERY === 0) spawnFaller();

  for (let i = state.fallers.length - 1; i >= 0; i--) {
    const f = state.fallers[i];
    f.y += FALL_SPEED;
    const caught =
      f.y + f.size >= state.catcher.y &&
      f.x + f.size >= state.catcher.x &&
      f.x <= state.catcher.x + CATCHER_W;

    if (caught) {
      state.fallers.splice(i, 1);
      state.score++;
      document.getElementById("score-value").textContent = state.score;
      playSound(SOUND_IDS.catch);
    } else if (f.y > H) {
      state.fallers.splice(i, 1);
      playSound(SOUND_IDS.miss);
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  if (images.background) {
    ctx.drawImage(images.background, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#c8f0ff";
    ctx.fillRect(0, 0, W, H);
  }

  for (const f of state.fallers) {
    if (images.falling) {
      ctx.drawImage(images.falling, f.x, f.y, f.size, f.size);
    } else {
      ctx.fillStyle = "#FF6B35";
      ctx.fillRect(f.x, f.y, f.size, f.size);
    }
  }

  if (images.character) {
    ctx.drawImage(images.character, state.catcher.x, state.catcher.y, CATCHER_W, CATCHER_H);
  } else {
    ctx.fillStyle = "#4ECDC4";
    ctx.fillRect(state.catcher.x, state.catcher.y, CATCHER_W, CATCHER_H);
  }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }

document.addEventListener("keydown", (e) => { state.keys[e.key] = true;  e.preventDefault(); });
document.addEventListener("keyup",   (e) => { state.keys[e.key] = false; });

Promise.all([
  loadImage("character",  ASSETS.character),
  loadImage("falling",    ASSETS.falling),
  loadImage("background", ASSETS.background),
]).then(loop);
