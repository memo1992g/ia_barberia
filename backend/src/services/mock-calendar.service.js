import { DateTime } from "luxon";
import { TIME_ZONE, formatDate, formatTime, parseTimeOnDate } from "../utils/date.utils.js";
import {
  getDurationForService,
  isAmbiguousServiceRequest,
  normalizeServiceName,
  validateBusinessRules,
  generateAlternativeSlots,
} from "../utils/availability.utils.js";

function ensureDuration(payload) {
  const duration = getDurationForService(payload.service);
  if (!duration) {
    const error = new Error("Servicio inválido.");
    error.statusCode = 400;
    error.userMessage = "Ese servicio no existe en la lista de servicios de la barbería.";
    throw error;
  }

  return duration;
}

export async function checkAvailabilityMock(payload) {
  const durationMinutes = ensureDuration(payload);
  const dateTime = parseTimeOnDate(payload.date, payload.startTime);
  const service = normalizeServiceName(payload.service);

  if (isAmbiguousServiceRequest(payload.service) && service === "Corte clásico") {
    return {
      available: false,
      message:
        "Claro, ofrecemos corte clásico, degradado o fade, barba, corte + barba, cejas y tratamiento capilar. ¿Cuál te gustaría?",
      alternatives: [],
    };
  }

  const rules = validateBusinessRules(dateTime, durationMinutes);
  if (!rules.ok) {
    return {
      available: false,
      message: rules.message,
      alternatives: payload.date ? [] : [],
    };
  }

  const occupied = payload.startTime === "15:00";
  if (occupied) {
    return {
      available: false,
      message: "Horario ocupado",
      alternatives: ["15:30", "16:00", "16:15"],
    };
  }

  return {
    available: true,
    message: "Horario disponible",
    alternatives: [],
  };
}

export async function createAppointmentMock(payload) {
  const durationMinutes = ensureDuration(payload);
  const dateTime = parseTimeOnDate(payload.date, payload.startTime);
  const service = normalizeServiceName(payload.service);
  if (isAmbiguousServiceRequest(payload.service) && service === "Corte clásico") {
    const error = new Error("Servicio ambiguo.");
    error.statusCode = 400;
    error.userMessage =
      "Claro, ofrecemos corte clásico, degradado o fade, barba, corte + barba, cejas y tratamiento capilar. ¿Cuál te gustaría?";
    throw error;
  }

  const rules = validateBusinessRules(dateTime, durationMinutes);
  if (!rules.ok) {
    const error = new Error(rules.message);
    error.statusCode = 400;
    error.userMessage = rules.message;
    throw error;
  }

  if (payload.startTime === "15:00") {
    const error = new Error("Horario ocupado");
    error.statusCode = 409;
    error.userMessage = "Horario ocupado";
    throw error;
  }

  return {
    success: true,
    eventId: `mock_${Date.now()}`,
    message: "Cita creada correctamente",
    event: {
      summary: `Cita - ${service} - ${payload.customerName}`,
      start: `${formatDate(dateTime)} ${formatTime(dateTime)}`,
      timezone: TIME_ZONE,
    },
  };
}
