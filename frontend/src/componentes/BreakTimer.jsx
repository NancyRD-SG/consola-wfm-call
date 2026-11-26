import React, { useState, useEffect } from 'react';

const DURACION_POR_DEFECTO = {
  'Pausa activa': 5, Break: 15, Almuerzo: 30, Capacitación: 105, Coaching: 30, Reunión: 30,
};

const aMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

function formato(totalSeg) {
  const s = Math.abs(totalSeg);
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

export default function BreakTimer({ estadoActual, inicioEstado, eventos = [], onTerminar }) {
  // El reloj se actualiza cada segundo; el tiempo se calcula con la hora real de inicio
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const minutosPrevistos = DURACION_POR_DEFECTO[estadoActual];

  // Disponible y Desconectado no tienen temporizador
  if (!minutosPrevistos) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Control de Tiempo</h2>
        <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
          <p style={{ fontSize: '1rem', margin: 0 }}>Sin pausa activa.</p>
          <p style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '0.5rem' }}>
            El temporizador se activa al iniciar una pausa, break, almuerzo, capacitación, coaching o reunión.
          </p>
        </div>
      </div>
    );
  }

  // Duración programada: la del evento de su malla más cercano a la hora en que inició
  let duracion = minutosPrevistos;
  const candidatos = eventos.filter((e) => e.tipo === estadoActual);
  if (candidatos.length > 0) {
    const inicioMin = inicioEstado.getHours() * 60 + inicioEstado.getMinutes();
    const cercano = candidatos.reduce((a, b) =>
      Math.abs(aMin(a.hora_inicio) - inicioMin) <= Math.abs(aMin(b.hora_inicio) - inicioMin) ? a : b
    );
    duracion = aMin(cercano.hora_fin) - aMin(cercano.hora_inicio);
  }

  const transcurridos = Math.floor((ahora - inicioEstado.getTime()) / 1000);
  const restante = duracion * 60 - transcurridos;
  const excedido = restante < 0;

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Temporizador ({estadoActual}, {duracion} min)</h2>
      <div className="timer-display" style={excedido ? { color: '#f87171' } : undefined}>
        {excedido ? '+' : ''}{formato(restante)}
      </div>
      {excedido && (
        <p style={{ textAlign: 'center', color: '#f87171', margin: '0 0 1rem 0', fontSize: '0.85rem' }}>
          Tiempo excedido. Vuelve a Disponible.
        </p>
      )}
      <div className="timer-buttons">
        <button onClick={onTerminar} className="btn-action">
          Terminar y volver a Disponible
        </button>
      </div>
    </div>
  );
}