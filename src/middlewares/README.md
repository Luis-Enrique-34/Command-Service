# `middlewares/` — Seguridad transversal

Filtros por los que pasa la petición **antes** del controlador. Son pequeños y se combinan por ruta (**I** de SOLID).

| Middleware | Librería | Protege contra |
|---|---|---|
| `auth.middleware.js` → `requireAuth`, `requireRol` | jsonwebtoken | Acceso sin sesión (401) o con rol incorrecto (403) |
| `validate.middleware.js` → `validate`, `idParam` | zod | Datos inválidos o inesperados (400) |
| `rateLimit.middleware.js` | express-rate-limit | Fuerza bruta y abuso (429) |

Los middlewares globales (helmet, cookie-parser, JSON ≤ 10 KB, logger) se registran en `src/app.js` con los parámetros de `config/security.js`.
