import { Router, type Request, type Response, type NextFunction } from "express";
import { v4 as uuid } from "uuid";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import db, { UPLOAD_DIR } from "../db.js";
import { getServerProvider } from "../ai/index.js";
import { isFlagged } from "./moderation.js";

const VERSION_LABELS = ["First try", "Second try", "Third try", "Fourth try"];

export const aiRouter = Router();

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
// Body: { childId, description, drawingBase64 }
// Returns: { id, label, prompt, sprites, createdAt }
aiRouter.post("/sprites", async (req, res) => {
  const { childId, description, drawingBase64 = "", styleMode, artStyle } = req.body as {
    childId?: string; description?: string; drawingBase64?: string;
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

  if (row.ai_provider === "openai" && !process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is not set on the server. Add it to your .env file and restart.",
    });
  }

  try {
    const provider  = await getServerProvider(row.ai_provider);
    const buffers   = await provider.generateSprites(description, drawingBase64, styleMode, artStyle);

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
    const label  = VERSION_LABELS[n] ?? `Try ${n + 1}`;
    const styleDesc = styleMode === "copy" ? "copy drawing style" : `${artStyle ?? "cartoon"} (shape only)`;
    const prompt = `Character: ${description}. Style: ${styleDesc}. Poses: idle, move, celebrate.`;

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
// refined by an optional description and an art-style choice (mirrors /api/ai/sprites' shape/copy pattern)
// Body: { description?, imageBase64, styleMode, artStyle? }
// Returns: { backgroundUrl }
aiRouter.post("/background", async (req, res) => {
  const { description, imageBase64, styleMode, artStyle } = req.body as {
    description?: string; imageBase64?: string; styleMode?: "shape" | "copy"; artStyle?: string;
  };
  if (!imageBase64) {
    return res.status(400).json({ error: "imageBase64 is required" });
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

  const providerName = process.env.AI_PROVIDER ?? "openai";
  if (providerName === "openai" && !process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is not set on the server. Add it to your .env file and restart.",
    });
  }

  try {
    const provider = await getServerProvider(providerName);
    if (!provider.generateBackground) {
      return res.status(501).json({ error: `Provider "${providerName}" does not support background generation.` });
    }
    const { data, ext } = await provider.generateBackground(description ?? "", imageBase64, styleMode ?? "shape", artStyle);
    const filename = `bg_${uuid()}.${ext}`;
    writeFileSync(join(UPLOAD_DIR, filename), data);
    res.json({ backgroundUrl: `/uploads/${filename}` });
  } catch (err) {
    console.error("Background generation error:", err);
    res.status(500).json({ error: "Background generation failed — please try again." });
  }
});
