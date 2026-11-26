import React, { useState, useEffect, useRef } from 'react';

// Contenido simulado de los casos (se elige según el número del caso)
const CORREOS = [
  { asunto: 'Mi pedido no ha llegado', cuerpo: 'Hola, hice un pedido hace dos semanas y todavía no lo recibo. ¿Me pueden ayudar a rastrearlo?' },
  { asunto: 'Cobro duplicado en mi factura', cuerpo: 'Buenas tardes. Veo dos cobros iguales en mi última factura y quisiera que lo revisen.' },
  { asunto: 'Solicitud de cambio de plan', cuerpo: 'Quisiera cambiar mi plan actual por uno de menor costo. ¿Qué opciones tengo?' },
  { asunto: 'No puedo ingresar a mi cuenta', cuerpo: 'Desde ayer no puedo iniciar sesión, me dice que mi clave es incorrecta y ya la restablecí.' },
];
const MENSAJES_CHAT = [
  'Hola, necesito ayuda con mi pedido, no me ha llegado.',
  'Buenas, me cobraron dos veces este mes. ¿Pueden revisarlo?',
  'Hola, quiero cambiar mi plan, ¿qué opciones hay?',
  'No puedo entrar a mi cuenta, me sale clave incorrecta.',
];
const MOTIVOS_LLAMADA = [
  'Consulta por un pedido demorado',
  'Reclamo por un cobro duplicado',
  'Solicitud de cambio de plan',
  'Problemas para ingresar a su cuenta',
];

const ROTULOS = {
  LLAMADA: { entrante: 'Llamada entrante', boton: 'Contestar llamada', icono: '📞' },
  CHAT: { entrante: 'Chat nuevo', boton: 'Aceptar chat', icono: '💬' },
  CORREO: { entrante: 'Correo nuevo', boton: 'Abrir correo', icono: '✉️' },
};

const aFecha = (texto) => new Date(texto.replace(' ', 'T'));

const mmss = (seg) => {
  const s = Math.max(0, seg);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Reloj que se actualiza cada segundo
function useAhora() {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return ahora;
}

// ---------- Llamada ----------
function VistaLlamada({ caso, onCerrar }) {
  const ahora = useAhora();
  const seg = Math.floor((ahora - aFecha(caso.inicio_atencion).getTime()) / 1000);
  const motivo = MOTIVOS_LLAMADA[caso.id % MOTIVOS_LLAMADA.length];

  return (
    <div className="caso-llamada">
      <div className="caso-etiqueta">📞 Llamada en curso · {caso.numero_caso}</div>
      <h4 style={{ margin: '0 0 0.25rem 0' }}>{caso.cliente_nombre}</h4>
      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Motivo: {motivo}</p>
      <div className="llamada-reloj">{mmss(seg)}</div>
      <button className="btn-colgar" onClick={() => onCerrar(caso.id)}>Colgar y cerrar caso</button>
    </div>
  );
}

// ---------- Correo ----------
function VistaCorreo({ caso, onCerrar }) {
  const [respuesta, setRespuesta] = useState('');
  const correo = CORREOS[caso.id % CORREOS.length];

  return (
    <div>
      <div className="caso-etiqueta">✉️ Correo en atención · {caso.numero_caso}</div>
      <div className="correo-cabecera">
        <span>De: {caso.cliente_nombre} &lt;cliente{caso.id}@correo.demo&gt;</span>
        <strong>Asunto: {correo.asunto}</strong>
      </div>
      <p className="correo-cuerpo">{correo.cuerpo}</p>
      <textarea
        className="caja-texto"
        rows={4}
        placeholder="Escribe tu respuesta al cliente..."
        value={respuesta}
        onChange={(e) => setRespuesta(e.target.value)}
      />
      <button
        className="btn-action"
        disabled={respuesta.trim().length === 0}
        onClick={() => onCerrar(caso.id)}
      >
        Enviar respuesta y cerrar caso
      </button>
    </div>
  );
}

// ---------- Chat ----------
function VistaChat({ caso, onCerrar }) {
  const [mensajes, setMensajes] = useState([
    { de: 'cliente', texto: MENSAJES_CHAT[caso.id % MENSAJES_CHAT.length] },
  ]);
  const [texto, setTexto] = useState('');
  const temporizador = useRef(null);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    setMensajes((m) => [...m, { de: 'agente', texto: t }]);
    setTexto('');
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      setMensajes((m) => [...m, { de: 'cliente', texto: 'Entiendo, muchas gracias por la ayuda.' }]);
    }, 1500);
  };

  return (
    <div>
      <div className="caso-etiqueta">💬 Chat en atención · {caso.numero_caso} · {caso.cliente_nombre}</div>
      <div className="chat-ventana">
        {mensajes.map((m, i) => (
          <div key={i} className={`chat-burbuja ${m.de}`}>{m.texto}</div>
        ))}
      </div>
      <div className="chat-entrada">
        <input
          className="caja-texto"
          placeholder="Escribe tu respuesta..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
        />
        <button className="btn-action" onClick={enviar}>Enviar</button>
      </div>
      <button className="btn-colgar" onClick={() => onCerrar(caso.id)}>Cerrar chat</button>
    </div>
  );
}

// ---------- Panel principal ----------
export default function CasosPanel({ canal, estadoActual, casos, onTomar, onCerrar }) {
  const canalAgente = (canal || '').toUpperCase();
  const enAtencion = casos.en_atencion;
  const recibeCasos = estadoActual === 'Disponible' || estadoActual === 'Atendiendo caso';

  let cuerpo;

  if (!recibeCasos) {
    // Bloqueo: en Break, Almuerzo, Capacitación, etc. no se reciben casos
    cuerpo = (
      <div className="caso-bloqueado">
        <div style={{ fontSize: '1.75rem' }}>🔒</div>
        <p style={{ margin: '0.25rem 0 0 0', fontWeight: 600 }}>
          {estadoActual === 'Desconectado'
            ? 'Estás desconectado. No recibes casos.'
            : `Estás en ${estadoActual}. No recibes casos.`}
        </p>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
          Vuelve a Disponible para recibir casos.
        </p>
      </div>
    );
  } else if (enAtencion) {
    const canalCaso = (enAtencion.canal || canalAgente).toUpperCase();
    if (canalCaso === 'LLAMADA') cuerpo = <VistaLlamada key={enAtencion.id} caso={enAtencion} onCerrar={onCerrar} />;
    else if (canalCaso === 'CHAT') cuerpo = <VistaChat key={enAtencion.id} caso={enAtencion} onCerrar={onCerrar} />;
    else cuerpo = <VistaCorreo key={enAtencion.id} caso={enAtencion} onCerrar={onCerrar} />;
  } else if (casos.pendientes.length > 0) {
    const siguiente = casos.pendientes[0];
    const rotulo = ROTULOS[(siguiente.canal || canalAgente).toUpperCase()] || ROTULOS.CORREO;
    cuerpo = (
      <div className="caso-entrante">
        <div>
          <div className="caso-etiqueta">{rotulo.icono} {rotulo.entrante}</div>
          <strong>{siguiente.numero_caso} · {siguiente.cliente_nombre}</strong>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Casos en cola: {casos.total_pendientes}
          </div>
        </div>
        <button className="btn-action" onClick={onTomar}>{rotulo.boton}</button>
      </div>
    );
  } else {
    cuerpo = (
      <div className="caso-vacio">
        <p style={{ margin: 0 }}>Sin casos en cola.</p>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
          Los casos nuevos llegan automáticamente mientras estés Disponible.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Atención de Casos</h2>
      {cuerpo}
    </div>
  );
}