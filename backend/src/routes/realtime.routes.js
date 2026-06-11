import { Router } from "express";
import { createRealtimeSession } from "../services/openai-realtime.service.js";

const router = Router();

router.post("/session", async (_req, res) => {
  try {
    const session = await createRealtimeSession();
    res.json(session);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({
      error: "REALTIME_SESSION_ERROR",
      message:
        error.userMessage ||
        "No pude iniciar la llamada IA. Revisa la API Key de OpenAI.",
    });
  }
});

export default router;

