import { checkAvailability, createAppointment, requestRealtimeSession } from "./api";
import {
  buildServiceCatalogMessage,
  getDurationForService,
  getPriceForService,
  isAmbiguousServiceRequest,
  normalizeServiceName,
} from "./server/availability.utils";

export type CallStatus =
  | "esperando"
  | "conectando"
  | "escuchando"
  | "respondiendo"
  | "revisando"
  | "confirmada"
  | "ocupado"
  | "error";

export type AudioQuality = "Audio limpio" | "Ruido moderado" | "No se escucha bien";

export type TranscriptEntry = {
  id: string;
  speaker: "Cliente" | "Sofía IA";
  text: string;
};

export type AppointmentCard = {
  customerName: string;
  phone: string;
  service: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  price?: number;
  eventId?: string;
};

export type RealtimeCallbacks = {
  onStatusChange: (status: CallStatus) => void;
  onTranscriptChange: (entries: TranscriptEntry[]) => void;
  onAppointment: (appointment: AppointmentCard) => void;
  onAlternatives: (alternatives: string[]) => void;
  onError: (message: string) => void;
  onAudioLevel?: (level: number) => void;
  onAudioQuality?: (quality: AudioQuality) => void;
  onLog?: (message: string) => void;
};

const REALTIME_URL = "https://api.openai.com/v1/realtime/calls";

const SHORT_FILLS = new Set(["mm", "mmm", "eh", "ah", "uh", "hmm", "aja", "ajá", "um", "emm"]);

type BufferedToolCall = {
  itemId?: string;
  callId?: string;
  name?: string;
  arguments: string;
  outputIndex?: number;
};

function normalizeSpeechText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function usefulCharacterCount(value: string) {
  return normalizeSpeechText(value).replace(/[^a-z0-9]/g, "").length;
}

function isDoubtfulTranscript(value: string) {
  const normalized = normalizeSpeechText(value);
  if (!normalized) {
    return true;
  }

  if (normalized === "..." || /^[.\s…-]+$/.test(normalized)) {
    return true;
  }

  const compact = normalized.replace(/[^a-z0-9]/g, "");
  if (compact.length < 2) {
    return true;
  }

  if (SHORT_FILLS.has(normalized) || SHORT_FILLS.has(compact)) {
    return true;
  }

  if (/^(m+|h+|a+h+|e+h+|u+m+)$/.test(compact)) {
    return true;
  }

  return false;
}

function isServiceAmbiguous(rawService: string) {
  return isAmbiguousServiceRequest(rawService);
}

function inferAudioQuality(level: number): AudioQuality {
  if (level < 0.035) {
    return "No se escucha bien";
  }

  if (level < 0.13) {
    return "Ruido moderado";
  }

  return "Audio limpio";
}

function buildRepeatMessage(field?: string) {
  switch (field) {
    case "hora":
      return "Disculpá, no logré escuchar la hora. ¿Me la repetís?";
    case "teléfono":
    case "telefono":
      return "Disculpá, no logré escuchar el número. ¿Me lo repetís despacio?";
    case "nombre":
      return "Disculpá, no logré escuchar tu nombre. ¿Me lo repetís?";
    case "servicio":
      return "Disculpá, no logré escuchar el servicio. ¿Cuál querías?";
    case "fecha":
      return "Disculpá, no logré escuchar la fecha. ¿Me la repetís?";
    default:
      return "Disculpá, no logré escucharte bien. ¿Me lo repetís, por favor?";
  }
}

function buildServiceListMessage() {
  return `${buildServiceCatalogMessage()} ¿Cuál te gustaría?`;
}

function validateDate(value: string) {
  const normalized = normalizeSpeechText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized);
}

function validateTime(value: string) {
  const normalized = normalizeSpeechText(value);
  return /^\d{2}:\d{2}$/.test(normalized);
}

function validateToolArgs(toolName: string, args: Record<string, unknown>) {
  const getString = (key: string) => (typeof args[key] === "string" ? String(args[key]).trim() : "");
  const rawService = getString("service");

  if (!rawService || isDoubtfulTranscript(rawService)) {
    return {
      ok: false,
      field: "servicio",
      message: buildRepeatMessage("servicio"),
    };
  }

  if (isServiceAmbiguous(rawService)) {
    return {
      ok: false,
      field: "servicio",
      message: buildServiceListMessage(),
    };
  }

  const service = normalizeServiceName(rawService);
  const date = getString("date");
  const startTime = getString("startTime");

  if (!date || isDoubtfulTranscript(date) || !validateDate(date)) {
    return {
      ok: false,
      field: "fecha",
      message: buildRepeatMessage("fecha"),
    };
  }

  if (!startTime || isDoubtfulTranscript(startTime) || !validateTime(startTime)) {
    return {
      ok: false,
      field: "hora",
      message: buildRepeatMessage("hora"),
    };
  }

  if (toolName === "checkAvailability") {
    return {
      ok: true,
      args: {
        service,
        date,
        startTime,
        durationMinutes: getDurationForService(service) ?? Number(args.durationMinutes || 0),
      },
    };
  }

  const customerName = getString("customerName");
  const phone = getString("phone");

  if (!customerName || isDoubtfulTranscript(customerName) || usefulCharacterCount(customerName) < 2) {
    return {
      ok: false,
      field: "nombre",
      message: buildRepeatMessage("nombre"),
    };
  }

  if (!phone || isDoubtfulTranscript(phone) || usefulCharacterCount(phone) < 2) {
    return {
      ok: false,
      field: "telefono",
      message: buildRepeatMessage("teléfono"),
    };
  }

  return {
    ok: true,
    args: {
      customerName,
      phone,
      service,
      date,
      startTime,
      durationMinutes: getDurationForService(service) ?? Number(args.durationMinutes || 0),
    },
  };
}

function createTranscriptStore(onTranscriptChange: RealtimeCallbacks["onTranscriptChange"]) {
  const entries = new Map<string, TranscriptEntry>();

  function upsert(id: string, speaker: TranscriptEntry["speaker"], delta: string) {
    const existing = entries.get(id);
    const nextText = `${existing?.text || ""}${delta}`;
    if (speaker === "Cliente" && (isDoubtfulTranscript(nextText) || usefulCharacterCount(nextText) < 2)) {
      return;
    }

    const next: TranscriptEntry = {
      id,
      speaker,
      text: nextText,
    };
    entries.set(id, next);
    onTranscriptChange(Array.from(entries.values()));
  }

  function finalize(id: string, speaker: TranscriptEntry["speaker"], fullText: string) {
    if (speaker === "Cliente" && (isDoubtfulTranscript(fullText) || usefulCharacterCount(fullText) < 2)) {
      return false;
    }
    entries.set(id, { id, speaker, text: fullText });
    onTranscriptChange(Array.from(entries.values()));
    return true;
  }

  return { upsert, finalize };
}

function parseToolArguments(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  return value && typeof value === "object" ? value : {};
}

function extractFunctionCallsFromResponse(response: any) {
  const output = Array.isArray(response?.output) ? response.output : [];
  return output
    .filter((item: any) => item?.type === "function_call")
    .map((item: any) => ({
      itemId: item.id || item.call_id,
      callId: item.call_id || item.id,
      name: item.name,
      arguments: item.arguments || "",
      outputIndex: item.output_index,
    }));
}

function waitForIceGatheringComplete(peerConnection: RTCPeerConnection) {
  if (peerConnection.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const handleChange = () => {
      if (peerConnection.iceGatheringState === "complete") {
        peerConnection.removeEventListener("icegatheringstatechange", handleChange);
        resolve();
      }
    };

    peerConnection.addEventListener("icegatheringstatechange", handleChange);
    setTimeout(() => {
      peerConnection.removeEventListener("icegatheringstatechange", handleChange);
      resolve();
    }, 4000);
  });
}

export async function startRealtimeCall(callbacks: RealtimeCallbacks) {
  callbacks.onStatusChange("conectando");
  callbacks.onLog?.("Solicitando sesión efímera a OpenAI.");

  const session = await requestRealtimeSession();
  callbacks.onLog?.("Sesión efímera recibida. Iniciando WebRTC.");

  const pc = new RTCPeerConnection();
  const audio = document.createElement("audio");
  audio.autoplay = true;
  audio.controls = false;
  audio.setAttribute("playsinline", "true");
  audio.style.display = "none";
  document.body.appendChild(audio);

  pc.ontrack = (event) => {
    audio.srcObject = event.streams[0];
  };

  let micStream: MediaStream;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    callbacks.onLog?.("Permiso de micrófono concedido.");
  } catch {
    pc.close();
    throw new Error("No pude acceder al microfono. Revisa los permisos del navegador.");
  }

  const audioTrack = micStream.getAudioTracks()[0];
  pc.addTrack(audioTrack, micStream);
  callbacks.onLog?.("Track de audio local agregado a la conexión.");

  let audioContext: AudioContext | null = null;
  let rafId = 0;
  try {
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(micStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        sum += data[i];
      }
      const level = Math.min(1, sum / data.length / 255);
      callbacks.onAudioLevel?.(level);
      callbacks.onAudioQuality?.(inferAudioQuality(level));
      rafId = requestAnimationFrame(tick);
    };
    tick();
  } catch {
    callbacks.onAudioLevel?.(0.08);
    callbacks.onAudioQuality?.("Ruido moderado");
  }

  const dc = pc.createDataChannel("oai-events");
  callbacks.onLog?.("DataChannel oai-events creado.");
  const transcripts = createTranscriptStore(callbacks.onTranscriptChange);
  const handledToolCalls = new Set<string>();
  const bufferedToolCallsByItemId = new Map<string, BufferedToolCall>();
  const bufferedToolCallsByCallId = new Map<string, BufferedToolCall>();

  const sendEvent = (payload: unknown) => {
    if (dc.readyState === "open") {
      dc.send(JSON.stringify(payload));
    }
  };

  const storeBufferedToolCall = (call: BufferedToolCall) => {
    if (call.itemId) {
      bufferedToolCallsByItemId.set(call.itemId, call);
    }
    if (call.callId) {
      bufferedToolCallsByCallId.set(call.callId, call);
    }
  };

  const getBufferedToolCall = (event: any) => {
    const itemId = event.item_id || event.item?.id;
    const callId = event.item?.call_id || event.call_id;
    if (itemId && bufferedToolCallsByItemId.has(itemId)) {
      return bufferedToolCallsByItemId.get(itemId) || null;
    }
    if (callId && bufferedToolCallsByCallId.has(callId)) {
      return bufferedToolCallsByCallId.get(callId) || null;
    }
    return null;
  };

  const executeToolCall = async (toolCall: BufferedToolCall) => {
    if (!toolCall.callId || !toolCall.name) {
      callbacks.onLog?.(
        `Tool incompleta ignorada: name=${toolCall.name || "n/a"} callId=${toolCall.callId || "n/a"}`
      );
      return;
    }

    if (handledToolCalls.has(toolCall.callId)) {
      callbacks.onLog?.(`Tool duplicada ignorada: ${toolCall.name} (${toolCall.callId})`);
      return;
    }
    handledToolCalls.add(toolCall.callId);

    const args = parseToolArguments(toolCall.arguments);
    callbacks.onLog?.(
      `Ejecutando tool ${toolCall.name} (${toolCall.callId}) con args=${toolCall.arguments || "{}"}`
    );

    if (toolCall.name === "checkAvailability") {
      const validation = validateToolArgs("checkAvailability", args as Record<string, unknown>);
      if (!validation.ok) {
        const message = validation.message || buildRepeatMessage();
        callbacks.onStatusChange("escuchando");
        callbacks.onLog?.(`checkAvailability bloqueada: ${message}`);
        sendEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: toolCall.callId,
            output: JSON.stringify({
              success: false,
              message,
              shouldRepeatField: validation.field || "clarification",
            }),
          },
        });
        sendEvent({ type: "response.create" });
        return;
      }

      const normalizedArgs = validation.args!;
      callbacks.onStatusChange("revisando");
      try {
        const result = await checkAvailability({
          service: String(normalizedArgs.service || ""),
          date: String(normalizedArgs.date || ""),
          startTime: String(normalizedArgs.startTime || ""),
          durationMinutes: Number(normalizedArgs.durationMinutes || 0),
        });

        callbacks.onAlternatives(result.alternatives || []);
        callbacks.onLog?.(`checkAvailability => ${JSON.stringify(result)}`);
        callbacks.onStatusChange(result.available ? "escuchando" : "ocupado");

        sendEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: toolCall.callId,
            output: JSON.stringify(result),
          },
        });
        sendEvent({ type: "response.create" });
      } catch (toolError) {
        const message =
          toolError instanceof Error
            ? toolError.message
            : "No pude revisar la agenda. Revisa permisos del calendario.";
        callbacks.onStatusChange("error");
        callbacks.onError(message);
        callbacks.onLog?.(`checkAvailability error: ${message}`);
        sendEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: toolCall.callId,
            output: JSON.stringify({ success: false, message }),
          },
        });
      }
      return;
    }

    if (toolCall.name === "createAppointment") {
      const validation = validateToolArgs("createAppointment", args as Record<string, unknown>);
      if (!validation.ok) {
        const message = validation.message || buildRepeatMessage();
        callbacks.onStatusChange("escuchando");
        callbacks.onLog?.(`createAppointment bloqueada: ${message}`);
        sendEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: toolCall.callId,
            output: JSON.stringify({
              success: false,
              message,
              shouldRepeatField: validation.field || "clarification",
            }),
          },
        });
        sendEvent({ type: "response.create" });
        return;
      }

      const normalizedArgs = validation.args!;
      try {
        const result = await createAppointment({
          customerName: String(normalizedArgs.customerName || ""),
          phone: String(normalizedArgs.phone || ""),
          service: String(normalizedArgs.service || ""),
          date: String(normalizedArgs.date || ""),
          startTime: String(normalizedArgs.startTime || ""),
          durationMinutes: Number(normalizedArgs.durationMinutes || 0),
        });

        if (result.success) {
          const price = getPriceForService(String(normalizedArgs.service || ""));
          callbacks.onStatusChange("confirmada");
          callbacks.onAlternatives([]);
          callbacks.onAppointment({
            customerName: String(normalizedArgs.customerName || ""),
            phone: String(normalizedArgs.phone || ""),
            service: String(normalizedArgs.service || ""),
            date: String(normalizedArgs.date || ""),
            startTime: String(normalizedArgs.startTime || ""),
            durationMinutes: Number(normalizedArgs.durationMinutes || 0),
            price: price ?? undefined,
            eventId: result.eventId,
          });
        }

        callbacks.onLog?.(`createAppointment => ${JSON.stringify(result)}`);
        sendEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: toolCall.callId,
            output: JSON.stringify(result),
          },
        });
        sendEvent({ type: "response.create" });
      } catch (toolError) {
        const message =
          toolError instanceof Error ? toolError.message : "No pude crear la cita. Intenta nuevamente.";
        callbacks.onStatusChange("error");
        callbacks.onError(message);
        callbacks.onLog?.(`createAppointment error: ${message}`);
        sendEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: toolCall.callId,
            output: JSON.stringify({ success: false, message }),
          },
        });
        sendEvent({ type: "response.create" });
      }
    }
  };

  const stop = () => {
    try {
      dc.close();
    } catch {
      /* no-op */
    }
    try {
      pc.getSenders().forEach((sender) => sender.track?.stop());
      pc.close();
    } catch {
      /* no-op */
    }
    try {
      micStream.getTracks().forEach((track) => track.stop());
    } catch {
      /* no-op */
    }
    try {
      audio.remove();
    } catch {
      /* no-op */
    }
    try {
      if (rafId) cancelAnimationFrame(rafId);
      audioContext?.close();
    } catch {
      /* no-op */
    }
  };

  dc.onopen = async () => {
    callbacks.onLog?.("DataChannel abierto. Enviando primer response.create.");
    callbacks.onStatusChange("escuchando");
    sendEvent({ type: "response.create" });
  };

  dc.onmessage = async (message) => {
    let event: any;
    try {
      event = JSON.parse(message.data);
    } catch {
      return;
    }

    switch (event.type) {
      case "response.created":
        callbacks.onLog?.(`response.created: ${event.response?.id || "sin-id"}`);
        break;
      case "response.output_item.added":
        callbacks.onLog?.(
          `function_call detectada: ${event.item?.name || "sin-nombre"} ${event.item?.call_id || event.item?.id || ""}`
        );
        if (event.item?.type === "function_call") {
          storeBufferedToolCall({
            itemId: event.item.id || event.item_id || event.item?.call_id,
            callId: event.item.call_id,
            name: event.item.name,
            arguments: String(event.item.arguments || ""),
            outputIndex: event.output_index,
          });
        }
        break;
      case "response.output_item.done":
        callbacks.onLog?.(
          `response.output_item.done: ${event.item?.type || "item"} ${event.item?.name || ""}`
        );
        if (event.item?.type === "function_call") {
          storeBufferedToolCall({
            itemId: event.item.id || event.item_id || event.item?.call_id,
            callId: event.item.call_id,
            name: event.item.name,
            arguments: String(event.item.arguments || ""),
            outputIndex: event.output_index,
          });
        }
        break;
      case "response.function_call_arguments.delta": {
        callbacks.onLog?.(`function_call_arguments.delta (${String(event.delta || "").length} chars)`);
        const buffered = getBufferedToolCall(event);
        if (buffered) {
          buffered.arguments = `${buffered.arguments || ""}${String(event.delta || "")}`;
          storeBufferedToolCall(buffered);
        }
        break;
      }
      case "response.function_call_arguments.done": {
        callbacks.onLog?.(`function_call_arguments.done para ${event.item?.name || "tool"}`);
        const buffered = getBufferedToolCall(event);
        const merged: BufferedToolCall = buffered
          ? {
              ...buffered,
              itemId: event.item?.id || event.item_id || buffered.itemId,
              callId: event.item?.call_id || buffered.callId,
              name: event.item?.name || buffered.name,
              arguments: String(event.arguments || event.item?.arguments || buffered.arguments || ""),
              outputIndex: event.output_index ?? buffered.outputIndex,
            }
          : {
              itemId: event.item?.id || event.item_id,
              callId: event.item?.call_id,
              name: event.item?.name,
              arguments: String(event.arguments || event.item?.arguments || ""),
              outputIndex: event.output_index,
            };
        storeBufferedToolCall(merged);
        await executeToolCall(merged);
        break;
      }
      case "response.done": {
        callbacks.onLog?.(`response.done: ${event.response?.status || "completed"}`);
        for (const call of extractFunctionCallsFromResponse(event.response)) {
          const buffered =
            (call.callId && bufferedToolCallsByCallId.get(call.callId)) ||
            (call.callId && bufferedToolCallsByItemId.get(call.callId)) ||
            call;
          await executeToolCall({
            itemId: buffered.itemId || call.itemId,
            callId: buffered.callId || call.callId,
            name: buffered.name || call.name,
            arguments: buffered.arguments || JSON.stringify(call.arguments || {}),
            outputIndex: buffered.outputIndex || call.outputIndex,
          });
        }
        break;
      }
      case "conversation.item.input_audio_transcription.delta":
        if (event.item_id && typeof event.delta === "string") {
          callbacks.onStatusChange("escuchando");
          transcripts.upsert(event.item_id, "Cliente", event.delta);
        }
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (event.item_id) {
          const transcript = String(event.transcript || "");
          const accepted = transcripts.finalize(event.item_id, "Cliente", transcript);
          if (!accepted) {
            callbacks.onLog?.("Transcripción cliente ignorada por ruido o silencio.");
            callbacks.onStatusChange("escuchando");
            sendEvent({ type: "response.create" });
            break;
          }
          callbacks.onLog?.(`Transcripcion cliente completada: ${transcript}`);
        }
        break;
      case "response.output_text.delta":
      case "response.output_audio_transcript.delta":
        if (event.item_id && typeof event.delta === "string") {
          callbacks.onStatusChange("respondiendo");
          transcripts.upsert(event.item_id, "Sofía IA", event.delta);
        }
        break;
      case "input_audio_buffer.speech_started":
        callbacks.onStatusChange("escuchando");
        callbacks.onLog?.("speech_started");
        break;
      case "input_audio_buffer.speech_stopped":
        callbacks.onStatusChange("respondiendo");
        callbacks.onLog?.("speech_stopped");
        break;
      case "error":
        callbacks.onStatusChange("error");
        callbacks.onError(event.error?.message || "Ocurrió un error en la llamada.");
        callbacks.onLog?.(`Realtime error: ${event.error?.message || "sin mensaje"}`);
        break;
      default:
        break;
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGatheringComplete(pc);

  const sdpResponse = await fetch(REALTIME_URL, {
    method: "POST",
    body: pc.localDescription?.sdp || offer.sdp,
    headers: {
      Authorization: `Bearer ${session.clientSecret}`,
      "Content-Type": "application/sdp",
    },
  });

  if (!sdpResponse.ok) {
    stop();
    callbacks.onLog?.(`WebRTC SDP response failed: ${sdpResponse.status}`);
    throw new Error("No pude iniciar la llamada IA. Revisa la API Key de OpenAI.");
  }

  const answer = {
    type: "answer" as RTCSdpType,
    sdp: await sdpResponse.text(),
  };
  await pc.setRemoteDescription(answer);
  callbacks.onLog?.("Remote description aplicada. Conexión lista.");

  callbacks.onStatusChange("escuchando");

  return {
    stop,
    pc,
    dc,
    audio,
  };
}
