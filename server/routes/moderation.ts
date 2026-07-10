import { Router } from "express";

export const moderationRouter = Router();

const BLOCKED_WORDS: string[] = [
  // Violence
  "kill", "murder", "stab", "shoot", "blood", "dead",
  // Explicit
  "sex", "porn", "nude", "naked",
  // Strong profanity (list is intentionally short — teacher is always present)
  "fuck", "shit", "bitch", "cunt", "asshole",
];

export function isFlagged(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
}

// POST /api/moderation/check — check free-text input before sending to AI
// Body: { text, childId, sessionId }
// Returns: { allowed: boolean, flagged: boolean, reason?: string }
moderationRouter.post("/check", (req, res) => {
  const { text } = req.body as { text: string };

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }

  if (isFlagged(text)) {
    return res.json({ allowed: false, flagged: true, reason: "inappropriate content" });
  }

  return res.json({ allowed: true, flagged: false });
});
