import { DateTime } from "luxon";

export const TIME_ZONE = "America/El_Salvador";
export const BUSINESS_START_HOUR = 9;
export const BUSINESS_END_HOUR = 19;
export const SLOT_STEP_MINUTES = 15;
export const BUFFER_MINUTES = 10;

const WEEKDAY_MAP: Record<string, number> = {
  domingo: 7,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

export function nowInZone() {
  return DateTime.now().setZone(TIME_ZONE);
}

export function normalizeDateInput(input: unknown) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const today = nowInZone().startOf("day");

  if (raw === "hoy") {
    return formatDate(today);
  }

  if (raw === "mañana" || raw === "manana") {
    return formatDate(today.plus({ days: 1 }));
  }

  if (raw === "pasado mañana" || raw === "pasado manana") {
    return formatDate(today.plus({ days: 2 }));
  }

  const matchedWeekday = Object.entries(WEEKDAY_MAP).find(([name]) => raw.includes(name));
  if (matchedWeekday) {
    const weekday = matchedWeekday[1];
    let cursor = today.plus({ days: 1 });
    while (cursor.weekday !== weekday) {
      cursor = cursor.plus({ days: 1 });
    }
    return formatDate(cursor);
  }

  return String(input).trim();
}

export function normalizeTimeInput(input: unknown) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "";

  if (/^\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

  const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?|am|pm|de la mañana|de la tarde|de la noche)?/i);
  if (!match) {
    return String(input).trim();
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const suffix = (match[3] || "").toLowerCase();

  if (suffix.includes("a") || suffix.includes("mañana")) {
    if (hour === 12) hour = 0;
  } else if (suffix.includes("p") || suffix.includes("tarde") || suffix.includes("noche")) {
    if (hour < 12) hour += 12;
  } else if (hour >= 1 && hour <= 7) {
    hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseTimeOnDate(dateString: string, timeString: string) {
  const [hour, minute] = String(timeString)
    .split(":")
    .map((value) => Number(value));

  return DateTime.fromObject(
    {
      year: Number(dateString.slice(0, 4)),
      month: Number(dateString.slice(5, 7)),
      day: Number(dateString.slice(8, 10)),
      hour,
      minute,
      second: 0,
      millisecond: 0,
    },
    { zone: TIME_ZONE }
  );
}

export function formatDate(dateTime: DateTime) {
  return dateTime.setZone(TIME_ZONE).toFormat("yyyy-LL-dd");
}

export function formatTime(dateTime: DateTime) {
  return dateTime.setZone(TIME_ZONE).toFormat("HH:mm");
}

export function isSunday(dateTime: DateTime) {
  return dateTime.setZone(TIME_ZONE).weekday === 7;
}

export function getBusinessWindow(dateTime: DateTime) {
  const day = dateTime.setZone(TIME_ZONE).startOf("day");
  return {
    start: day.set({ hour: BUSINESS_START_HOUR, minute: 0, second: 0, millisecond: 0 }),
    end: day.set({ hour: BUSINESS_END_HOUR, minute: 0, second: 0, millisecond: 0 }),
  };
}

export function nextBusinessDay(dateTime: DateTime) {
  let cursor = dateTime.setZone(TIME_ZONE).plus({ days: 1 }).startOf("day");
  while (cursor.weekday === 7) {
    cursor = cursor.plus({ days: 1 });
  }
  return cursor;
}

export function roundUpToStep(dateTime: DateTime, minutes = SLOT_STEP_MINUTES) {
  const remainder = dateTime.minute % minutes;
  if (remainder === 0 && dateTime.second === 0 && dateTime.millisecond === 0) {
    return dateTime.set({ second: 0, millisecond: 0 });
  }

  return dateTime
    .plus({ minutes: minutes - remainder })
    .startOf("minute")
    .set({ second: 0, millisecond: 0 });
}

export function addMinutes(dateTime: DateTime, minutes: number) {
  return dateTime.plus({ minutes });
}

export function toIsoWithZone(dateTime: DateTime) {
  return dateTime.setZone(TIME_ZONE).toISO({ suppressMilliseconds: true });
}

export function isPastDateTime(dateTime: DateTime) {
  return dateTime.toMillis() < nowInZone().toMillis();
}
