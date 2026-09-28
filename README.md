# Command-Service
Plataforma de servicios centralizados: los **proveedores** (emprendedores) publican sus servicios y los **clientes** los contratan.

## Tecnologías
- **Frontend:** HTML, CSS y JavaScript (carpeta `public/`)
- **Backend:** Node.js + Express (carpeta `src/`)
- **Base de datos:** PostgreSQL en **Supabase** (nube)
- **Seguridad:** Argon2id, JWT en cookie HttpOnly, Zod, Helmet, rate limiting, RLS en Supabase

## Inicio rápido
```bash
npm install
copy .env.example .env      # completar DATABASE_URL (Supabase → Connect → Session pooler) y JWT_SECRET
npm run db:test             # prueba la conexión con Supabase
npm run db:init             # crea las tablas
npm run dev                 # abre http://localhost:3000
```

## Documentación
- [Guía de instalación (Node.js, Supabase, DBeaver, Antares)](docs/GUIA-INSTALACION.md)
- [Cómo funciona el login y la seguridad](docs/GUIA-AUTENTICACION.md)

## Estructura
```
public/     páginas web (landing, login, registro, panel)
src/        servidor Node.js (rutas, controladores, middlewares, config de BD)
database/   schema.sql, init.js (db:init), test-connection.js (db:test)
docs/       guías
```
