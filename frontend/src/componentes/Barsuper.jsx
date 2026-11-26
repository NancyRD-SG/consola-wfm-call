import React from 'react';

export default function Barsuper({ rol = 'AGENTE', nombre = '', supervisor = '', onSalir }) {
  return (
    <header className="bar-super">
      <div>
        <h1>Consola de Gestión - Call Center</h1>
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        {rol === 'AGENTE' && supervisor && (
          <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
            Supervisor: <strong style={{ color: '#f8fafc' }}>{supervisor}</strong>
          </span>
        )}
        <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
          {rol === 'SUPERVISOR' ? 'Supervisor' : 'Agente'}: <strong style={{ color: '#f8fafc' }}>{nombre}</strong>
        </span>
        <div className="status-indicator">
          <span className="dot"></span>
          <span>Sesión activa</span>
        </div>
        {onSalir && (
          <button className="btn-salir" onClick={onSalir}>Cerrar sesión</button>
        )}
      </div>
    </header>
  );
}