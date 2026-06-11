import type { AppointmentCard } from "@/lib/realtime";

export function AppointmentPanel({
  appointment,
  alternatives,
}: {
  appointment: AppointmentCard | null;
  alternatives: string[];
}) {
  return (
    <section className="glass rounded-3xl p-5 md:p-6">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-white/45">Agenda</p>
        <h2 className="font-display text-2xl text-white">Detalle de cita</h2>
      </div>

      {appointment ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-evo-gold/20 bg-evo-gold/10 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-evo-goldSoft/80">
              Cita confirmada
            </div>
            <div className="mt-3 space-y-2 text-sm text-white/88">
              <p>
                <span className="text-white/55">Cliente:</span> {appointment.customerName}
              </p>
              <p>
                <span className="text-white/55">Telefono:</span> {appointment.phone}
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
                <span className="text-white/55">Duracion:</span> {appointment.durationMinutes} min
              </p>
              {appointment.eventId ? (
                <p>
                  <span className="text-white/55">Event ID:</span> {appointment.eventId}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            Aun no hay una cita confirmada. Cuando el cliente confirme, la informacion aparecera aqui.
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.22em] text-white/45">
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
                  Sin sugerencias todavia
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
