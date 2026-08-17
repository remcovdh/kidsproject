import { Router, type Request, type Response, type NextFunction } from "express";
import { v4 as uuid } from "uuid";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import db, { UPLOAD_DIR } from "../db.js";
import { getServerProvider } from "../ai/index.js";
import { isFlagged } from "./moderation.js";

const VERSION_LABELS = ["First try", "Second try", "Third try", "Fourth try"];

export const aiRouter = Router();

// Look up the child's latest teacher-approved photo of the given kind and read it from
// disk as base64 — the server verifies this itself rather than trusting whatever image
// data a client submits, so generation can't be triggered with an unapproved (or entirely
// client-supplied) photo by calling these endpoints directly, bypassing the capture UI.
function getApprovedPhotoBase64(childId: string, kind: "drawing" | "world"): string | null {
  const row = db.prepare(`
    SELECT url FROM photo_captures
    WHERE child_id = ? AND kind = ? AND status = 'approved'
    ORDER BY created_at DESC LIMIT 1
  `).get(childId, kind) as { url: string } | undefined;
  if (!row) return null;
  const filePath = join(UPLOAD_DIR, row.url.replace(/^\/uploads\//, ""));
  try {
    return readFileSync(filePath).toString("base64");
  } catch {
    return null;
  }
}

// Simple in-memory rate limiter: max 10 AI calls per IP per minute.
const _rateMap = new Map<string, { count: number; resetAt: number }>();
function aiRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip  = req.ip ?? "unknown";
  const now = Date.now();
  const rec = _rateMap.get(ip);
  if (!rec || rec.resetAt < now) {
    _rateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  if (rec.count >= 10) {
    return res.status(429).json({ error: "Too many requests — please wait a moment." });
  }
  rec.count++;
  next();
}

aiRouter.use(aiRateLimit);

// POST /api/ai/sprites — generate a sprite pack for a child's drawing
// Body: { childId, description }
// The drawing photo itself is NOT taken from the request body — it's looked up server-side
// from the child's latest teacher-approved photo_captures record, so this can't be triggered
// with an arbitrary/unapproved photo by calling the endpoint directly.
// Returns: { id, label, prompt, sprites, createdAt }
aiRouter.post("/sprites", async (req, res) => {
  const { childId, description, styleMode, artStyle } = req.body as {
    childId?: string; description?: string;
    styleMode?: "shape" | "copy"; artStyle?: string;
  };

  if (!childId || !description) {
    return res.status(400).json({ error: "childId and description are required" });
  }
  if (description.length > 300) {
    return res.status(400).json({ error: "Description is too long (max 300 characters)" });
  }
  if (artStyle && artStyle.length > 50) {
    return res.status(400).json({ error: "Art style is too long (max 50 characters)" });
  }
  if (isFlagged(description)) {
    return res.status(400).json({ error: "Description contains inappropriate content" });
  }

  const row = db.prepare(`
    SELECT c.id, s.ai_provider
    FROM   children c
    JOIN   sessions s ON s.id = c.session_id
    WHERE  c.id = ?
  `).get(childId) as { id: string; ai_provider: string } | undefined;

  if (!row) return res.status(404).json({ error: "Child not found" });

  const drawingBase64 = getApprovedPhotoBase64(childId, "drawing");
  if (!drawingBase64) {
    return res.status(400).json({ error: "No approved drawing photo found for this child yet — ask a helper to take one first." });
  }

  if (row.ai_provider === "openai" && !process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is not set on the server. Add it to your .env file and restart.",
    });
  }

  try {
    const provider = await getServerProvider(row.ai_provider);
    const { sprites: buffers, prompt } = await provider.generateSprites(description, drawingBase64, styleMode, artStyle);

    const versionId = uuid();
    const spriteDir = join(UPLOAD_DIR, "sprites", versionId);
    mkdirSync(spriteDir, { recursive: true });

    const sprites: Record<string, string> = {};
    for (const [pose, { data, ext }] of Object.entries(buffers)) {
      const filename = `${pose}.${ext}`;
      writeFileSync(join(spriteDir, filename), data);
      sprites[pose] = `/uploads/sprites/${versionId}/${filename}`;
    }

    const { n } = db.prepare(
      "SELECT COUNT(*) as n FROM sprite_versions WHERE child_id = ?"
    ).get(childId) as { n: number };
    const label = VERSION_LABELS[n] ?? `Try ${n + 1}`;

    db.prepare(
      "INSERT INTO sprite_versions (id, child_id, label, prompt, sprites) VALUES (?, ?, ?, ?, ?)"
    ).run(versionId, childId, label, prompt, JSON.stringify(sprites));

    res.json({ id: versionId, label, prompt, sprites, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error("Sprite generation error:", err);
    res.status(500).json({ error: "Character generation failed — please try again." });
  }
});

// POST /api/ai/background — generate a background image from a teacher-captured world photo,
// refined by an optional description and an art-style choice (mirrors /api/ai/sprites' shape/copy
// pattern). The photo is looked up server-side from the child's latest approved photo_captures
// record, same as /api/ai/sprites — never trusted from the request body.
// Body: { childId, description?, styleMode, artStyle? }
// Returns: { backgroundUrl }
aiRouter.post("/background", async (req, res) => {
  const { childId, description, styleMode, artStyle } = req.body as {
    childId?: string; description?: string; styleMode?: "shape" | "copy"; artStyle?: string;
  };
  if (!childId) {
    return res.status(400).json({ error: "childId is required" });
  }
  if (description && description.length > 300) {
    return res.status(400).json({ error: "Description is too long (max 300 characters)" });
  }
  if (artStyle && artStyle.length > 50) {
    return res.status(400).json({ error: "Art style is too long (max 50 characters)" });
  }
  if (description && isFlagged(description)) {
    return res.status(400).json({ error: "Description contains inappropriate content" });
  }

  const row = db.prepare(`
    SELECT c.id, s.ai_provider
    FROM   children c
    JOIN   sessions s ON s.id = c.session_id
    WHERE  c.id = ?
  `).get(childId) as { id: string; ai_provider: string } | undefined;

  if (!row) return res.status(404).json({ error: "Child not found" });

  const imageBase64 = getApprovedPhotoBase64(childId, "world");
  if (!imageBase64) {
    return res.status(400).json({ error: "No approved World photo found for this child yet — ask a helper to take one first." });
  }

  if (row.ai_provider === "openai" && !process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is not set on the server. Add it to your .env file and restart.",
    });
  }

  try {
    const provider = await getServerProvider(row.ai_provider);
    if (!provider.generateBackground) {
      return res.status(501).json({ error: `Provider "${row.ai_provider}" does not support background generation.` });
    }
    const { file, prompt } = await provider.generateBackground(description ?? "", imageBase64, styleMode ?? "shape", artStyle);
    const filename = `bg_${uuid()}.${file.ext}`;
    writeFileSync(join(UPLOAD_DIR, filename), file.data);
    res.json({ backgroundUrl: `/uploads/${filename}`, prompt });
  } catch (err) {
    console.error("Background generation error:", err);
    res.status(500).json({ error: "Background generation failed — please try again." });
  }
});
