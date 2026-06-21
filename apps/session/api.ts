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
  backgroundUrl?: string | null;
}

// ── Mock published-game store ─────────────────────────────────────────────────

interface MockPublished {
  childId: string;
  childName: string;
  sprites: SpritePack;
  backgroundUrl?: string | null;
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

export async function registerChild(sessionId: string, name: string): Promise<string> {
  if (MOCK_MODE) {
    await sleep(150);
    return `child_${Math.random().toString(36).slice(2, 8)}`;
  }
  const r = await apiFetch<{ childId: string }>(`${API}/api/sessions/${sessionId}/children`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return r.childId;
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

export async function generateSprites(
  childId: string,
  description: string,
  _drawingBase64: string
): Promise<SpriteVersion> {
  if (MOCK_MODE) {
    await sleep(2800);
    _versionCount++;
    const label  = VERSION_LABELS[_versionCount - 1] ?? `Try ${_versionCount}`;
    const colors = ["#FF6B35", "#4ECDC4", "#A855F7", "#F59E0B"];
    const bg     = colors[(_versionCount - 1) % colors.length];
    return {
      id: `v${_versionCount}_${Date.now()}`,
      label,
      prompt: `Turn this child's drawing into a game character sprite pack. The character is: ${description}.`,
      sprites: {
        idle:      svgUrl("idle",       bg),
        move:      svgUrl("move",       "#4ECDC4"),
        action:    svgUrl("action!",    "#F59E0B"),
        celebrate: svgUrl("yay!",       "#A8E6CF"),
      },
      createdAt: new Date().toISOString(),
    };
  }
  return apiFetch<SpriteVersion>(`${API}/api/ai/sprites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childId, description, drawingBase64: _drawingBase64 }),
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
    }));
    const demoGames: GalleryItem[] = [
      { childId: "c1", childName: "Emma",  previewUrl: svgUrl("idle", "#FF6B35"), gameType: "catcher", sprites: { idle: svgUrl("idle", "#FF6B35"), move: svgUrl("move", "#4ECDC4"), action: svgUrl("action!", "#F59E0B"), celebrate: svgUrl("yay!", "#A8E6CF") } },
      { childId: "c2", childName: "Liam",  previewUrl: svgUrl("idle", "#4ECDC4"), gameType: "catcher", sprites: { idle: svgUrl("idle", "#4ECDC4"), move: svgUrl("move", "#FF6B35"), action: svgUrl("action!", "#A855F7"), celebrate: svgUrl("yay!", "#A8E6CF") } },
      { childId: "c3", childName: "Sofia", previewUrl: svgUrl("idle", "#A855F7"), gameType: "catcher", sprites: { idle: svgUrl("idle", "#A855F7"), move: svgUrl("move", "#F59E0B"), action: svgUrl("action!", "#4ECDC4"), celebrate: svgUrl("yay!", "#A8E6CF") } },
    ];
    return [...userGames, ...demoGames];
  }
  return apiFetch<GalleryItem[]>(`${API}/api/sessions/${sessionId}/gallery`);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
