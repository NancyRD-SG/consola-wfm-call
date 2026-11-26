import React, { useState, useEffect, useCallback } from 'react';
import Barsuper from './Barsuper';
import { obtenerCumplimiento } from '../services/api';

const META = 80; // cumplimiento de referencia (%). Cámbialo si tu meta es otra.

const mostrarPorcentaje = (p) => (p === null || p === undefined ? '—' : `${p} %`);

function clasePorcentaje(p) {
  if (p === null || p === undefined) return 'neutro';
  return p >= META ? 'ok' : 'mal';
}

export default function SupervisorView({ usuario, onSalir }) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    const d = await obtenerCumplimiento(desde, hasta);
    if (d) {
      setDatos(d);
      setError('');
    } else {
      setError('No se pudo cargar el cumplimiento. Revisa que el backend esté corriendo.');
    }
  }, [desde, hasta]);

  // Carga al abrir y se actualiza cada 15 segundos
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [cargar]);

  // Descarga la tabla como CSV (separador ";" para que Excel en español la abra en columnas)
  const descargar = () => {
    if (!datos) return;
    const filas = [
      ['Agente', 'Canal', 'Descansos evaluados', 'A tiempo', 'Cumplimiento (%)', 'Desfase promedio (min)'],
      ...datos.por_agente.map((a) => [
        a.nombre, a.canal, a.descansos, a.a_tiempo, a.porcentaje ?? '', a.desfase_promedio_min ?? '',
      ]),
      ['TOTAL', '', datos.total.descansos, datos.total.a_tiempo, datos.total.porcentaje ?? '', datos.total.desfase_promedio_min ?? ''],
    ];
    const texto = '\uFEFF' + filas.map((f) => f.join(';')).join('\n');
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    enlace.download = 'cumplimiento-descansos.csv';
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  };

  return (
    <div className="app-layout">
      <Barsuper rol="SUPERVISOR" nombre={usuario.nombre} onSalir={onSalir} />
      <div className="main-container">
        <main className="content-area" style={{ width: '100%' }}>
          {error && <div className="card" style={{ color: '#f87171' }}>{error}</div>}

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <span className="card-icon">📈</span>
              <h3>Cumplimiento de Descansos</h3>
            </div>

            <div className="filtros">
              <label>
                Desde
                <input type="date" className="caja-texto" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </label>
              <label>
                Hasta
                <input type="date" className="caja-texto" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </label>
              <button className="btn-secundario" onClick={() => { setDesde(''); setHasta(''); }}>
                Ver todo
              </button>
              <button className="btn-action" onClick={descargar} disabled={!datos}>
                Descargar para Excel
              </button>
            </div>

            {datos && (
              <div className="resumen-total">
                <div>
                  <span className="metric-label">Descansos evaluados</span>
                  <div className="metric-number">{datos.total.descansos}</div>
                </div>
                <div>
                  <span className="metric-label">A tiempo</span>
                  <div className="metric-number" style={{ color: '#34d399' }}>{datos.total.a_tiempo}</div>
                </div>
                <div>
                  <span className="metric-label">Cumplimiento total</span>
                  <div className="metric-number">{mostrarPorcentaje(datos.total.porcentaje)}</div>
                </div>
                <div>
                  <span className="metric-label">Desfase promedio</span>
                  <div className="metric-number">
                    {datos.total.desfase_promedio_min === null ? '—' : `${datos.total.desfase_promedio_min} min`}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-icon">👥</span>
              <h3>Por Agente</h3>
            </div>
            {!datos ? (
              <p style={{ color: '#94a3b8', margin: 0 }}>Cargando...</p>
            ) : (
              <>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Agente</th><th>Canal</th><th>Evaluados</th><th>A tiempo</th>
                      <th>Cumplimiento</th><th>Desfase prom.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.por_agente.map((a) => (
                      <tr key={a.id}>
                        <td>{a.nombre}</td>
                        <td>{a.canal}</td>
                        <td>{a.descansos}</td>
                        <td>{a.a_tiempo}</td>
                        <td><span className={`etiqueta ${clasePorcentaje(a.porcentaje)}`}>{mostrarPorcentaje(a.porcentaje)}</span></td>
                        <td>{a.desfase_promedio_min === null ? '—' : `${a.desfase_promedio_min} min`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 0 }}>
                  Un descanso cuenta como "a tiempo" si el agente lo inicia dentro de ±{datos.tolerancia_min} minutos de su hora programada.
                  Verde: cumplimiento de {META} % o más.
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}