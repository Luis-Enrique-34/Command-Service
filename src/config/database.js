// =====================================================================
//  CONEXIÓN A POSTGRESQL (Supabase) — librería: pg
//  Un "pool" mantiene conexiones abiertas y las recicla: abrir una por
//  petición sería lento, sobre todo hacia la nube.
//  Expone solo query() y tx(): los DAO dependen de esta abstracción y no
//  del driver (principio D de SOLID: inversión de dependencias).
// =====================================================================
const { Pool, types } = require("pg");
const { DATABASE_URL, DB_POOL_MAX } = require("./env");
const { buildDbConfig } = require("./dbConfig");
const logger = require("../utils/logger");

// Las columnas DATE se devuelven como texto "AAAA-MM-DD" (sin convertir a otra
// zona horaria, que podía mostrar el día anterior en Perú, UTC-5).
types.setTypeParser(1082, (v) => v);

const { info, ...config } = buildDbConfig(DATABASE_URL, { max: DB_POOL_MAX });
const pool = new Pool(config);

pool.on("error", (err) => {
  // Supabase puede cerrar conexiones inactivas; el pool abre otra sola.
  logger.warn("Error en una conexión del pool de PostgreSQL", { error: err.message });
});

// Métricas simples para el módulo "Sistema" (consultas ejecutadas y tiempo medio)
const stats = { consultas: 0, errores: 0, msTotal: 0, lentas: 0 };

async function medir(fn) {
  const inicio = process.hrtime.bigint();
  try {
    return await fn();
  } catch (err) {
    stats.errores++;
    throw err;
  } finally {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    stats.consultas++;
    stats.msTotal += ms;
    if (ms > 500) stats.lentas++;
  }
}

// IMPORTANTE: siempre usar consultas parametrizadas ($1, $2...)
// Nunca concatenar texto del usuario dentro del SQL -> evita SQL Injection.
const query = (text, params) => medir(() => pool.query(text, params));

/**
 * Ejecuta varias consultas en UNA transacción (todo o nada).
 * `usuarioId` se guarda en la variable de sesión app.usuario_id para que los
 * triggers (historial de solicitudes) sepan quién hizo el cambio.
 * @param {(q: (text: string, params?: any[]) => Promise<import('pg').QueryResult>) => Promise<any>} fn
 * @param {{ usuarioId?: string, comentario?: string }} [ctx]
 */
async function tx(fn, { usuarioId, comentario } = {}) {
  const client = await pool.connect();
  const q = (text, params) => medir(() => client.query(text, params));
  try {
    await client.query("BEGIN");
    if (usuarioId || comentario) {
      await client.query(
        "SELECT set_config('app.usuario_id', $1, true), set_config('app.comentario', $2, true)",
        [usuarioId || "", comentario || ""]
      );
    }
    const resultado = await fn(q);
    await client.query("COMMIT");
    return resultado;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, tx, pool, info, stats };
