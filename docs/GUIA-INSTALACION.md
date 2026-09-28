# Guía de instalación y uso – Command Service
### Node.js + Supabase (PostgreSQL en la nube) + DBeaver / Antares (Windows)

Esta guía te lleva desde cero hasta tener el proyecto corriendo en `http://localhost:3000`, guardando los usuarios en **Supabase**, y viendo los datos desde el panel de Supabase o desde DBeaver.

---

## 0. Primero: ¿qué es cada cosa?

```
      TU PC                                              INTERNET
 ┌──────────────┐   HTTP    ┌──────────────────┐   SQL + SSL   ┌──────────────────────┐
 │  Navegador   │ ────────► │  Node.js         │ ────────────► │  SUPABASE            │
 │ (landing,    │ ◄──────── │  (tu servidor,   │ ◄──────────── │  PostgreSQL en la    │
 │  login...)   │   JSON    │   carpeta src/)  │    filas      │  nube (São Paulo)    │
 └──────────────┘           └──────────────────┘               └──────────────────────┘
                                                                  ▲            ▲
                                                   panel web de   │            │ también se conecta
                                                   Supabase ──────┘   ┌──────────────────┐
                                                   (Table Editor,     │ DBeaver / Antares│
                                                    SQL Editor)       │   (opcional)     │
                                                                      └──────────────────┘
```

| Herramienta | Qué es | Analogía |
|---|---|---|
| **Supabase** | Servicio en la nube que te da una base de datos **PostgreSQL** real, lista para usar, con un panel web. | Un almacén alquilado, siempre abierto |
| **Node.js** | Ejecuta JavaScript fuera del navegador. Con él corre tu backend. | El empleado que atiende pedidos y va al almacén |
| **npm** | Viene con Node. Descarga librerías (express, pg, argon2...). | La tienda de herramientas |
| **DBeaver / Antares** | Programas de escritorio para ver tablas y ejecutar SQL. **Opcionales**: Supabase ya trae su propio editor web. | Otra ventana para mirar dentro del almacén |

> **Importante:** Supabase *es* PostgreSQL. Todo el SQL que aprendas funciona igual. Tu backend se conecta con la misma librería `pg`; solo cambia la dirección (`DATABASE_URL`).

### ¿Por qué Supabase en vez de local?
| Ventaja | Detalle |
|---|---|
| No instalas PostgreSQL | Todo está en la nube |
| Trabajo en equipo | Tus compañeros pueden usar la misma BD |
| Listo para publicar | Cuando subas la web a internet, la BD ya está en la nube |
| Panel web | Ves tus tablas desde el navegador en cualquier PC |

| A tener en cuenta | Detalle |
|---|---|
| Necesitas internet | Sin conexión, el servidor no arranca |
| Pausa por inactividad | En el plan gratis, si el proyecto no se usa por unos días (hoy ~1 semana), Supabase lo **pausa**. Se reactiva con un clic (**Restore project**) y no pierdes datos. |
| Límite de conexiones | El plan gratis permite pocas conexiones simultáneas; por eso el proyecto usa máximo 5 (`DB_POOL_MAX`). |

---

## 1. Empezar con Node.js

### 1.1 Verificar la instalación
Abre **VS Code** → menú **Terminal → New Terminal** (atajo `` Ctrl + ` ``; en teclado español `Ctrl + ñ`) y escribe:

```bash
node -v     # debe mostrar v20.x, v22.x o v24.x
npm -v      # debe mostrar un número, ej. 10.x
```

**¿Error "npm.ps1 no se puede cargar porque la ejecución de scripts está deshabilitada"?**
Es una restricción de PowerShell. Ejecuta una sola vez:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
Responde `S` (Sí) y vuelve a intentar.

### 1.2 Tu primer script (para entender cómo funciona)
Crea un archivo `hola.js` en cualquier carpeta:
```js
console.log("¡Hola desde Node.js!");
console.log("2 + 3 =", 2 + 3);
```
Ejecútalo:
```bash
node hola.js
```
Eso es Node: ejecuta archivos `.js` en tu PC, sin navegador. Tu servidor (`src/server.js`) es exactamente eso, solo que se queda "escuchando" peticiones.

### 1.3 Conceptos que verás en el proyecto

| Archivo / comando | Qué es |
|---|---|
| `package.json` | La "ficha" del proyecto: nombre, librerías que usa y comandos (`scripts`) |
| `npm install` | Lee `package.json` y descarga las librerías en `node_modules/` |
| `node_modules/` | Las librerías descargadas. **Pesa mucho y NO se sube a GitHub** (se regenera con `npm install`) |
| `package-lock.json` | Congela las versiones exactas para que todos instalen lo mismo. Sí se sube a GitHub |
| `.env` | Tus datos secretos (contraseña de Supabase, clave JWT). **NUNCA se sube a GitHub** |
| `npm run db:test` | Prueba la conexión con Supabase |
| `npm run db:init` | Crea las tablas en Supabase |
| `npm run dev` | Arranca el servidor y lo reinicia solo cada vez que guardas un archivo |
| `Ctrl + C` en la terminal | Detiene el servidor |

---

## 2. Crear el proyecto en Supabase

1. Entra a https://supabase.com → **Start your project** → inicia sesión (con GitHub es lo más práctico).
2. Si te lo pide, crea una **Organization** (ej. `Command Service`, plan **Free**).
3. **New project** y completa:

   | Campo | Qué poner |
   |---|---|
   | Project name | `Command Service` |
   | **Database Password** | Usa **Generate a password** o crea una fuerte. **CÓPIALA Y GUÁRDALA** (en un gestor de contraseñas o un lugar seguro): la necesitas para el `.env`. Supabase no te la vuelve a mostrar. |
   | **Region** | **South America (São Paulo)**: la más cercana a Perú = respuestas más rápidas |
   | Opciones de seguridad / Data API (si aparecen) | Déjalas por defecto. Nuestro `schema.sql` protege las tablas de todas formas. |

4. **Create new project** y espera 1–2 minutos mientras se prepara.

> 💡 **Tip:** para evitar problemas en la URL, es más cómodo que la contraseña tenga solo letras y números (y que sea larga, 20+ caracteres). Si tiene símbolos, mira la sección 3.3.

---

## 3. Obtener la cadena de conexión (DATABASE_URL)

### 3.1 Dónde encontrarla
1. En tu proyecto de Supabase, pulsa el botón **Connect** (parte superior de la página).
2. Pestaña **Connection String**, tipo **URI**.
3. En **Method** elige **Session pooler**.
4. Copia la cadena. Se ve así:
   ```
   postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
   ```

### 3.2 ¿Por qué “Session pooler” y no “Direct connection”?
Supabase ofrece 3 formas de conectarse:

| Método | Host / puerto | ¿Para ti? |
|---|---|---|
| Direct connection | `db.xxxx.supabase.co:5432` | ❌ Solo funciona con **IPv6**. La mayoría de redes domésticas en Perú solo tienen IPv4 → da error `ENETUNREACH` o se queda colgado |
| **Session pooler** | `aws-X-region.pooler.supabase.com:5432` | ✅ **Usa esta.** Funciona con IPv4 y es ideal para un servidor Node que se queda encendido |
| Transaction pooler | `...pooler.supabase.com:6543` | Para funciones *serverless*. No la necesitas por ahora |

Partes de la cadena:
```
postgresql://postgres.abcdefghijklmnop:MiClave123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
             └──────── usuario ───────┘ └ clave ┘ └──────────── servidor ────────────┘ └┬─┘ └──┬───┘
              (postgres.TU_PROJECT_REF)                                              puerto  base de datos
                                                                                           (siempre "postgres")
```

### 3.3 Reemplazar la contraseña
- Borra `[YOUR-PASSWORD]` **incluyendo los corchetes** y escribe tu contraseña.
- Si tu contraseña tiene símbolos, codifícalos:

  | Símbolo | Escríbelo como |
  |---|---|
  | `@` | `%40` |
  | `#` | `%23` |
  | `/` | `%2F` |
  | `:` | `%3A` |
  | `?` | `%3F` |
  | `%` | `%25` |

  Ejemplo: `Clave#2026@cs` → `Clave%232026%40cs`

- ¿Olvidaste la contraseña? Supabase → **Project Settings → Database → Reset database password**.

---

## 4. Poner a correr Command Service

1. Descomprime el proyecto y abre la carpeta **Command-Service** en VS Code (**File → Open Folder**).
2. En la terminal:
   ```bash
   npm install
   ```
3. Crea tu archivo `.env` a partir de la plantilla:
   ```bash
   copy .env.example .env
   ```
4. Genera tu clave secreta para las sesiones:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
5. Abre `.env` y deja así las líneas principales:
   ```ini
   PORT=3000
   NODE_ENV=development
   DATABASE_URL=postgresql://postgres.abcdefghijklmnop:TuClaveReal@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
   DB_POOL_MAX=5
   JWT_SECRET=el_texto_largo_que_generaste_en_el_paso_4
   JWT_EXPIRES_IN=2h
   ```
6. **Prueba la conexión** con Supabase:
   ```bash
   npm run db:test
   ```
   Debes ver algo como:
   ```
   ✅ ¡Conexión exitosa! (180 ms)
      PostgreSQL 17.x ...
      Tablas en public: (ninguna aún → ejecuta npm run db:init)
   ```
   Si falla, el mismo mensaje te dice la causa probable (y la sección 11 tiene la solución).

7. **Crea las tablas** en Supabase:
   ```bash
   npm run db:init
   ```
   ```
   ✅ Esquema aplicado. Tablas en 'public':
      • servicios  (RLS activado 🔒)
      • usuarios  (RLS activado 🔒)
   ```
   > **Alternativa sin terminal:** Supabase → **SQL Editor** → **New query** → pega todo el contenido de `database/schema.sql` → **Run**.

8. **Arranca el servidor**:
   ```bash
   npm run dev
   ```
   ```
   ✅ Conectado a Supabase (aws-0-sa-east-1.pooler.supabase.com)
   🚀 Command Service corriendo en http://localhost:3000
   ```
9. Abre **http://localhost:3000** → **Empezar gratis** → crea una cuenta. ¡Ese usuario ya está guardado en Supabase!

> ⚠️ **Ya no uses Live Server** (puerto 5501). Live Server solo muestra archivos HTML; no ejecuta Node, así que el login diría “No se pudo conectar con el servidor”. Ahora **Node sirve la web y la API** en el puerto 3000.

---

## 5. Ver y administrar los datos en Supabase (panel web)

### 5.1 Table Editor
Menú izquierdo → **Table Editor** → tabla **usuarios**.
- Verás cada usuario registrado. La columna `password_hash` empieza con `$argon2id$...`: **nunca** se guarda la contraseña real.
- Es posible que veas un aviso de **RLS enabled / no policies**: es **correcto e intencional** (ver sección 7).

### 5.2 SQL Editor
Menú izquierdo → **SQL Editor** → **New query**. Escribe y pulsa **Run** (o `Ctrl + Enter`).

Consultas útiles para practicar:
```sql
-- Todos los usuarios (sin mostrar el hash)
SELECT nombres, apellidos, email, rol, creado_en, ultimo_login
FROM usuarios
ORDER BY creado_en DESC;

-- Cuántos clientes y proveedores hay
SELECT rol, COUNT(*) AS total
FROM usuarios
GROUP BY rol;

-- Desbloquear una cuenta (tras 5 intentos fallidos)
UPDATE usuarios
SET bloqueado_hasta = NULL, intentos_fallidos = 0
WHERE email = 'correo@ejemplo.com';

-- Convertir un usuario en proveedor
UPDATE usuarios SET rol = 'proveedor' WHERE email = 'correo@ejemplo.com';

-- Borrar un usuario de prueba
DELETE FROM usuarios WHERE email = 'correo@ejemplo.com';
```
Puedes guardar tus consultas favoritas en el SQL Editor para reutilizarlas.

### 5.3 Diagrama de tablas
**Database → Schema Visualizer**: muestra la relación `servicios.proveedor_id → usuarios.id`. Útil para tus informes de la universidad.

> **No crees usuarios escribiendo en la tabla a mano:** la contraseña debe pasar por Argon2. Regístralos siempre desde la web (`/registro.html`).

---

## 6. DBeaver y Antares con Supabase (opcional)

Útiles si prefieres un programa de escritorio o quieres practicar con las herramientas que se usan en el trabajo. Usan los **mismos datos del Session pooler** (sección 3).

### 6.1 DBeaver (recomendado)
1. Descarga **DBeaver Community**: https://dbeaver.io/download/ → Windows (installer). Instala con opciones por defecto.
2. Clic en el ícono **enchufe con “+”** (o **Database → New Database Connection**) → **PostgreSQL** → **Next**.
3. Pestaña **Main**:

   | Campo | Valor |
   |---|---|
   | Connect by | Host |
   | Host | `aws-0-sa-east-1.pooler.supabase.com` (el host de TU cadena) |
   | Port | `5432` |
   | Database | `postgres` |
   | Authentication | Database Native |
   | Username | `postgres.abcdefghijklmnop` (**con** el punto y tu project ref) |
   | Password | tu contraseña (aquí **sin** codificar símbolos) · ✅ Save password |

4. Pestaña **SSL**: ✅ **Use SSL** · SSL mode: **require**.
5. **Test Connection...** → la primera vez pedirá **descargar drivers** → **Download**. Debe decir **Connected**.
6. **Finish**.

Navegar hasta tus tablas:
```
aws-0-sa-east-1.pooler.supabase.com
 └─ Databases
     └─ postgres
         └─ Schemas
             └─ public          ← AQUÍ están tus tablas
                 └─ Tables
                     ├─ servicios
                     └─ usuarios   ← doble clic → pestaña Data / ER Diagram
```
> Verás otros esquemas (`auth`, `storage`, `realtime`...). Son internos de Supabase: **no los modifiques**.

Ejecutar SQL: clic derecho en **postgres** → **SQL Editor → Open SQL script** (`Ctrl + ]`).
- `Ctrl + Enter` → ejecuta la sentencia donde está el cursor.
- `Alt + X` → ejecuta todo el script.
- Si editas celdas en la pestaña **Data**, pulsa **Save** (o `Ctrl + S`) para confirmar.

### 6.2 Antares SQL (alternativa ligera)
Antares tiene una interfaz moderna, pero solo soporta PostgreSQL, MySQL/MariaDB y SQLite, y lo mantiene una sola persona (última versión: junio de 2025). Para trabajo serio, DBeaver.

1. Descarga el instalador `.exe` de la versión más reciente en https://github.com/antares-sql/antares/releases.
2. **“+” / Create connection** y completa:

   | Campo | Valor |
   |---|---|
   | Client | PostgreSQL |
   | Host name / IP | `aws-0-sa-east-1.pooler.supabase.com` |
   | Port | `5432` |
   | Database | `postgres` |
   | User | `postgres.abcdefghijklmnop` |
   | Password | tu contraseña |
   | SSL | Actívalo (pestaña/opción **SSL**) |

3. **Test connection** → **Save** → clic en la conexión.
4. Abre el esquema **public** para ver `usuarios` y `servicios`. Para SQL, abre una pestaña de **Query**, escribe y pulsa **Run ▶**.

---

## 7. Seguridad específica de Supabase (léelo)

Supabase crea automáticamente una **API REST pública** (Data API) sobre el esquema `public`, que se usa con una clave llamada **anon key**. Muchos proyectos han filtrado datos porque dejaron sus tablas abiertas por esa vía.

**En Command Service no usamos esa API**: el navegador solo habla con tu servidor Node, y Node habla con la BD. Por eso `schema.sql`:
1. Activa **Row Level Security (RLS)** en `usuarios` y `servicios` **sin políticas** → la API no puede leer ni escribir filas.
2. Quita todos los permisos a los roles `anon` y `authenticated` → doble candado.

Tu backend se conecta como `postgres` (dueño de las tablas), así que no le afecta.

Reglas de oro:
- ❌ No pongas la **anon key** ni la **service_role key** en tu frontend (no las necesitas).
- ❌ Nunca subas `.env` a GitHub. Si lo subiste por error: **resetea la contraseña de la BD** en Supabase de inmediato.
- ✅ Cada vez que crees una tabla nueva, agrega `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` (y el `REVOKE`) en `schema.sql`.
- ✅ Revisa de vez en cuando **Advisors → Security Advisor** en Supabase: no debería mostrar alertas sobre tus tablas.
- ✅ *(Opcional, más seguro)* Verifica el certificado del servidor: **Project Settings → Database → SSL Configuration → Download certificate**, guárdalo en `certs/` y agrega en `.env`:
  ```ini
  DATABASE_SSL_CA=./certs/prod-ca-2021.crt
  ```
  (la carpeta `certs/` ya está en `.gitignore`). Sin esta línea la conexión **igual va cifrada**; con ella, además se comprueba que el servidor sea realmente Supabase.

---

## 8. Tu rutina diaria de trabajo

```bash
# 1. Abrir la carpeta Command-Service en VS Code
# 2. Terminal:
npm run dev
# 3. Navegador: http://localhost:3000
# 4. Programar → guardar (nodemon reinicia solo)
# 5. Revisar datos en Supabase (Table Editor) o DBeaver (F5 para refrescar)
# 6. Al terminar: Ctrl + C en la terminal
```

¿Agregaste columnas o tablas nuevas en `schema.sql`? Vuelve a ejecutar `npm run db:init` (usa `IF NOT EXISTS`, no borra lo que ya tienes). Para **modificar** columnas existentes usa `ALTER TABLE` en el SQL Editor.

---

## 9. Trabajo en equipo

Todos pueden usar el **mismo proyecto de Supabase**:
1. Supabase → **Organization settings → Team → Invite** (para que tus compañeros vean el panel).
2. Comparte la `DATABASE_URL` **por un canal privado** (nunca en el repositorio ni en grupos públicos).
3. Cada uno clona el repo, ejecuta `npm install` y crea su propio `.env`. **No** hace falta volver a ejecutar `db:init` (las tablas ya existen).

---

## 10. Subir los cambios a GitHub

```bash
git status          # revisa: NO debe aparecer .env, node_modules ni certs/
git add .
git commit -m "Login y registro con Node.js, Express y Supabase"
git push
```

---

## 11. Problemas comunes

| Mensaje | Causa | Solución |
|---|---|---|
| `DATABASE_URL todavía tiene un texto de ejemplo` | Quedó `[YOUR-PASSWORD]` o `TU_CONTRASEÑA` | Pon tu contraseña real, **sin corchetes** |
| `ENETUNREACH` / se queda colgado con host `db.xxxx.supabase.co` | Usaste la *Direct connection* (solo IPv6) | Usa la cadena del **Session pooler** (sección 3) |
| `Tenant or user not found` | Usuario sin el project ref, o host de otra región | El usuario debe ser `postgres.TU_PROJECT_REF`; copia la cadena completa otra vez |
| `password authentication failed` | Contraseña incorrecta o con símbolos sin codificar | Revisa la sección 3.3 o resetea la contraseña en Supabase |
| `DATABASE_URL no es una URL válida` | Símbolos especiales en la contraseña | Codifícalos (`#` → `%23`, etc.) |
| `ETIMEDOUT` / tarda y falla | Sin internet, o una red (universidad/trabajo) bloquea el puerto 5432 | Prueba con otra red (ej. datos del celular) |
| El proyecto no responde / aparece “Paused” en Supabase | Pausa por inactividad del plan gratis | Dashboard → **Restore project** y espera un par de minutos |
| `MaxClientsInSessionMode` / `too many clients` | Varios servidores abiertos a la vez | Cierra otras terminales con `npm run dev`; baja `DB_POOL_MAX` |
| `self-signed certificate` / `certificate` | Ruta incorrecta en `DATABASE_SSL_CA` | Corrige la ruta o borra esa línea del `.env` |
| `Falta la variable de entorno JWT_SECRET` | No existe `.env` o está incompleto | Pasos 3 a 5 de la sección 4 |
| `EADDRINUSE: address already in use :::3000` | Ya hay un servidor corriendo en otra terminal | Ciérralo con `Ctrl + C`, o cambia `PORT=3001` |
| `'nodemon' no se reconoce...` | No se ejecutó `npm install` | `npm install` |
| Error al instalar `argon2` | Node muy antiguo o no LTS | Instala Node **LTS** desde nodejs.org y repite `npm install` |
| El login dice “No se pudo conectar con el servidor” | Abriste la página con Live Server o doble clic | Usa `http://localhost:3000` con `npm run dev` corriendo |
| “Demasiados intentos de inicio de sesión” | Límite anti fuerza bruta (10 cada 15 min) | Espera 15 min o reinicia el servidor |
| “Cuenta bloqueada temporalmente” | 5 contraseñas incorrectas seguidas | Consulta de desbloqueo de la sección 5.2 |

---

## Anexo: usar PostgreSQL local en vez de Supabase
El código funciona igual con un PostgreSQL instalado en tu PC (útil si no tienes internet). Instálalo desde https://www.postgresql.org/download/windows/, y en `.env` usa:
```ini
DATABASE_URL=postgresql://postgres:TuClaveLocal@localhost:5432/command_service
```
`npm run db:init` creará la base `command_service` automáticamente. Con `localhost` el proyecto desactiva SSL solo.

---

**Siguiente guía:** [GUIA-AUTENTICACION.md](GUIA-AUTENTICACION.md) explica cómo funciona el login por dentro y por qué cada medida de seguridad.
