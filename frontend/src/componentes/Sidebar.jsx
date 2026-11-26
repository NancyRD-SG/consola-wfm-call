import React from 'react';

const OPCIONES = [
  { id: 'estado', texto: 'Estado Agente' },
  { id: 'pausas', texto: 'Control de Pausas' },
  { id: 'historial', texto: 'Historial del Día' },
];

export default function Sidebar({ vista = 'estado', onCambiarVista }) {
  return (
    <aside className="sidebar">
      <nav>
        {OPCIONES.map((o) => (
          <a
            key={o.id}
            href={`#${o.id}`}
            className={vista === o.id ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              if (onCambiarVista) onCambiarVista(o.id);
            }}
          >
            {o.texto}
          </a>
        ))}
      </nav>
    </aside>
  );
}