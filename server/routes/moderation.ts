import { Router } from "express";

export const moderationRouter = Router();

const BLOCKED_WORDS: string[] = [
  // Add age-inappropriate terms here
];

// POST /api/moderation/check — check free-text input before sending to AI
// Body: { text, childId, sessionId }
// Returns: { allowed: boolean, flagged: boolean, reason?: string }
moderationRouter.post("/check", (req, res) => {
  const { text } = req.body as { text: string };

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }

  const lower = text.toLowerCase();
  const hit = BLOCKED_WORDS.find((w) => lower.includes(w));

  if (hit) {
    // Log for teacher dashboard — do not expose which word triggered
    return res.json({ allowed: false, flagged: true, reason: "inappropriate content" });
  }

  return res.json({ allowed: true, flagged: false });
});
