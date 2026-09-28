// Carga las variables del archivo .env y valida que existan las críticas.
// Si falta algo importante, la app NO arranca (mejor fallar temprano que
// correr en producción con una clave vacía).
require("dotenv").config({ quiet: true });

function fallar(...lineas) {
  lineas.forEach((l) => console.error(l));
  process.exit(1);
}

for (const nombre of ["DATABASE_URL", "JWT_SECRET"]) {
  if (!process.env[nombre]) {
    fallar(`❌ Falta la variable de entorno ${nombre}. Revisa tu archivo .env`);
  }
}

// Errores típicos al copiar la cadena de conexión desde Supabase
const dbUrl = process.env.DATABASE_URL;
if (/\[YOUR-PASSWORD\]|TU_CONTRASEÑA|TU-PASSWORD|\[PROJECT-REF\]/i.test(dbUrl)) {
  fallar(
    "❌ DATABASE_URL todavía tiene un texto de ejemplo ([YOUR-PASSWORD], TU_CONTRASEÑA...).",
    "   Reemplázalo por la contraseña real de tu base de datos de Supabase (sin corchetes)."
  );
}
try {
  new URL(dbUrl);
} catch {
  fallar(
    "❌ DATABASE_URL no es una URL válida.",
    "   Si tu contraseña tiene símbolos como @ # / : ? codifícalos (ej. @ → %40, # → %23)."
  );
}

if (process.env.JWT_SECRET.length < 32) {
  fallar(
    "❌ JWT_SECRET debe tener al menos 32 caracteres. Genera uno con:",
    "   node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
  );
}

module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
  IS_PROD: process.env.NODE_ENV === "production",
  DATABASE_URL: dbUrl,
  DB_POOL_MAX: Number(process.env.DB_POOL_MAX) || 5,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "2h",
};
