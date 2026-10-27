# `src/` — Backend por capas (MVC + Servicio + DAO)

Una petición recorre las capas de arriba hacia abajo. Cada capa tiene **una sola responsabilidad** y solo conoce a la capa siguiente.

| Orden | Carpeta | Capa / concepto | Qué hace | No hace |
|---|---|---|---|---|
| 1 | `routes/` | Rutas | Asocia cada URL con sus middlewares y su controlador | Lógica |
| 2 | `middlewares/` | Seguridad transversal | Sesión (JWT), rol, validación (Zod), límite de intentos | Negocio |
| 3 | `validators/` | Validación | Esquemas Zod: lista blanca de campos y formatos | — |
| 4 | `controllers/` | **C** de MVC | Traduce HTTP ↔ servicio (lee `req`, responde JSON) | SQL, reglas |
| 5 | `services/` | Lógica de negocio | Reglas, coordinación y auditoría; recibe los DAO por constructor | HTTP, SQL |
| 6 | `models/` | **M** de MVC (dominio) | Clases `Usuario` y `Solicitud`: herencia, polimorfismo, máquina de estados | Persistencia |
| 7 | `dao/` | **M** de MVC (datos) · patrón DAO | Único lugar con SQL; clases que heredan de `BaseDAO` | Reglas |
| — | `config/` | Configuración | `.env` (dotenv), conexión `pg`, parámetros de seguridad | — |
| — | `utils/` | Utilidades | Logger (≈ Logback), CSV para Excel (≈ Apache POI), `HttpError` | — |

La **V** de MVC está en `public/` (HTML, CSS y JavaScript con módulos ES).

Ejemplo — el proveedor pulsa **Aceptar**:
`routes/api.routes.js` → `middlewares/` (sesión, UUID, Zod) → `controllers/solicitud.controller.js#accion`
→ `services/SolicitudService.js#ejecutarAccion` → `models/Solicitud.js#validarAccion` → `dao/SolicitudDAO.js#cambiarEstado` → PostgreSQL (trigger de historial).
