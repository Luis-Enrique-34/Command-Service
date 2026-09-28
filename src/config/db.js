// Conexión a PostgreSQL (Supabase) usando un "pool" (grupo de conexiones
// reutilizables). Abrir una conexión nueva por cada petición es lento,
// sobre todo hacia la nube; el pool las mantiene abiertas y las recicla.
const { Pool } = require("pg");
const { DATABASE_URL, DB_POOL_MAX } = require("./env");
const { buildDbConfig } = require("./dbConfig");

const { info, ...config } = buildDbConfig(DATABASE_URL, { max: DB_POOL_MAX });
const pool = new Pool(config);

pool.on("error", (err) => {
  // Supabase puede cerrar conexiones inactivas; el pool abre otra sola.
  console.error("⚠️  Error en una conexión del pool de PostgreSQL:", err.message);
});

module.exports = {
  // IMPORTANTE: siempre usar consultas parametrizadas ($1, $2...)
  // Nunca concatenar texto del usuario dentro del SQL -> evita SQL Injection.
  query: (text, params) => pool.query(text, params),
  pool,
  info,
};
