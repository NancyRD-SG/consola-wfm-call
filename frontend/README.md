# Consola WFM: gestión de los tiempos de descanso

Proyecto de grado de Nancy Rincón Duarte, Politécnico Internacional.
Aplicativo web para gestionar y medir el cumplimiento de los descansos del personal de atención al cliente.

## Requisitos
- Node.js 20 o superior (se probó con la versión 24)

## Cómo ejecutarlo (modo entrega, una sola terminal)
1. Abrir una terminal en la carpeta `backend`.
2. `npm install`
3. `npm start`
4. Abrir http://localhost:3001 en el navegador.

La base de datos (`backend/data/consola.db`) ya viene con los usuarios y los horarios; si se borra la carpeta `data`, se crea sola al iniciar.

## Usuarios de prueba
La contraseña inicial es el usuario seguido de `#2026`, por ejemplo `agente01#2026`.

| Rol | Usuarios |
|---|---|
| Agentes de correo | agente01 a agente04 |
| Agentes de chat | agente05 a agente08 |
| Agentes de llamada | agente09 a agente12 |
| Supervisores | deigger.torres, marcela.rios, andres.mejia |

El supervisor ve el cumplimiento de todos los agentes.

## Modo desarrollo (dos terminales)
- En `backend`: `npm install` y `npm start`
- En `frontend`: `npm install` y `npm run dev` (http://localhost:5173)
- Para volver a compilar la pantalla: `npm run build` dentro de `frontend`


## Scripts útiles (dentro de `backend`)
- `node limpiar-historial.js`: borra el historial, los casos y las encuestas
- `node preparar-demo.js 7 agente01`: programa los descansos de hoy para una demostración
- `node probar-login.js`: prueba los permisos de acceso (con el servidor corriendo)

## Notas
- Los casos y las encuestas de satisfacción son simulados.
- Un descanso cuenta como «a tiempo» si se inicia dentro de ±5 minutos de su hora programada.