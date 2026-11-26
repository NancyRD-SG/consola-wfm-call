import React, { useState, useEffect, useCallback } from 'react';
import Barsuper from './Barsuper';
import Sidebar from './Sidebar';
import StatusAgent from './StatusAgent';
import BreakTimer from './BreakTimer';
import BreakNotification from './BreakNotification';
import ScheduleGrid from './ScheduleGrid';
import AgentMetrics from './AgentMetrics';
import CasosPanel from './CasosPanel';
import PausasView from './PausasView';
import HistorialView from './HistorialView';
import {
  obtenerDatosAgente, obtenerEstadoActual, actualizarEstadoEnServidor,
  obtenerCasos, tomarCaso, cerrarCaso, obtenerHistorial,
} from '../services/api';

// 'AAAA-MM-DD HH:MM:SS' (hora local del servidor) -> Date
const aFecha = (texto) => new Date(texto.replace(' ', 'T'));

const CASOS_VACIOS = {
  estado: 'Desconectado', en_atencion: null, pendientes: [], total_pendientes: 0, cerrados_hoy: [],
};

export default function ConsolaAgente({ usuario, onSalir }) {
  const AGENTE_ID = usuario.id;

  const [vista, setVista] = useState('estado');

  const [canalAgente, setCanalAgente] = useState(usuario.canal || 'Chat');
  const [casosAtendidos, setCasosAtendidos] = useState(0);
  const [supervisorAsignado, setSupervisorAsignado] = useState('Cargando...');
  const [mallaHoraria, setMallaHoraria] = useState([]);
  const [descansaHoy, setDescansaHoy] = useState(false);
  const [puntuacion, setPuntuacion] = useState('Sin encuestas');

  const [estadoAgente, setEstadoAgente] = useState('Desconectado');
  const [inicioEstado, setInicioEstado] = useState(new Date());
  const [mensajeError, setMensajeError] = useState('');

  const [casos, setCasos] = useState(CASOS_VACIOS);
  const [historial, setHistorial] = useState([]);

  // Datos del agente (supervisor, canal, malla del día y métricas)
  const cargarDatos = useCallback(async () => {
    const datos = await obtenerDatosAgente(AGENTE_ID);
    if (datos) {
      setCanalAgente(datos.canal || 'Chat');
      setCasosAtendidos(datos.casosAtendidos || 0);
      setSupervisorAsignado(datos.supervisor || 'Sin asignar');
      setMallaHoraria(datos.mallaHoraria || []);
      setDescansaHoy(datos.descansaHoy);
      setPuntuacion(datos.puntuacionEncuesta);
    } else {
      setMensajeError('No se pudo conectar con el servidor. Revisa que el backend esté corriendo.');
    }
  }, [AGENTE_ID]);

  const recargarCasos = useCallback(async () => {
    const c = await obtenerCasos(AGENTE_ID);
    if (c) setCasos(c);
  }, [AGENTE_ID]);

  const recargarHistorial = useCallback(async () => {
    const h = await obtenerHistorial(AGENTE_ID);
    if (h) setHistorial(h);
  }, [AGENTE_ID]);

  // Al abrir la pantalla: carga los datos y el estado en el que quedó el agente
  useEffect(() => {
    async function inicio() {
      await cargarDatos();
      const actual = await obtenerEstadoActual(AGENTE_ID);
      if (actual) {
        setEstadoAgente(actual.estado);
        if (actual.inicio) setInicioEstado(aFecha(actual.inicio));
      }
    }
    inicio();
  }, [cargarDatos, AGENTE_ID]);

  // Revisa si llegaron casos nuevos cada 10 segundos
  useEffect(() => {
    recargarCasos();
    const t = setInterval(recargarCasos, 10000);
    return () => clearInterval(t);
  }, [recargarCasos]);

  // El historial se carga siempre y se actualiza cada vez que cambia el estado.
  // Sirve para Control de Pausas, Historial del Día y para no repetir avisos de descansos ya tomados
  useEffect(() => {
    recargarHistorial();
  }, [vista, estadoAgente, recargarHistorial]);

  // Cambia el estado: primero lo guarda en el backend y, si se guardó, lo muestra
  const manejarCambioEstado = async (nuevoEstado) => {
    const respuesta = await actualizarEstadoEnServidor(AGENTE_ID, nuevoEstado);
    if (!respuesta) {
      setMensajeError('No se pudo guardar el cambio de estado. Intenta de nuevo.');
      return;
    }
    setMensajeError('');
    setEstadoAgente(nuevoEstado);
    setInicioEstado(aFecha(respuesta.inicio));
    recargarCasos();
  };

  // Toma el siguiente caso de la cola
  const manejarTomarCaso = async () => {
    const r = await tomarCaso(AGENTE_ID);
    if (!r) {
      setMensajeError('No se pudo tomar el caso.');
      await recargarCasos();
      return;
    }
    setMensajeError('');
    setEstadoAgente('Atendiendo caso');
    setInicioEstado(aFecha(r.estado.inicio));
    await recargarCasos();
  };

  // Cierra el caso y vuelve a Disponible
  const manejarCerrarCaso = async (casoId) => {
    const r = await cerrarCaso(AGENTE_ID, casoId);
    if (!r) {
      setMensajeError('No se pudo cerrar el caso.');
      await recargarCasos();
      return;
    }
    setMensajeError('');
    setEstadoAgente('Disponible');
    setInicioEstado(r.estado ? aFecha(r.estado.inicio) : new Date());
    await recargarCasos();
    await cargarDatos();
  };

  // Descansos que el agente ya tomó hoy (para no volver a avisarle de ellos)
  const hoy = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const hoyTexto = `${hoy.getFullYear()}-${p2(hoy.getMonth() + 1)}-${p2(hoy.getDate())}`;
  const tomados = historial
    .filter((h) => h.horario_id && h.inicio.startsWith(hoyTexto))
    .map((h) => h.horario_id);

  let contenido;
  if (vista === 'pausas') {
    contenido = <PausasView eventos={mallaHoraria} historial={historial} descansaHoy={descansaHoy} />;
  } else if (vista === 'historial') {
    contenido = <HistorialView historial={historial} casosCerrados={casos.cerrados_hoy} />;
  } else {
    contenido = (
      <>
        <BreakNotification eventos={mallaHoraria} estadoActual={estadoAgente} tomados={tomados} />

        <div className="grid-2">
          <AgentMetrics tipoCanal={canalAgente} casosAtendidos={casosAtendidos} puntuacionEncuesta={puntuacion} />
          <ScheduleGrid schedule={mallaHoraria} descansaHoy={descansaHoy} />
        </div>

        <div className="fila">
          <CasosPanel
            canal={canalAgente}
            estadoActual={estadoAgente}
            casos={casos}
            onTomar={manejarTomarCaso}
            onCerrar={manejarCerrarCaso}
          />
        </div>

        <div className="grid-2">
          <StatusAgent
            estadoActual={estadoAgente}
            bloqueado={estadoAgente === 'Atendiendo caso'}
            onEstadoChange={manejarCambioEstado}
          />
          <BreakTimer
            estadoActual={estadoAgente}
            inicioEstado={inicioEstado}
            eventos={mallaHoraria}
            onTerminar={() => manejarCambioEstado('Disponible')}
          />
        </div>
      </>
    );
  }

  return (
    <div className="app-layout">
      <Barsuper rol="AGENTE" nombre={usuario.nombre} supervisor={supervisorAsignado} onSalir={onSalir} />
      <div className="main-container">
        <Sidebar vista={vista} onCambiarVista={setVista} />
        <main className="content-area">
          {mensajeError && (
            <div className="card" style={{ color: '#f87171' }}>{mensajeError}</div>
          )}
          {contenido}
        </main>
      </div>
    </div>
  );
}