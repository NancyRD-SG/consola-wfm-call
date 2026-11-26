const { db, ejecutar } = require('./database');

async function limpiar() {

  await ejecutar('DELETE FROM historial_estados');
  await ejecutar('DELETE FROM encuestas');
  await ejecutar('DELETE FROM casos');
  try {
    await ejecutar('DELETE FROM sesiones');
  } catch (e) {
    
  }
  console.log('Listo: historial, casos, encuestas y sesiones borrados.');
}

limpiar()
  .catch((e) => console.error('Error:', e.message))
  .finally(() => db.close());