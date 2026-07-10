import "./env.js"; // Must be first — loads .env before any other module reads process.env

import express from "express";
import cors from "cors";
import db, { UPLOAD_DIR } from "./db.js";
import { sessionRouter }    from "./routes/sessions.js";
import { uploadRouter }     from "./routes/uploads.js";
import { aiRouter }         from "./routes/ai.js";
import { moderationRouter } from "./routes/moderation.js";

if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️  OPENAI_API_KEY not set — sprite generation will fail in real mode.");
}

const app  = express();
const PORT = process.env.PORT ?? 3002;

app.use(cors());

// Serve uploaded images (drawings + generated sprites) at /uploads/**
app.use("/uploads", express.static(UPLOAD_DIR));

// AI routes carry drawingBase64 / imageBase64 — give them a large limit.
// All other routes only need small JSON payloads.
app.use("/api/ai",         express.json({ limit: "15mb" }), aiRouter);
app.use(express.json({ limit: "50kb" }));
app.use("/api/sessions",   sessionRouter);
app.use("/api/uploads",    uploadRouter);
app.use("/api/moderation", moderationRouter);

app.listen(PORT, () => {
  console.log(`API server →  http://localhost:${PORT}`);
});
