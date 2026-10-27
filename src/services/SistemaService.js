// =====================================================================
//  SERVICIO de sistema: verificación EN VIVO de librerías y salud.
//  Cada librería se prueba ejecutándola de verdad (no solo se lista):
//  así se demuestra que está instalada, en qué versión y que funciona.
// =====================================================================
const fs = require("fs");
const path = require("path");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { ARGON2_OPTIONS } = require("../config/security");
const env = require("../config/env");
const { loginLimiter, registroLimiter, apiLimiter } = require("../middlewares/rateLimit.middleware");
const logger = require("../utils/logger");

const RAIZ = path.join(__dirname, "..", "..");
const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));

/** Versión realmente instalada en node_modules (puede diferir de la declarada). */
function versionInstalada(nombre) {
  try {
    return JSON.parse(fs.readFileSync(path.join(RAIZ, "node_modules", nombre, "package.json"), "utf8")).version;
  } catch {
    return null;
  }
}

async function cronometrar(fn) {
  const inicio = process.hrtime.bigint();
  try {
    const detalle = await fn();
    return { ok: true, ms: Math.round(Number(process.hrtime.bigint() - inicio) / 1e5) / 10, detalle };
  } catch (err) {
    return { ok: false, ms: null, detalle: err.message };
  }
}

/** Descripción de cada librería: para qué sirve, en qué capa se usa y su prueba. */
function catalogoLibrerias(req, db) {
  return [
    {
      nombre: "express", categoria: "Framework web", capa: "Controlador / Rutas (MVC)",
      uso: "Servidor HTTP, enrutamiento de la API y archivos estáticos.",
      seguridad: "Errores centralizados con mensajes genéricos; body limitado a 10 KB.",
      prueba: async () => `${req.app.router?.stack?.length ?? "?"} capas de middleware registradas`,
    },
    {
      nombre: "pg", categoria: "Acceso a datos", capa: "DAO",
      uso: "Driver de PostgreSQL (Supabase) con pool de conexiones.",
      seguridad: "Consultas parametrizadas ($1, $2…) contra inyección SQL; conexión SSL.",
      prueba: async () => {
        const { rows } = await db.query("SELECT current_setting('server_version') AS v");
        return `PostgreSQL ${rows[0].v} · pool ${db.pool.totalCount} abiertas / ${db.pool.idleCount} libres`;
      },
    },
    {
      nombre: "argon2", categoria: "Seguridad", capa: "Controlador de autenticación",
      uso: "Hash de contraseñas con Argon2id (ganador de la Password Hashing Competition).",
      seguridad: "Parámetros OWASP: 19 MiB, 2 iteraciones, paralelismo 1.",
      prueba: async () => {
        const h = await argon2.hash("prueba-en-vivo", ARGON2_OPTIONS);
        if (!(await argon2.verify(h, "prueba-en-vivo"))) throw new Error("verify falló");
        return `hash + verificación correctos (${h.slice(0, 17)}…)`;
      },
    },
    {
      nombre: "jsonwebtoken", categoria: "Seguridad", capa: "Middleware de sesión",
      uso: "Token de sesión firmado (JWT HS256) dentro de una cookie HttpOnly.",
      seguridad: `Algoritmo fijado a HS256; expira en ${env.JWT_EXPIRES_IN}.`,
      prueba: async () => {
        const t = jwt.sign({ sub: "prueba" }, env.JWT_SECRET, { algorithm: "HS256", expiresIn: "10s" });
        jwt.verify(t, env.JWT_SECRET, { algorithms: ["HS256"] });
        return "firma y verificación correctas";
      },
    },
    {
      nombre: "zod", categoria: "Validación", capa: "Validadores (antes del controlador)",
      uso: "Esquemas que validan y normalizan todo dato que llega del navegador.",
      seguridad: "Lista blanca de campos y formatos; el rol 'admin' no se acepta en el registro.",
      prueba: async () => {
        const r = z.object({ email: z.string().email() }).safeParse({ email: "no-es-correo" });
        if (r.success) throw new Error("debió rechazar");
        return "rechazó correctamente un dato inválido";
      },
    },
    {
      nombre: "helmet", categoria: "Seguridad", capa: "Middleware global",
      uso: "Cabeceras HTTP de seguridad (CSP, anti-clickjacking, nosniff…).",
      seguridad: "Content-Security-Policy solo permite scripts propios.",
      prueba: async () => {
        const csp = req.res?.getHeader("content-security-policy");
        if (!csp) throw new Error("no se encontró la cabecera CSP");
        return `CSP activa · X-Frame-Options: ${req.res.getHeader("x-frame-options")}`;
      },
    },
    {
      nombre: "express-rate-limit", categoria: "Seguridad", capa: "Middleware de rutas",
      uso: "Limita peticiones por IP contra fuerza bruta y abuso.",
      seguridad: env.IS_PROD ? "Login 10/15 min · Registro 5/hora · API 1000/15 min." : "Desarrollo: login 50/15 min · registro 20/hora (producción: 10 y 5) · API 5000/15 min (producción: 1000).",
      prueba: async () => {
        if (![loginLimiter, registroLimiter, apiLimiter].every((f) => typeof f === "function")) throw new Error("limitadores no cargados");
        return "3 limitadores activos";
      },
    },
    {
      nombre: "cookie-parser", categoria: "Sesión", capa: "Middleware global",
      uso: "Lee la cookie de sesión cs_session.",
      seguridad: "Cookie HttpOnly + SameSite=Strict (+ Secure en producción).",
      prueba: async () => {
        if (!req.cookies?.cs_session) throw new Error("no llegó la cookie de sesión");
        return "cookie de sesión leída en esta petición";
      },
    },
    {
      nombre: "dotenv", categoria: "Configuración", capa: "config/env.js",
      uso: "Carga variables de entorno desde .env (fuera de Git).",
      seguridad: "La app no arranca si falta DATABASE_URL o JWT_SECRET (≥ 32 caracteres).",
      prueba: async () => {
        const vars = ["DATABASE_URL", "JWT_SECRET", "PORT", "NODE_ENV"].filter((v) => process.env[v]);
        return `${vars.length} variables cargadas (${vars.join(", ")}) — valores ocultos`;
      },
    },
  ];
}

class SistemaService {
  /** @param {{reporteDAO: object, db: object}} deps */
  constructor({ reporteDAO, db }) {
    this.reportes = reporteDAO;
    this.db = db;
  }

  /** Ejecuta una prueba real con cada librería de producción. */
  async verificarLibrerias(req) {
    const declaradas = { ...pkg.dependencies };
    const resultados = await Promise.all(
      catalogoLibrerias(req, this.db).map(async (lib) => {
        const r = await cronometrar(lib.prueba);
        return {
          nombre: lib.nombre, categoria: lib.categoria, capa: lib.capa, uso: lib.uso, seguridad: lib.seguridad,
          declarada: declaradas[lib.nombre] || null, instalada: versionInstalada(lib.nombre),
          ok: r.ok, ms: r.ms, detalle: r.detalle,
        };
      })
    );
    const dev = Object.entries(pkg.devDependencies || {}).map(([nombre, declarada]) => ({
      nombre, declarada, instalada: versionInstalada(nombre),
    }));
    return { librerias: resultados, desarrollo: dev };
  }

  /** Salud de la base de datos, del servidor y últimas peticiones. */
  async salud() {
    const db = this.db;
    const conexion = await cronometrar(async () => {
      await db.query("SELECT 1");
      return db.info.esSupabase ? "Supabase" : db.info.esLocal ? "PostgreSQL local" : "PostgreSQL";
    });
    let tablas = [];
    try {
      tablas = await this.reportes.estadoTablas();
    } catch (err) {
      logger.warn("No se pudo leer el estado de tablas", { error: err.message });
    }
    const mem = process.memoryUsage();
    return {
      app: { nombre: pkg.name, version: pkg.version, entorno: env.NODE_ENV },
      runtime: { node: process.version, plataforma: `${process.platform} ${process.arch}`, uptime_s: Math.round(process.uptime()),
                 memoria_mb: Math.round(mem.rss / 1048576) },
      baseDatos: {
        ok: conexion.ok, motor: conexion.detalle, latencia_ms: conexion.ms, host: db.info.host,
        ssl: db.info.esLocal ? "no (local)" : db.info.sslVerificado ? "cifrado + certificado verificado" : "cifrado",
        pool: { max: env.DB_POOL_MAX, abiertas: db.pool.totalCount, libres: db.pool.idleCount, esperando: db.pool.waitingCount },
        consultas: { total: db.stats.consultas, errores: db.stats.errores, lentas: db.stats.lentas,
                     promedio_ms: db.stats.consultas ? Math.round((db.stats.msTotal / db.stats.consultas) * 10) / 10 : 0 },
        tablas,
      },
      peticiones: logger.peticiones().slice(0, 25),
      eventos: logger.recientes().filter((e) => e.nivel !== "debug").slice(0, 15),
    };
  }
}

module.exports = SistemaService;
