// Punto de entrada: verifica la base de datos y levanta el servidor.
const { PORT } = require("./config/env");
const app = require("./app");
const db = require("./config/db");
const logger = require("./utils/logger");
const { explicarErrorDb } = require("./utils/dbErrors");

(async () => {
  try {
    await db.query("SELECT 1");
    const destino = db.info.esSupabase ? "Supabase" : db.info.esLocal ? "PostgreSQL local" : "PostgreSQL";
    logger.info(`✅ Conectado a ${destino} (${db.info.host})`);

    // Aviso útil si falta aplicar el esquema v2 (npm run db:init)
    const { rows } = await db.query("SELECT to_regclass('public.solicitudes') AS t");
    if (!rows[0].t) logger.warn("⚠️  Faltan tablas del esquema v2. Ejecuta: npm run db:init  y luego  npm run db:seed");
  } catch (err) {
    logger.error(`❌ No se pudo conectar a la base de datos: ${err.message}`);
    explicarErrorDb(err, db.info).forEach((l) => console.error("   " + l));
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`🚀 Command Service corriendo en http://localhost:${PORT}`);
  });

  // Cierre ordenado (Ctrl+C o reinicio de nodemon): termina peticiones y cierra el pool
  const cerrar = (senal) => {
    logger.info(`Recibido ${senal}, cerrando...`);
    server.close(() => db.pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on("SIGINT", cerrar);
  process.on("SIGTERM", cerrar);
})();
