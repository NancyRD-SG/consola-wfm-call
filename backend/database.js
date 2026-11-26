const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// ---------- 1. Conexión ----------
const carpeta = path.join(__dirname, 'data');
fs.mkdirSync(carpeta, { recursive: true });

const db = new sqlite3.Database(path.join(carpeta, 'consola.db'), (err) => {
  if (err) console.error('Error al conectar:', err.message);
  else console.log('Conectado a la base de datos.');
});

// ---------- 2. Funciones auxiliares ----------
// Ejecuta una instrucción que modifica datos (crear tabla, insertar, actualizar, borrar)
function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, cambios: this.changes });
    });
  });
}

// Trae UNA sola fila (o undefined si no hay)
function obtener(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, fila) => (err ? reject(err) : resolve(fila)));
  });
}

// Trae VARIAS filas, en una lista
function listar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, filas) => (err ? reject(err) : resolve(filas)));
  });
}

// ---------- 3. Las 5 tablas ----------
async function crearTablas() {
  // Activa el control de relaciones entre tablas (llaves foráneas)
  await ejecutar('PRAGMA foreign_keys = ON');

  await ejecutar(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      correo TEXT NOT NULL UNIQUE,
      rol TEXT NOT NULL CHECK (rol IN ('AGENTE', 'SUPERVISOR')),
      canal TEXT CHECK (canal IN ('LLAMADA', 'CHAT', 'CORREO')),
      supervisor_id INTEGER,
      FOREIGN KEY (supervisor_id) REFERENCES usuarios(id)
    )
  `);

  // dia_semana: 0 = domingo, 1 = lunes ... 6 = sábado
  await ejecutar(`
    CREATE TABLE IF NOT EXISTS horarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
      tipo TEXT NOT NULL CHECK (tipo IN
        ('Turno', 'Pausa activa', 'Break', 'Almuerzo', 'Capacitación', 'Coaching', 'Reunión')),
      hora_inicio TEXT NOT NULL,
      hora_fin TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  await ejecutar(`
    CREATE TABLE IF NOT EXISTS casos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_caso TEXT NOT NULL UNIQUE,
      usuario_id INTEGER NOT NULL,
      canal TEXT NOT NULL CHECK (canal IN ('LLAMADA', 'CHAT', 'CORREO')),
      cliente_nombre TEXT,
      estado TEXT NOT NULL CHECK (estado IN ('PENDIENTE', 'EN_ATENCION', 'CERRADO')),
      fecha_creacion TEXT DEFAULT (datetime('now', 'localtime')),
      inicio_atencion TEXT,
      fecha_cierre TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  await ejecutar(`
    CREATE TABLE IF NOT EXISTS encuestas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caso_id INTEGER NOT NULL UNIQUE,
      tipo TEXT NOT NULL CHECK (tipo IN ('POSITIVA', 'NEGATIVA')),
      calificacion INTEGER CHECK (calificacion BETWEEN 1 AND 5),
      comentario TEXT,
      fecha TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (caso_id) REFERENCES casos(id)
    )
  `);

  await ejecutar(`
    CREATE TABLE IF NOT EXISTS historial_estados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      estado TEXT NOT NULL CHECK (estado IN
        ('Disponible', 'Atendiendo caso', 'Pausa activa', 'Break', 'Almuerzo',
         'Capacitación', 'Coaching', 'Reunión', 'Desconectado')),
      inicio TEXT NOT NULL,
      fin TEXT,
      duracion_seg INTEGER,
      horario_id INTEGER,
      desfase_min INTEGER,
      cumplido INTEGER CHECK (cumplido IN (0, 1)),
      caso_id INTEGER,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (horario_id) REFERENCES horarios(id),
      FOREIGN KEY (caso_id) REFERENCES casos(id)
    )
  `);
}

// ---------- 4. Datos iniciales ----------
// Convierte 'HH:MM' en minutos, y minutos en 'HH:MM'
function aMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function aHora(minutos) {
  const h = String(Math.floor(minutos / 60)).padStart(2, '0');
  const m = String(minutos % 60).padStart(2, '0');
  return `${h}:${m}`;
}

async function sembrar() {
  // Solo carga datos si la base está vacía, para no duplicar nada
  const { total } = await obtener('SELECT COUNT(*) AS total FROM usuarios');
  if (total > 0) return;

  // Tres supervisores, cada uno con un canal a cargo
  const grupos = [
    { supervisor: ['Deigger Torres', 'deigger.torres@demo.local'], canal: 'CORREO' },
    { supervisor: ['Marcela Ríos', 'marcela.rios@demo.local'], canal: 'CHAT' },
    { supervisor: ['Andrés Mejía', 'andres.mejia@demo.local'], canal: 'LLAMADA' },
  ];

  // Seis plantillas de turno (entre 06:00 y 24:00). Todas dan 7 h efectivas al día.
  // Efectivas = duración del turno - almuerzo (los breaks de 15 min sí cuentan).
  const plantillas = [
    { turno: ['06:00', '14:00'], almuerzo: ['10:30', '11:30'], breaks: ['08:30'] },          // 8 h - 1 h
    { turno: ['07:00', '14:30'], almuerzo: ['10:30', '11:00'], breaks: ['09:00'] },          // 7,5 h - 0,5 h
    { turno: ['08:00', '15:30'], almuerzo: ['11:30', '12:00'], breaks: ['09:30', '13:30'] }, // 7,5 h - 0,5 h, 2 breaks
    { turno: ['13:00', '21:00'], almuerzo: ['17:00', '18:00'], breaks: ['15:00'] },          // 8 h - 1 h
    { turno: ['14:30', '22:00'], almuerzo: ['18:00', '18:30'], breaks: ['16:30'] },          // 7,5 h - 0,5 h
    { turno: ['16:00', '23:30'], almuerzo: ['19:30', '20:00'], breaks: ['17:30', '21:30'] }, // 7,5 h - 0,5 h, 2 breaks
  ];

  // Nombres de prueba. Cámbialos solo si los participantes lo autorizan.
  const nombres = [
    'Agente 01', 'Agente 02', 'Agente 03', 'Agente 04',
    'Agente 05', 'Agente 06', 'Agente 07', 'Agente 08',
    'Agente 09', 'Agente 10', 'Agente 11', 'Agente 12',
  ];

  const agentesPorCanal = {}; // canal -> ids de sus agentes
  let n = 0;

  for (const grupo of grupos) {
    const sup = await ejecutar(
      'INSERT INTO usuarios (nombre, correo, rol) VALUES (?, ?, ?)',
      [grupo.supervisor[0], grupo.supervisor[1], 'SUPERVISOR']
    );
    agentesPorCanal[grupo.canal] = [];

    // 4 agentes por supervisor
    for (let k = 0; k < 4; k++) {
      const nombre = nombres[n];
      const correo = `agente${String(n + 1).padStart(2, '0')}@demo.local`;
      const ag = await ejecutar(
        'INSERT INTO usuarios (nombre, correo, rol, canal, supervisor_id) VALUES (?, ?, ?, ?, ?)',
        [nombre, correo, 'AGENTE', grupo.canal, sup.id]
      );
      agentesPorCanal[grupo.canal].push(ag.id);

      // Horario semanal: plantilla según el agente, con un día de descanso distinto
      const p = plantillas[n % plantillas.length];
      const descanso = n % 7;
      let minutosSemana = 0;

      for (let dia = 0; dia <= 6; dia++) {
        if (dia === descanso) continue; // día libre: no se registra nada

        await ejecutar(
          'INSERT INTO horarios (usuario_id, dia_semana, tipo, hora_inicio, hora_fin) VALUES (?, ?, ?, ?, ?)',
          [ag.id, dia, 'Turno', p.turno[0], p.turno[1]]
        );
        await ejecutar(
          'INSERT INTO horarios (usuario_id, dia_semana, tipo, hora_inicio, hora_fin) VALUES (?, ?, ?, ?, ?)',
          [ag.id, dia, 'Almuerzo', p.almuerzo[0], p.almuerzo[1]]
        );
        for (const b of p.breaks) {
          await ejecutar(
            'INSERT INTO horarios (usuario_id, dia_semana, tipo, hora_inicio, hora_fin) VALUES (?, ?, ?, ?, ?)',
            [ag.id, dia, 'Break', b, aHora(aMinutos(b) + 15)]
          );
        }

        minutosSemana +=
          (aMinutos(p.turno[1]) - aMinutos(p.turno[0])) -
          (aMinutos(p.almuerzo[1]) - aMinutos(p.almuerzo[0]));
      }

      // Control: cada agente debe sumar exactamente 42 horas efectivas por semana
      const horas = minutosSemana / 60;
      if (horas !== 42) throw new Error(`${nombre} suma ${horas} h, no 42 h`);
      console.log(`${nombre} (${grupo.canal}): ${horas} h semanales, descansa el día ${descanso}`);

      n++;
    }
  }

  // Tres casos simulados con clientes ficticios
  const c1 = await ejecutar(
    `INSERT INTO casos (numero_caso, usuario_id, canal, cliente_nombre, estado,
       fecha_creacion, inicio_atencion, fecha_cierre)
     VALUES ('C-501', ?, 'CORREO', 'Cliente 501', 'CERRADO',
       datetime('now', 'localtime', '-3 hours'),
       datetime('now', 'localtime', '-3 hours', '+5 minutes'),
       datetime('now', 'localtime', '-2 hours'))`,
    [agentesPorCanal.CORREO[0]]
  );
  const c2 = await ejecutar(
    `INSERT INTO casos (numero_caso, usuario_id, canal, cliente_nombre, estado,
       fecha_creacion, inicio_atencion, fecha_cierre)
     VALUES ('C-502', ?, 'CHAT', 'Cliente 502', 'CERRADO',
       datetime('now', 'localtime', '-2 hours'),
       datetime('now', 'localtime', '-2 hours', '+2 minutes'),
       datetime('now', 'localtime', '-1 hours'))`,
    [agentesPorCanal.CHAT[0]]
  );
  await ejecutar(
    `INSERT INTO casos (numero_caso, usuario_id, canal, cliente_nombre, estado)
     VALUES ('C-503', ?, 'CORREO', 'Cliente 503', 'PENDIENTE')`,
    [agentesPorCanal.CORREO[0]]
  );

  // Una encuesta positiva y una negativa
  await ejecutar(
    `INSERT INTO encuestas (caso_id, tipo, calificacion, comentario)
     VALUES (?, 'POSITIVA', 5, 'Buena atención')`,
    [c1.id]
  );
  await ejecutar(
    `INSERT INTO encuestas (caso_id, tipo, calificacion, comentario)
     VALUES (?, 'NEGATIVA', 2, 'Demora en la respuesta')`,
    [c2.id]
  );
}

// Prepara la base: crea las tablas y carga los datos iniciales
async function iniciar() {
  await crearTablas();
  await sembrar();
}

// ---------- 5. Exportar ----------
module.exports = { db, ejecutar, obtener, listar, crearTablas, iniciar };

// Si ejecutas "node database.js" directamente, prepara la base y muestra un resumen
if (require.main === module) {
  iniciar()
    .then(async () => {
      console.log('Base de datos lista. Registros por tabla:');
      for (const t of ['usuarios', 'horarios', 'casos', 'encuestas', 'historial_estados']) {
        const { total } = await obtener(`SELECT COUNT(*) AS total FROM ${t}`);
        console.log(` - ${t}: ${total}`);
      }
      db.close();
    })
    .catch((e) => {
      console.error('Error:', e.message);
      db.close();
    });
}
