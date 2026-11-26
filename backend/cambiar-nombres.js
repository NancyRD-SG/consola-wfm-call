const { db, ejecutar } = require('./database');

// Usuario de ingreso -> nombre que se mostrará.
const NOMBRES = {
  agente01: 'Nombre Apellido',
  agente02: 'Nombre Apellido',
  agente03: 'Nombre Apellido',
  agente04: 'Nombre Apellido',
  agente05: 'Nombre Apellido',
  agente06: 'Nombre Apellido',
  agente07: 'Nombre Apellido',
  agente08: 'Nombre Apellido',
  agente09: 'Nombre Apellido',
  agente10: 'Nombre Apellido',
  agente11: 'Nombre Apellido',
  agente12: 'Nombre Apellido',
};

async function cambiar() {
  for (const [usuario, nombre] of Object.entries(NOMBRES)) {
    const r = await ejecutar(
      'UPDATE usuarios SET nombre = ? WHERE lower(correo) = ?',
      [nombre, `${usuario}@demo.local`]
    );
    console.log(`${usuario}: ${r.cambios ? 'actualizado' : 'no encontrado'}`);
  }
}

cambiar()
  .catch((e) => console.error('Error:', e.message))
  .finally(() => db.close());