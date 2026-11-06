import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { chat, resetSession } from "../chat/claude";
import { dealershipConfig, env } from "../config";
import { store } from "../data/store";

export const api = Router();

// Public widget config — branding only, no secrets.
api.get("/config", (_req, res) => {
  res.json({
    dealershipName: dealershipConfig.dealership.name,
    tagline: dealershipConfig.dealership.tagline,
    phone: dealershipConfig.dealership.phone,
    branding: dealershipConfig.branding
  });
});

api.post("/session", (_req, res) => {
  res.json({ sessionId: crypto.randomUUID() });
});

api.post("/chat", async (req, res) => {
  const { sessionId, message } = req.body ?? {};
  if (typeof sessionId !== "string" || !sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: "message too long" });
  }

  try {
    const result = await chat(sessionId, message.trim());
    res.json(result);
  } catch (err) {
    const isMissingCredentials =
      err instanceof Error && err.message.includes("Could not resolve authentication method");
    if (err instanceof Anthropic.AuthenticationError || isMissingCredentials) {
      console.error("Anthropic authentication failed — check ANTHROPIC_API_KEY");
      return res.status(503).json({
        error: "The assistant is not configured yet. Please call us instead.",
        phone: dealershipConfig.dealership.phone
      });
    }
    if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError) {
      return res.status(503).json({
        error: "The assistant is very busy right now — please try again in a moment."
      });
    }
    console.error("Chat error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

api.post("/session/reset", (req, res) => {
  const { sessionId } = req.body ?? {};
  if (typeof sessionId === "string" && sessionId) resetSession(sessionId);
  res.json({ ok: true });
});

// --- Admin endpoints (bearer token) ---

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== env.adminToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

api.get("/admin/leads", requireAdmin, (_req, res) => {
  res.json({ leads: [...store.leads].reverse() });
});

api.get("/admin/appointments", requireAdmin, (_req, res) => {
  res.json({ appointments: [...store.appointments].reverse() });
});

api.get("/admin/inventory", requireAdmin, (_req, res) => {
  res.json({ inventory: store.inventory });
});
