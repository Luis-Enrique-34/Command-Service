# Command-Service
Plataforma de servicios centralizados: los **proveedores** (emprendedores) publican sus servicios, los **clientes** los contratan con **pago en custodia** y el **administrador** verifica proveedores y supervisa la operación.

## Tecnologías
- **Frontend:** HTML, CSS y JavaScript (módulos ES, sin frameworks) · tema **claro/oscuro** · fuentes e íconos locales (`public/assets/vendor`)
- **Backend:** Node.js + Express 5 con arquitectura **MVC + Servicio + DAO**
- **Base de datos:** PostgreSQL en **Supabase** (10 tablas, triggers, columnas generadas, RLS)
- **Seguridad:** Argon2id, JWT en cookie HttpOnly/SameSite, Zod, Helmet (CSP), rate limiting, auditoría
- **Pruebas:** `node:test` — 12 unitarias (modelo y servicio con DAO simulados) + 11 de integración de la API

## Inicio rápido
```bash
npm install
copy .env.example .env      # completar DATABASE_URL (Supabase → Connect → Session pooler) y JWT_SECRET
npm run db:test             # prueba la conexión con Supabase
npm run db:init             # crea / actualiza las tablas (no borra datos)
npm run db:seed             # carga datos de demostración
npm run dev                 # abre http://localhost:3000
npm test                    # ejecuta las 23 pruebas (test:unit · test:integration por separado)
```

### Cuentas de demostración (contraseña `Demo2026!`)
| Rol | Correo |
|---|---|
| Administrador | admin@demo.commandservice.pe |
| Proveedor verificado | diego.salazar@demo.commandservice.pe |
| Proveedor pendiente | jorge.paredes@demo.commandservice.pe |
| Cliente | ana.torres@demo.commandservice.pe |

`npm run db:reset` borra y vuelve a crear solo los datos demo (no toca las cuentas reales).

## Módulos (después del login)
| Módulo | Cliente | Proveedor | Admin |
|---|:-:|:-:|:-:|
| Inicio con indicadores | ✔ | ✔ | ✔ |
| Catálogo con búsqueda y filtros | ✔ | | ✔ |
| Mis servicios (publicar / editar / activar) | | ✔ | |
| Solicitudes: estados, pago en custodia, mensajes, reseñas | ✔ | ✔ | ✔ |
| Agenda | | ✔ | |
| Usuarios · Verificación de proveedores · Reportes (CSV) · Auditoría | | | ✔ |
| Sistema y librerías (verificación en vivo) | | | ✔ |
| Mi perfil | ✔ | ✔ | ✔ |

## Arquitectura
**MVC + Servicio + DAO**, con cada concepto en su propia carpeta. El mapa completo concepto → archivo está en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
```
Vista (public/) → routes/ → middlewares/ → controllers/ → services/ → models/ + dao/ → PostgreSQL
                  (URL)     (sesión, rol,   (HTTP ↔        (reglas)    (dominio)  (SQL)
                             Zod, límites)   servicio)
```
```
Command-Service/
├── public/                    VISTA (la "V" de MVC)
│   ├── landing.html · login.html · registro.html · app.html
│   └── assets/  css/ · js/ (theme.js · pages/ · app/core.js · app/main.js · app/views/) · img/ · vendor/
├── src/                       BACKEND
│   ├── server.js · app.js     arranque · cadena de middlewares y errores
│   ├── config/                env.js (dotenv) · database.js (pg) · security.js (helmet, argon2, JWT, cookie)
│   ├── routes/                index.js · auth.routes.js · api.routes.js
│   ├── middlewares/           auth · validate (zod) · rateLimit (express-rate-limit)
│   ├── validators/            esquemas Zod
│   ├── controllers/           CONTROLADOR (la "C"): auth · panel · servicio · solicitud · admin · sistema
│   ├── services/              LÓGICA DE NEGOCIO: AuthService · UsuarioService · ServicioService · SolicitudService · ReporteService · SistemaService
│   ├── models/                MODELO de dominio (POO): Usuario (+ Cliente, Proveedor, Administrador) · Solicitud (máquina de estados)
│   ├── dao/                   MODELO de datos (patrón DAO): BaseDAO + UsuarioDAO · ServicioDAO · SolicitudDAO · ReporteDAO · AuditoriaDAO
│   └── utils/                 logger (≈ Logback) · csv (≈ Apache POI) · HttpError · dbErrors
├── database/                  schema.sql · init.js · seed.js · test-connection.js
├── tests/
│   ├── unit/                  Solicitud.model.test.js · SolicitudService.test.js (DAO simulados)
│   └── integration/           api.test.js (servidor real + BD)
└── docs/                      ARQUITECTURA.md · guías · entregables/
```

## API principal
| Método | Ruta | Rol |
|---|---|---|
| POST | /api/auth/registro · /login · /logout · GET /me | Público / sesión |
| GET | /api/inicio · /api/perfil · PUT /api/perfil | Todos |
| GET | /api/categorias · /api/servicios?q=&categoria=&modalidad=&orden= | Todos |
| GET/POST/PUT/PATCH | /api/mis-servicios[/:id[/estado]] | Proveedor |
| GET/POST | /api/solicitudes · GET /api/solicitudes/:id | Según rol |
| PATCH | /api/solicitudes/:id/estado `{accion: aceptar\|rechazar\|pagar\|agendar\|iniciar\|completar\|cancelar}` | Según máquina de estados |
| POST | /api/solicitudes/:id/mensajes · /resena | Participantes / cliente |
| GET | /api/agenda | Proveedor |
| GET/PATCH | /api/admin/usuarios · /proveedores · /reportes · /reportes/solicitudes.csv · /auditoria | Admin |
| GET | /api/sistema/librerias · /api/sistema/salud | Admin |

## Documentación
- [Arquitectura: dónde está cada concepto (MVC, DAO, SOLID, TDD, POO, librerías)](docs/ARQUITECTURA.md)
- [Guía de instalación (Node.js, Supabase, DBeaver, Antares)](docs/GUIA-INSTALACION.md)
- [Cómo funciona el login y la seguridad](docs/GUIA-AUTENTICACION.md)
