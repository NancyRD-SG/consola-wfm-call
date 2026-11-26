import React from 'react';

// "nombre" es el estado tal como lo guarda el backend. "clase" .
const ESTADOS = [
  { nombre: 'Disponible', clase: 'btn-disponible' },
  { nombre: 'Pausa activa', clase: 'btn-break' },
  { nombre: 'Break', clase: 'btn-break' },
  { nombre: 'Almuerzo', clase: 'btn-almuerzo' },
  { nombre: 'Capacitación', clase: 'btn-capacitacion' },
  { nombre: 'Coaching', clase: 'btn-capacitacion' },
  { nombre: 'Reunión', clase: 'btn-capacitacion' },
  { nombre: 'Desconectado', clase: 'btn-backoffice' },
];

const COLORES = {
  Disponible: '#34d399',
  'Atendiendo caso': '#38bdf8',
  'Pausa activa': '#fbbf24',
  Break: '#fbbf24',
  Almuerzo: '#60a5fa',
  Capacitación: '#a78bfa',
  Coaching: '#a78bfa',
  Reunión: '#a78bfa',
  Desconectado: '#94a3b8',
};

export default function StatusAgent({ estadoActual = 'Desconectado', bloqueado = false, onEstadoChange }) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Cambiar Estado del Agente</h2>

      <div style={{ marginBottom: '1rem' }}>
        <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Estado actual:</span>
        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: COLORES[estadoActual] || '#94a3b8', marginTop: '0.25rem' }}>
          {estadoActual}
        </div>
      </div>

      {bloqueado && (
        <p style={{ color: '#fbbf24', fontSize: '0.85rem', marginTop: 0 }}>
          Estás atendiendo un caso. Ciérralo para poder cambiar de estado.
        </p>
      )}

      <div className="status-grid">
        {ESTADOS.map((item) => (
          <button
            key={item.nombre}
            onClick={() => onEstadoChange && onEstadoChange(item.nombre)}
            disabled={bloqueado || item.nombre === estadoActual}
            className={`status-btn ${item.clase}`}
          >
            {item.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}