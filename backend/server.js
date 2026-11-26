const express = require('express');
const cors = require('cors');
const { iniciar, listar, obtener, ejecutar } = require('./database');
const { prepararAuth, login, logout, yo, exigirSesion } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', exigirSesion);
app.post('/api/login', login);
app.post('/api/logout', logout);
app.get('/api/yo', yo);

// ---------- Constantes ----------
const ESTADOS = [
  'Disponible', 'Atendiendo caso', 'Pausa activa', 'Break', 'Almuerzo',
  'Capacitación', 'Coaching', 'Reunión', 'Desconectado',
];
// Estados que corresponden a un evento programado en la malla del agente
const ESTADOS_PROGRAMADOS = [
  'Pausa activa', 'Break', 'Almuerzo', 'Capacitación', 'Coaching', 'Reunión',
];
const TOLERANCIA_MIN = 5; // un descanso es "a tiempo" si empieza dentro de ±5 minutos

// Casos simulados: cada 20 s llega un caso a cada agente que esté Disponible (hasta 3 en cola)
const GENERAR_CASOS = true;
const INTERVALO_CASOS_MS = 20000;
const MAX_PENDIENTES = 3;

// ---------- Funciones auxiliares ----------
// Date -> 'AAAA-MM-DD HH:MM:SS' (hora local del computador)
function formatoFecha(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
         `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
// 'AAAA-MM-DD HH:MM:SS' -> Date
function aFecha(texto) {
  return new Date(texto.replace(' ', 'T'));
}

// Error con código HTTP (400, 404, 409...) para responder con el mensaje correcto
class ErrorHttp extends Error {
  constructor(codigo, mensaje, extra = {}) {
    super(mensaje);
    this.codigo = codigo;
    this.extra = extra;
  }
}

function responderError(res, e) {
  if (e instanceof ErrorHttp) {
    return res.status(e.codigo).json({ error: e.message, ...e.extra });
  }
  if (String(e.message).includes('historial_estados.usuario_id')) {
    return res.status(409).json({ error: 'El agente ya tiene un cambio de estado en curso' });
  }
  return res.status(500).json({ error: e.message });
}

// Estado en el que está el agente ahora 
async function estadoDe(id) {
  const abierto = await obtener(
    `SELECT estado FROM historial_estados
     WHERE usuario_id = ? AND fin IS NULL
     ORDER BY id DESC LIMIT 1`,
    [id]
  );
  return abierto ? abierto.estado : 'Desconectado';
}

// Cierra el estado anterior, calcula el cumplimiento y abre el estado nuevo
async function cambiarEstado(id, estado, { casoId = null, ahora = new Date() } = {}) {
  if (!Number.isInteger(id) || !ESTADOS.includes(estado)) {
    throw new ErrorHttp(400, 'Agente o estado inválido', { estados_permitidos: ESTADOS });
  }
  const ahoraTxt = formatoFecha(ahora);

  //  Validaciones antes de cambiar  en la base de datos
  const agente = await obtener(`SELECT id FROM usuarios WHERE id = ? AND rol = 'AGENTE'`, [id]);
  if (!agente) throw new ErrorHttp(404, 'Agente no encontrado');

  const abierto = await obtener(
    `SELECT id, estado, inicio FROM historial_estados
     WHERE usuario_id = ? AND fin IS NULL
     ORDER BY id DESC LIMIT 1`,
    [id]
  );
  if (abierto && abierto.estado === estado) {
    throw new ErrorHttp(409, `El agente ya está en el estado "${estado}"`);
  }

  let casoValido = null;
  if (estado === 'Atendiendo caso' && casoId !== null && casoId !== undefined) {
    const caso = await obtener(
      'SELECT id FROM casos WHERE id = ? AND usuario_id = ?', [Number(casoId), id]
    );
    if (!caso) throw new ErrorHttp(400, 'El caso no existe o no pertenece a este agente');
    casoValido = caso.id;
  }

  // Impedir pasar a Break, Almuerzo, etc. si el agente tiene un caso en atención
  const casoAbierto = await obtener(
    `SELECT id, numero_caso
     FROM casos
     WHERE usuario_id = ? AND estado = 'EN_ATENCION'
     LIMIT 1`,
    [id]
  );
  if (casoAbierto && estado !== 'Atendiendo caso') {
    throw new ErrorHttp(
      409,
      `No puedes cambiar a "${estado}" mientras tienes el caso ${casoAbierto.numero_caso} en atención. Ciérralo primero.`
    );
  }
  // 2. Cerrar el estado anterior, si lo hay
  let cerrado = null;
  if (abierto) {
    const seg = Math.max(0, Math.round((ahora - aFecha(abierto.inicio)) / 1000));
    await ejecutar(
      'UPDATE historial_estados SET fin = ?, duracion_seg = ? WHERE id = ?',
      [ahoraTxt, seg, abierto.id]
    );
    cerrado = { estado: abierto.estado, inicio: abierto.inicio, fin: ahoraTxt, duracion_seg: seg };
  }

  // 3. Si es un evento programado, buscar el más cercano de hoy y calcular el desfase
  let horarioId = null;
  let desfase = null;
  let cumplido = null;
  if (ESTADOS_PROGRAMADOS.includes(estado)) {
    const candidatos = await listar(
      `SELECT id, hora_inicio FROM horarios
       WHERE usuario_id = ? AND dia_semana = ? AND tipo = ?`,
      [id, ahora.getDay(), estado]
    );
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
    let mejor = null;
    for (const c of candidatos) {
      const [h, m] = c.hora_inicio.split(':').map(Number);
      const d = minAhora - (h * 60 + m); // positivo = tarde, negativo = temprano
      if (!mejor || Math.abs(d) < Math.abs(mejor.d)) mejor = { id: c.id, d };
    }
    if (mejor) {
      horarioId = mejor.id;
      desfase = mejor.d;
      cumplido = Math.abs(mejor.d) <= TOLERANCIA_MIN ? 1 : 0;
    }
  }

  // 4. Abrir el estado nuevo
  const nuevo = await ejecutar(
    `INSERT INTO historial_estados
       (usuario_id, estado, inicio, horario_id, desfase_min, cumplido, caso_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, estado, ahoraTxt, horarioId, desfase, cumplido, casoValido]
  );

  return {
    id: nuevo.id,
    estado,
    inicio: ahoraTxt,
    horario_id: horarioId,
    desfase_min: desfase,
    cumplido,
    caso_id: casoValido,
    cerrado,
  };
}

// ---------- Casos simulados ----------
async function crearCaso(agente) {
  const { n } = await obtener('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM casos');
  const numero = 500 + n;
  await ejecutar(
    `INSERT INTO casos (numero_caso, usuario_id, canal, cliente_nombre, estado, fecha_creacion)
     VALUES (?, ?, ?, ?, 'PENDIENTE', ?)`,
    [`C-${numero}`, agente.id, agente.canal, `Cliente ${numero}`, formatoFecha(new Date())]
  );
}

// Solo reciben casos los agentes que están Disponibles
async function generarCasos() {
  const agentes = await listar(
    `SELECT u.id, u.canal
     FROM usuarios u
     JOIN historial_estados h
       ON h.usuario_id = u.id
      AND h.fin IS NULL
      AND h.id = (
        SELECT h2.id
        FROM historial_estados h2
        WHERE h2.usuario_id = u.id AND h2.fin IS NULL
        ORDER BY h2.id DESC LIMIT 1
      )
     WHERE u.rol = 'AGENTE' AND h.estado = 'Disponible'`
  );
  for (const a of agentes) {
    const { n } = await obtener(
      `SELECT COUNT(*) AS n FROM casos WHERE usuario_id = ? AND estado = 'PENDIENTE'`,
      [a.id]
    );
    if (n < MAX_PENDIENTES) await crearCaso(a);
  }
}

// Encuesta simulada al cerrar un caso 
const COMENTARIOS = {
  POSITIVA: ['Buena atención', 'Resolvieron mi problema', 'Muy amable y rápido'],
  NEGATIVA: ['Demora en la respuesta', 'No resolvieron mi problema', 'Esperaba más claridad'],
};
async function simularEncuesta(casoId) {
  if (Math.random() > 0.75) return null;
  const r = Math.random();
  const calificacion = r < 0.5 ? 5 : r < 0.75 ? 4 : r < 0.85 ? 3 : r < 0.95 ? 2 : 1;
  const tipo = calificacion >= 4 ? 'POSITIVA' : 'NEGATIVA';
  const lista = COMENTARIOS[tipo];
  const comentario = lista[Math.floor(Math.random() * lista.length)];
  await ejecutar(
    'INSERT INTO encuestas (caso_id, tipo, calificacion, comentario, fecha) VALUES (?, ?, ?, ?, ?)',
    [casoId, tipo, calificacion, comentario, formatoFecha(new Date())]
  );
  return { tipo, calificacion };
}

// ---------- Rutas ----------

// Ruta de prueba: sirve para comprobar que el servidor está vivo
app.get('/api/salud', (req, res) => {
  res.json({ ok: true, mensaje: 'Servidor de la Consola WFM funcionando' });
});

// Lista de agentes con su canal y su supervisor
app.get('/api/agentes', async (req, res) => {
  try {
    const agentes = await listar(`
      SELECT u.id, u.nombre, u.canal, s.nombre AS supervisor
      FROM usuarios u
      JOIN usuarios s ON s.id = u.supervisor_id
      WHERE u.rol = 'AGENTE'
      ORDER BY u.id
    `);
    res.json(agentes);
  } catch (e) {
    responderError(res, e);
  }
});

// Horario de un agente para un día (por defecto, hoy). 0 = domingo ... 6 = sábado
app.get('/api/agentes/:id/horario', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const dia = req.query.dia !== undefined ? Number(req.query.dia) : new Date().getDay();
    if (!Number.isInteger(id) || !Number.isInteger(dia) || dia < 0 || dia > 6) {
      throw new ErrorHttp(400, 'Parámetros inválidos');
    }

    const agente = await obtener(
      `SELECT u.id, u.nombre, u.canal, s.nombre AS supervisor
       FROM usuarios u
       JOIN usuarios s ON s.id = u.supervisor_id
       WHERE u.id = ? AND u.rol = 'AGENTE'`,
      [id]
    );
    if (!agente) throw new ErrorHttp(404, 'Agente no encontrado');

    const eventos = await listar(
      `SELECT id, tipo, hora_inicio, hora_fin
       FROM horarios
       WHERE usuario_id = ? AND dia_semana = ?
       ORDER BY hora_inicio`,
      [id, dia]
    );

    res.json({ agente, dia_semana: dia, descansa: eventos.length === 0, eventos });
  } catch (e) {
    responderError(res, e);
  }
});

// Estado actual de un agente 
app.get('/api/agentes/:id/estado', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new ErrorHttp(400, 'Agente inválido');
    const abierto = await obtener(
      `SELECT estado, inicio, horario_id, caso_id
       FROM historial_estados
       WHERE usuario_id = ? AND fin IS NULL
       ORDER BY id DESC LIMIT 1`,
      [id]
    );
    res.json(abierto || { estado: 'Desconectado' });
  } catch (e) {
    responderError(res, e);
  }
});

// Cambiar el estado de un agente
app.post('/api/agentes/:id/estado', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { estado, caso_id, ahora: ahoraTexto } = req.body || {};

    // La hora real es la del computador; 
    let ahora = new Date();
    if (ahoraTexto && process.env.MODO_PRUEBAS === '1') {
      ahora = aFecha(ahoraTexto);
      if (isNaN(ahora.getTime())) {
        throw new ErrorHttp(400, 'Fecha inválida. Usa AAAA-MM-DD HH:MM:SS');
      }
    }

    const resultado = await cambiarEstado(id, estado, { casoId: caso_id ?? null, ahora });
    res.status(201).json(resultado);
  } catch (e) {
    responderError(res, e);
  }
});

// Casos del agente: el que está atendiendo, la cola y los cerrados hoy
app.get('/api/agentes/:id/casos', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new ErrorHttp(400, 'Agente inválido');
    const agente = await obtener(`SELECT id FROM usuarios WHERE id = ? AND rol = 'AGENTE'`, [id]);
    if (!agente) throw new ErrorHttp(404, 'Agente no encontrado');

    const estado = await estadoDe(id);
    // En Break, Almuerzo, etc. el agente no ve ni recibe casos
    const recibeCasos = estado === 'Disponible' || estado === 'Atendiendo caso';

    const enAtencion = await obtener(
      `SELECT id, numero_caso, canal, cliente_nombre, inicio_atencion
       FROM casos WHERE usuario_id = ? AND estado = 'EN_ATENCION'
       ORDER BY id DESC LIMIT 1`,
      [id]
    );

    let pendientes = [];
    let totalPendientes = 0;
    if (recibeCasos) {
      pendientes = await listar(
        `SELECT id, numero_caso, canal, cliente_nombre, fecha_creacion
         FROM casos WHERE usuario_id = ? AND estado = 'PENDIENTE'
         ORDER BY id LIMIT 5`,
        [id]
      );
      const t = await obtener(
        `SELECT COUNT(*) AS n FROM casos WHERE usuario_id = ? AND estado = 'PENDIENTE'`, [id]
      );
      totalPendientes = t.n;
    }

    const hoy = formatoFecha(new Date()).slice(0, 10);
    const cerradosHoy = await listar(
      `SELECT c.numero_caso, c.cliente_nombre, c.canal, c.inicio_atencion, c.fecha_cierre,
              e.tipo AS encuesta, e.calificacion
       FROM casos c
       LEFT JOIN encuestas e ON e.caso_id = c.id
       WHERE c.usuario_id = ? AND c.estado = 'CERRADO' AND substr(c.fecha_cierre, 1, 10) = ?
       ORDER BY c.id DESC LIMIT 30`,
      [id, hoy]
    );

    res.json({
      estado,
      recibe_casos: recibeCasos,
      en_atencion: enAtencion || null,
      pendientes,
      total_pendientes: totalPendientes,
      cerrados_hoy: cerradosHoy,
    });
  } catch (e) {
    responderError(res, e);
  }
});

// Tomar el siguiente caso de la cola (solo si el agente está Disponible)
app.post('/api/agentes/:id/casos/tomar', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new ErrorHttp(400, 'Agente inválido');
    const agente = await obtener(`SELECT id FROM usuarios WHERE id = ? AND rol = 'AGENTE'`, [id]);
    if (!agente) throw new ErrorHttp(404, 'Agente no encontrado');

    const estado = await estadoDe(id);
    if (estado !== 'Disponible') {
      throw new ErrorHttp(409, `No puedes tomar casos en el estado "${estado}"`);
    }

    const caso = await obtener(
      `SELECT id, numero_caso, canal, cliente_nombre FROM casos
       WHERE usuario_id = ? AND estado = 'PENDIENTE'
       ORDER BY id LIMIT 1`,
      [id]
    );
    if (!caso) throw new ErrorHttp(404, 'No hay casos pendientes');

    const ahora = new Date();
    const cambio = await cambiarEstado(id, 'Atendiendo caso', { casoId: caso.id, ahora });
    await ejecutar(
      `UPDATE casos SET estado = 'EN_ATENCION', inicio_atencion = ? WHERE id = ?`,
      [formatoFecha(ahora), caso.id]
    );

    res.status(201).json({ caso: { ...caso, inicio_atencion: formatoFecha(ahora) }, estado: cambio });
  } catch (e) {
    responderError(res, e);
  }
});

// Cerrar el caso en atención: genera la encuesta simulada y devuelve al agente a Disponible
app.post('/api/agentes/:id/casos/:casoId/cerrar', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const casoId = Number(req.params.casoId);
    if (!Number.isInteger(id) || !Number.isInteger(casoId)) {
      throw new ErrorHttp(400, 'Parámetros inválidos');
    }

    const caso = await obtener(
      `SELECT id, numero_caso FROM casos
       WHERE id = ? AND usuario_id = ? AND estado = 'EN_ATENCION'`,
      [casoId, id]
    );
    if (!caso) throw new ErrorHttp(404, 'Ese caso no está en atención con este agente');

    const ahora = new Date();
    await ejecutar(
      `UPDATE casos SET estado = 'CERRADO', fecha_cierre = ? WHERE id = ?`,
      [formatoFecha(ahora), casoId]
    );
    const encuesta = await simularEncuesta(casoId);

    const estado = await estadoDe(id);
    const cambio = estado === 'Disponible' ? null : await cambiarEstado(id, 'Disponible', { ahora });

    res.json({ caso, encuesta, estado: cambio });
  } catch (e) {
    responderError(res, e);
  }
});

// Resumen del agente: casos cerrados y puntuación promedio de sus encuestas
app.get('/api/agentes/:id/resumen', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new ErrorHttp(400, 'Agente inválido');
    const casos = await obtener(
      `SELECT COUNT(*) AS n FROM casos WHERE usuario_id = ? AND estado = 'CERRADO'`,
      [id]
    );
    const enc = await obtener(
      `SELECT ROUND(AVG(e.calificacion), 1) AS promedio
       FROM encuestas e
       JOIN casos c ON c.id = e.caso_id
       WHERE c.usuario_id = ?`,
      [id]
    );
    res.json({ casos_atendidos: casos.n, puntuacion: enc.promedio });
  } catch (e) {
    responderError(res, e);
  }
});

// Historial de estados de un agente (los más recientes primero)
app.get('/api/agentes/:id/historial', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const limite = req.query.limite !== undefined ? Number(req.query.limite) : 50;
    if (!Number.isInteger(id) || !Number.isInteger(limite) || limite < 1 || limite > 500) {
      throw new ErrorHttp(400, 'Parámetros inválidos');
    }
    const filas = await listar(
      `SELECT h.id, h.estado, h.inicio, h.fin, h.duracion_seg, h.horario_id,
              h.desfase_min, h.cumplido, c.numero_caso
       FROM historial_estados h
       LEFT JOIN casos c ON c.id = h.caso_id
       WHERE h.usuario_id = ?
       ORDER BY h.id DESC
       LIMIT ?`,
      [id, limite]
    );
    res.json(filas);
  } catch (e) {
    responderError(res, e);
  }
});

// Cumplimiento de los descansos: por agente y en total.
// Filtros opcionales: ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
app.get('/api/cumplimiento', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const fechaValida = (f) => f === undefined || /^\d{4}-\d{2}-\d{2}$/.test(f);
    if (!fechaValida(desde) || !fechaValida(hasta)) {
      throw new ErrorHttp(400, 'Usa el formato AAAA-MM-DD');
    }

    let filtro = '';
    const params = [];
    if (desde) { filtro += ' AND substr(h.inicio, 1, 10) >= ?'; params.push(desde); }
    if (hasta) { filtro += ' AND substr(h.inicio, 1, 10) <= ?'; params.push(hasta); }

    const porAgente = await listar(
      `SELECT u.id, u.nombre, u.canal,
              COUNT(h.id) AS descansos,
              COALESCE(SUM(h.cumplido), 0) AS a_tiempo,
              ROUND(100.0 * SUM(h.cumplido) / COUNT(h.id), 1) AS porcentaje,
              ROUND(AVG(ABS(h.desfase_min)), 1) AS desfase_promedio_min
       FROM usuarios u
       LEFT JOIN historial_estados h
              ON h.usuario_id = u.id AND h.cumplido IS NOT NULL${filtro}
       WHERE u.rol = 'AGENTE'
       GROUP BY u.id
       ORDER BY u.id`,
      params
    );

    const total = await obtener(
      `SELECT COUNT(*) AS descansos,
              COALESCE(SUM(h.cumplido), 0) AS a_tiempo,
              ROUND(100.0 * SUM(h.cumplido) / COUNT(*), 1) AS porcentaje,
              ROUND(AVG(ABS(h.desfase_min)), 1) AS desfase_promedio_min
       FROM historial_estados h
       WHERE h.cumplido IS NOT NULL${filtro}`,
      params
    );

    res.json({ tolerancia_min: TOLERANCIA_MIN, total, por_agente: porAgente });
  } catch (e) {
    responderError(res, e);
  }
});



const path = require('path');
const fs = require('fs');
const dist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}
const PUERTO = process.env.PORT || 3001;

// Primero prepara la base de datos y solo después abre el servidor
iniciar()
  .then(() => prepararAuth())
  .then(() => {
    app.listen(PUERTO, () => {
      console.log(`Servidor listo en http://localhost:${PUERTO}`);
    });
    
    if (GENERAR_CASOS) {
      setInterval(() => {
        generarCasos().catch((e) => console.error('Error al generar casos:', e.message));
      }, INTERVALO_CASOS_MS);
    }
  })
  .catch((e) => {
    console.error('No se pudo preparar la base de datos:', e.message);
    process.exit(1);
  });