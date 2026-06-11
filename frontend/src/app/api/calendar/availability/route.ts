import { NextResponse } from "next/server";
import { checkAvailability, normalizeAppointmentPayload } from "@/lib/server/calendar";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const normalized = normalizeAppointmentPayload(payload, true);
    const result = await checkAvailability(normalized);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "AVAILABILITY_ERROR",
        message: error?.userMessage || "No pude revisar la agenda. Revisa permisos del calendario.",
      },
      { status: error?.statusCode || 400 }
    );
  }
}
