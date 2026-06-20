// All server calls live here. Flip MOCK_MODE to false when the server is ready.
const MOCK_MODE = true;
const API = "";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function b64svg(pose: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <rect width="200" height="200" fill="${bg}" rx="24"/>
    <text x="100" y="115" font-size="28" text-anchor="middle" fill="white"
      font-family="sans-serif" font-weight="bold">${pose}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

let _versionCount = 0;
const VERSION_LABELS = ["First try", "Second try", "Third try", "Fourth try"];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionConfig {
  id: string;
  name: string;
  showPrompt: boolean;
  aiProvider: string;
}

export interface SpritePack {
  idle: string;
  move: string;
  action: string;
  celebrate: string;
}

export interface SpriteVersion {
  id: string;
  label: string;
  prompt: string;
  sprites: SpritePack;
  createdAt: string;
}

export interface GalleryItem {
  childId: string;
  childName: string;
  previewUrl: string;
  gameType: "catcher" | "jumper";
  sprites: SpritePack;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchSession(sessionId: string): Promise<SessionConfig> {
  if (MOCK_MODE) {
    await sleep(200);
    return { id: sessionId || "demo", name: "Dragon Workshop 🐉", showPrompt: true, aiProvider: "openai" };
  }
  return fetch(`${API}/api/sessions/${sessionId}`).then((r) => r.json());
}

export async function registerChild(sessionId: string, name: string): Promise<string> {
  if (MOCK_MODE) {
    await sleep(150);
    return `child_${Math.random().toString(36).slice(2, 8)}`;
  }
  const r = await fetch(`${API}/api/sessions/${sessionId}/children`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return (await r.json()).childId;
}

export async function uploadDrawing(file: File): Promise<{ drawingUrl: string; drawingBase64: string }> {
  if (MOCK_MODE) {
    await sleep(400);
    return {
      drawingUrl: URL.createObjectURL(file),
      drawingBase64: await fileToBase64(file),
    };
  }
  const form = new FormData();
  form.append("drawing", file);
  return fetch(`${API}/api/uploads/drawing`, { method: "POST", body: form }).then((r) => r.json());
}

export async function checkModeration(text: string): Promise<{ allowed: boolean }> {
  if (MOCK_MODE) return { allowed: true };
  return fetch(`${API}/api/moderation/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).then((r) => r.json());
}

export async function generateSprites(
  childId: string,
  description: string,
  _drawingBase64: string
): Promise<SpriteVersion> {
  if (MOCK_MODE) {
    await sleep(2800);
    _versionCount++;
    const label = VERSION_LABELS[_versionCount - 1] ?? `Try ${_versionCount}`;
    const colors = ["#FF6B35", "#4ECDC4", "#A855F7", "#F59E0B"];
    const bg = colors[(_versionCount - 1) % colors.length];
    return {
      id: `v${_versionCount}_${Date.now()}`,
      label,
      prompt: `Turn this child's drawing into a game character sprite pack. The character is: ${description}.`,
      sprites: {
        idle:      b64svg("idle",      bg),
        move:      b64svg("move",      "#4ECDC4"),
        action:    b64svg("action!",   "#F59E0B"),
        celebrate: b64svg("yay! 🎉",  "#A8E6CF"),
      },
      createdAt: new Date().toISOString(),
    };
  }
  return fetch(`${API}/api/ai/sprites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childId, description, drawingBase64: _drawingBase64 }),
  }).then((r) => r.json());
}

export async function publishGame(
  childId: string,
  spriteVersionId: string,
  sounds: Record<string, string>
): Promise<void> {
  if (MOCK_MODE) { await sleep(500); return; }
  await fetch(`${API}/api/sessions/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childId, spriteVersionId, sounds }),
  });
}

export async function fetchGallery(sessionId: string): Promise<GalleryItem[]> {
  if (MOCK_MODE) {
    await sleep(600);
    return [
      { childId: "c1", childName: "Emma",  previewUrl: b64svg("idle", "#FF6B35"), gameType: "catcher", sprites: { idle: b64svg("idle", "#FF6B35"), move: b64svg("move", "#4ECDC4"), action: b64svg("action!", "#F59E0B"), celebrate: b64svg("yay! 🎉", "#A8E6CF") } },
      { childId: "c2", childName: "Liam",  previewUrl: b64svg("idle", "#4ECDC4"), gameType: "catcher", sprites: { idle: b64svg("idle", "#4ECDC4"), move: b64svg("move", "#FF6B35"), action: b64svg("action!", "#A855F7"), celebrate: b64svg("yay! 🎉", "#A8E6CF") } },
      { childId: "c3", childName: "Sofia", previewUrl: b64svg("idle", "#A855F7"), gameType: "catcher", sprites: { idle: b64svg("idle", "#A855F7"), move: b64svg("move", "#F59E0B"), action: b64svg("action!", "#4ECDC4"), celebrate: b64svg("yay! 🎉", "#A8E6CF") } },
    ];
  }
  return fetch(`${API}/api/sessions/${sessionId}/gallery`).then((r) => r.json());
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
