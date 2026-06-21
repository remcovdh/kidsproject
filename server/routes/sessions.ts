import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

export const sessionRouter = Router();

// POST /api/sessions — create a new session (facilitator)
sessionRouter.post("/", (req, res) => {
  const { name, showPrompt = true, aiProvider = "openai" } = req.body as {
    name?: string; showPrompt?: boolean; aiProvider?: string;
  };
  if (!name) return res.status(400).json({ error: "name is required" });

  const id = uuid();
  db.prepare(
    "INSERT INTO sessions (id, name, show_prompt, ai_provider) VALUES (?, ?, ?, ?)"
  ).run(id, name, showPrompt ? 1 : 0, aiProvider);
  res.json({ id });
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
    { id: string; name: string; show_prompt: number; ai_provider: string } | undefined;
  if (!session) return res.status(404).json({ error: "Session not found" });

  res.json({
    id:          session.id,
    name:        session.name,
    showPrompt:  session.show_prompt === 1,
    aiProvider:  session.ai_provider,
  });
});

// POST /api/sessions/:id/children — register a child in the session
sessionRouter.post("/:id/children", (req, res) => {
  const { name, gameType = "catcher" } = req.body as { name?: string; gameType?: string };
  if (!name) return res.status(400).json({ error: "name is required" });

  const session = db.prepare("SELECT id FROM sessions WHERE id = ?").get(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const childId = uuid();
  db.prepare(
    "INSERT INTO children (id, session_id, name, game_type) VALUES (?, ?, ?, ?)"
  ).run(childId, req.params.id, name, gameType);
  res.json({ childId });
});

// GET /api/sessions/:id/gallery — all published games in this session
sessionRouter.get("/:id/gallery", (req, res) => {
  const rows = db.prepare(`
    SELECT pg.id, c.id AS child_id, c.name AS child_name, c.game_type,
           sv.sprites, pg.background_url
    FROM   published_games pg
    JOIN   children c        ON c.id  = pg.child_id
    JOIN   sprite_versions sv ON sv.id = pg.sprite_version_id
    WHERE  pg.session_id = ?
    ORDER  BY pg.published_at DESC
  `).all(req.params.id) as Array<{
    id: string; child_id: string; child_name: string; game_type: string;
    sprites: string; background_url: string | null;
  }>;

  res.json(rows.map((r) => {
    const sprites = JSON.parse(r.sprites) as Record<string, string>;
    return {
      childId:      r.child_id,
      childName:    r.child_name,
      previewUrl:   sprites.idle ?? "",
      gameType:     r.game_type,
      sprites,
      backgroundUrl: r.background_url,
    };
  }));
});
