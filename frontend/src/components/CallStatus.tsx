import type { CallStatus } from "@/lib/realtime";

const statusConfig: Record<
  CallStatus,
  { label: string; accent: string; glow: string }
> = {
  esperando: {
    label: "Esperando",
    accent: "bg-white/10 text-white",
    glow: "from-white/40 to-white/10",
  },
  conectando: {
    label: "Conectando",
    accent: "bg-evo-gold/15 text-evo-goldSoft border border-evo-gold/30",
    glow: "from-evo-gold/80 to-evo-gold/10",
  },
  escuchando: {
    label: "Escuchando",
    accent: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
    glow: "from-emerald-400/80 to-emerald-400/10",
  },
  respondiendo: {
    label: "Sofía respondiendo",
    accent: "bg-sky-500/15 text-sky-200 border border-sky-500/25",
    glow: "from-sky-400/80 to-sky-400/10",
  },
  revisando: {
    label: "Revisando agenda",
    accent: "bg-amber-500/15 text-amber-200 border border-amber-500/25",
    glow: "from-amber-400/80 to-amber-400/10",
  },
  confirmada: {
    label: "Cita confirmada",
    accent: "bg-evo-gold/20 text-evo-goldSoft border border-evo-gold/40",
    glow: "from-evo-gold/90 to-evo-gold/20",
  },
  ocupado: {
    label: "Horario ocupado",
    accent: "bg-rose-500/15 text-rose-200 border border-rose-500/25",
    glow: "from-rose-400/80 to-rose-400/10",
  },
  error: {
    label: "Error",
    accent: "bg-red-500/20 text-red-200 border border-red-500/25",
    glow: "from-red-400/80 to-red-400/10",
  },
};

export function CallStatus({ status }: { status: CallStatus }) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-3">
      <div className={`relative h-3 w-3 rounded-full bg-gradient-to-br ${config.glow} shadow-[0_0_18px_rgba(200,169,106,0.45)]`} />
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${config.accent}`}>
        {config.label}
      </span>
    </div>
  );
}
