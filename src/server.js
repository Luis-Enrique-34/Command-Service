// Punto de entrada: verifica la base de datos y levanta el servidor.
const { PORT } = require("./config/env");
const app = require("./app");
const db = require("./config/db");
const { explicarErrorDb } = require("./utils/dbErrors");

(async () => {
  try {
    await db.query("SELECT 1");
    const destino = db.info.esSupabase ? "Supabase" : db.info.esLocal ? "PostgreSQL local" : "PostgreSQL";
    console.log(`✅ Conectado a ${destino} (${db.info.host})`);
  } catch (err) {
    console.error("❌ No se pudo conectar a la base de datos:", err.message);
    explicarErrorDb(err, db.info).forEach((l) => console.error("   " + l));
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Command Service corriendo en http://localhost:${PORT}`);
  });
})();
