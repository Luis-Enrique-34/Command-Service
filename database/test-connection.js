// =====================================================================
//  Prueba rápida de conexión:  npm run db:test
//  Útil para verificar tu DATABASE_URL de Supabase antes de todo lo demás.
// =====================================================================
require("dotenv").config({ quiet: true });
const { Client } = require("pg");
const { buildDbConfig } = require("../src/config/dbConfig");
const { explicarErrorDb } = require("../src/utils/dbErrors");

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error("❌ Falta DATABASE_URL en el archivo .env");
    process.exit(1);
  }
  const { info, ...config } = buildDbConfig(process.env.DATABASE_URL);
  console.log("🔌 Probando conexión...");
  console.log(`   Host:     ${info.host}`);
  console.log(`   Puerto:   ${info.port}`);
  console.log(`   Base:     ${info.database}`);
  console.log(`   Usuario:  ${info.user}`);
  console.log(`   SSL:      ${info.esLocal ? "no (local)" : info.sslVerificado ? "sí, con certificado verificado" : "sí, cifrado"}`);

  const client = new Client(config);
  const inicio = Date.now();
  try {
    await client.connect();
    const { rows } = await client.query("SELECT version(), current_user, now()");
    console.log(`\n✅ ¡Conexión exitosa! (${Date.now() - inicio} ms)`);
    console.log(`   ${rows[0].version.split(",")[0]}`);
    console.log(`   Conectado como: ${rows[0].current_user}`);
    const { rows: t } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1"
    );
    console.log(`   Tablas en public: ${t.length ? t.map((x) => x.table_name).join(", ") : "(ninguna aún → ejecuta npm run db:init)"}`);
  } catch (err) {
    console.error(`\n❌ Falló la conexión: ${err.message}`);
    explicarErrorDb(err, info).forEach((l) => console.error("   " + l));
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
