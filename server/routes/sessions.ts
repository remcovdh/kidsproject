import { Router } from "express";
import type { Session } from "../../packages/shared/index.js";

export const sessionRouter = Router();

// GET /api/sessions/:id — load session config for child-facing app
sessionRouter.get("/:id", (req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

// POST /api/sessions — create a new session (facilitator only)
sessionRouter.post("/", (req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

// GET /api/sessions/:id/gallery — all published games in session
sessionRouter.get("/:id/gallery", (req, res) => {
  res.status(501).json({ error: "Not implemented" });
});
