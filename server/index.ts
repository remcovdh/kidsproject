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
app.use(express.json({ limit: "15mb" }));

// Serve uploaded images (drawings + generated sprites) at /uploads/**
app.use("/uploads", express.static(UPLOAD_DIR));

app.use("/api/sessions",   sessionRouter);
app.use("/api/uploads",    uploadRouter);
app.use("/api/ai",         aiRouter);
app.use("/api/moderation", moderationRouter);

app.listen(PORT, () => {
  console.log(`API server →  http://localhost:${PORT}`);
});
