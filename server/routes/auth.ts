import { Router } from "express";

export const authRouter = Router();

// POST /api/auth/login — validate the shared facilitator password and echo back the
// token the admin app should attach as `Authorization: Bearer <token>` on subsequent
// facilitator-gated requests. If FACILITATOR_TOKEN is unset, login is open (mirrors
// checkFacilitatorAuth's existing "no auth configured" behavior).
authRouter.post("/login", (req, res) => {
  const token = process.env.FACILITATOR_TOKEN;
  if (!token) return res.json({ token: "" });

  const { password } = req.body as { password?: string };
  if (password !== token) {
    return res.status(401).json({ error: "Invalid password" });
  }
  res.json({ token });
});
