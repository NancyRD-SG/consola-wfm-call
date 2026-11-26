const BASE = 'http://localhost:3001/api';

async function llamar(metodo, ruta, cuerpo, token) {
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { codigo: r.status, datos: await r.json() };
}

function revisar(descripcion, r, esperado) {
  const ok = r.codigo === esperado;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${descripcion} -> ${r.codigo} (esperado ${esperado})`);
}

async function probar() {
  revisar('1. Sin sesión no se accede', await llamar('GET', '/agentes/3/estado'), 401);
  revisar('2. Contraseña incorrecta', await llamar('POST', '/login', { usuario: 'agente02', clave: 'mala' }), 401);

  const a = await llamar('POST', '/login', { usuario: 'agente02', clave: 'agente02#2026' });
  revisar('3. Entra el Agente 02', a, 200);
  const t = a.datos.token;
  console.log('      sesión de:', JSON.stringify(a.datos.usuario));

  revisar('4. Ve su propio estado', await llamar('GET', '/agentes/3/estado', null, t), 200);
  revisar('5. No ve el estado de otro agente', await llamar('GET', '/agentes/4/estado', null, t), 403);
  revisar('6. No ve la lista de agentes', await llamar('GET', '/agentes', null, t), 403);
  revisar('7. No ve el cumplimiento general', await llamar('GET', '/cumplimiento', null, t), 403);

  const s = await llamar('POST', '/login', { usuario: 'deigger.torres', clave: 'deigger.torres#2026' });
  revisar('8. Entra el supervisor', s, 200);
  revisar('9. El supervisor ve el cumplimiento', await llamar('GET', '/cumplimiento', null, s.datos.token), 200);
  revisar('10. El supervisor ve a cualquier agente', await llamar('GET', '/agentes/4/estado', null, s.datos.token), 200);

  revisar('11. Cierra sesión', await llamar('POST', '/logout', null, t), 200);
  revisar('12. La sesión cerrada ya no sirve', await llamar('GET', '/agentes/3/estado', null, t), 401);

  // Bloqueo tras 5 intentos fallidos (con un usuario que no existe, para no bloquear a nadie real)
  for (let i = 1; i <= 5; i++) {
    await llamar('POST', '/login', { usuario: 'noexiste', clave: 'x' });
  }
  revisar('13. Bloqueo tras 5 intentos fallidos', await llamar('POST', '/login', { usuario: 'noexiste', clave: 'x' }), 429);
}

probar().catch((e) => console.error('Error:', e.message, '(¿está corriendo el servidor con npm start?)'));