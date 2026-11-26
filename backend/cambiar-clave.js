const { db, ejecutar, obtener } = require('./database');
const { hashClave } = require('./auth');

const [, , usuario, clave] = process.argv;

async function cambiar() {
  if (!usuario || !clave || clave.length < 8) {
    console.log('Uso: node cambiar-clave.js usuario nuevaClave   (mínimo 8 caracteres)');
    return;
  }
  const u = await obtener(
    'SELECT id FROM usuarios WHERE lower(correo) = ?',
    [`${usuario.toLowerCase()}@demo.local`]
  );
  if (!u) {
    console.log('No existe el usuario', usuario);
    return;
  }
  await ejecutar('UPDATE usuarios SET clave = ? WHERE id = ?', [hashClave(clave), u.id]);
  await ejecutar('DELETE FROM sesiones WHERE usuario_id = ?', [u.id]);
  console.log(`Contraseña de ${usuario} actualizada.`);
}

cambiar()
  .catch((e) => console.error('Error:', e.message))
  .finally(() => db.close());