import express from "express";
import { sessionRouter } from "./routes/sessions.js";
import { uploadRouter } from "./routes/uploads.js";
import { aiRouter } from "./routes/ai.js";
import { moderationRouter } from "./routes/moderation.js";

const app = express();
const PORT = process.env.PORT ?? 3002;

app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(process.env.UPLOAD_DIR ?? "./uploads"));

app.use("/api/sessions", sessionRouter);
app.use("/api/uploads", uploadRouter);
app.use("/api/ai", aiRouter);
app.use("/api/moderation", moderationRouter);

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
