export type CalendarAvailabilityRequest = {
  service: string;
  date: string;
  startTime: string;
  durationMinutes: number;
};

export type CalendarAppointmentRequest = {
  customerName: string;
  phone: string;
  service: string;
  date: string;
  startTime: string;
  durationMinutes: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return data as T;
}

export async function requestRealtimeSession() {
  return fetchJson<{
    success: boolean;
    clientSecret: string;
    expiresAt: number;
    model: string;
    voice: string;
    session: unknown;
  }>("/api/realtime/session", {
    method: "POST",
  });
}

export async function checkAvailability(payload: CalendarAvailabilityRequest) {
  return fetchJson<{
    available: boolean;
    message: string;
    alternatives: string[];
  }>("/api/calendar/availability", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createAppointment(payload: CalendarAppointmentRequest) {
  return fetchJson<{
    success: boolean;
    eventId: string;
    message: string;
    event?: Record<string, unknown>;
  }>("/api/calendar/appointment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
