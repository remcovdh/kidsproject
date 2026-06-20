import { Router } from "express";

export const uploadRouter = Router();

// POST /api/uploads/drawing — child uploads their paper drawing
// Accepts multipart/form-data with field "drawing"
// Returns { drawingId, url }
uploadRouter.post("/drawing", (req, res) => {
  res.status(501).json({ error: "Not implemented" });
});
