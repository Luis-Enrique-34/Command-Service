# Command-Service
Plataforma de servicios centralizados: los **proveedores** (emprendedores) publican sus servicios, los **clientes** los contratan con **pago en custodia** y el **administrador** verifica proveedores y supervisa la operación.

## Tecnologías
- **Frontend:** HTML, CSS y JavaScript (módulos ES, sin frameworks) · tema **claro/oscuro** · fuentes e íconos locales (`public/vendor`)
- **Backend:** Node.js + Express 5 con arquitectura **MVC + Servicio + DAO**
- **Base de datos:** PostgreSQL en **Supabase** (10 tablas, triggers, columnas generadas, RLS)
- **Seguridad:** Argon2id, JWT en cookie HttpOnly/SameSite, Zod, Helmet (CSP), rate limiting, auditoría
- **Pruebas:** `node:test` (unitarias de la máquina de estados + integración de la API)

## Inicio rápido
```bash
npm install
copy .env.example .env      # completar DATABASE_URL (Supabase → Connect → Session pooler) y JWT_SECRET
npm run db:test             # prueba la conexión con Supabase
npm run db:init             # crea / actualiza las tablas (no borra datos)
npm run db:seed             # carga datos de demostración
npm run dev                 # abre http://localhost:3000
npm test                    # ejecuta las pruebas automáticas
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
```
Vista (public/)  →  Rutas + middleware  →  Controlador  →  Servicio  →  DAO  →  PostgreSQL
                    (sesión, rol, Zod)      (HTTP)         (reglas)     (SQL)
```
```
public/            landing, login, registro, app.html (panel)
  css/             theme.css (tokens claro/oscuro) · app.css
  js/              theme.js · app/core.js · app/main.js (router) · app/views/*.js
  img/ vendor/     logos por tema · fuentes e íconos locales
src/
  config/          env.js · db.js (pool + transacciones) · dbConfig.js
  routes/          auth.routes.js · api.routes.js
  middleware/      requireAuth.js · validate.js · rateLimiters.js
  validators/      auth.schemas.js · negocio.schemas.js (Zod)
  controllers/     auth · servicio · solicitud · panel
  services/        solicitud.service.js (máquina de estados) · sistema.service.js
  dao/             usuario · servicio · solicitud · reporte · auditoria
  utils/           logger.js · http.js · cookies.js · dbErrors.js
database/          schema.sql · init.js · seed.js · test-connection.js
tests/             solicitud.service.test.js · api.test.js
docs/              guías
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
- [Guía de instalación (Node.js, Supabase, DBeaver, Antares)](docs/GUIA-INSTALACION.md)
- [Cómo funciona el login y la seguridad](docs/GUIA-AUTENTICACION.md)
