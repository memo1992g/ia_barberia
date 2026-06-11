import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import realtimeRoutes from "./src/routes/realtime.routes.js";
import calendarRoutes from "./src/routes/calendar.routes.js";

dotenv.config({ override: true });

const app = express();
const port = Number(process.env.PORT || 3001);
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";

app.use(
  cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "evo-voice-agent-backend" });
});

app.use("/api/realtime", realtimeRoutes);
app.use("/api/calendar", calendarRoutes);

app.use((err, _req, res, _next) => {
  console.error("Unhandled backend error:", err);
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "Ha ocurrido un error inesperado en el backend.",
  });
});

app.listen(port, () => {
  console.log(`EVO Voice Agent backend listening on http://localhost:${port}`);
});
