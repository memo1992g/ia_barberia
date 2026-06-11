import type { CallStatus } from "@/lib/realtime";
import { CallStatus as StatusBadge } from "./CallStatus";

export function CallCard({
  status,
  demoMode,
  isCalling,
  onStart,
  onStop,
}: {
  status: CallStatus;
  demoMode: boolean;
  isCalling: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const canStart = !isCalling && status !== "conectando";

  return (
    <section className="glass relative overflow-hidden rounded-[2rem] p-6 md:p-8">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-evo-gold/60 to-transparent" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Demo de llamada IA</p>
          <h1 className="mt-2 font-display text-4xl text-white md:text-5xl">EVO Voice Agent</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65 md:text-base">
            Imperial Barber Studio con Sofía IA, una recepcionista virtual que atiende, revisa
            agenda y agenda citas por voz en tiempo real.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full border border-evo-gold/30 bg-evo-gold/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-evo-goldSoft">
            Powered by EVO
          </span>
          {demoMode ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
              Modo demo sin calendario real
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-white/40">Agente</div>
              <h2 className="font-display text-3xl text-white">Sofia IA</h2>
            </div>
            <StatusBadge status={status} />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex h-16 w-16 animate-pulseGlow items-center justify-center rounded-full border border-evo-gold/25 bg-gradient-to-br from-evo-gold/25 to-white/5 shadow-glow">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-evo-goldSoft">
                SI
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-white/70">Imperial Barber Studio</p>
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">
                Recepcionista virtual profesional
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-evo-smoke/80 p-5">
            <div className="flex items-end gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((bar, index) => (
                <span
                  key={bar}
                  className="w-full rounded-full bg-gradient-to-t from-evo-gold/35 to-evo-goldSoft/90 animate-bars"
                  style={{
                    height: `${12 + ((index % 4) + 1) * 8}px`,
                    animationDelay: `${index * 0.12}s`,
                  }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-white/45">
              <span>Mic activo</span>
              <span>Audio realtime</span>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
          <div className="flex h-full flex-col justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/40">Accion</p>
              <h3 className="mt-2 font-display text-2xl text-white">Llamada simulada por voz</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">
                Pulsa iniciar, concede permiso al microfono y conversa con Sofía como si
                estuvieras llamando a la barberia.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={onStart}
                disabled={!canStart}
                className="w-full rounded-2xl bg-gradient-to-r from-evo-gold to-evo-goldSoft px-5 py-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Iniciar llamada demo
              </button>
              <button
                onClick={onStop}
                disabled={!isCalling}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Finalizar llamada
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                Servicios disponibles
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/72">
                <span className="rounded-full border border-white/10 px-3 py-1">Corte clasico</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Fade</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Barba</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Corte + barba</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Cejas</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Tratamiento capilar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
