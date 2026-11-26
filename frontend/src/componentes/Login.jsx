import React, { useState } from 'react';
import { iniciarSesion } from '../services/api';

export default function Login({ aviso = '', onEntrar }) {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    const r = await iniciarSesion(usuario, clave);
    setEnviando(false);
    if (r.error) {
      setError(r.error);
      setClave('');
      return;
    }
    onEntrar(r.usuario);
  };

  return (
    <div className="login-pagina">
      <form className="card login-card" onSubmit={entrar}>
        <h2 style={{ marginTop: 0 }}>Consola de Gestión</h2>
        <p style={{ color: '#94a3b8', marginTop: 0, fontSize: '0.9rem' }}>
          Ingresa con tu usuario y tu contraseña.
        </p>

        {aviso && <p style={{ color: '#fbbf24', fontSize: '0.85rem' }}>{aviso}</p>}

        <label className="campo-etiqueta" htmlFor="usuario">Usuario</label>
        <input
          id="usuario"
          className="caja-texto"
          autoFocus
          autoComplete="username"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />

        <label className="campo-etiqueta" htmlFor="clave">Contraseña</label>
        <input
          id="clave"
          className="caja-texto"
          type="password"
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
        />

        {error && <p style={{ color: '#f87171', fontSize: '0.85rem', margin: '0 0 0.75rem 0' }}>{error}</p>}

        <button
          className="btn-action"
          type="submit"
          style={{ width: '100%' }}
          disabled={enviando || !usuario.trim() || !clave}
        >
          {enviando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}