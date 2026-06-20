// Catcher game — plain JS, no dependencies, runs with file://
// Swap image paths in ASSETS to use a child's generated sprites

const ASSETS = {
  character: "assets/character_idle.png",
  falling:   "assets/collectible.png",
  background: "assets/background.png",
};

const SOUNDS = {
  catch: "assets/sounds/catch.mp3",
  miss:  "assets/sounds/miss.mp3",
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

const CATCHER_WIDTH = 80;
const CATCHER_HEIGHT = 80;
const CATCHER_SPEED = 8;
const FALL_SPEED = 4;
const SPAWN_INTERVAL = 90; // frames

const state = {
  score: 0,
  catcher: { x: W / 2 - CATCHER_WIDTH / 2, y: H - CATCHER_HEIGHT - 16 },
  fallers: [],
  frame: 0,
  keys: {},
};

const images = {};

async function loadImage(key, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images[key] = img; resolve(); };
    img.onerror = () => resolve(); // silently skip missing assets
    img.src = src;
  });
}

function playSound(key) {
  const src = SOUNDS[key];
  if (!src) return;
  try {
    new Audio(src).play();
  } catch {
    // Browser may block autoplay — that's fine
  }
}

function spawnFaller() {
  state.fallers.push({
    x: Math.random() * (W - 48),
    y: -48,
    size: 48,
  });
}

function update() {
  state.frame++;

  if (state.keys["ArrowLeft"])  state.catcher.x = Math.max(0, state.catcher.x - CATCHER_SPEED);
  if (state.keys["ArrowRight"]) state.catcher.x = Math.min(W - CATCHER_WIDTH, state.catcher.x + CATCHER_SPEED);

  if (state.frame % SPAWN_INTERVAL === 0) spawnFaller();

  for (let i = state.fallers.length - 1; i >= 0; i--) {
    const f = state.fallers[i];
    f.y += FALL_SPEED;

    const caught =
      f.y + f.size >= state.catcher.y &&
      f.x + f.size >= state.catcher.x &&
      f.x <= state.catcher.x + CATCHER_WIDTH;

    if (caught) {
      state.fallers.splice(i, 1);
      state.score++;
      document.getElementById("score-value").textContent = state.score;
      playSound("catch");
    } else if (f.y > H) {
      state.fallers.splice(i, 1);
      playSound("miss");
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
      ctx.fillStyle = "#ff6b35";
      ctx.fillRect(f.x, f.y, f.size, f.size);
    }
  }

  if (images.character) {
    ctx.drawImage(images.character, state.catcher.x, state.catcher.y, CATCHER_WIDTH, CATCHER_HEIGHT);
  } else {
    ctx.fillStyle = "#4ecdc4";
    ctx.fillRect(state.catcher.x, state.catcher.y, CATCHER_WIDTH, CATCHER_HEIGHT);
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

document.addEventListener("keydown", (e) => { state.keys[e.key] = true; });
document.addEventListener("keyup",   (e) => { state.keys[e.key] = false; });

Promise.all([
  loadImage("character", ASSETS.character),
  loadImage("falling",   ASSETS.falling),
  loadImage("background", ASSETS.background),
]).then(loop);
