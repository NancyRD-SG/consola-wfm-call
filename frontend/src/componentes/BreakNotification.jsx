import React, { useState, useEffect } from 'react';

const aMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const aHHMM = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// SOLO PARA PRUEBAS: con ?hora=08:56 en la dirección, el reloj parte de esa hora
const horaSimulada = new URLSearchParams(window.location.search).get('hora');
const cargadoEn = Date.now();
function reloj() {
  if (!horaSimulada || !/^\d{1,2}:\d{2}$/.test(horaSimulada)) return new Date();
  const [h, m] = horaSimulada.split(':').map(Number);
  const base = new Date();
  base.setHours(h, m, 0, 0);
  return new Date(base.getTime() + (Date.now() - cargadoEn));
}

const AVISO_ANTES_MIN = 5;   // avisa desde 5 minutos antes
const TOLERANCIA_MIN = 5;    // igual que el backend: a tiempo = dentro de ±5 minutos

// "tomados" = ids de los descansos que el agente ya tomó hoy; de esos no se vuelve a avisar
export default function BreakNotification({ eventos = [], estadoActual, tomados = [] }) {
  const [ahora, setAhora] = useState(reloj());
  const [descartados, setDescartados] = useState([]);

  useEffect(() => {
    const t = setInterval(() => setAhora(reloj()), 15000);
    return () => clearInterval(t);
  }, []);

  // Solo avisa si el agente está Disponible (si ya está en una pausa, no hace falta)
  if (estadoActual !== 'Disponible') return null;

  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();

  // Primer descanso programado que está por empezar (o que empezó hace menos de 5 minutos)
  const proximo = eventos
    .filter((e) => e.tipo !== 'Turno' && !descartados.includes(e.id) && !tomados.includes(e.id))
    .map((e) => ({ ...e, falta: aMin(e.hora_inicio) - minAhora }))
    .find((e) => e.falta <= AVISO_ANTES_MIN && e.falta >= -TOLERANCIA_MIN);

  if (!proximo) return null;

  const mensaje =
    proximo.falta > 0
      ? `Faltan ${proximo.falta} min para tu ${proximo.tipo} (${proximo.hora_inicio}). Ve cerrando tus pendientes.`
      : `Es hora de tu ${proximo.tipo}. Puedes iniciarlo hasta las ${aHHMM(aMin(proximo.hora_inicio) + TOLERANCIA_MIN)} para cumplir el horario.`;

  return (
    <div className="notification-card" style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '1.5rem' }}>⚠️</span>
        <div>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.9rem' }}>Aviso de {proximo.tipo}</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.9 }}>{mensaje}</p>
        </div>
      </div>
      <button
        onClick={() => setDescartados([...descartados, proximo.id])}
        style={{
          background: 'transparent',
          border: '1px solid #f59e0b',
          color: '#fde68a',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.75rem',
        }}
      >
        Entendido
      </button>
    </div>
  );
}