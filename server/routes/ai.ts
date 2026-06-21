import { Router } from "express";
import { v4 as uuid } from "uuid";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import db, { UPLOAD_DIR } from "../db.js";
import { getServerProvider } from "../ai/index.js";

const VERSION_LABELS = ["First try", "Second try", "Third try", "Fourth try"];

export const aiRouter = Router();

// POST /api/ai/sprites — generate a sprite pack for a child's drawing
// Body: { childId, description, drawingBase64 }
// Returns: { id, label, prompt, sprites, createdAt }
aiRouter.post("/sprites", async (req, res) => {
  const { childId, description, drawingBase64 = "" } = req.body as {
    childId?: string; description?: string; drawingBase64?: string;
  };

  if (!childId || !description) {
    return res.status(400).json({ error: "childId and description are required" });
  }

  const row = db.prepare(`
    SELECT c.id, s.ai_provider
    FROM   children c
    JOIN   sessions s ON s.id = c.session_id
    WHERE  c.id = ?
  `).get(childId) as { id: string; ai_provider: string } | undefined;

  if (!row) return res.status(404).json({ error: "Child not found" });

  try {
    const provider  = await getServerProvider(row.ai_provider);
    const buffers   = await provider.generateSprites(description, drawingBase64);

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
    const prompt = `Character: ${description}. Poses: idle, move, action, celebrate.`;

    db.prepare(
      "INSERT INTO sprite_versions (id, child_id, label, prompt, sprites) VALUES (?, ?, ?, ?, ?)"
    ).run(versionId, childId, label, prompt, JSON.stringify(sprites));

    res.json({ id: versionId, label, prompt, sprites, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error("Sprite generation error:", err);
    res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }
});
