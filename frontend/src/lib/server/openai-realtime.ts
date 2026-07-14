const REALTIME_MODEL = "gpt-realtime-2.1";
const REALTIME_VOICE = "marin";

function getVadThreshold() {
  const raw = Number(process.env.REALTIME_VAD_THRESHOLD || 0.75);
  if (Number.isNaN(raw)) {
    return 0.75;
  }

  return Math.min(0.95, Math.max(0.5, raw));
}

function buildSofiaInstructions() {
  return `Eres Sofía IA, recepcionista virtual de Imperial Barber Studio.

Hablas en español con voz femenina, cálida, amable, natural y profesional.
Tu trabajo es atender llamadas para agendar citas en la barbería.

No uses lenguaje técnico.
No suenes robótica.
No des respuestas largas.
No digas "procederé a consultar".
No expliques procesos internos.
No digas que eres una IA a menos que el cliente lo pregunte.

Usa frases naturales como:
"Hola, gracias por llamar a Imperial Barber Studio. Soy Sofía, ¿te gustaría agendar una cita?"
"Claro, con gusto."
"Perfecto, ¿qué servicio deseas?"
"Dame un segundo, reviso la agenda."
"Sí, tengo espacio a esa hora."
"Ese horario ya está ocupado, pero te puedo ofrecer otro."
"Perfecto, ya dejé tu cita agendada."

Flujo:
1. Saluda.
2. Pregunta qué servicio desea.
3. Pregunta fecha y hora.
4. Pregunta nombre.
5. Pregunta teléfono.
6. Detecta duración del servicio.
7. Si el cliente dice "corte de cabello", "corte de pelo", "corte" o cualquier sinónimo ambiguo de corte, no asumas el servicio. Pide aclaración y ofrece la lista exacta de servicios disponibles.
8. Cuando ya tengas servicio, fecha y hora, llama inmediatamente a checkAvailability. No le pidas confirmación al cliente antes de consultar disponibilidad.
9. No digas "estoy confirmando" ni "estoy revisando" si no has llamado realmente a checkAvailability.
10. Si checkAvailability devuelve disponible, pide confirmación con esta frase:
"Perfecto, te agendo {servicio} para el {fecha} a las {hora}, a nombre de {nombre}. ¿Confirmas?"
11. Si el cliente confirma, crea la cita con createAppointment.
12. Si está ocupado, ofrece hasta 3 horarios alternativos.
13. Si es domingo, indica que está cerrado y ofrece lunes.
14. Si está fuera de horario, ofrece horarios disponibles dentro del horario laboral.
15. Si una herramienta devuelve un mensaje de repetición o shouldRepeatField, usa exactamente ese mensaje y no inventes otra respuesta.
16. Si el texto del cliente es ruido, silencio, "...", "mmm", "eh", "ah" o no se entiende bien, no avances la conversación.
17. Si falta un dato específico, pide solo ese dato:
- hora: "Disculpá, no logré escuchar la hora. ¿Me la repetís?"
- teléfono: "Disculpá, no logré escuchar el número. ¿Me lo repetís despacio?"
- nombre: "Disculpá, no logré escuchar tu nombre. ¿Me lo repetís?"
- servicio: "Disculpá, no logré escuchar el servicio. ¿Cuál querías?"

Si el cliente pide un "corte" sin especificar cuál, responde:
"Claro, ofrecemos corte clásico, degradado o fade, barba, corte + barba, cejas y tratamiento capilar. ¿Cuál te gustaría?"

Nunca crees una cita sin confirmación explícita del cliente.`;
}

function buildToolDefinitions() {
  return [
    {
      type: "function",
      name: "checkAvailability",
      description:
        "Consulta si un horario está libre en el calendario de Imperial Barber Studio y devuelve alternativas si está ocupado.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["service", "date", "startTime", "durationMinutes"],
        properties: {
          service: { type: "string", description: "Servicio solicitado" },
          date: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
          startTime: { type: "string", description: "Hora en formato HH:mm" },
          durationMinutes: {
            type: "number",
            description: "Duración del servicio en minutos",
          },
        },
      },
    },
    {
      type: "function",
      name: "createAppointment",
      description:
        "Crea una cita en Google Calendar si el cliente ya confirmó los datos y el horario sigue disponible.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["customerName", "phone", "service", "date", "startTime", "durationMinutes"],
        properties: {
          customerName: { type: "string" },
          phone: { type: "string" },
          service: { type: "string" },
          date: { type: "string" },
          startTime: { type: "string" },
          durationMinutes: { type: "number" },
        },
      },
    },
  ];
}

export async function createRealtimeSession() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("Falta OPENAI_API_KEY.") as Error & { statusCode?: number; userMessage?: string };
    error.statusCode = 500;
    error.userMessage = "No pude iniciar la llamada IA. Revisa la API Key de OpenAI.";
    throw error;
  }

  const sessionConfig = {
    type: "realtime",
    model: REALTIME_MODEL,
    instructions: buildSofiaInstructions(),
    audio: {
      input: {
        noise_reduction: {
          type: "near_field",
        },
        turn_detection: {
          type: "server_vad",
          threshold: getVadThreshold(),
          silence_duration_ms: 900,
          prefix_padding_ms: 300,
          create_response: true,
        },
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "es",
          prompt:
            "Transcribe en español de forma natural, conserva nombres, teléfonos, fechas y horas exactas.",
        },
      },
      output: {
        voice: REALTIME_VOICE,
      },
    },
    tools: buildToolDefinitions(),
  };

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": "evo-voice-agent-demo",
    },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 600 },
      session: sessionConfig,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`OpenAI Realtime error: ${text}`) as Error & {
      statusCode?: number;
      userMessage?: string;
    };
    error.statusCode = response.status;
    if (response.status === 401) {
      error.userMessage =
        "La API Key de OpenAI no es válida o no tiene acceso a Realtime. Verifica la clave y reinicia el backend.";
    } else if (response.status === 429) {
      error.userMessage =
        "OpenAI está limitando solicitudes por ahora. Intenta de nuevo en unos segundos.";
    } else {
      error.userMessage = "No pude iniciar la llamada IA. Revisa la API Key de OpenAI.";
    }
    throw error;
  }

  const data = await response.json();
  return {
    success: true,
    clientSecret: data.value || data.client_secret?.value,
    expiresAt: data.expires_at || data.client_secret?.expires_at,
    session: data.session || sessionConfig,
    model: REALTIME_MODEL,
    voice: REALTIME_VOICE,
  };
}
