const { db, ejecutar, obtener } = require('./database');

// El primer número son los minutos que faltan para el Break de hoy; luego, los agentes.
const minutos = Number(process.argv[2]);
const usuarios = process.argv.slice(3).map((u) => u.toLowerCase());

const aHora = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

async function preparar() {
  if (!Number.isInteger(minutos) || minutos < 1 || usuarios.length === 0) {
    console.log('Uso: node preparar-demo.js 8 agente01 agente05');
    return;
  }

  const ahora = new Date();
  const dia = ahora.getDay();
  const base = ahora.getHours() * 60 + ahora.getMinutes();
  if (base + minutos + 75 >= 24 * 60) {
    console.log('Es muy tarde para preparar la sesión hoy.');
    return;
  }

  // Break dentro de N minutos; después, una pausa activa y el almuerzo
  const eventos = [
    ['Turno', Math.max(0, base - 60), base + minutos + 75],
    ['Break', base + minutos, base + minutos + 15],
    ['Pausa activa', base + minutos + 25, base + minutos + 30],
    ['Almuerzo', base + minutos + 40, base + minutos + 70],
  ];

  for (const usuario of usuarios) {
    const u = await obtener(
      `SELECT id FROM usuarios WHERE lower(correo) = ? AND rol = 'AGENTE'`,
      [`${usuario}@demo.local`]
    );
    if (!u) {
      console.log(`${usuario}: no existe`);
      continue;
    }

    // Si ya hay historial, cambiar la malla dejaría registros apuntando a horarios borrados
    const previo = await obtener(
      'SELECT COUNT(*) AS n FROM historial_estados WHERE usuario_id = ?',
      [u.id]
    );
    if (previo.n > 0) {
      console.log(`${usuario}: ya tiene historial. Ejecuta primero: node limpiar-historial.js`);
      continue;
    }

    await ejecutar('DELETE FROM horarios WHERE usuario_id = ? AND dia_semana = ?', [u.id, dia]);
    for (const [tipo, ini, fin] of eventos) {
      await ejecutar(
        'INSERT INTO horarios (usuario_id, dia_semana, tipo, hora_inicio, hora_fin) VALUES (?, ?, ?, ?, ?)',
        [u.id, dia, tipo, aHora(ini), aHora(fin)]
      );
    }
    console.log(`${usuario}: lista`);
  }

  console.log('\nHoras de hoy (avísales):');
  for (const [tipo, ini, fin] of eventos.slice(1)) {
    console.log(` - ${tipo}: ${aHora(ini)} a ${aHora(fin)}`);
  }
  console.log('Un descanso cuenta como "a tiempo" si lo inician dentro de ±5 minutos de su hora.');
}

preparar()
  .catch((e) => console.error('Error:', e.message))
  .finally(() => db.close());