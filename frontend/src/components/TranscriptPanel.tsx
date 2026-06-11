import type { TranscriptEntry } from "@/lib/realtime";

export function TranscriptPanel({ entries }: { entries: TranscriptEntry[] }) {
  return (
    <section className="glass rounded-3xl p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/45">Transcripcion</p>
          <h2 className="font-display text-2xl text-white">Conversacion en vivo</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
          Cliente / Sofia IA
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto space-y-3 pr-1">
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-white/55">
            La transcripcion aparecera aqui mientras dure la llamada.
          </div>
        ) : (
          entries.map((entry) => (
              <div
              key={entry.id}
              className={`rounded-2xl border p-4 ${
                entry.speaker === "Sofía IA"
                  ? "border-evo-gold/20 bg-evo-gold/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="mb-1 text-xs uppercase tracking-[0.22em] text-white/45">
                {entry.speaker}
              </div>
              <p className="text-sm leading-6 text-white/90">{entry.text || "..."}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
