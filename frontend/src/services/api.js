const BASE = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';
const CLAVE_TOKEN = 'consola_token';

// La sesión se guarda por pestaña: cada pestaña puede tener un usuario distinto
let alVencer = null;
export function registrarAlVencer(fn) {
  alVencer = fn;
}

export function hayToken() {
  return !!sessionStorage.getItem(CLAVE_TOKEN);
}

// Pide un JSON al backend con la sesión; si algo falla, avisa en la consola y devuelve null
async function pedir(ruta, opciones = {}) {
  try {
    const token = sessionStorage.getItem(CLAVE_TOKEN);
    const r = await fetch(BASE + ruta, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const datos = await r.json();
    if (r.status === 401 && token) {
      // La sesión venció o ya no es válida: vuelve a la pantalla de ingreso
      sessionStorage.removeItem(CLAVE_TOKEN);
      if (alVencer) alVencer();
      return null;
    }
    if (!r.ok) {
      console.error('El backend respondió', r.status, datos);
      return null;
    }
    return datos;
  } catch (e) {
    console.error('No se pudo conectar con el backend:', e.message);
    return null;
  }
}

// ---------- Sesión ----------
export async function iniciarSesion(usuario, clave) {
  try {
    const r = await fetch(BASE + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, clave }),
    });
    const datos = await r.json();
    if (!r.ok) return { error: datos.error || 'No se pudo iniciar sesión' };
    sessionStorage.setItem(CLAVE_TOKEN, datos.token);
    return { usuario: datos.usuario };
  } catch (e) {
    return { error: 'No se pudo conectar con el servidor. Revisa que el backend esté corriendo.' };
  }
}

export async function cerrarSesion() {
  await pedir('/logout', { method: 'POST' });
  sessionStorage.removeItem(CLAVE_TOKEN);
}

// Si la pestaña ya tenía una sesión abierta (por ejemplo, al recargar), la recupera
export async function recuperarSesion() {
  if (!hayToken()) return null;
  const d = await pedir('/yo');
  return d ? d.usuario : null;
}

// ---------- Agente ----------
// Reúne lo que necesita la pantalla del agente
export async function obtenerDatosAgente(id) {
  const horario = await pedir(`/agentes/${id}/horario`);
  const resumen = await pedir(`/agentes/${id}/resumen`);
  if (!horario) return null;

  return {
    canal: horario.agente.canal,
    supervisor: horario.agente.supervisor,
    casosAtendidos: resumen ? resumen.casos_atendidos : 0,
    puntuacionEncuesta: resumen && resumen.puntuacion ? `${resumen.puntuacion}/5` : 'Sin encuestas',
    mallaHoraria: horario.eventos, // { id, tipo, hora_inicio, hora_fin }
    descansaHoy: horario.descansa,
  };
}

// Estado en el que está el agente ahora 
export async function obtenerEstadoActual(id) {
  return pedir(`/agentes/${id}/estado`);
}

// Guarda el cambio de estado con la hora real 
export async function actualizarEstadoEnServidor(id, estado) {
  return pedir(`/agentes/${id}/estado`, {
    method: 'POST',
    body: JSON.stringify({ estado }),
  });
}

// Casos: el que atiende, la cola y los cerrados hoy
export async function obtenerCasos(id) {
  return pedir(`/agentes/${id}/casos`);
}

// Toma el siguiente caso de la cola
export async function tomarCaso(id) {
  return pedir(`/agentes/${id}/casos/tomar`, { method: 'POST' });
}

// Cierra el caso en atención
export async function cerrarCaso(id, casoId) {
  return pedir(`/agentes/${id}/casos/${casoId}/cerrar`, { method: 'POST' });
}

// Historial de estados (los más recientes primero)
export async function obtenerHistorial(id) {
  return pedir(`/agentes/${id}/historial?limite=200`);
}

// ---------- Supervisor ----------
// Cumplimiento de los descansos de todos los agentes. Fechas opcionales: AAAA-MM-DD
export async function obtenerCumplimiento(desde, hasta) {
  const partes = [];
  if (desde) partes.push(`desde=${desde}`);
  if (hasta) partes.push(`hasta=${hasta}`);
  return pedir(`/cumplimiento${partes.length ? '?' + partes.join('&') : ''}`);
}