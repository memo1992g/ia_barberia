import { NextResponse } from "next/server";
import { createAppointment, normalizeAppointmentPayload } from "@/lib/server/calendar";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const normalized = normalizeAppointmentPayload(payload, false);
    const result = await createAppointment(normalized);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "APPOINTMENT_ERROR",
        message: error?.userMessage || "No pude crear la cita. Intenta nuevamente.",
      },
      { status: error?.statusCode || 400 }
    );
  }
}
