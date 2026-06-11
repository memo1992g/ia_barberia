"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { startRealtimeCall } from "@/lib/realtime";
import type { AppointmentCard, CallStatus, TranscriptEntry } from "@/lib/realtime";

const demoMode = String(process.env.NEXT_PUBLIC_DEMO_MODE || "").toLowerCase() === "true";

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

export default function Page() {
  const [status, setStatus] = useState<CallStatus>("esperando");
  const [audioLevel, setAudioLevel] = useState(0.08);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [appointment, setAppointment] = useState<AppointmentCard | null>(null);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const callRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    return () => {
      callRef.current?.stop();
    };
  }, []);

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
        onLog: (message) => {
          setLogs((current) => [message, ...current].slice(0, 12));
        },
      });

      callRef.current = call;
      setIsCalling(true);
      setStatus("escuchando");
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
  };

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 md:px-6">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.45em] text-white/35">
              Imperial Barber Studio
            </div>
            <h1 className="text-lg font-semibold tracking-wide">EVO Voice Agent</h1>
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
                  const variance = 0.45 + ((index % 7) / 10);
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
          <div className="max-h-48 space-y-2 overflow-y-auto pr-1 text-xs text-white/75">
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

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.3em] text-white/35">
              Conversacion
            </div>
            <div className="max-h-56 space-y-3 overflow-y-auto pr-1 text-sm">
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
            <div className="mb-3 text-xs uppercase tracking-[0.3em] text-white/35">
              Cita
            </div>
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
      </div>
    </main>
  );
}
