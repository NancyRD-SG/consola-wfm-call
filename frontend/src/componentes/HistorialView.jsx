import React from 'react';

// Fecha de hoy como 'AAAA-MM-DD'
const hoyTexto = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const duracion = (seg) => {
  if (seg === null || seg === undefined) return 'En curso';
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
};

export default function HistorialView({ historial = [], casosCerrados = [] }) {
  const deHoy = historial.filter((h) => h.inicio.startsWith(hoyTexto()));

  return (
    <>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-icon">🕒</span>
          <h3>Estados de Hoy</h3>
        </div>
        {deHoy.length === 0 ? (
          <p style={{ color: '#94a3b8', margin: 0 }}>Todavía no hay estados registrados hoy.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr><th>Estado</th><th>Inicio</th><th>Fin</th><th>Duración</th><th>Caso</th></tr>
            </thead>
            <tbody>
              {deHoy.map((h) => (
                <tr key={h.id}>
                  <td>{h.estado}</td>
                  <td>{h.inicio.slice(11, 19)}</td>
                  <td>{h.fin ? h.fin.slice(11, 19) : '—'}</td>
                  <td>{duracion(h.duracion_seg)}</td>
                  <td>{h.numero_caso || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-icon">📋</span>
          <h3>Casos Cerrados Hoy</h3>
        </div>
        {casosCerrados.length === 0 ? (
          <p style={{ color: '#94a3b8', margin: 0 }}>Todavía no has cerrado casos hoy.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr><th>Caso</th><th>Cliente</th><th>Cierre</th><th>Encuesta</th></tr>
            </thead>
            <tbody>
              {casosCerrados.map((c) => (
                <tr key={c.numero_caso}>
                  <td>{c.numero_caso}</td>
                  <td>{c.cliente_nombre}</td>
                  <td>{c.fecha_cierre.slice(11, 19)}</td>
                  <td>
                    {c.encuesta
                      ? <span className={`etiqueta ${c.encuesta === 'POSITIVA' ? 'ok' : 'mal'}`}>
                          {c.encuesta === 'POSITIVA' ? 'Positiva' : 'Negativa'} · {c.calificacion}/5
                        </span>
                      : <span className="etiqueta neutro">Sin respuesta</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}