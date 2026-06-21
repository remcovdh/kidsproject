// Catcher game — plain JS, no dependencies, runs with file://
// Sprites loaded from localStorage when embedded in the session app.

const spriteConfig = JSON.parse(localStorage.getItem("kidsproject_sprites") ?? "{}");
const params = new URLSearchParams(location.search);

const ASSETS = {
  character_idle:      spriteConfig.idle        ?? params.get("idle")        ?? "assets/character_idle.png",
  character_move:      spriteConfig.move        ?? params.get("move")        ?? "assets/character_idle.png",
  character_action:    spriteConfig.action      ?? params.get("action")      ?? "assets/character_idle.png",
  character_celebrate: spriteConfig.celebrate   ?? params.get("celebrate")   ?? "assets/character_idle.png",
  falling:             spriteConfig.collectible ?? params.get("falling")     ?? "assets/collectible.png",
  background:          spriteConfig.background  ?? params.get("background")  ?? "assets/background.png",
};

const SOUND_IDS = {
  catch: params.get("sound_catch") ?? "catch",
  miss:  params.get("sound_miss")  ?? "miss",
};

const canvas   = document.getElementById("game");
const ctx      = canvas.getContext("2d");
const stopBtn  = document.getElementById("stop-btn");
const replayBtn = document.getElementById("replay-btn");

const W = canvas.width;
const H = canvas.height;

const CATCHER_W   = 80;
const CATCHER_H   = 80;
const CATCHER_SPD = 8;
const FALL_SPEED  = 4;
const SPAWN_EVERY = 90; // frames between new items
const POSE_FRAMES = 45; // ~0.75s at 60fps for temporary pose

const state = {
  score:     0,
  lives:     3,
  gameOver:  false,
  catcher:   { x: W / 2 - CATCHER_W / 2, y: H - CATCHER_H - 20 },
  fallers:   [],
  frame:     0,
  keys:      {},
  pose:      "idle",   // "idle" | "move" | "action" | "celebrate"
  poseTimer: 0,        // frames remaining for temporary pose
};

const images = {};

// ── Asset loading ─────────────────────────────────────────────────────────────
function loadImage(key, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => { images[key] = img; resolve(); };
    img.onerror = () => resolve();
    img.src = src;
  });
}

function playSound(id) {
  try { new Audio(`assets/sounds/${id}.mp3`).play(); } catch { /* autoplay blocked */ }
}

// ── Game state ────────────────────────────────────────────────────────────────
function spawnFaller() {
  state.fallers.push({ x: Math.random() * (W - 48), y: -48, size: 48 });
}

function showGameOver() {
  state.gameOver = true;
  stopBtn.hidden  = true;
  replayBtn.hidden = false;
}

function restartGame() {
  state.score     = 0;
  state.lives     = 3;
  state.gameOver  = false;
  state.fallers   = [];
  state.frame     = 0;
  state.pose      = "idle";
  state.poseTimer = 0;
  state.catcher.x = W / 2 - CATCHER_W / 2;
  stopBtn.hidden   = false;
  replayBtn.hidden = true;
}

// ── Update ────────────────────────────────────────────────────────────────────
function update() {
  if (state.gameOver) return;
  state.frame++;

  // Pose management: temporary poses (catch/miss) count down; movement pose while key held
  if (state.poseTimer > 0) {
    state.poseTimer--;
    if (state.poseTimer === 0) state.pose = "idle";
  } else if (state.keys["ArrowLeft"] || state.keys["ArrowRight"]) {
    state.pose = "move";
  } else {
    state.pose = "idle";
  }

  if (state.keys["ArrowLeft"])
    state.catcher.x = Math.max(0, state.catcher.x - CATCHER_SPD);
  if (state.keys["ArrowRight"])
    state.catcher.x = Math.min(W - CATCHER_W, state.catcher.x + CATCHER_SPD);

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
      state.pose      = "celebrate";
      state.poseTimer = POSE_FRAMES;
      playSound(SOUND_IDS.catch);
    } else if (f.y > H) {
      state.fallers.splice(i, 1);
      state.lives--;
      state.pose      = "action";
      state.poseTimer = POSE_FRAMES;
      playSound(SOUND_IDS.miss);
      if (state.lives <= 0) showGameOver();
    }
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawBackground() {
  if (images.background) {
    ctx.drawImage(images.background, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#c8f0ff";
    ctx.fillRect(0, 0, W, H);
  }
}

function drawFallers() {
  for (const f of state.fallers) {
    if (images.falling) {
      ctx.drawImage(images.falling, f.x, f.y, f.size, f.size);
    } else {
      ctx.fillStyle = "#FF6B35";
      ctx.fillRect(f.x, f.y, f.size, f.size);
    }
  }
}

function drawCatcher() {
  // Use the pose-specific sprite; fall back to idle if the image didn't load
  const img = images[`character_${state.pose}`] ?? images.character_idle;
  if (img) {
    ctx.drawImage(img, state.catcher.x, state.catcher.y, CATCHER_W, CATCHER_H);
  } else {
    ctx.fillStyle = "#4ECDC4";
    ctx.fillRect(state.catcher.x, state.catcher.y, CATCHER_W, CATCHER_H);
  }
}

function drawHUD() {
  ctx.save();

  // Top bar
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(0, 0, W, 48);

  // Lives
  ctx.font = "bold 26px sans-serif";
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < state.lives ? "#FF4444" : "rgba(255,255,255,0.2)";
    ctx.fillText("♥", 14 + i * 30, 32);
  }

  // Score
  ctx.fillStyle = "white";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`Score: ${state.score}`, W - 14, 32);
  ctx.textAlign = "left";

  ctx.restore();
}

function drawGameOver() {
  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, W, H);

  const pw = 300, ph = 210;
  const px = (W - pw) / 2, py = (H - ph) / 2;

  ctx.fillStyle = "white";
  ctx.fillRect(px, py, pw, ph);

  ctx.fillStyle = "#FF6B35";
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Game Over!", W / 2, py + 62);

  ctx.fillStyle = "#2D2D2D";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(`Score: ${state.score}`, W / 2, py + 114);

  ctx.fillStyle = "#888";
  ctx.font = "16px sans-serif";
  ctx.fillText("Tap Play again or press SPACE", W / 2, py + 158);

  ctx.textAlign = "left";
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawFallers();
  drawCatcher();
  drawHUD();
  if (state.gameOver) drawGameOver();
}

// ── Loop ──────────────────────────────────────────────────────────────────────
function loop() { update(); draw(); requestAnimationFrame(loop); }

// ── Input ─────────────────────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
  if (state.gameOver && e.code === "Space") { restartGame(); return; }
  state.keys[e.key] = true;
});
document.addEventListener("keyup", (e) => { state.keys[e.key] = false; });

stopBtn.addEventListener("click",   () => showGameOver());
replayBtn.addEventListener("click", () => restartGame());

// ── Start ─────────────────────────────────────────────────────────────────────
Promise.all([
  loadImage("character_idle",      ASSETS.character_idle),
  loadImage("character_move",      ASSETS.character_move),
  loadImage("character_action",    ASSETS.character_action),
  loadImage("character_celebrate", ASSETS.character_celebrate),
  loadImage("falling",             ASSETS.falling),
  loadImage("background",          ASSETS.background),
]).then(loop);
