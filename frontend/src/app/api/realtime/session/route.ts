import { NextResponse } from "next/server";
import { createRealtimeSession } from "@/lib/server/openai-realtime";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await createRealtimeSession();
    return NextResponse.json(session);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "REALTIME_SESSION_ERROR",
        message: error?.userMessage || "No pude iniciar la llamada IA. Revisa la API Key de OpenAI.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}
