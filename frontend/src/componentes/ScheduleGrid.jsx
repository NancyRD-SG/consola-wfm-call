import React from 'react';

const aMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// '14:30' -> '02:30 PM'
const hora12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export default function ScheduleGrid({ schedule = [], descansaHoy = false }) {
  const turno = schedule.find((e) => e.tipo === 'Turno');
  const pausas = schedule.filter((e) => e.tipo !== 'Turno');

  return (
    <div className="card schedule-card">
      <div className="card-header">
        <span className="card-icon">📅</span>
        <h3>Malla Horaria del Día</h3>
      </div>

      {schedule.length === 0 ? (
        <p style={{ color: '#94a3b8', margin: 0 }}>
          {descansaHoy ? 'Hoy es tu día de descanso.' : 'Cargando horario...'}
        </p>
      ) : (
        <div className="schedule-timeline">
          {turno && (
            <div className="schedule-item">
              <span className="schedule-label">Entrada / Salida</span>
              <span className="schedule-value">{hora12(turno.hora_inicio)} - {hora12(turno.hora_fin)}</span>
            </div>
          )}
          {pausas.map((e) => (
            <div className="schedule-item" key={e.id}>
              <span className="schedule-label">{e.tipo}</span>
              <span className={`schedule-value ${e.tipo === 'Almuerzo' ? 'highlight-lunch' : 'highlight-break'}`}>
                {hora12(e.hora_inicio)} ({aMin(e.hora_fin) - aMin(e.hora_inicio)} min)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}