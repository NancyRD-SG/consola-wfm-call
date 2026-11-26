const { db, ejecutar } = require('./database');

const BASE = 'http://localhost:3001/api';
const AGENTE = 2;            
const FECHA = '2026-01-05';  

async function llamar(metodo, ruta, cuerpo) {
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { codigo: r.status, datos: await r.json() };
}

async function cambiar(descripcion, agente, estado, hora, extra = {}) {
  const r = await llamar('POST', `/agentes/${agente}/estado`, {
    estado,
    ahora: `${FECHA} ${hora}`,
    ...extra,
  });
  console.log(`\n${descripcion}\n   -> ${r.codigo} ${JSON.stringify(r.datos)}`);
}

async function probar() {
  console.log('--- RECORRIDO NORMAL ---');
  await cambiar('1. Inicia el turno (Disponible, 06:00)', AGENTE, 'Disponible', '06:00:00');
  await cambiar('2. Break a las 08:33 (programado 08:30: a tiempo)', AGENTE, 'Break', '08:33:00');
  await cambiar('3. Vuelve a Disponible a las 08:48', AGENTE, 'Disponible', '08:48:00');
  await cambiar('4. Almuerzo a las 10:40 (programado 10:30: tarde)', AGENTE, 'Almuerzo', '10:40:00');
  await cambiar('5. Vuelve a Disponible a las 11:42', AGENTE, 'Disponible', '11:42:00');
  await cambiar('6. Atiende el caso 1 a las 12:00', AGENTE, 'Atendiendo caso', '12:00:00', { caso_id: 1 });
  await cambiar('7. Vuelve a Disponible a las 12:20', AGENTE, 'Disponible', '12:20:00');

  console.log('\n--- CASOS QUE DEBEN SER RECHAZADOS ---');
  await cambiar('8. Estado inexistente (400)', AGENTE, 'Dormido', '12:30:00');
  await cambiar('9. Repetir el mismo estado (409)', AGENTE, 'Disponible', '12:30:00');
  await cambiar('10. Un supervisor no es agente (404)', 1, 'Break', '12:30:00');
  await cambiar('11. Caso de otro agente (400)', AGENTE, 'Atendiendo caso', '12:30:00', { caso_id: 2 });

  console.log('\n--- ESTADO ACTUAL ---');
  const actual = await llamar('GET', `/agentes/${AGENTE}/estado`);
  console.log(actual.codigo, JSON.stringify(actual.datos));
}

const conservar = process.argv.includes('--conservar'); 
const soloLimpiar = process.argv.includes('--limpiar'); 

(soloLimpiar ? Promise.resolve() : probar())
  .catch((e) => console.error('Error:', e.message, '(¿está corriendo el servidor con npm start?)'))
  .finally(async () => {
    if (!conservar) {
      await ejecutar("DELETE FROM historial_estados WHERE inicio LIKE '2026-01-05%'");
      console.log('\nDatos de prueba eliminados.');
    }
    db.close();
  });