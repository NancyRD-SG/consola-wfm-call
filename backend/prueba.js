const { db, ejecutar, obtener, listar, iniciar } = require('./database');

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Convierte una columna 'HH:MM' en minutos dentro de la consulta SQL
const MIN = (col) =>
  `(CAST(substr(${col}, 1, 2) AS INTEGER) * 60 + CAST(substr(${col}, 4, 2) AS INTEGER))`;
const DURACION = `(${MIN('h.hora_fin')} - ${MIN('h.hora_inicio')})`;

async function probar() {
  // Crea las tablas y carga los datos si la base está vacía
  await iniciar();

  // 1. Registros por tabla
  console.log('\n1. REGISTROS POR TABLA');
  for (const t of ['usuarios', 'horarios', 'casos', 'encuestas', 'historial_estados']) {
    const { total } = await obtener(`SELECT COUNT(*) AS total FROM ${t}`);
    console.log(` - ${t}: ${total}`);
  }

  // 2. Supervisores y cuántos agentes tiene cada uno
  console.log('\n2. SUPERVISORES Y SUS AGENTES');
  console.table(await listar(`
    SELECT s.nombre AS supervisor, a.canal, COUNT(*) AS agentes
    FROM usuarios a
    JOIN usuarios s ON s.id = a.supervisor_id
    GROUP BY s.id
    ORDER BY s.id
  `));

  // 3. Resumen de la malla de cada agente
  console.log('3. HORARIO SEMANAL DE CADA AGENTE');
  const filas = await listar(`
    SELECT u.nombre AS agente,
           u.canal,
           s.nombre AS supervisor,
           COUNT(DISTINCT h.dia_semana) AS dias,
           ROUND(SUM(CASE h.tipo
                       WHEN 'Turno' THEN ${DURACION}
                       WHEN 'Almuerzo' THEN -${DURACION}
                       ELSE 0 END) / 60.0, 1) AS horas_semana,
           MAX(CASE WHEN h.tipo = 'Almuerzo' THEN ${DURACION} END) AS almuerzo_min,
           SUM(h.tipo = 'Break') / COUNT(DISTINCT h.dia_semana) AS breaks_por_dia,
           21 - SUM(DISTINCT h.dia_semana) AS dia_descanso
    FROM usuarios u
    JOIN usuarios s ON s.id = u.supervisor_id
    JOIN horarios h ON h.usuario_id = u.id
    WHERE u.rol = 'AGENTE'
    GROUP BY u.id
    ORDER BY u.id
  `);
  // Cambia el número del día de descanso por su nombre
  console.table(filas.map((f) => ({ ...f, dia_descanso: DIAS[f.dia_descanso] })));

  // 4. Comprobaciones automáticas
  console.log('4. COMPROBACIONES');
  const supervisores = await obtener("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'SUPERVISOR'");
  const checks = [
    ['3 supervisores', supervisores.n === 3],
    ['12 agentes', filas.length === 12],
    ['cada agente trabaja 6 días', filas.every((f) => f.dias === 6)],
    ['cada agente suma 42 horas', filas.every((f) => f.horas_semana === 42)],
    ['hay almuerzos de 30 y de 60 min', filas.some((f) => f.almuerzo_min === 30) && filas.some((f) => f.almuerzo_min === 60)],
    ['hay horarios con 1 y con 2 breaks', filas.some((f) => f.breaks_por_dia === 1) && filas.some((f) => f.breaks_por_dia === 2)],
    ['están los 3 canales', new Set(filas.map((f) => f.canal)).size === 3],
  ];
  for (const [nombre, ok] of checks) console.log(` ${ok ? 'OK   ' : 'FALLA'} ${nombre}`);

  // 5. La base debe rechazar un día de la semana inválido
  try {
    await ejecutar(
      'INSERT INTO horarios (usuario_id, dia_semana, tipo, hora_inicio, hora_fin) VALUES (?, ?, ?, ?, ?)',
      [2, 9, 'Break', '10:00', '10:15']
    );
    console.log(' FALLA aceptó un día inválido');
  } catch (e) {
    console.log(' OK    rechazó el día 9:', e.message);
  }

  // 6. Casos y encuestas (quién fue el cliente y qué agente atendió)
  console.log('\n5. ENCUESTAS');
  console.table(await listar(`
    SELECT e.tipo, e.calificacion, c.numero_caso, c.cliente_nombre, u.nombre AS agente, c.canal
    FROM encuestas e
    JOIN casos c ON c.id = e.caso_id
    JOIN usuarios u ON u.id = c.usuario_id
  `));

  db.close();
}

probar().catch((e) => {
  console.error('Error:', e.message);
  db.close();
});