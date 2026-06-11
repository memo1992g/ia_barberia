import { Router } from "express";
import {
  checkAvailabilityReal,
  createAppointmentReal,
  normalizeAppointmentPayload,
} from "../services/google-calendar.service.js";
import {
  checkAvailabilityMock,
  createAppointmentMock,
} from "../services/mock-calendar.service.js";

const router = Router();

function useMocks() {
  return String(process.env.USE_MOCKS || "").toLowerCase() === "true";
}

router.post("/availability", async (req, res) => {
  try {
    const payload = req.body || {};
    const normalized = normalizeAppointmentPayload(payload, true);

    const result = useMocks()
      ? await checkAvailabilityMock(normalized)
      : await checkAvailabilityReal(normalized);

    res.json(result);
  } catch (error) {
    const status = error.statusCode || 400;
    res.status(status).json({
      error: "AVAILABILITY_ERROR",
      message:
        error.userMessage || "No pude revisar la agenda. Revisa permisos del calendario.",
    });
  }
});

router.post("/appointment", async (req, res) => {
  try {
    const payload = req.body || {};
    const normalized = normalizeAppointmentPayload(payload, false);

    const result = useMocks()
      ? await createAppointmentMock(normalized)
      : await createAppointmentReal(normalized);

    res.json(result);
  } catch (error) {
    const status = error.statusCode || 400;
    res.status(status).json({
      error: "APPOINTMENT_ERROR",
      message:
        error.userMessage || "No pude crear la cita. Intenta nuevamente.",
    });
  }
});

export default router;

