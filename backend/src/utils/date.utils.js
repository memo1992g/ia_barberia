import { DateTime } from "luxon";

export const TIME_ZONE = "America/El_Salvador";
export const BUSINESS_START_HOUR = 9;
export const BUSINESS_END_HOUR = 19;
export const SLOT_STEP_MINUTES = 15;
export const BUFFER_MINUTES = 10;

const WEEKDAY_MAP = {
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

const MONTH_MAP = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function addMonthsPreservingDay(dateTime, monthsToAdd, day) {
  let candidate = dateTime.plus({ months: monthsToAdd }).set({ day });
  for (let i = 0; i < 3 && !candidate.isValid; i += 1) {
    candidate = candidate.plus({ months: 1 }).set({ day });
  }
  return candidate;
}

function nextOrSameWeekdayFrom(baseDate, weekday) {
  let candidate = baseDate.startOf("day");
  while (candidate.weekday !== weekday) {
    candidate = candidate.plus({ days: 1 });
  }
  return candidate;
}

function nextWeekdayAfter(baseDate, weekday) {
  let candidate = baseDate.plus({ days: 1 }).startOf("day");
  while (candidate.weekday !== weekday) {
    candidate = candidate.plus({ days: 1 });
  }
  return candidate;
}

function thisWeekWeekdayFrom(baseDate, weekday) {
  const delta = weekday - baseDate.weekday;
  if (delta < 0) {
    return null;
  }
  return baseDate.plus({ days: delta }).startOf("day");
}

export function nowInZone() {
  return DateTime.now().setZone(TIME_ZONE);
}

export function normalizeDateInput(input) {
  const raw = normalizeText(input);
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const today = nowInZone().startOf("day");

  if (raw === "hoy") {
    return formatDate(today);
  }

  if (raw === "manana") {
    return formatDate(today.plus({ days: 1 }));
  }

  if (raw === "pasado manana") {
    return formatDate(today.plus({ days: 2 }));
  }

  const matchedWeekday = Object.entries(WEEKDAY_MAP).find(([name]) => raw.includes(name));
  if (matchedWeekday) {
    const weekday = matchedWeekday[1];
    const hasNextReference = /(proximo|siguiente|next)/.test(raw);
    const hasThisReference = /(este|esta|este mismo)/.test(raw);

    if (hasNextReference) {
      return formatDate(nextWeekdayAfter(today, weekday));
    }

    if (hasThisReference) {
      const currentWeekCandidate = thisWeekWeekdayFrom(today, weekday);
      if (currentWeekCandidate && currentWeekCandidate >= today.startOf("day")) {
        return formatDate(currentWeekCandidate);
      }
      return formatDate(nextWeekdayAfter(today, weekday));
    }

    return formatDate(today.weekday === weekday ? today : nextWeekdayAfter(today, weekday));
  }

  const dayOnlyMatch = raw.match(/^(?:el\s+)?(\d{1,2})(?:\s+de\s+(este|este\s+mes|este mes|del\s+mes|de\s+este\s+mes))?$/);
  if (dayOnlyMatch) {
    const day = Number(dayOnlyMatch[1]);
    if (day >= 1 && day <= 31) {
      const currentMonthCandidate = today.set({ day });
      if (currentMonthCandidate.isValid && currentMonthCandidate >= today.startOf("day")) {
        return formatDate(currentMonthCandidate);
      }

      const nextMonthCandidate = addMonthsPreservingDay(today, 1, day);
      if (nextMonthCandidate.isValid) {
        return formatDate(nextMonthCandidate);
      }

      return String(input).trim();
    }
  }

  const monthMatch = raw.match(/^(?:el\s+)?(\d{1,2})(?:\s+de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?$/);
  if (monthMatch) {
    const day = Number(monthMatch[1]);
    const month = MONTH_MAP[monthMatch[2]];
    const year = Number(monthMatch[3] || today.year);
    const candidate = DateTime.fromObject(
      {
        year,
        month,
        day,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      { zone: TIME_ZONE }
    );
    if (candidate.isValid) {
      if (!monthMatch[3] && candidate < today.startOf("day")) {
        const nextYearCandidate = DateTime.fromObject(
          {
            year: year + 1,
            month,
            day,
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
          },
          { zone: TIME_ZONE }
        );
        if (nextYearCandidate.isValid) {
          return formatDate(nextYearCandidate);
        }
      }
      return formatDate(candidate);
    }
  }

  return String(input).trim();
}

export function normalizeTimeInput(input) {
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

export function parseDateInZone(dateString) {
  return DateTime.fromISO(dateString, { zone: TIME_ZONE }).startOf("day");
}

export function parseTimeOnDate(dateString, timeString) {
  const [hour, minute] = String(timeString).split(":").map((value) => Number(value));
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

export function formatDate(dateTime) {
  return dateTime.setZone(TIME_ZONE).toFormat("yyyy-LL-dd");
}

export function formatTime(dateTime) {
  return dateTime.setZone(TIME_ZONE).toFormat("HH:mm");
}

export function formatFriendlyDate(dateTime) {
  return dateTime.setZone(TIME_ZONE).toFormat("cccc, dd 'de' LLLL yyyy");
}

export function isSunday(dateTime) {
  return dateTime.setZone(TIME_ZONE).weekday === 7;
}

export function getBusinessWindow(dateTime) {
  const day = dateTime.setZone(TIME_ZONE).startOf("day");
  return {
    start: day.set({ hour: BUSINESS_START_HOUR, minute: 0, second: 0, millisecond: 0 }),
    end: day.set({ hour: BUSINESS_END_HOUR, minute: 0, second: 0, millisecond: 0 }),
  };
}

export function isPastDateTime(dateTime) {
  return dateTime.toMillis() < nowInZone().toMillis();
}

export function isWithinBusinessHours(start, end) {
  const window = getBusinessWindow(start);
  return start >= window.start && end <= window.end;
}

export function nextBusinessDay(dateTime) {
  let cursor = dateTime.setZone(TIME_ZONE).plus({ days: 1 }).startOf("day");
  while (cursor.weekday === 7) {
    cursor = cursor.plus({ days: 1 });
  }
  return cursor;
}

export function nextWeekdayOccurrence(weekdayNumber) {
  let cursor = nowInZone().startOf("day");
  do {
    cursor = cursor.plus({ days: 1 });
  } while (cursor.weekday !== weekdayNumber);
  return cursor;
}

export function roundUpToStep(dateTime, minutes = SLOT_STEP_MINUTES) {
  const remainder = dateTime.minute % minutes;
  if (remainder === 0 && dateTime.second === 0 && dateTime.millisecond === 0) {
    return dateTime.set({ second: 0, millisecond: 0 });
  }
  return dateTime
    .plus({ minutes: minutes - remainder })
    .startOf("minute")
    .set({ second: 0, millisecond: 0 });
}

export function addMinutes(dateTime, minutes) {
  return dateTime.plus({ minutes });
}

export function toIsoWithZone(dateTime) {
  return dateTime.setZone(TIME_ZONE).toISO({ suppressMilliseconds: true });
}
