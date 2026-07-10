import { Router } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { UPLOAD_DIR } from "../db.js";

// Map allowed MIME types to safe extensions.
// SVG is intentionally excluded — it can contain <script> tags.
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png":  ".png",
  "image/webp": ".webp",
  "image/gif":  ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${uuid()}${MIME_TO_EXT[file.mimetype] ?? ".jpg"}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    cb(null, file.mimetype in MIME_TO_EXT);
  },
});

export const uploadRouter = Router();

// POST /api/uploads/drawing — save a child's uploaded photo to disk
// Returns: { drawingUrl } — base64 is computed client-side from the original File object
uploadRouter.post("/drawing", upload.single("drawing"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file received" });

  res.json({ drawingUrl: `/uploads/${req.file.filename}` });
});
