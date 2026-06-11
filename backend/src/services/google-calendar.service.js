import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { DateTime } from "luxon";
import {
  BUFFER_MINUTES,
  TIME_ZONE,
  formatDate,
  formatTime,
  normalizeDateInput,
  normalizeTimeInput,
  parseTimeOnDate,
  toIsoWithZone,
} from "../utils/date.utils.js";
import {
  generateAlternativeSlots,
  getDurationForService,
  isAmbiguousServiceRequest,
  isValidPhoneInput,
  normalizeServiceName,
  normalizePhoneInput,
  validateBusinessRules,
} from "../utils/availability.utils.js";

function normalizePrivateKey(key) {
  return String(key || "").replace(/\\n/g, "\n");
}

function loadServiceAccount() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath) {
    const resolved = path.resolve(credentialsPath);
    if (fs.existsSync(resolved)) {
      const raw = fs.readFileSync(resolved, "utf8");
      return JSON.parse(raw);
    }
  }

  return {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
  };
}

function getCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID;
}

function createCalendarClient() {
  const creds = loadServiceAccount();
  if (!creds.client_email || !creds.private_key) {
    const error = new Error("Credenciales de Google incompletas.");
    error.statusCode = 500;
    error.userMessage =
      "No tengo permiso para acceder al calendario. Revisa que la cuenta de servicio esté compartida con permiso para hacer cambios en eventos.";
    throw error;
  }

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({ version: "v3", auth });
}

function mapGoogleError(error) {
  const status = error?.code || error?.response?.status || 500;
  if (status === 403 || status === 401) {
    const mapped = new Error(
      "No tengo permiso para acceder al calendario. Revisa que la cuenta de servicio esté compartida con permiso para hacer cambios en eventos."
    );
    mapped.statusCode = 403;
    mapped.userMessage =
      "No tengo permiso para acceder al calendario. Revisa que la cuenta de servicio esté compartida con permiso para hacer cambios en eventos.";
    return mapped;
  }

  return error;
}

function buildBusyBlocks(items = []) {
  return items
    .map((item) => {
      const startValue =
        typeof item?.start === "string"
          ? item.start
          : item?.start?.dateTime || item?.start?.date;
      const endValue =
        typeof item?.end === "string" ? item.end : item?.end?.dateTime || item?.end?.date;

      if (!startValue || !endValue) {
        return null;
      }

      const start = DateTime.fromISO(startValue, { zone: TIME_ZONE });
      const end = DateTime.fromISO(endValue, { zone: TIME_ZONE });

      if (!start.isValid || !end.isValid) {
        return null;
      }

      return {
        startDate: formatDate(start),
        startTime: formatTime(start),
        endDate: formatDate(end),
        endTime: formatTime(end),
      };
    })
    .filter(Boolean);
}

async function fetchBusyBlocksForDate(calendar, dateString) {
  const dayStart = parseTimeOnDate(dateString, "00:00");
  const dayEnd = parseTimeOnDate(dateString, "23:59");

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: toIsoWithZone(dayStart),
      timeMax: toIsoWithZone(dayEnd),
      items: [{ id: getCalendarId() }],
      timeZone: TIME_ZONE,
    },
  });

  const calendarData = response.data.calendars?.[getCalendarId()];
  const busyItems = calendarData?.busy || [];

  return busyItems;
}

export function normalizeAppointmentPayload(payload, allowMissingConfirmation = false) {
  const customerName = String(payload.customerName || "").trim();
  const phone = normalizePhoneInput(payload.phone);
  const service = normalizeServiceName(payload.service);
  if (isAmbiguousServiceRequest(payload.service) && service === "Corte clásico") {
    const error = new Error("Servicio ambiguo.");
    error.statusCode = 400;
    error.userMessage =
      "Claro, ofrecemos corte clásico, degradado o fade, barba, corte + barba, cejas y tratamiento capilar. ¿Cuál te gustaría?";
    throw error;
  }
  const date = normalizeDateInput(payload.date);
  const startTime = normalizeTimeInput(payload.startTime);
  const catalogDuration = getDurationForService(service);
  const durationMinutes = catalogDuration;

  if (!service) {
    const error = new Error("Falta el servicio.");
    error.statusCode = 400;
    error.userMessage = "No puedo crear una cita sin servicio.";
    throw error;
  }

  if (!catalogDuration) {
    const error = new Error("Servicio inválido.");
    error.statusCode = 400;
    error.userMessage = "Ese servicio no existe en la lista de servicios de la barbería.";
    throw error;
  }

  if (!date || !startTime) {
    const error = new Error("Falta fecha u hora.");
    error.statusCode = 400;
    error.userMessage = "No puedo crear una cita sin fecha y hora.";
    throw error;
  }

  if (!allowMissingConfirmation && (!customerName || !phone)) {
    const error = new Error("Faltan datos obligatorios.");
    error.statusCode = 400;
    error.userMessage = "No puedo crear una cita sin nombre y teléfono.";
    throw error;
  }

  if (customerName && customerName.length < 2) {
    const error = new Error("Nombre inválido.");
    error.statusCode = 400;
    error.userMessage = "El nombre debe tener al menos 2 caracteres.";
    throw error;
  }

  if (customerName && /^[0-9\s+-]+$/.test(customerName)) {
    const error = new Error("Nombre inválido.");
    error.statusCode = 400;
    error.userMessage = "El nombre no puede ser solo números.";
    throw error;
  }

  if (phone && !isValidPhoneInput(phone)) {
    const error = new Error("Teléfono inválido.");
    error.statusCode = 400;
    error.userMessage = "Me repetís tu número, por favor. Necesito un número de 8 dígitos.";
    throw error;
  }

  return {
    customerName,
    phone,
    service,
    date,
    startTime,
    durationMinutes,
  };
}

export async function checkAvailabilityReal(payload) {
  const normalized = normalizeAppointmentPayload(payload, true);
  const calendar = createCalendarClient();
  const calendarId = getCalendarId();
  if (!calendarId) {
    const error = new Error("Falta GOOGLE_CALENDAR_ID.");
    error.statusCode = 500;
    error.userMessage = "No pude revisar la agenda. Revisa permisos del calendario.";
    throw error;
  }

  try {
    const durationMinutes = normalized.durationMinutes;
    const dateTime = parseTimeOnDate(normalized.date, normalized.startTime);
    const rules = validateBusinessRules(dateTime, durationMinutes);

    if (!rules.ok) {
      return {
        available: false,
        message: rules.message,
        alternatives:
          rules.reason === "Cerrado el domingo"
            ? [formatTime(dateTime.plus({ days: 1 }).set({ hour: 9, minute: 0 }))]
            : [],
      };
    }

    const busyItems = await fetchBusyBlocksForDate(calendar, normalized.date);
    const busyBlocks = buildBusyBlocks(busyItems);

    const candidateEnd = dateTime.plus({ minutes: durationMinutes });
    const hasConflict = busyBlocks.some((busy) => {
      const busyStart = parseTimeOnDate(busy.startDate, busy.startTime);
      const busyEnd = parseTimeOnDate(busy.endDate, busy.endTime);
      const bufferedStart = busyStart.minus({ minutes: BUFFER_MINUTES });
      const bufferedEnd = busyEnd.plus({ minutes: BUFFER_MINUTES });
      return dateTime < bufferedEnd && candidateEnd > bufferedStart;
    });

    if (hasConflict) {
      const alternatives = generateAlternativeSlots({
        currentDate: dateTime,
        requestedStartTime: normalized.startTime,
        durationMinutes,
        busyBlocks,
      });
      return {
        available: false,
        message: "Horario ocupado",
        alternatives,
      };
    }

    return {
      available: true,
      message: "Horario disponible",
      alternatives: [],
    };
  } catch (error) {
    throw mapGoogleError(error);
  }
}

export async function createAppointmentReal(payload) {
  const normalized = normalizeAppointmentPayload(payload, false);
  const calendar = createCalendarClient();
  const calendarId = getCalendarId();
  if (!calendarId) {
    const error = new Error("Falta GOOGLE_CALENDAR_ID.");
    error.statusCode = 500;
    error.userMessage = "No pude crear la cita. Intenta nuevamente.";
    throw error;
  }

  try {
    const service = normalized.service;
    const durationMinutes = normalized.durationMinutes;
    const dateTime = parseTimeOnDate(normalized.date, normalized.startTime);
    const rules = validateBusinessRules(dateTime, durationMinutes);

    if (!rules.ok) {
      const error = new Error(rules.message);
      error.statusCode = 400;
      error.userMessage = rules.message;
      throw error;
    }

    const availability = await checkAvailabilityReal(normalized);
    if (!availability.available) {
      const error = new Error("Horario ocupado");
      error.statusCode = 409;
      error.userMessage = "Horario ocupado";
      throw error;
    }

    const endTime = dateTime.plus({ minutes: durationMinutes });
    const startIso = dateTime.toISO({ suppressMilliseconds: true });
    const endIso = endTime.toISO({ suppressMilliseconds: true });

    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `Cita - ${service} - ${payload.customerName}`,
        description: [
          `Cliente: ${payload.customerName}`,
          `Teléfono: ${normalized.phone}`,
          `Servicio: ${service}`,
          `Fecha: ${normalized.date}`,
          `Hora: ${normalized.startTime}`,
          `Duración: ${durationMinutes} minutos`,
          "Creado por: EVO Voice Agent",
          "Demo: Imperial Barber Studio",
        ].join("\n"),
        location: "Imperial Barber Studio",
        start: {
          dateTime: startIso,
          timeZone: TIME_ZONE,
        },
        end: {
          dateTime: endIso,
          timeZone: TIME_ZONE,
        },
        transparency: "opaque",
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
            { method: "email", minutes: 120 },
          ],
        },
        colorId: "5",
      },
    });

    return {
      success: true,
      eventId: response.data.id,
      message: "Cita creada correctamente",
      event: {
        summary: response.data.summary,
        start: normalized.startTime,
        date: normalized.date,
        service,
        customerName: normalized.customerName,
        phone: normalized.phone,
      },
    };
  } catch (error) {
    throw mapGoogleError(error);
  }
}
