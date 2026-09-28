# Command Service – Login y Registro seguro

Plataforma de servicios donde **proveedores** (emprendedores) publican servicios y **clientes** los contratan.
Este módulo agrega **registro, inicio de sesión, cierre de sesión y páginas protegidas** usando:

| Capa | Tecnología | ¿Para qué? |
|---|---|---|
| Frontend | HTML + CSS + JavaScript puro | Tus páginas (landing, login, registro, panel) |
| Backend | **Node.js + Express** | Recibe los formularios, valida y habla con la BD |
| Base de datos | **PostgreSQL en Supabase** (nube) | Guarda usuarios (y luego servicios, pedidos...) |
| Contraseñas | **Argon2id** | Hash seguro (nunca se guarda la contraseña real) |
| Sesión | **JWT dentro de una cookie HttpOnly** | Recordar quién inició sesión |

---

## 1. Estructura del proyecto

```
Command-Service/
├── public/                  ← TODO lo que ve el navegador
│   ├── landing.html         (tu landing, con botones ya enlazados)
│   ├── landstyle.css
│   ├── landscript.js        (+ detecta si hay sesión y cambia el header)
│   ├── login.html / login.js
│   ├── registro.html / registro.js
│   ├── panel.html / panel.js  (página protegida de ejemplo)
│   ├── auth.css / auth.js     (estilos y funciones compartidas)
│   ├── LOGO CUADRADO.png
│   └── LOGO RECTANGULAR.svg
├── src/                     ← Backend (NUNCA es accesible desde el navegador)
│   ├── server.js            punto de entrada
│   ├── app.js               configuración de Express + seguridad
│   ├── config/  env.js, db.js
│   ├── routes/  auth.routes.js
│   ├── controllers/ auth.controller.js   (lógica de registro/login)
│   ├── middleware/  validate.js, requireAuth.js, rateLimiters.js
│   ├── validators/  auth.schemas.js       (reglas de validación)
│   └── utils/       cookies.js
├── database/
│   ├── schema.sql           ← crea las tablas (+ protección RLS de Supabase)
│   ├── init.js              ← `npm run db:init` (crea las tablas)
│   └── test-connection.js   ← `npm run db:test` (prueba la conexión)
├── docs/                    ← guías (esta y la de instalación)
├── .env.example             ← plantilla de configuración
├── .gitignore
└── package.json
```

> **¿Por qué separar `public/` de `src/`?** Express solo sirve la carpeta `public/`. Así es imposible que alguien descargue tu `.env` (con contraseñas) o tu código del servidor escribiendo la URL.

---

## 2. Instalación

La instalación detallada (Node.js, Supabase, DBeaver/Antares) está en **[GUIA-INSTALACION.md](GUIA-INSTALACION.md)**. Resumen:

```bash
npm install
copy .env.example .env      # completar DATABASE_URL (Supabase) y JWT_SECRET
npm run db:test             # prueba la conexión con Supabase
npm run db:init             # crea las tablas
npm run dev                 # http://localhost:3000
```

---

## 3. Cómo funciona (flujo completo)

### Registro
```
Navegador (registro.js)                Servidor (Node/Express)                 Supabase
──────────────────────                 ───────────────────────                 ──────────
1. Valida campos (comodidad)
2. POST /api/auth/registro  ─────────► 3. Rate limit (máx 5/hora por IP)
   { nombres, email, password... }     4. Zod valida TODO de nuevo
                                       5. Argon2id: password → hash
                                       6. INSERT ... VALUES ($1,$2...)  ───────► guarda hash, NO la clave
                                       7. Firma un JWT {sub: id, rol}
   ◄──────── Set-Cookie: cs_session=JWT; HttpOnly; SameSite=Strict
8. Redirige a panel.html
```

### Login
1. `POST /api/auth/login` con email y contraseña.
2. Se busca el usuario por email. Si **no existe**, igual se ejecuta un `argon2.verify` falso para que la respuesta tarde lo mismo (así nadie descubre qué correos están registrados).
3. `argon2.verify(hashGuardado, contraseñaEscrita)` → true/false.
4. Si falla 5 veces seguidas → la cuenta se **bloquea 15 minutos**.
5. Si es correcta → se crea el JWT y se envía en la cookie.
6. El mensaje de error es **siempre el mismo**: "Correo o contraseña incorrectos" (nunca "ese correo no existe").

### Páginas protegidas
`panel.js` llama a `GET /api/auth/me`. El middleware `requireAuth` lee la cookie, verifica la firma del JWT y su expiración. Si todo está bien devuelve los datos del usuario; si no, `401` y el frontend redirige al login.

Para proteger futuras rutas del backend:
```js
const { requireAuth, requireRol } = require("../middleware/requireAuth");

// Solo usuarios logueados
router.get("/mis-pedidos", requireAuth, controlador);

// Solo proveedores pueden publicar servicios
router.post("/servicios", requireAuth, requireRol("proveedor"), controlador);
// Dentro del controlador tienes req.usuario.id y req.usuario.rol
```

---

## 4. ¿Por qué estas decisiones de seguridad?

### 4.1 ¿Node.js es buena opción? — Sí
Node.js + Express es una de las opciones más usadas para este tipo de plataformas: usas **JavaScript en frontend y backend** (un solo lenguaje), tiene librerías maduras para PostgreSQL (`pg`), hashing (`argon2`) y seguridad (`helmet`, `express-rate-limit`), y se despliega gratis/barato en Render, Railway, etc. Otras alternativas válidas serían Python (Django/FastAPI), PHP (Laravel) o Java (Spring Boot); ninguna es “más segura” por sí misma: **la seguridad depende de las prácticas**, que son las siguientes.

### 4.1.1 ¿Y por qué no usar “Supabase Auth”?
Supabase trae su propio sistema de login (**Supabase Auth**, tabla `auth.users`). Es una opción válida, pero aquí usamos Supabase **solo como base de datos PostgreSQL** y hacemos la autenticación en nuestro backend porque:
- **Aprendes cómo funciona por dentro** (hashing, tokens, cookies, validación), que es justo lo que se evalúa en la universidad y en entrevistas.
- **No dependes de un proveedor**: si mañana migras a otro PostgreSQL (Neon, Render, un servidor propio) solo cambias `DATABASE_URL`.
- Toda la lógica pasa por un solo lugar (tu API), lo que simplifica los permisos.

Si en el futuro quieres login con Google, verificación de correo o recuperación de contraseña sin programarlos, Supabase Auth es una buena alternativa; implicaría rehacer esta parte con la librería `@supabase/supabase-js`.

### 4.2 Hash de contraseñas con Argon2id
- **Nunca** se guarda la contraseña ni se “encripta” (lo encriptado se puede desencriptar). Se guarda un **hash**: una transformación de un solo sentido.
- **Argon2id** es la primera recomendación de OWASP. Es lento a propósito y consume memoria, lo que hace muy caro que un atacante pruebe millones de contraseñas si roba la base de datos.
- Cada hash incluye una **sal** aleatoria: dos usuarios con la misma contraseña tienen hashes distintos.
- Alternativa aceptada: **bcrypt** (más antiguo pero aún seguro). **Nunca** uses MD5, SHA-1 o SHA-256 solos para contraseñas.

### 4.3 Sesión: JWT en cookie HttpOnly (y no en localStorage)
| Opción | Problema |
|---|---|
| Guardar el token en `localStorage` | Cualquier script malicioso (XSS) puede leerlo y robar la sesión |
| **Cookie `HttpOnly`** ✅ | JavaScript no puede leerla; el navegador la envía sola |

Atributos de la cookie:
- `HttpOnly` → invisible para JavaScript (anti-XSS).
- `SameSite=Strict` → no se envía desde otros sitios web (anti-CSRF).
- `Secure` (en producción) → solo viaja por HTTPS.
- Expira en **2 horas**.

### 4.4 Consultas parametrizadas (anti SQL Injection)
```js
// ❌ PELIGROSO
db.query(`SELECT * FROM usuarios WHERE email = '${email}'`);
// ✅ CORRECTO (lo que usa este proyecto)
db.query("SELECT * FROM usuarios WHERE email = $1", [email]);
```

### 4.5 Validación en el servidor (Zod)
La validación de `registro.js` se puede saltar fácilmente (con Postman o las DevTools). Por eso el servidor vuelve a validar todo en `auth.schemas.js`. Ejemplo: aunque alguien envíe `"rol": "admin"`, el servidor lo rechaza.

### 4.6 Otras capas
| Medida | Dónde | Protege contra |
|---|---|---|
| Rate limiting (10 logins / 15 min por IP) | `rateLimiters.js` | Fuerza bruta |
| Bloqueo de cuenta tras 5 fallos | `auth.controller.js` | Fuerza bruta a una cuenta concreta |
| Helmet (cabeceras CSP, X-Frame-Options...) | `app.js` | XSS, clickjacking |
| Límite de 10 KB por petición | `app.js` | Denegación de servicio |
| Errores genéricos al cliente | `app.js` | Filtración de información interna |
| `.env` fuera de Git y de `public/` | `.gitignore` | Robo de credenciales |
| UUID como ID | `schema.sql` | Enumerar usuarios (/usuario/1, /2, /3...) |
| RLS activado + permisos revocados a `anon`/`authenticated` | `schema.sql` | Que alguien lea la tabla `usuarios` por la API REST automática de Supabase |
| Conexión SSL obligatoria a Supabase | `src/config/dbConfig.js` | Que alguien espíe el tráfico entre tu servidor y la BD |

---

## 5. Probar la API con Postman / Thunder Client

| Método | URL | Body (JSON) |
|---|---|---|
| POST | `http://localhost:3000/api/auth/registro` | `{"rol":"cliente","nombres":"Ana","apellidos":"Torres","email":"ana@mail.com","password":"Segura123","confirmPassword":"Segura123","aceptaTerminos":true}` |
| POST | `http://localhost:3000/api/auth/login` | `{"email":"ana@mail.com","password":"Segura123"}` |
| GET | `http://localhost:3000/api/auth/me` | — (usa la cookie) |
| POST | `http://localhost:3000/api/auth/logout` | — |

Ver usuarios en la BD (Supabase → **SQL Editor**, o DBeaver):
```sql
SELECT email, rol, password_hash, creado_en FROM usuarios;
```
Desbloquear una cuenta durante pruebas:
```sql
UPDATE usuarios SET bloqueado_hasta = NULL, intentos_fallidos = 0 WHERE email = 'ana@mail.com';
```

---

## 6. Antes de publicar en internet (checklist)
- [ ] `NODE_ENV=production` (activa la cookie `Secure`; la conexión a Supabase ya va cifrada siempre)
- [ ] HTTPS obligatorio (Render/Railway lo dan gratis)
- [ ] `JWT_SECRET` nuevo y distinto al de desarrollo
- [ ] RLS activado en todas las tablas (Supabase → **Advisors → Security Advisor** sin alertas)
- [ ] (Opcional) Verificación del certificado con `DATABASE_SSL_CA`
- [ ] Contraseña de la BD de Supabase fuerte y guardada solo en `.env` / variables del hosting
- [ ] `npm audit` sin vulnerabilidades altas

## 7. Siguientes pasos sugeridos
1. **Verificación de correo** (enviar un enlace al registrarse) con Nodemailer o Resend.
2. **Recuperar contraseña** con token de un solo uso que expira en 15–30 min.
3. **Publicar servicios** (la tabla `servicios` ya está creada) con `requireRol("proveedor")`.
4. Login con Google (OAuth 2.0) usando Passport.js.
