# Arquitectura de Command Service — dónde está cada concepto

Guía para revisar el código durante la sustentación. Cada concepto del curso tiene su carpeta y archivos concretos. Los números de línea corresponden a la versión 1.2.0.

## 1. MVC + Servicio + DAO

```
Navegador ──fetch + cookie──► routes/ ─► middlewares/ ─► controllers/ ─► services/ ─► models/ + dao/ ─► PostgreSQL
   ▲                                                         │
   └──────────────────────── JSON (res.json) ◄───────────────┘
```

| Capa | Carpeta | Ejemplo para mostrar |
|---|---|---|
| **Vista (V)** | `public/` | `public/assets/js/app/main.js` (router y menú por rol, línea 22) · `public/assets/js/app/views/` (11 vistas) |
| **Controlador (C)** | `src/controllers/` | `solicitud.controller.js#accion` (línea 27): 4 líneas, sin SQL ni reglas |
| **Servicio** | `src/services/` | `SolicitudService.js#ejecutarAccion` (línea 70): valida con el modelo, guarda con el DAO, audita |
| **Modelo (M) – dominio** | `src/models/` | `Solicitud.js` (máquina de estados) · `Usuario.js` (roles) |
| **Modelo (M) – datos** | `src/dao/` | `SolicitudDAO.js#cambiarEstado` (línea 116) |

## 2. Patrón DAO

- `src/dao/BaseDAO.js` (línea 14): clase base con `query`, `uno`, `varios`, `afecta` y `tx`. Recibe la conexión por constructor.
- `UsuarioDAO`, `ServicioDAO`, `SolicitudDAO`, `ReporteDAO` y `AuditoriaDAO` **heredan** de `BaseDAO` (`class SolicitudDAO extends BaseDAO`, línea 30).
- `src/dao/index.js`: crea una instancia de cada DAO.
- **Único lugar con SQL**. Las consultas son parametrizadas (`$1, $2…`) y el cambio de estado usa bloqueo optimista (`WHERE id = $1 AND estado = $2`, línea 124).

## 3. SOLID

| Principio | Dónde | Qué mostrar |
|---|---|---|
| **S** – Responsabilidad única | Una carpeta por responsabilidad en `src/` | Controlador sin SQL, DAO sin reglas, servicio sin HTTP |
| **O** – Abierto/cerrado | `src/models/Solicitud.js` línea 13 (`TRANSICIONES`) · `public/assets/js/app/main.js` línea 22 (`VISTAS`) | Agregar una acción o un módulo del menú = agregar una entrada |
| **L** – Sustitución de Liskov | `src/utils/HttpError.js` línea 7 · `src/models/Usuario.js` | `HttpError` se usa donde se espera un `Error` (`app.js` línea 45); `Cliente`/`Proveedor`/`Administrador` sustituyen a `Usuario` |
| **I** – Segregación de interfaces | `src/middlewares/` · `src/routes/api.routes.js` | Middlewares pequeños que cada ruta combina: `requireRol`, `idParam`, `validate` (línea 43) |
| **D** – Inversión de dependencias | `src/services/index.js` · `SolicitudService.js` línea 15 · `BaseDAO.js` línea 16 | Los servicios reciben los DAO por constructor; en las pruebas se pasan DAO simulados |

## 4. Programación Orientada a Objetos

| Concepto | Dónde |
|---|---|
| Clases y constructores | `src/models/Usuario.js` línea 11 · `src/dao/BaseDAO.js` · `src/services/*.js` |
| Herencia (`extends`, `super`) | `Cliente`, `Proveedor`, `Administrador extends Usuario` (líneas 53, 59, 85) · cada DAO `extends BaseDAO` · `HttpError extends Error` |
| Polimorfismo | `participaEn()` redefinido en cada rol (líneas 54, 76, 91); `Solicitud#accionesPara` lo usa sin preguntar el rol |
| Encapsulamiento | `toJSON()` (línea 47) nunca expone el hash · campo privado `#hashFicticio` en `AuthService.js` línea 17 |
| Patrón fábrica | `Usuario.desde()` (línea 27) crea la subclase según el rol |
| Arreglos | `TRANSICIONES` + `Object.entries().filter().map()` en `Solicitud#accionesPara` · `VISTAS.filter()` en `main.js` |

## 5. TDD y pruebas (`npm test`, 23 pruebas)

| Archivo | Tipo | Qué prueba |
|---|---|---|
| `tests/unit/Solicitud.model.test.js` | Unitaria (9) | Máquina de estados y POO, sin base de datos. Se escribieron antes del modelo (rojo → verde → refactor) |
| `tests/unit/SolicitudService.test.js` | Unitaria (3) | El servicio con **DAO simulados** (inyección de dependencias) |
| `tests/integration/api.test.js` | Integración (11) | API real: login, 401/403, IDOR, validación, CSV con BOM, cabeceras Helmet |

`npm run test:unit` ejecuta solo las unitarias (no necesitan base de datos).

## 6. Librerías

| Librería | Dónde se configura | Dónde se usa |
|---|---|---|
| express 5 | `src/app.js` | `src/routes/` · `src/controllers/` |
| pg | `src/config/database.js` | `src/dao/BaseDAO.js` |
| argon2 | `src/config/security.js` (`ARGON2_OPTIONS`, línea 28) | `src/services/AuthService.js` |
| jsonwebtoken | `src/config/security.js` (`JWT_OPTIONS`, línea 31) | `AuthService#emitirToken` · `verificarToken` |
| zod | `src/validators/` | `src/middlewares/validate.middleware.js` |
| helmet | `src/config/security.js` (`HELMET_OPTIONS`, línea 10) | `src/app.js` |
| express-rate-limit | `src/middlewares/rateLimit.middleware.js` | `src/routes/` |
| cookie-parser | `src/config/security.js` (`COOKIE_OPTIONS`, línea 36) | `src/app.js` · `auth.controller.js` |
| dotenv | `src/config/env.js` | toda la configuración |

Verificación en vivo: módulo **Sistema y librerías** (`src/services/SistemaService.js`).

### Equivalencias con las librerías Java del sílabo

| Java | Command Service |
|---|---|
| Logback | `src/utils/logger.js` (niveles, JSON en producción, log HTTP) |
| Apache POI | `src/utils/csv.js` (CSV con BOM para Excel + protección contra CSV injection) |
| Apache Commons | Zod (`src/validators/`) + `Intl` en `public/assets/js/app/core.js` |
| Google Guava | Arreglos ES2023, `Map`/`Set`, `Object.freeze` en `TRANSICIONES` |
| JUnit · Maven · Javadoc | `node:test` · npm · JSDoc en los archivos de `src/` |

## 7. Seguridad por capa

| Capa | Control | Archivo |
|---|---|---|
| Navegador | Cookie HttpOnly + SameSite=Strict; plantillas que escapan HTML (anti-XSS) | `config/security.js` · `public/assets/js/app/core.js` |
| Cabeceras | CSP solo con recursos propios, anti-clickjacking | `config/security.js` → `app.js` |
| Entrada | Validación Zod; UUID en `:id` | `validators/` · `middlewares/validate.middleware.js` |
| Acceso | JWT HS256 (2 h) y control por rol | `middlewares/auth.middleware.js` |
| Abuso | Límite por IP + bloqueo de cuenta tras 5 fallos | `middlewares/rateLimit.middleware.js` · `AuthService#login` |
| Contraseñas | Argon2id con parámetros OWASP | `AuthService.js` |
| Datos | SQL parametrizado, alcance por rol, RLS en las 10 tablas | `dao/` · `database/schema.sql` |
| Errores | Mensajes genéricos al cliente; detalle solo en el log | `app.js` (manejador central) |
