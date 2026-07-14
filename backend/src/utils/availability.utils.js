import {
  BUFFER_MINUTES,
  BUSINESS_END_HOUR,
  BUSINESS_START_HOUR,
  SLOT_STEP_MINUTES,
  TIME_ZONE,
  addMinutes,
  formatDate,
  formatTime,
  getBusinessWindow,
  isPastDateTime,
  isSunday,
  nowInZone,
  nextBusinessDay,
  parseTimeOnDate,
  roundUpToStep,
} from "./date.utils.js";

export const SERVICE_DURATIONS = {
  "Corte clásico": 30,
  "Degradado / Fade": 45,
  Barba: 25,
  "Corte + barba": 60,
  Cejas: 15,
  "Tratamiento capilar": 60,
};

export const SERVICE_PRICES = {
  "Corte clásico": 8,
  "Degradado / Fade": 10,
  Barba: 5,
  "Corte + barba": 12,
  Cejas: 4,
  "Tratamiento capilar": 15,
};

const SERVICE_ALIASES = {
  "corte de cabello": "Corte clásico",
  corte: "Corte clásico",
  "corte clásico": "Corte clásico",
  "corte clasico": "Corte clásico",
  "corte barba": "Corte + barba",
  fade: "Degradado / Fade",
  degradado: "Degradado / Fade",
  "degradado / fade": "Degradado / Fade",
  barba: "Barba",
  "corte y barba": "Corte + barba",
  "corte + barba": "Corte + barba",
  cejas: "Cejas",
  "tratamiento capilar": "Tratamiento capilar",
};

const SERVICE_NAME_LOOKUP = Object.keys(SERVICE_DURATIONS).reduce((acc, name) => {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  acc[normalized] = name;
  return acc;
}, {});

function normalizeServiceToken(token) {
  const normalized = String(token || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return SERVICE_ALIASES[normalized] || SERVICE_NAME_LOOKUP[normalized] || "";
}

function splitServiceRequest(service) {
  const raw = String(service || "").trim();
  if (!raw) return [];

  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const exact = normalizeServiceToken(normalized);
  if (exact) {
    return [exact];
  }

  return normalized
    .split(/\s*(?:\+|\/|\by\b|\bcon\b)\s*/i)
    .map((part) => normalizeServiceToken(part))
    .filter(Boolean)
    .filter((part, index, array) => array.indexOf(part) === index);
}

export function buildServiceCatalogMessage() {
  return [
    "Claro, estos son los servicios y precios:",
    "Corte clásico: $8",
    "Degradado / Fade: $10",
    "Barba: $5",
    "Cejas: $4",
    "Tratamiento capilar: $15",
    "También podés pedir combinados como corte + barba o barba + cejas; en ese caso se suman los servicios.",
  ].join(" ");
}

const DIGIT_WORDS = {
  cero: "0",
  uno: "1",
  una: "1",
  un: "1",
  dos: "2",
  tres: "3",
  cuatro: "4",
  cinco: "5",
  seis: "6",
  siete: "7",
  ocho: "8",
  nueve: "9",
};

const TEENS_WORDS = {
  diez: "10",
  once: "11",
  doce: "12",
  trece: "13",
  catorce: "14",
  quince: "15",
  dieciseis: "16",
  dieciséis: "16",
  diecisiete: "17",
  dieciocho: "18",
  diecinueve: "19",
};

const TENS_WORDS = {
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};

export function normalizeServiceName(service) {
  const parts = splitServiceRequest(service);
  if (parts.length === 1) {
    return parts[0];
  }

  if (parts.length > 1) {
    return parts.join(" + ");
  }

  return String(service || "").trim();
}

export function isAmbiguousServiceRequest(service) {
  const parts = splitServiceRequest(service);
  if (parts.length > 1) {
    return false;
  }

  const normalized = String(service || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized === "corte" || normalized.includes("corte de pelo") || normalized.includes("corte de cabello");
}

export function getDurationForService(service) {
  const parts = splitServiceRequest(service);
  if (parts.length === 0) return null;

  const duration = parts.reduce((total, part) => total + (SERVICE_DURATIONS[part] || 0), 0);
  return duration > 0 ? duration : null;
}

export function getPriceForService(service) {
  const parts = splitServiceRequest(service);
  if (parts.length === 0) return null;

  const price = parts.reduce((total, part) => total + (SERVICE_PRICES[part] || 0), 0);
  return price > 0 ? price : null;
}

function normalizeWordToken(token) {
  return String(token || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseSpanishNumberWords(value) {
  const tokens = String(value || "")
    .replace(/[.,;:()]/g, " ")
    .split(/[\s-]+/)
    .map(normalizeWordToken)
    .filter(Boolean);

  let digits = "";

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token in DIGIT_WORDS) {
      digits += DIGIT_WORDS[token];
      continue;
    }

    if (token in TEENS_WORDS) {
      digits += TEENS_WORDS[token];
      continue;
    }

    if (token in TENS_WORDS) {
      const tenValue = TENS_WORDS[token];
      const nextToken = tokens[index + 1];
      const nextNextToken = tokens[index + 2];

      if (nextToken === "y" && nextNextToken && nextNextToken in DIGIT_WORDS) {
        digits += String(tenValue + Number(DIGIT_WORDS[nextNextToken]));
        index += 2;
        continue;
      }

      digits += String(tenValue);
      continue;
    }

    if (/^\d+$/.test(token)) {
      digits += token;
    }
  }

  return digits;
}

export function normalizePhoneInput(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";

  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .trim();

  const numericCandidate = cleaned.replace(/[^\d+]/g, "");
  const digitsFromNumbers = numericCandidate.replace(/^\+/, "");
  const digitsFromWords = parseSpanishNumberWords(cleaned);

  let digits = digitsFromNumbers.length >= 8 ? digitsFromNumbers : digitsFromWords;

  if (digits.startsWith("503") && digits.length === 11) {
    digits = digits.slice(3);
  }

  if (digits.length === 8) {
    return `+503 ${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  if (digits.length === 11 && digits.startsWith("503")) {
    return `+503 ${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return raw;
}

export function isValidPhoneInput(phone) {
  const normalized = normalizePhoneInput(phone);
  const digits = normalized.replace(/[^\d]/g, "");
  return digits.length === 11 && digits.startsWith("503");
}

export function buildBusyIntervals(busyBlocks = []) {
  return busyBlocks.map((busy) => {
    const start = busy.start?.dateTime || busy.start?.date;
    const end = busy.end?.dateTime || busy.end?.date;
    return { start, end };
  });
}

function overlapsWithBuffer(candidateStart, candidateEnd, busyStart, busyEnd) {
  const bufferedStart = busyStart.minus({ minutes: BUFFER_MINUTES });
  const bufferedEnd = busyEnd.plus({ minutes: BUFFER_MINUTES });
  return candidateStart < bufferedEnd && candidateEnd > bufferedStart;
}

export function slotConflicts(candidateStart, candidateEnd, busyBlocks) {
  return busyBlocks.some((busy) => {
    const busyStart = parseTimeOnDate(busy.startDate, busy.startTime);
    const busyEnd = parseTimeOnDate(busy.endDate, busy.endTime);
    return overlapsWithBuffer(candidateStart, candidateEnd, busyStart, busyEnd);
  });
}

export function buildCalendarWindow(dateString) {
  const dayStart = parseTimeOnDate(dateString, "00:00");
  const dayEnd = parseTimeOnDate(dateString, "23:59");
  return { dayStart, dayEnd };
}

export function normalizeDateTimeInput(dateString, startTime) {
  return parseTimeOnDate(dateString, startTime);
}

export function validateBusinessRules(dateTime, durationMinutes) {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return {
      ok: false,
      reason: "Duracion invalida",
      message: "La duración del servicio no es válida.",
    };
  }

  if (isSunday(dateTime)) {
    return {
      ok: false,
      reason: "Cerrado el domingo",
      message: "La barbería está cerrada los domingos. Te puedo ofrecer lunes.",
    };
  }

  const end = addMinutes(dateTime, durationMinutes);
  const window = getBusinessWindow(dateTime);

  if (dateTime < nowInZone().startOf("minute")) {
    return {
      ok: false,
      reason: "Horario pasado",
      message: "No puedo agendar una cita en un horario pasado.",
    };
  }

  if (dateTime < window.start || end > window.end) {
    return {
      ok: false,
      reason: "Fuera de horario",
      message: `La barbería atiende de ${BUSINESS_START_HOUR
        .toString()
        .padStart(2, "0")}:00 a ${BUSINESS_END_HOUR}:00.`,
    };
  }

  return { ok: true };
}

export function getDayLabel(dateTime) {
  return dateTime.setZone(TIME_ZONE).toFormat("cccc");
}

export function generateAlternativeSlots({
  currentDate,
  requestedStartTime,
  durationMinutes,
  busyBlocks = [],
}) {
  const alternatives = [];
  let searchDate = currentDate.setZone(TIME_ZONE);
  const requested = parseTimeOnDate(formatDate(searchDate), requestedStartTime);

  const maxDaysToScan = 7;
  for (let dayIndex = 0; dayIndex < maxDaysToScan && alternatives.length < 3; dayIndex += 1) {
    if (dayIndex > 0) {
      searchDate = nextBusinessDay(searchDate);
    }

    if (isSunday(searchDate)) {
      continue;
    }

    const startOfBusiness = searchDate.set({
      hour: BUSINESS_START_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    const endOfBusiness = searchDate.set({
      hour: BUSINESS_END_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    });

    let cursor = dayIndex === 0 ? roundUpToStep(requested, SLOT_STEP_MINUTES) : startOfBusiness;
    if (dayIndex === 0 && cursor < startOfBusiness) {
      cursor = startOfBusiness;
    }

    const passes = [1, -1];
    for (const direction of passes) {
      let candidate = cursor;
      while (candidate >= startOfBusiness && candidate < endOfBusiness && alternatives.length < 3) {
        const candidateEnd = candidate.plus({ minutes: durationMinutes });
        if (candidateEnd <= endOfBusiness && !slotConflicts(candidate, candidateEnd, busyBlocks)) {
          const formatted = formatTime(candidate);
          if (!alternatives.includes(formatted)) {
            alternatives.push(formatted);
          }
        }

        candidate = candidate.plus({ minutes: direction * SLOT_STEP_MINUTES });
        if (direction === 1 && candidate <= requested && dayIndex === 0) {
          continue;
        }
      }
    }

    if (dayIndex === 0 && alternatives.length > 0) {
      const forward = alternatives.filter((slot) => slot >= requestedStartTime);
      const backward = alternatives.filter((slot) => slot < requestedStartTime);
      const ordered = [...forward, ...backward];
      return ordered.slice(0, 3);
    }
  }

  return alternatives.slice(0, 3);
}
