import React, { useState, useEffect } from 'react';
import Login from './componentes/Login';
import ConsolaAgente from './componentes/ConsolaAgente';
import SupervisorView from './componentes/SupervisorView';
import { recuperarSesion, cerrarSesion, registrarAlVencer } from './services/api';
import './App.css';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    // Si la sesión vence mientras se usa la pantalla, vuelve al ingreso
    registrarAlVencer(() => {
      setUsuario(null);
      setAviso('Tu sesión venció. Inicia sesión de nuevo.');
    });
    recuperarSesion().then((u) => {
      if (u) setUsuario(u);
      setCargando(false);
    });
  }, []);

  const salir = async () => {
    await cerrarSesion();
    setUsuario(null);
    setAviso('');
  };

  if (cargando) {
    return <div className="login-pagina"><p style={{ color: '#94a3b8' }}>Cargando...</p></div>;
  }

  if (!usuario) {
    return <Login aviso={aviso} onEntrar={(u) => { setUsuario(u); setAviso(''); }} />;
  }

  if (usuario.rol === 'SUPERVISOR') {
    return <SupervisorView usuario={usuario} onSalir={salir} />;
  }

  // key: si cambia el usuario, la pantalla del agente se reinicia por completo
  return <ConsolaAgente key={usuario.id} usuario={usuario} onSalir={salir} />;
}

export default App;