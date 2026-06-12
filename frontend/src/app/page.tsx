"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { startRealtimeCall } from "@/lib/realtime";
import type { AppointmentCard, AudioQuality, CallStatus, TranscriptEntry } from "@/lib/realtime";
import { CallStatus as StatusBadge } from "@/components/CallStatus";

const demoMode = String(process.env.NEXT_PUBLIC_DEMO_MODE || "").toLowerCase() === "true";
const BARBERSHOP_NAME = "Imperial Barber Studio";
const BARBERSHOP_ADDRESS = "Boulevard de los Próceres 742, Colonia Escalón, San Salvador, El Salvador";
const BARBERSHOP_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  BARBERSHOP_ADDRESS
)}`;

const statusLabel: Record<CallStatus, string> = {
  esperando: "Esperando",
  conectando: "Conectando",
  escuchando: "Escuchando",
  respondiendo: "Sofía hablando",
  revisando: "Revisando agenda",
  confirmada: "Cita confirmada",
  ocupado: "Horario ocupado",
  error: "Error",
};

const audioQualityClass: Record<AudioQuality, string> = {
  "Audio limpio": "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  "Ruido moderado": "border-amber-500/20 bg-amber-500/10 text-amber-100",
  "No se escucha bien": "border-rose-500/20 bg-rose-500/10 text-rose-100",
};

type MobileTab = "llamada" | "transcripcion" | "agenda";

function formatNowClock() {
  return new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildIcsTimestamp(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const local = new Date(year, month - 1, day, hour, minute, 0);
  return local.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function addMinutesToTimestamp(date: string, time: string, minutes: number) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const local = new Date(year, month - 1, day, hour, minute, 0);
  local.setMinutes(local.getMinutes() + minutes);
  return local.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export default function Page() {
  const [status, setStatus] = useState<CallStatus>("esperando");
  const [audioLevel, setAudioLevel] = useState(0.08);
  const [audioQuality, setAudioQuality] = useState<AudioQuality>("Ruido moderado");
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [appointment, setAppointment] = useState<AppointmentCard | null>(null);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("llamada");
  const callRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    return () => {
      callRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    if (status === "revisando" || status === "confirmada" || status === "ocupado" || status === "error") {
      navigator.vibrate?.([30, 20, 30]);
    } else if (status === "escuchando") {
      navigator.vibrate?.(12);
    }
  }, [isMobile, status]);

  const orbStyle = useMemo(() => {
    const boost = isCalling ? 1 + audioLevel * 0.55 : 1;
    const glow = 0.25 + audioLevel * 0.8;
    return {
      transform: `scale(${boost})`,
      filter: `drop-shadow(0 0 ${18 + glow * 28}px rgba(204, 72, 255, ${0.35 + glow * 0.35})) drop-shadow(0 0 ${12 + glow * 20}px rgba(108, 102, 255, ${0.18 + glow * 0.28}))`,
    };
  }, [audioLevel, isCalling]);

  const handleStart = async () => {
    setError(null);
    setEntries([]);
    setAppointment(null);
    setAlternatives([]);
    setLogs([]);

    try {
      const call = await startRealtimeCall({
        onStatusChange: setStatus,
        onTranscriptChange: setEntries,
        onAppointment: (nextAppointment) => {
          setAppointment(nextAppointment);
          setStatus("confirmada");
        },
        onAlternatives: setAlternatives,
        onError: (message) => {
          setError(message);
          setStatus("error");
        },
        onAudioLevel: setAudioLevel,
        onAudioQuality: setAudioQuality,
        onLog: (message) => {
          setLogs((current) => [message, ...current].slice(0, 12));
        },
      });

      callRef.current = call;
      setIsCalling(true);
      setStatus("escuchando");
      if (isMobile) setMobileTab("llamada");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No pude iniciar la llamada IA. Revisa la API Key de OpenAI.";
      setError(message);
      setStatus("error");
      setIsCalling(false);
    }
  };

  const handleStop = () => {
    callRef.current?.stop();
    callRef.current = null;
    setIsCalling(false);
    setStatus("esperando");
    setAudioLevel(0.08);
    setAudioQuality("Ruido moderado");
  };

  const handleShareAppointment = async (channel: "whatsapp" | "sms") => {
    if (!appointment) return;

    const message = `Cita confirmada en ${BARBERSHOP_NAME}%0A
Servicio: ${appointment.service}%0A
Cliente: ${appointment.customerName}%0A
Fecha: ${appointment.date}%0A
Hora: ${appointment.startTime}%0A
Teléfono: ${appointment.phone}%0A
Agendada por: AZENTYA Voice Agent`;

    const rawMessage = `Cita confirmada en ${BARBERSHOP_NAME}
Servicio: ${appointment.service}
Cliente: ${appointment.customerName}
Fecha: ${appointment.date}
Hora: ${appointment.startTime}
Teléfono: ${appointment.phone}
Agendada por: AZENTYA Voice Agent`;

    if (channel === "whatsapp") {
      const whatsappUrl = `https://wa.me/?text=${message}`;
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const smsUrl = `sms:${appointment.phone}?body=${encodeURIComponent(rawMessage)}`;

    try {
      window.location.href = smsUrl;
    } catch {
      await navigator.clipboard.writeText(rawMessage);
      alert("No se pudo abrir SMS. El texto de la cita se copió al portapapeles.");
    }
  };

  const handleExportAppointment = () => {
    if (!appointment) return;

    const dtStart = buildIcsTimestamp(appointment.date, appointment.startTime);
    const dtEnd = addMinutesToTimestamp(appointment.date, appointment.startTime, appointment.durationMinutes);
    const uid = `${appointment.eventId || `${appointment.date}-${appointment.startTime}`}@evo-voice-agent`;
    const summary = `Cita - ${appointment.service} - ${appointment.customerName}`;
    const description = [
      `Cliente: ${appointment.customerName}`,
      `Teléfono: ${appointment.phone}`,
      `Servicio: ${appointment.service}`,
      `Fecha: ${appointment.date}`,
      `Hora: ${appointment.startTime}`,
      `Creado por: AZENTYA Voice Agent`,
    ].join("\\n");
    const dtStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//AZENTYA Voice Agent//${BARBERSHOP_NAME}//ES`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `LOCATION:${escapeIcsText(BARBERSHOP_ADDRESS)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const calendarLink = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    const webcalLink = `webcal://${window.location.host}/cita-${appointment.date}-${appointment.startTime}.ics`;

    if (isMobile) {
      try {
        window.open(webcalLink, "_blank", "noopener,noreferrer");
        setTimeout(() => {
          const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `cita-${appointment.date}-${appointment.startTime}.ics`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
        }, 250);
        return;
      } catch {
        // Fallback below
      }
    }

    try {
      window.open(calendarLink, "_blank", "noopener,noreferrer");
      return;
    } catch {
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cita-${appointment.date}-${appointment.startTime}.ics`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
  };

  const handleOpenDirections = () => {
    window.open(BARBERSHOP_MAPS_URL, "_blank", "noopener,noreferrer");
  };

  const activeTabContent = {
    llamada: (
      <div className="space-y-3">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-[0_18px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.45em] text-white/35">
                Imperial Barber Studio
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-wide text-white">
                AZENTYA Voice Agent
              </h1>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="rounded-full border border-evo-gold/25 bg-evo-gold/10 px-3 py-1 text-[10px] font-semibold tracking-[0.2em] text-evo-goldSoft">
                Powered by AZENTYA
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-white/55">
                Sofía IA
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/35">Estado</div>
              <div className="mt-1 text-sm font-medium text-white">{statusLabel[status]}</div>
            </div>
            <StatusBadge status={status} />
          </div>

          <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/35">Audio</div>
              <div className="mt-1 text-sm font-medium text-white">Calidad de señal</div>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${audioQualityClass[audioQuality]}`}
            >
              {audioQuality}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(18,18,28,0.92),rgba(5,5,7,0.96))] p-4">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_center,rgba(22,22,34,1),rgba(7,7,10,0.98))]">
              <div
                className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg,rgba(205,64,255,0.95),rgba(112,102,255,0.95),rgba(205,64,255,0.95))] opacity-80 blur-[1px]"
                style={orbStyle}
              />
              <div className="absolute inset-[2px] rounded-full bg-[radial-gradient(circle_at_center,rgba(18,18,28,0.96),rgba(6,6,10,0.98))]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border border-white/10 bg-black/55 backdrop-blur-md">
                  <span className="text-[9px] uppercase tracking-[0.3em] text-white/35">Sofía</span>
                  <span className="mt-1 text-xs font-semibold text-white">IA</span>
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/85 text-balance">
                {isCalling
                  ? "La llamada está activa. Habla con Sofía como si estuvieras llamando a la barbería."
                  : "Toca iniciar y conversa con Sofía para agendar por voz en tiempo real."}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-fuchsia-400 to-indigo-400 transition-all duration-75"
                    style={{ width: `${Math.max(12, audioLevel * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-white/45">Audio</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={handleStart}
              disabled={isCalling}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Iniciar llamada demo
            </button>
            <button
              onClick={handleStop}
              disabled={!isCalling}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Finalizar llamada
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/65">
              {demoMode ? "Modo demo sin calendario real" : "Calendario real activo"}
            </span>
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/65">
              {formatNowClock()}
            </span>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/35">Tips</div>
              <div className="text-sm text-white/70">Pensado para pantalla chica</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/72">
            <span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">Orbes más grandes</span>
            <span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">Botones grandes</span>
            <span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">Vibración sutil</span>
            <span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">Vista por pestañas</span>
          </div>
        </div>
      </div>
    ),
    transcripcion: (
      <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/35">Transcripción</div>
            <div className="text-sm text-white/70">Conversación en vivo</div>
          </div>
          <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/55">
            Cliente / Sofía IA
          </div>
        </div>
        <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1 hide-scrollbar">
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/45">
              La transcripción aparecerá aquí mientras habla Sofía.
            </div>
          ) : (
            entries.slice(-8).map((entry) => (
              <div
                key={entry.id}
                className={`rounded-2xl border p-4 ${
                  entry.speaker === "Sofía IA"
                    ? "border-evo-gold/20 bg-evo-gold/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="mb-1 text-[10px] uppercase tracking-[0.22em] text-white/45">
                  {entry.speaker}
                </div>
                <p className="text-sm leading-6 text-white/90">{entry.text || "..."}</p>
              </div>
            ))
          )}
        </div>
      </div>
    ),
    agenda: (
      <div className="space-y-3">
        <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/35">Agenda</div>
            <div className="text-sm text-white/70">Detalle de cita</div>
          </div>

          {appointment ? (
            <div className="rounded-2xl border border-evo-gold/20 bg-evo-gold/10 p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-evo-goldSoft/80">
                Cita confirmada
              </div>
              <div className="mt-3 space-y-2 text-sm text-white/88">
                <p>
                  <span className="text-white/55">Cliente:</span> {appointment.customerName}
                </p>
                <p>
                  <span className="text-white/55">Teléfono:</span> {appointment.phone}
                </p>
                <p>
                  <span className="text-white/55">Servicio:</span> {appointment.service}
                </p>
                <p>
                  <span className="text-white/55">Fecha:</span> {appointment.date}
                </p>
                <p>
                  <span className="text-white/55">Hora:</span> {appointment.startTime}
                </p>
                <p>
                  <span className="text-white/55">Duración:</span> {appointment.durationMinutes} min
                </p>
                {appointment.eventId ? (
                  <p>
                    <span className="text-white/55">Event ID:</span> {appointment.eventId}
                  </p>
                ) : null}
              </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleShareAppointment("whatsapp")}
                    className="rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-black transition active:scale-[0.99]"
                  >
                  WhatsApp
                </button>
                <button
                  onClick={() => handleShareAppointment("sms")}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.99]"
                  >
                    SMS
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExportAppointment}
                    className="rounded-2xl border border-evo-gold/20 bg-evo-gold/10 px-4 py-3 text-sm font-semibold text-evo-goldSoft transition active:scale-[0.99]"
                  >
                    Exportar calendario
                  </button>
                  <button
                    onClick={handleOpenDirections}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.99]"
                  >
                    Ver dirección
                  </button>
                </div>
                <p className="mt-3 text-xs leading-5 text-white/55">
                  Dirección demo: {BARBERSHOP_ADDRESS}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                Aún no hay una cita confirmada. Cuando el cliente confirme, aparecerá aquí.
              </div>
          )}
        </div>

        <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
          <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/45">
            Horarios sugeridos
          </div>
          <div className="flex flex-wrap gap-2">
            {alternatives.length > 0 ? (
              alternatives.map((slot) => (
                <span
                  key={slot}
                  className="rounded-full border border-evo-gold/20 bg-evo-gold/10 px-3 py-1 text-xs text-evo-goldSoft"
                >
                  {slot}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">
                Sin sugerencias todavía
              </span>
            )}
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
            Logs
          </div>
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1 hide-scrollbar text-xs text-white/75">
            {logs.length === 0 ? (
              <div className="text-white/40">Aquí verás cada paso de la llamada en vivo.</div>
            ) : (
              logs.map((log, index) => (
                <div key={`${index}-${log}`} className="rounded-2xl border border-white/8 bg-black/25 px-3 py-2">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    ),
  };

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 pb-24 pt-3 md:px-6 md:pb-8 md:pt-6">
        <header className="safe-top mb-4 hidden items-center justify-between gap-4 md:flex">
          <div>
            <div className="text-[10px] uppercase tracking-[0.45em] text-white/35">
              Imperial Barber Studio
            </div>
            <h1 className="text-lg font-semibold tracking-wide">AZENTYA Voice Agent</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              Sofía IA
            </span>
            <span className="rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-1 text-[11px] text-fuchsia-200">
              Demo de llamada IA
            </span>
          </div>
        </header>

        <section className="md:hidden">
          <div className="mb-3 rounded-[1.35rem] border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center justify-between text-[11px] text-white/50">
              <span>{formatNowClock()}</span>
              <div className="flex items-center gap-2">
                <span>5G</span>
                <span>🔋</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                Audio
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${audioQualityClass[audioQuality]}`}
              >
                {audioQuality}
              </span>
            </div>
          </div>

          {activeTabContent[mobileTab]}
        </section>

        <section className="hidden md:flex flex-1 flex-col gap-6">
          <section className="flex flex-1 flex-col items-center justify-center">
            <div className="relative flex h-[420px] w-[420px] max-w-[88vw] items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_55%)] blur-2xl" />

              <div
                className="relative h-[330px] w-[330px] rounded-full border border-white/8 bg-[radial-gradient(circle_at_center,rgba(18,18,28,0.92),rgba(5,5,7,0.96))]"
                style={orbStyle}
              >
                <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg,rgba(205,64,255,0.95),rgba(112,102,255,0.95),rgba(205,64,255,0.95))] opacity-80 blur-[2px]" />

                <div className="absolute inset-[3px] rounded-full bg-[radial-gradient(circle_at_center,rgba(18,18,28,0.96),rgba(6,6,10,0.98))]" />

                <div className="absolute inset-0">
                  {Array.from({ length: 40 }).map((_, index) => {
                    const angle = (360 / 40) * index;
                    const variance = 0.45 + index % 7 / 10;
                    const pulse = isCalling ? 1 + audioLevel * 1.9 : 1;
                    const barHeight = 14 + variance * 20 + audioLevel * 36;
                    return (
                      <span
                        key={index}
                        className="absolute left-1/2 top-1/2 block origin-bottom rounded-full bg-[linear-gradient(to_top,#6b64ff,#d33cff)] shadow-[0_0_14px_rgba(211,60,255,0.4)]"
                        style={{
                          width: "4px",
                          height: `${barHeight * pulse}px`,
                          transform: `translate(-50%, -100%) rotate(${angle}deg) translateY(-155px)`,
                          opacity: 0.35 + audioLevel * 0.65,
                        }}
                      />
                    );
                  })}
                </div>

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full border border-white/10 bg-black/50 backdrop-blur-md">
                    <div className="text-xs uppercase tracking-[0.35em] text-white/35">
                      {statusLabel[status]}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-wide text-white">
                      Sofía IA
                    </div>
                    <div className="mt-2 h-1.5 w-20 rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-fuchsia-400 to-indigo-400 transition-all duration-75"
                        style={{ width: `${Math.max(12, audioLevel * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleStart}
                disabled={isCalling}
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Iniciar llamada demo
              </button>
              <button
                onClick={handleStop}
                disabled={!isCalling}
                className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Finalizar llamada
              </button>
            </div>

            <div className="mt-4 text-center text-sm text-white/60">
              {demoMode ? "Modo demo sin calendario real" : "Conectado al calendario real"}
            </div>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  audioQuality === "Audio limpio"
                    ? "bg-emerald-400"
                    : audioQuality === "Ruido moderado"
                      ? "bg-amber-400"
                      : "bg-rose-400"
                }`}
              />
              {audioQuality}
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-white/35">Logs</div>
                <div className="text-sm text-white/70">Actividad en tiempo real</div>
              </div>
              <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/55">
                {logs.length} eventos
              </div>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1 text-xs text-white/75 hide-scrollbar">
              {logs.length === 0 ? (
                <div className="text-white/40">Aquí verás cada paso de la llamada en vivo.</div>
              ) : (
                logs.map((log, index) => (
                  <div key={`${index}-${log}`} className="rounded-2xl border border-white/8 bg-black/25 px-3 py-2">
                    {log}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.3em] text-white/35">
                Conversacion
              </div>
              <div className="max-h-56 space-y-3 overflow-y-auto pr-1 text-sm hide-scrollbar">
                {entries.length === 0 ? (
                  <div className="text-white/45">
                    La conversación aparecerá aquí mientras habla Sofía.
                  </div>
                ) : (
                  entries.slice(-8).map((entry) => (
                    <div key={entry.id} className="rounded-2xl bg-black/30 px-4 py-3">
                      <div className="mb-1 text-[11px] uppercase tracking-[0.25em] text-white/35">
                        {entry.speaker}
                      </div>
                      <div className="leading-6 text-white/90">{entry.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.3em] text-white/35">Cita</div>
              {appointment ? (
                <div className="space-y-2 text-sm">
                  <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-4">
                    <div className="mb-2 text-xs uppercase tracking-[0.25em] text-fuchsia-200">
                      Confirmada
                    </div>
                    <div className="text-white/90">
                      {appointment.service} - {appointment.customerName}
                    </div>
                    <div className="mt-2 text-white/65">
                      {appointment.date} · {appointment.startTime}
                    </div>
                    <div className="mt-1 text-white/65">{appointment.phone}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-white/45">
                  Aquí verás el detalle de la cita cuando se confirme.
                </div>
              )}

              {alternatives.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {alternatives.map((slot) => (
                    <span
                      key={slot}
                      className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/75"
                    >
                      {slot}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </section>
      </div>

      <nav className="md:hidden safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#060608]/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-1 px-3 py-2">
          {[
            { id: "llamada", label: "Llamada" },
            { id: "transcripcion", label: "Texto" },
            { id: "agenda", label: "Agenda" },
          ].map((item) => {
            const active = mobileTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setMobileTab(item.id as MobileTab)}
                className={`rounded-2xl px-3 py-3 text-xs font-semibold transition ${
                  active
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/5 text-white/70"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
