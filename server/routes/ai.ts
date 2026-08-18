import { Router, type Request, type Response, type NextFunction } from "express";
import { v4 as uuid } from "uuid";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import db, { UPLOAD_DIR } from "../db.js";
import { getServerProvider, type SpriteGenerationResult, type BackgroundGenerationResult } from "../ai/index.js";
import { isFlagged } from "./moderation.js";
import { checkFacilitatorAuth } from "../auth.js";

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

function recordChoice(kind: "character" | "world", chosen: "text" | "image", childId: string) {
  db.prepare(
    "INSERT INTO generation_choices (id, kind, chosen, child_id) VALUES (?, ?, ?, ?)"
  ).run(uuid(), kind, chosen, childId);
}

// ── Character sprites ───────────────────────────────────────────────────────────

interface SpriteMeta {
  childId: string;
  label: string;
  createdAt: string;
  text:  { prompt: string; sprites: Record<string, string> };
  image: { prompt: string; sprites: Record<string, string> };
}

// POST /api/ai/sprites — generate TWO candidate sprite packs for a child's drawing (one
// text-only, one image-to-image) and return both for the child to choose between. Neither
// is written to sprite_versions yet — that happens in /sprites/:versionId/choose once the
// child picks one.
// Body: { childId, description, styleMode?, artStyle? }
// The drawing photo itself is NOT taken from the request body — it's looked up server-side
// from the child's latest teacher-approved photo_captures record, so this can't be triggered
// with an arbitrary/unapproved photo by calling the endpoint directly.
// Returns: { versionId, label, createdAt, options: { text: {prompt, sprites}, image: {prompt, sprites} } }
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
    const { text, image } = await provider.generateSprites(description, drawingBase64, styleMode, artStyle);

    const versionId = uuid();
    const versionDir = join(UPLOAD_DIR, "sprites", versionId);

    function saveOption(name: "text" | "image", result: SpriteGenerationResult) {
      const dir = join(versionDir, name);
      mkdirSync(dir, { recursive: true });
      const sprites: Record<string, string> = {};
      for (const [pose, { data, ext }] of Object.entries(result.sprites)) {
        const filename = `${pose}.${ext}`;
        writeFileSync(join(dir, filename), data);
        sprites[pose] = `/uploads/sprites/${versionId}/${name}/${filename}`;
      }
      return { prompt: result.prompt, sprites };
    }

    const textOption  = saveOption("text", text);
    const imageOption = saveOption("image", image);

    const { n } = db.prepare(
      "SELECT COUNT(*) as n FROM sprite_versions WHERE child_id = ?"
    ).get(childId) as { n: number };
    const label = VERSION_LABELS[n] ?? `Try ${n + 1}`;
    const createdAt = new Date().toISOString();

    const meta: SpriteMeta = { childId, label, createdAt, text: textOption, image: imageOption };
    writeFileSync(join(versionDir, "meta.json"), JSON.stringify(meta));

    res.json({ versionId, label, createdAt, options: { text: textOption, image: imageOption } });
  } catch (err) {
    console.error("Sprite generation error:", err);
    res.status(500).json({ error: "Character generation failed — please try again." });
  }
});

// POST /api/ai/sprites/:versionId/choose — the child picks "text" or "image"; that option
// becomes the real sprite_versions row (and the only one that survives into publish/preview/
// history). The chosen option's prompt+sprites are read back from the meta.json written
// during /sprites, not trusted from the request body.
// Body: { childId, chosen: "text" | "image" }
// Returns: { id, label, prompt, sprites, createdAt } — a normal SpriteVersion shape
aiRouter.post("/sprites/:versionId/choose", (req, res) => {
  const { versionId } = req.params;
  const { childId, chosen } = req.body as { childId?: string; chosen?: "text" | "image" };
  if (!childId || (chosen !== "text" && chosen !== "image")) {
    return res.status(400).json({ error: "childId and a valid chosen ('text'|'image') are required" });
  }

  const metaPath = join(UPLOAD_DIR, "sprites", versionId, "meta.json");
  if (!existsSync(metaPath)) return res.status(404).json({ error: "That generation wasn't found — try again." });

  const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as SpriteMeta;
  if (meta.childId !== childId) return res.status(403).json({ error: "That generation belongs to a different child." });

  const option = meta[chosen];
  db.prepare(
    "INSERT INTO sprite_versions (id, child_id, label, prompt, sprites) VALUES (?, ?, ?, ?, ?)"
  ).run(versionId, childId, meta.label, option.prompt, JSON.stringify(option.sprites));
  recordChoice("character", chosen, childId);

  res.json({ id: versionId, label: meta.label, prompt: option.prompt, sprites: option.sprites, createdAt: meta.createdAt });
});

// ── World / background ──────────────────────────────────────────────────────────

interface BackgroundMeta {
  childId: string;
  createdAt: string;
  text:  { prompt: string; backgroundUrl: string };
  image: { prompt: string; backgroundUrl: string };
}

// POST /api/ai/background — generate TWO candidate background images from a teacher-captured
// world photo (one text-only, one image-to-image), refined by an optional description and an
// art-style choice. Neither is "final" until /background/:versionId/choose is called.
// Body: { childId, description?, styleMode, artStyle? }
// Returns: { versionId, options: { text: {prompt, backgroundUrl}, image: {prompt, backgroundUrl} } }
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
    const { text, image } = await provider.generateBackground(description ?? "", imageBase64, styleMode ?? "shape", artStyle);

    const versionId = uuid();
    const dir = join(UPLOAD_DIR, "backgrounds", versionId);
    mkdirSync(dir, { recursive: true });

    function saveOption(name: "text" | "image", result: BackgroundGenerationResult) {
      const filename = `${name}.${result.file.ext}`;
      writeFileSync(join(dir, filename), result.file.data);
      return { prompt: result.prompt, backgroundUrl: `/uploads/backgrounds/${versionId}/${filename}` };
    }

    const textOption  = saveOption("text", text);
    const imageOption = saveOption("image", image);
    const createdAt = new Date().toISOString();

    const meta: BackgroundMeta = { childId, createdAt, text: textOption, image: imageOption };
    writeFileSync(join(dir, "meta.json"), JSON.stringify(meta));

    res.json({ versionId, options: { text: textOption, image: imageOption } });
  } catch (err) {
    console.error("Background generation error:", err);
    res.status(500).json({ error: "Background generation failed — please try again." });
  }
});

// POST /api/ai/background/:versionId/choose — the child picks "text" or "image"; records the
// choice and returns that option's URL/prompt, read back from meta.json (not the request body).
// Body: { childId, chosen: "text" | "image" }
// Returns: { backgroundUrl, prompt }
aiRouter.post("/background/:versionId/choose", (req, res) => {
  const { versionId } = req.params;
  const { childId, chosen } = req.body as { childId?: string; chosen?: "text" | "image" };
  if (!childId || (chosen !== "text" && chosen !== "image")) {
    return res.status(400).json({ error: "childId and a valid chosen ('text'|'image') are required" });
  }

  const metaPath = join(UPLOAD_DIR, "backgrounds", versionId, "meta.json");
  if (!existsSync(metaPath)) return res.status(404).json({ error: "That generation wasn't found — try again." });

  const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as BackgroundMeta;
  if (meta.childId !== childId) return res.status(403).json({ error: "That generation belongs to a different child." });

  const option = meta[chosen];
  recordChoice("world", chosen, childId);

  res.json({ backgroundUrl: option.backgroundUrl, prompt: option.prompt });
});

// GET /api/ai/stats/generation-choices — global, cross-session tally of text-vs-image choices,
// for facilitators deciding later whether one option should be retired.
aiRouter.get("/stats/generation-choices", (req, res) => {
  if (!checkFacilitatorAuth(req, res)) return;
  const rows = db.prepare(`
    SELECT kind, chosen, COUNT(*) as n FROM generation_choices GROUP BY kind, chosen
  `).all() as Array<{ kind: string; chosen: string; n: number }>;
  res.json(rows);
});
