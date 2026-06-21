import { Router } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { extname } from "path";
import { UPLOAD_DIR } from "../db.js";

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename:    (_req, file, cb) => cb(null, `${uuid()}${extname(file.originalname) || ".png"}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    cb(null, file.mimetype.startsWith("image/"));
  },
});

export const uploadRouter = Router();

// POST /api/uploads/drawing — save a child's uploaded photo to disk
// Returns: { drawingUrl } — base64 is computed client-side from the original File object
uploadRouter.post("/drawing", upload.single("drawing"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file received" });

  res.json({ drawingUrl: `/uploads/${req.file.filename}` });
});
