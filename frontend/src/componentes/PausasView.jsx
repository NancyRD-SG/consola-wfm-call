import React from 'react';

const TOLERANCIA_MIN = 5;

const aMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const hora12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

// Fecha de hoy como 'AAAA-MM-DD'
const hoyTexto = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function PausasView({ eventos = [], historial = [], descansaHoy = false }) {
  const ahora = new Date();
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const deHoy = historial.filter((h) => h.inicio.startsWith(hoyTexto()));
  const pausas = eventos.filter((e) => e.tipo !== 'Turno');

  // Compara cada descanso programado con lo que el agente realmente hizo hoy
  const filas = pausas.map((e) => {
    const tomado = deHoy.find((h) => h.horario_id === e.id);
    const inicioMin = aMin(e.hora_inicio);
    let estado;
    let clase;
    let detalle = '';
    let evaluado = true;

    if (tomado) {
      const d = tomado.desfase_min;
      detalle = `Inició a las ${tomado.inicio.slice(11, 16)} (${d > 0 ? '+' : ''}${d} min)`;
      if (tomado.cumplido === 1) { estado = 'A tiempo'; clase = 'ok'; }
      else { estado = 'Fuera de horario'; clase = 'mal'; }
    } else if (minAhora > inicioMin + TOLERANCIA_MIN) {
      estado = 'No tomado'; clase = 'mal';
    } else if (minAhora >= inicioMin - TOLERANCIA_MIN) {
      estado = 'Ya puedes iniciarlo'; clase = 'aviso'; evaluado = false;
    } else {
      estado = 'Pendiente'; clase = 'neutro'; evaluado = false;
    }
    return { e, estado, clase, detalle, evaluado };
  });

  const evaluados = filas.filter((f) => f.evaluado);
  const aTiempo = evaluados.filter((f) => f.estado === 'A tiempo').length;
  const porcentaje = evaluados.length > 0 ? Math.round((100 * aTiempo) / evaluados.length) : null;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon">⏱️</span>
        <h3>Control de Pausas de Hoy</h3>
      </div>

      {pausas.length === 0 ? (
        <p style={{ color: '#94a3b8', margin: 0 }}>
          {descansaHoy ? 'Hoy es tu día de descanso.' : 'No hay pausas programadas para hoy.'}
        </p>
      ) : (
        <>
          <p style={{ marginTop: 0 }}>
            {porcentaje === null
              ? 'Todavía no hay descansos para evaluar hoy.'
              : <>Cumplimiento de hoy: <strong>{aTiempo} de {evaluados.length} a tiempo ({porcentaje} %)</strong></>}
          </p>
          <table className="tabla">
            <thead>
              <tr><th>Descanso</th><th>Programado</th><th>Estado</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.e.id}>
                  <td>{f.e.tipo}</td>
                  <td>{hora12(f.e.hora_inicio)} ({aMin(f.e.hora_fin) - aMin(f.e.hora_inicio)} min)</td>
                  <td><span className={`etiqueta ${f.clase}`}>{f.estado}</span></td>
                  <td>{f.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 0 }}>
            Un descanso cuenta como "a tiempo" si lo inicias dentro de ±{TOLERANCIA_MIN} minutos de su hora programada.
          </p>
        </>
      )}
    </div>
  );
}