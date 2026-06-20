import { Router } from "express";
import { getProvider, buildSpritePrompt } from "../../packages/ai/index.js";

export const aiRouter = Router();

// POST /api/ai/sprites — generate sprite pack for a child's drawing
// Body: { sessionId, childId, drawingBase64, description, gameType }
// Returns: { versionId, label, sprites: { idle, move, action, celebrate } }
aiRouter.post("/sprites", async (req, res) => {
  res.status(501).json({ error: "Not implemented" });
});
