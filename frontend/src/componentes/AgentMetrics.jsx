import React from 'react';

export default function AgentMetrics({ tipoCanal = 'Chat', casosAtendidos = 0, puntuacionEncuesta = 'Sin encuestas' }) {

  const canal = tipoCanal.charAt(0).toUpperCase() + tipoCanal.slice(1).toLowerCase();

  const infoCanal = {
    Chat: { icono: '💬', etiqueta: 'Chats Atendidos', color: '#38bdf8' },
    Correo: { icono: '✉️', etiqueta: 'Correos Gestionados', color: '#a78bfa' },
    Llamada: { icono: '📞', etiqueta: 'Llamadas Atendidas', color: '#4ade80' },
  }[canal] || { icono: '🎧', etiqueta: 'Casos Atendidos', color: '#38bdf8' };

  return (
    <div className="card metrics-card">
      <div className="card-header">
        <span className="card-icon">📊</span>
        <h3>Rendimiento del Canal ({canal})</h3>
      </div>

      <div className="metrics-grid">
        <div className="metric-box">
          <span className="metric-icon">{infoCanal.icono}</span>
          <div className="metric-data">
            <span className="metric-number" style={{ color: infoCanal.color }}>{casosAtendidos}</span>
            <span className="metric-label">{infoCanal.etiqueta}</span>
          </div>
        </div>

        <div className="metric-box">
          <span className="metric-icon">⭐</span>
          <div className="metric-data">
            <span className="metric-number text-star">{puntuacionEncuesta}</span>
            <span className="metric-label">Satisfacción Encuestas</span>
          </div>
        </div>
      </div>
    </div>
  );
}