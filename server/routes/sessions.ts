import { Router } from "express";
import { v4 as uuid } from "uuid";
import db, { generateJoinCode } from "../db.js";
import { checkFacilitatorAuth } from "../auth.js";
import { upload } from "./uploads.js";

export const sessionRouter = Router();

const ALLOWED_PROVIDERS   = ["openai", "gemini", "local"] as const;
const ALLOWED_GAME_TYPES  = ["catcher"] as const;
const VALID_SOUND_IDS     = new Set(["boing", "splat", "whoosh", "pop", "squeak", "roar", "giggle", "crash", ""]);

// A unique-per-session animal emoji, shown next to the child's own name (e.g. "Robin 🦊") so a
// helper can tell same-named kids apart before any character/photo exists to distinguish them
// by. No name/number needed on the emoji itself — the app never assigns the same animal twice
// within one session (max 20 kids, matches the animal list size), so the symbol alone is
// already unique; the child's actual name carries the rest.
const ANIMALS = [
  "🦊", "🦉", "🐻", "🐼", "🦁", "🐯", "🐰", "🐸", "🐢", "🐧",
  "🐨", "🐬", "🐘", "🦒", "🦔", "🐿️", "🐵", "🦆", "🐱", "🐶",
];

function generateDisplayCode(sessionId: string): string {
  const existing = new Set(
    (db.prepare("SELECT display_code FROM children WHERE session_id = ?").all(sessionId) as
      Array<{ display_code: string | null }>).map((r) => r.display_code)
  );
  const available = ANIMALS.filter((a) => !existing.has(a));
  if (available.length > 0) return available[Math.floor(Math.random() * available.length)];
  return ANIMALS[Math.floor(Math.random() * ANIMALS.length)]; // >20 kids in one session — allow a repeat
}

function newUniqueJoinCode(): string {
  for (let i = 0; i < 10; i++) {
    const code = generateJoinCode();
    if (!db.prepare("SELECT 1 FROM sessions WHERE join_code = ?").get(code)) return code;
  }
  return `${generateJoinCode()}${Date.now() % 10}`; // fallback, effectively unique
}

// POST /api/sessions — create a new session (facilitator only)
sessionRouter.post("/", (req, res) => {
  if (!checkFacilitatorAuth(req, res)) return;

  const { name, showPrompt = true, aiProvider = "openai" } = req.body as {
    name?: string; showPrompt?: boolean; aiProvider?: string;
  };
  if (!name) return res.status(400).json({ error: "name is required" });
  if (name.length > 80) return res.status(400).json({ error: "Session name is too long (max 80 characters)" });
  if (!ALLOWED_PROVIDERS.includes(aiProvider as typeof ALLOWED_PROVIDERS[number])) {
    return res.status(400).json({ error: "Invalid AI provider" });
  }

  const id = uuid();
  const joinCode = newUniqueJoinCode();
  db.prepare(
    "INSERT INTO sessions (id, name, show_prompt, ai_provider, join_code) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, showPrompt ? 1 : 0, aiProvider, joinCode);
  res.json({ id, joinCode });
});

// GET /api/sessions — list all sessions (facilitator only) — used by the admin app to pick
// or manage a session after login
sessionRouter.get("/", (req, res) => {
  if (!checkFacilitatorAuth(req, res)) return;

  const rows = db.prepare(`
    SELECT s.id, s.name, s.join_code, s.ai_provider, s.show_prompt, s.created_at,
      (SELECT COUNT(*) FROM children c WHERE c.session_id = s.id) AS child_count
    FROM sessions s
    ORDER BY s.created_at DESC
  `).all() as Array<{
    id: string; name: string; join_code: string; ai_provider: string;
    show_prompt: number; created_at: string; child_count: number;
  }>;

  res.json(rows.map((r) => ({
    id:         r.id,
    name:       r.name,
    joinCode:   r.join_code,
    aiProvider: r.ai_provider,
    showPrompt: r.show_prompt === 1,
    createdAt:  r.created_at,
    childCount: r.child_count,
  })));
});

// GET /api/sessions/by-code/:code — resolve a short join code to a session (public, no
// auth — this is how a kid's device finds the session without typing/scanning a full URL)
sessionRouter.get("/by-code/:code", (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const session = db.prepare("SELECT id, name FROM sessions WHERE join_code = ?").get(code) as
    { id: string; name: string } | undefined;
  if (!session) return res.status(404).json({ error: "No session found with that code" });
  res.json({ id: session.id, name: session.name });
});

// POST /api/sessions/publish — publish a child's game to the gallery
sessionRouter.post("/publish", (req, res) => {
  const { childId, spriteVersionId, sounds, backgroundUrl } = req.body as {
    childId?: string; spriteVersionId?: string;
    sounds?: Record<string, string>; backgroundUrl?: string | null;
  };
  if (!childId || !spriteVersionId) {
    return res.status(400).json({ error: "childId and spriteVersionId are required" });
  }

  if (sounds) {
    for (const v of Object.values(sounds)) {
      if (!VALID_SOUND_IDS.has(String(v))) {
        return res.status(400).json({ error: "Invalid sound ID" });
      }
    }
  }

  if (backgroundUrl && !/^\/uploads\//.test(backgroundUrl)) {
    return res.status(400).json({ error: "Invalid background URL" });
  }

  const child = db.prepare("SELECT session_id FROM children WHERE id = ?").get(childId) as
    { session_id: string } | undefined;
  if (!child) return res.status(404).json({ error: "Child not found" });

  db.prepare(`
    INSERT INTO published_games (id, child_id, session_id, sprite_version_id, sounds, background_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    uuid(), childId, child.session_id, spriteVersionId,
    JSON.stringify(sounds ?? {}), backgroundUrl ?? null
  );
  res.json({ ok: true });
});

// GET /api/sessions/:id — load session config for child-facing app
sessionRouter.get("/:id", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id) as
    { id: string; name: string; show_prompt: number; ai_provider: string; join_code: string } | undefined;
  if (!session) return res.status(404).json({ error: "Session not found" });

  res.json({
    id:          session.id,
    name:        session.name,
    showPrompt:  session.show_prompt === 1,
    aiProvider:  session.ai_provider,
    joinCode:    session.join_code,
  });
});

// POST /api/sessions/:id/children — register a child in the session
sessionRouter.post("/:id/children", (req, res) => {
  const { name, gameType = "catcher" } = req.body as { name?: string; gameType?: string };
  if (!name) return res.status(400).json({ error: "name is required" });
  if (name.length > 60) return res.status(400).json({ error: "Name is too long (max 60 characters)" });
  if (!ALLOWED_GAME_TYPES.includes(gameType as typeof ALLOWED_GAME_TYPES[number])) {
    return res.status(400).json({ error: "Invalid game type" });
  }

  const session = db.prepare("SELECT id FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const childId = uuid();
  const displayCode = generateDisplayCode(req.params.id);
  db.prepare(
    "INSERT INTO children (id, session_id, name, game_type, display_code) VALUES (?, ?, ?, ?, ?)"
  ).run(childId, req.params.id, name, gameType, displayCode);
  res.json({ childId, displayCode });
});

// GET /api/sessions/:id/roster — live list of children + their photo-capture status
// (facilitator only — used by the teacher-assisted capture tool in apps/admin)
sessionRouter.get("/:id/roster", (req, res) => {
  if (!checkFacilitatorAuth(req, res)) return;

  const rows = db.prepare(`
    SELECT c.id, c.name, c.display_code, c.game_type,
      (SELECT status FROM photo_captures pc WHERE pc.child_id = c.id AND pc.kind = 'drawing'
         ORDER BY pc.created_at DESC LIMIT 1) AS drawing_status,
      (SELECT status FROM photo_captures pc WHERE pc.child_id = c.id AND pc.kind = 'world'
         ORDER BY pc.created_at DESC LIMIT 1) AS world_status,
      EXISTS(SELECT 1 FROM published_games pg WHERE pg.child_id = c.id) AS published
    FROM children c
    WHERE c.session_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.id) as Array<{
    id: string; name: string; display_code: string | null; game_type: string;
    drawing_status: string | null; world_status: string | null; published: number;
  }>;

  res.json(rows.map((r) => ({
    childId:       r.id,
    name:          r.name,
    displayCode:   r.display_code,
    gameType:      r.game_type,
    drawingStatus: r.drawing_status ?? "none",
    worldStatus:   r.world_status ?? "none",
    published:     r.published === 1,
  })));
});

// POST /api/sessions/:id/photos — teacher captures a photo for a child (facilitator only)
// multipart/form-data: { childId, kind: "drawing"|"world", photo: File }
sessionRouter.post("/:id/photos", upload.single("photo"), (req, res) => {
  if (!checkFacilitatorAuth(req, res)) return;
  if (!req.file) return res.status(400).json({ error: "No image file received" });

  const { childId, kind } = req.body as { childId?: string; kind?: string };
  if (!childId || (kind !== "drawing" && kind !== "world")) {
    return res.status(400).json({ error: "childId and a valid kind ('drawing'|'world') are required" });
  }

  const child = db.prepare("SELECT id FROM children WHERE id = ? AND session_id = ?")
    .get(childId, req.params.id);
  if (!child) return res.status(404).json({ error: "Child not found in this session" });

  const url = `/uploads/${req.file.filename}`;
  db.prepare(
    "INSERT INTO photo_captures (id, child_id, kind, url, status) VALUES (?, ?, ?, ?, 'pending_child_confirm')"
  ).run(uuid(), childId, kind, url);

  res.json({ photoId: uuid(), url });
});

// GET /api/sessions/:sessionId/children/:childId/photos/:kind — kid-facing poll for a
// teacher-captured photo awaiting confirmation
sessionRouter.get("/:sessionId/children/:childId/photos/:kind", (req, res) => {
  const { kind } = req.params;
  if (kind !== "drawing" && kind !== "world") {
    return res.status(400).json({ error: "Invalid kind" });
  }

  const row = db.prepare(`
    SELECT id, url, status FROM photo_captures
    WHERE child_id = ? AND kind = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(req.params.childId, kind) as { id: string; url: string; status: string } | undefined;

  if (!row) return res.json({ status: "none" });
  res.json({ status: row.status, url: row.url, photoId: row.id });
});

// POST /api/sessions/:sessionId/children/:childId/photos/:kind/confirm — kid-facing
// "Is this yours?" Yes/No. Yes approves, No rejects (the teacher, not the kid, recaptures).
sessionRouter.post("/:sessionId/children/:childId/photos/:kind/confirm", (req, res) => {
  const { kind } = req.params;
  if (kind !== "drawing" && kind !== "world") {
    return res.status(400).json({ error: "Invalid kind" });
  }
  const { approved } = req.body as { approved?: boolean };

  const row = db.prepare(`
    SELECT id FROM photo_captures
    WHERE child_id = ? AND kind = ? AND status = 'pending_child_confirm'
    ORDER BY created_at DESC LIMIT 1
  `).get(req.params.childId, kind) as { id: string } | undefined;

  if (!row) return res.status(404).json({ error: "No photo awaiting confirmation" });

  const status = approved ? "approved" : "rejected";
  db.prepare("UPDATE photo_captures SET status = ? WHERE id = ?").run(status, row.id);
  res.json({ ok: true, status });
});

// GET /api/sessions/:id/gallery — all published games in this session
sessionRouter.get("/:id/gallery", (req, res) => {
  const rows = db.prepare(`
    SELECT pg.id, c.id AS child_id, c.name AS child_name, c.game_type,
           sv.sprites, pg.background_url, pg.sounds
    FROM   published_games pg
    JOIN   children c        ON c.id  = pg.child_id
    JOIN   sprite_versions sv ON sv.id = pg.sprite_version_id
    WHERE  pg.session_id = ?
    ORDER  BY pg.published_at DESC
  `).all(req.params.id) as Array<{
    id: string; child_id: string; child_name: string; game_type: string;
    sprites: string; background_url: string | null; sounds: string | null;
  }>;

  res.json(rows.map((r) => {
    const sprites = JSON.parse(r.sprites) as Record<string, string>;
    const sounds  = r.sounds ? (JSON.parse(r.sounds) as Record<string, string>) : {};
    return {
      childId:      r.child_id,
      childName:    r.child_name,
      previewUrl:   sprites.idle ?? "",
      gameType:     r.game_type,
      sprites,
      backgroundUrl: r.background_url,
      sounds,
    };
  }));
});

// DELETE /api/sessions/:id — purge a completed session and all child data (facilitator only)
// Deletes in foreign-key order: published_games → sprite_versions → children → sessions.
// Note: uploaded files on disk are NOT removed here; run a periodic cleanup script if needed.
sessionRouter.delete("/:id", (req, res) => {
  if (!checkFacilitatorAuth(req, res)) return;

  const session = db.prepare("SELECT id FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  db.transaction(() => {
    db.prepare("DELETE FROM published_games WHERE session_id = ?").run(req.params.id);
    db.prepare(`
      DELETE FROM sprite_versions
      WHERE child_id IN (SELECT id FROM children WHERE session_id = ?)
    `).run(req.params.id);
    db.prepare(`
      DELETE FROM photo_captures
      WHERE child_id IN (SELECT id FROM children WHERE session_id = ?)
    `).run(req.params.id);
    db.prepare("DELETE FROM children WHERE session_id = ?").run(req.params.id);
    db.prepare("DELETE FROM sessions WHERE id = ?").run(req.params.id);
  })();

  res.json({ ok: true });
});
