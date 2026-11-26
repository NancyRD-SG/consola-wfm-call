const crypto = require('crypto');
const { ejecutar, obtener, listar } = require('./database');

const HORAS_SESION = 12;
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 5 * 60 * 1000;
const intentos = new Map(); // usuario -> { n, hasta }

// ---------- Contraseñas (se guardan cifradas) ----------
function hashClave(clave) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(clave, sal, 64).toString('hex');
  return `${sal}:${hash}`;
}

function verificarClave(clave, guardada) {
  if (!guardada) return false;
  const [sal, hash] = guardada.split(':');
  const calculado = crypto.scryptSync(clave, sal, 64);
  const esperado = Buffer.from(hash, 'hex');
  return calculado.length === esperado.length && crypto.timingSafeEqual(calculado, esperado);
}

// ---------- Preparar la base de datos ----------
// Agrega la columna de contraseña y la tabla de sesiones; asigna la contraseña inicial
// "usuario#2026" a quien todavía no tenga (el usuario es la parte del correo antes del @)
async function prepararAuth() {
  const columnas = await listar('PRAGMA table_info(usuarios)');
  if (!columnas.some((c) => c.name === 'clave')) {
    await ejecutar('ALTER TABLE usuarios ADD COLUMN clave TEXT');
  }

  await ejecutar(`
    CREATE TABLE IF NOT EXISTS sesiones (
      token TEXT PRIMARY KEY,
      usuario_id INTEGER NOT NULL,
      expira TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  const sinClave = await listar('SELECT id, correo FROM usuarios WHERE clave IS NULL');
  for (const u of sinClave) {
    const usuario = u.correo.split('@')[0];
    await ejecutar('UPDATE usuarios SET clave = ? WHERE id = ?', [hashClave(`${usuario}#2026`), u.id]);
  }

  // Limpia las sesiones vencidas
  await ejecutar('DELETE FROM sesiones WHERE expira < ?', [new Date().toISOString()]);
}

// ---------- Rutas de sesión ----------
async function login(req, res) {
  try {
    const { usuario, clave } = req.body || {};
    if (typeof usuario !== 'string' || typeof clave !== 'string' || !usuario.trim() || !clave) {
      return res.status(400).json({ error: 'Escribe tu usuario y tu contraseña' });
    }

    const texto = usuario.trim().toLowerCase();

    // Bloqueo temporal tras varios intentos fallidos
    const reg = intentos.get(texto);
    if (reg && reg.hasta > Date.now()) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' });
    }

    const correo = texto.includes('@') ? texto : `${texto}@demo.local`;
    const u = await obtener(
      'SELECT id, nombre, rol, canal, clave FROM usuarios WHERE lower(correo) = ?',
      [correo]
    );

    if (!u || !verificarClave(clave, u.clave)) {
      const n = (reg ? reg.n : 0) + 1;
      intentos.set(texto, n >= MAX_INTENTOS ? { n: 0, hasta: Date.now() + BLOQUEO_MS } : { n, hasta: 0 });
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    intentos.delete(texto);
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + HORAS_SESION * 3600 * 1000).toISOString();
    await ejecutar('INSERT INTO sesiones (token, usuario_id, expira) VALUES (?, ?, ?)', [token, u.id, expira]);

    res.json({ token, usuario: { id: u.id, nombre: u.nombre, rol: u.rol, canal: u.canal } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function logout(req, res) {
  try {
    await ejecutar('DELETE FROM sesiones WHERE token = ?', [req.token]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Datos de quien tiene la sesión abierta (sirve para recuperar la sesión al recargar la página)
function yo(req, res) {
  res.json({ usuario: req.usuario });
}

// ---------- Control de acceso ----------
// Todas las rutas /api exigen sesión, salvo /salud y /login
async function exigirSesion(req, res, next) {
  try {
    if (req.path === '/salud' || req.path === '/login') return next();

    const cabecera = req.headers.authorization || '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Debes iniciar sesión' });

    const u = await obtener(
      `SELECT u.id, u.nombre, u.rol, u.canal
       FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token = ? AND s.expira > ?`,
      [token, new Date().toISOString()]
    );
    if (!u) return res.status(401).json({ error: 'Tu sesión venció. Inicia sesión de nuevo.' });

    req.usuario = u;
    req.token = token;

    // Permisos: un agente solo accede a lo suyo; el supervisor, a todo
    if (req.path === '/logout' || req.path === '/yo') return next();
    const m = req.path.match(/^\/agentes\/(\d+)(\/|$)/);
    if (m) {
      if (u.rol !== 'SUPERVISOR' && Number(m[1]) !== u.id) {
        return res.status(403).json({ error: 'No puedes acceder a los datos de otro agente' });
      }
    } else if (u.rol !== 'SUPERVISOR') {
      return res.status(403).json({ error: 'Esta información es solo para supervisores' });
    }
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { prepararAuth, login, logout, yo, exigirSesion, hashClave };