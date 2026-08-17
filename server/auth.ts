import type { Request, Response } from "express";

// Single shared facilitator password (FACILITATOR_TOKEN). No per-user accounts —
// matches "session admin is facilitator-only for now" from the project's locked decisions.
// If FACILITATOR_TOKEN is unset, auth is open (used for local dev without any setup).
export function checkFacilitatorAuth(req: Request, res: Response): boolean {
  const token = process.env.FACILITATOR_TOKEN;
  if (!token) return true;
  if (req.headers.authorization !== `Bearer ${token}`) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}
