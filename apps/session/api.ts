// VITE_MOCK=false in .env switches to the real server.
// Default is true so `npm run dev` works without any setup.
const MOCK_MODE = import.meta.env["VITE_MOCK"] !== "false";
const API = "";

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(url, options);
  if (!r.ok) {
    let msg: string;
    if (r.status === 413) {
      msg = "Photo is too large (max 20 MB). Try a lower resolution or move closer to the drawing.";
    } else {
      msg = `Server returned ${r.status}`;
      try { const b = await r.json(); if (b?.error) msg = b.error; } catch { /* */ }
    }
    throw new Error(msg);
  }
  return r.json() as Promise<T>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function svgUrl(label: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <rect width="200" height="200" fill="${bg}" rx="24"/>
    <text x="100" y="115" font-size="28" text-anchor="middle" fill="white"
      font-family="sans-serif" font-weight="bold">${label}</text>
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
  idle:        string;
  move:        string;
  moveLeft?:   string; // optional — providers that don't generate it fall back to mirroring `move`
  celebrate:   string;
  collectible: string;
  sheet?:      string; // optional raw sprite-sheet debug image (openai provider only)
}

export interface SpriteVersion {
  id: string;
  label: string;
  prompt: string;
  sprites: SpritePack;
  createdAt: string;
}

// A generation offers two candidates — "text" (generated purely from a written description)
// and "image" (image-to-image, edited directly from the child's own photo) — for the child to
// pick between. Neither is "the" version until chooseSprites()/chooseBackground() is called.
export interface SpriteGenOption { prompt: string; sprites: SpritePack; }
export interface SpriteGenChoice {
  versionId: string;
  label: string;
  createdAt: string;
  options: { text: SpriteGenOption; image: SpriteGenOption };
}

export interface BackgroundGenOption { prompt: string; backgroundUrl: string; }
export interface BackgroundGenChoice {
  versionId: string;
  options: { text: BackgroundGenOption; image: BackgroundGenOption };
}

export interface GalleryItem {
  childId: string;
  childName: string;
  previewUrl: string;
  gameType: "catcher" | "jumper";
  sprites: SpritePack;
  backgroundUrl?: string | null;
  sounds?: Record<string, string>;
}

// ── Mock published-game store ─────────────────────────────────────────────────

interface MockPublished {
  childId: string;
  childName: string;
  sprites: SpritePack;
  backgroundUrl?: string | null;
  sounds?: Record<string, string>;
}

const _published: MockPublished[] = [];

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchSession(sessionId: string): Promise<SessionConfig> {
  if (MOCK_MODE) {
    await sleep(200);
    return { id: sessionId || "demo", name: "Dragon Workshop 🐉", showPrompt: true, aiProvider: "openai" };
  }
  return apiFetch<SessionConfig>(`${API}/api/sessions/${sessionId}`);
}

export async function resolveJoinCode(code: string): Promise<{ id: string; name: string }> {
  if (MOCK_MODE) {
    await sleep(200);
    return { id: "demo", name: "Dragon Workshop 🐉" };
  }
  return apiFetch<{ id: string; name: string }>(`${API}/api/sessions/by-code/${encodeURIComponent(code)}`);
}

const MOCK_ANIMALS = ["🦊", "🦉", "🐻", "🐼", "🦁"];

export async function registerChild(sessionId: string, name: string): Promise<{ childId: string; displayCode: string }> {
  if (MOCK_MODE) {
    await sleep(150);
    return {
      childId: `child_${Math.random().toString(36).slice(2, 8)}`,
      displayCode: MOCK_ANIMALS[Math.floor(Math.random() * MOCK_ANIMALS.length)],
    };
  }
  return apiFetch<{ childId: string; displayCode: string }>(`${API}/api/sessions/${sessionId}/children`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function uploadDrawing(file: File): Promise<{ drawingUrl: string; drawingBase64: string }> {
  if (MOCK_MODE) {
    await sleep(400);
    return { drawingUrl: URL.createObjectURL(file), drawingBase64: await fileToBase64(file) };
  }
  const form = new FormData();
  form.append("drawing", file);
  const { drawingUrl } = await apiFetch<{ drawingUrl: string }>(`${API}/api/uploads/drawing`, { method: "POST", body: form });
  // Compute base64 client-side so we don't round-trip large data through the server
  const drawingBase64 = await fileToBase64(file);
  return { drawingUrl, drawingBase64 };
}

export async function checkModeration(text: string): Promise<{ allowed: boolean }> {
  if (MOCK_MODE) return { allowed: true };
  return apiFetch<{ allowed: boolean }>(`${API}/api/moderation/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

// Mock-mode only: holds the two candidates from generateSprites() until chooseSprites() is
// called, so mock mode can round-trip a choice the same way the real server does.
const _pendingSpriteChoices = new Map<string, { label: string; createdAt: string; text: SpriteGenOption; image: SpriteGenOption }>();

export async function generateSprites(
  childId: string,
  description: string,
  styleMode: "shape" | "copy" = "shape",
  artStyle = "cartoon",
): Promise<SpriteGenChoice> {
  if (MOCK_MODE) {
    await sleep(2800);
    _versionCount++;
    const label      = VERSION_LABELS[_versionCount - 1] ?? `Try ${_versionCount}`;
    const versionId  = `v${_versionCount}_${Date.now()}`;
    const createdAt  = new Date().toISOString();
    const promptBase = `Character: ${description}. Style: ${styleMode === "copy" ? "copy drawing style" : artStyle}.`;
    const text: SpriteGenOption = {
      prompt: `${promptBase} (generated from a written description only)`,
      sprites: {
        idle: svgUrl("idle", "#FF6B35"), move: svgUrl("move", "#4ECDC4"),
        celebrate: svgUrl("yay!", "#A8E6CF"), collectible: svgUrl("★", "#FFE66D"),
      },
    };
    const image: SpriteGenOption = {
      prompt: `${promptBase} (image-to-image, edited directly from the photo)`,
      sprites: {
        idle: svgUrl("idle", "#A855F7"), move: svgUrl("move", "#F59E0B"),
        celebrate: svgUrl("yay!", "#A8E6CF"), collectible: svgUrl("★", "#FFE66D"),
      },
    };
    _pendingSpriteChoices.set(versionId, { label, createdAt, text, image });
    return { versionId, label, createdAt, options: { text, image } };
  }
  return apiFetch<SpriteGenChoice>(`${API}/api/ai/sprites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childId, description, styleMode, artStyle }),
  });
}

export async function chooseSprites(
  childId: string, versionId: string, chosen: "text" | "image"
): Promise<SpriteVersion> {
  if (MOCK_MODE) {
    await sleep(150);
    const pending = _pendingSpriteChoices.get(versionId);
    const option  = pending?.[chosen] ?? { prompt: "", sprites: { idle: "", move: "", celebrate: "", collectible: "" } };
    return { id: versionId, label: pending?.label ?? "Try", prompt: option.prompt, sprites: option.sprites, createdAt: pending?.createdAt ?? new Date().toISOString() };
  }
  return apiFetch<SpriteVersion>(`${API}/api/ai/sprites/${versionId}/choose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childId, chosen }),
  });
}

export async function publishGame(
  childId: string,
  spriteVersionId: string,
  sounds: Record<string, string>,
  backgroundUrl: string | null,
  // Only needed for the mock gallery (server derives these from the DB)
  _mockMeta?: { childName: string; sprites: SpritePack }
): Promise<void> {
  if (MOCK_MODE) {
    if (_mockMeta) {
      _published.unshift({
        childId,
        childName: _mockMeta.childName,
        sprites:   _mockMeta.sprites,
        backgroundUrl,
        sounds,
      });
    }
    await sleep(500);
    return;
  }
  await apiFetch(`${API}/api/sessions/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childId, spriteVersionId, sounds, backgroundUrl }),
  });
}

export async function fetchGallery(sessionId: string): Promise<GalleryItem[]> {
  if (MOCK_MODE) {
    await sleep(400);
    const userGames: GalleryItem[] = _published.map((g) => ({
      childId:      g.childId,
      childName:    g.childName,
      previewUrl:   g.sprites.idle,
      gameType:     "catcher" as const,
      sprites:      g.sprites,
      backgroundUrl: g.backgroundUrl,
      sounds:       g.sounds,
    }));
    const demoGames: GalleryItem[] = [
      { childId: "c1", childName: "Emma",  previewUrl: svgUrl("idle", "#FF6B35"), gameType: "catcher", sprites: { idle: svgUrl("idle", "#FF6B35"), move: svgUrl("move", "#4ECDC4"), celebrate: svgUrl("yay!", "#A8E6CF"), collectible: svgUrl("★", "#FFE66D") } },
      { childId: "c2", childName: "Liam",  previewUrl: svgUrl("idle", "#4ECDC4"), gameType: "catcher", sprites: { idle: svgUrl("idle", "#4ECDC4"), move: svgUrl("move", "#FF6B35"), celebrate: svgUrl("yay!", "#A8E6CF"), collectible: svgUrl("★", "#FFE66D") } },
      { childId: "c3", childName: "Sofia", previewUrl: svgUrl("idle", "#A855F7"), gameType: "catcher", sprites: { idle: svgUrl("idle", "#A855F7"), move: svgUrl("move", "#F59E0B"), celebrate: svgUrl("yay!", "#A8E6CF"), collectible: svgUrl("★", "#FFE66D") } },
    ];
    return [...userGames, ...demoGames];
  }
  return apiFetch<GalleryItem[]>(`${API}/api/sessions/${sessionId}/gallery`);
}

// Mock-mode only: same round-trip pattern as _pendingSpriteChoices above.
const _pendingBackgroundChoices = new Map<string, { text: BackgroundGenOption; image: BackgroundGenOption }>();

export async function generateBackground(
  childId: string,
  description: string,
  styleMode: "shape" | "copy",
  artStyle?: string,
): Promise<BackgroundGenChoice> {
  if (MOCK_MODE) {
    await sleep(1500);
    const versionId  = `bg_${Date.now()}`;
    const promptBase = `World: ${description || "a colorful game world"}. Style: ${styleMode === "copy" ? "as drawn" : artStyle}.`;
    const text: BackgroundGenOption  = { backgroundUrl: svgUrl("your world", "#4ECDC4"), prompt: `${promptBase} (generated from a written description only)` };
    const image: BackgroundGenOption = { backgroundUrl: svgUrl("your world", "#A855F7"), prompt: `${promptBase} (image-to-image, edited directly from the photo)` };
    _pendingBackgroundChoices.set(versionId, { text, image });
    return { versionId, options: { text, image } };
  }
  return apiFetch<BackgroundGenChoice>(`${API}/api/ai/background`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childId, description, styleMode, artStyle }),
  });
}

export async function chooseBackground(
  childId: string, versionId: string, chosen: "text" | "image"
): Promise<{ backgroundUrl: string; prompt: string }> {
  if (MOCK_MODE) {
    await sleep(150);
    const pending = _pendingBackgroundChoices.get(versionId);
    return pending?.[chosen] ?? { backgroundUrl: "", prompt: "" };
  }
  return apiFetch<{ backgroundUrl: string; prompt: string }>(`${API}/api/ai/background/${versionId}/choose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childId, chosen }),
  });
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function urlToBase64(url: string): Promise<string> {
  const blob = await fetch(url).then((r) => r.blob());
  return fileToBase64(blob);
}

export interface PhotoStatus {
  status: "none" | "pending_child_confirm" | "approved" | "rejected";
  url?: string;
  photoId?: string;
}

// In mock mode there's no real teacher — simulate one showing up on the second poll
// so the waiting → confirm screen transition is still testable without a server.
const _mockPhotoSeen = new Set<string>();

export async function fetchPhotoStatus(sessionId: string, childId: string, kind: "drawing" | "world"): Promise<PhotoStatus> {
  if (MOCK_MODE) {
    await sleep(200);
    const key = `${childId}:${kind}`;
    if (!_mockPhotoSeen.has(key)) {
      _mockPhotoSeen.add(key);
      return { status: "none" };
    }
    return {
      status: "pending_child_confirm",
      url: svgUrl(kind === "drawing" ? "your drawing" : "your world", kind === "drawing" ? "#FF6B35" : "#4ECDC4"),
      photoId: `mock_${key}`,
    };
  }
  return apiFetch<PhotoStatus>(`${API}/api/sessions/${sessionId}/children/${childId}/photos/${kind}`);
}

export async function confirmPhoto(
  sessionId: string, childId: string, kind: "drawing" | "world", approved: boolean
): Promise<{ ok: true; status: string }> {
  if (MOCK_MODE) {
    await sleep(150);
    if (!approved) _mockPhotoSeen.delete(`${childId}:${kind}`);
    return { ok: true, status: approved ? "approved" : "rejected" };
  }
  return apiFetch(`${API}/api/sessions/${sessionId}/children/${childId}/photos/${kind}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved }),
  });
}
