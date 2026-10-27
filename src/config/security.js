// =====================================================================
//  CONFIGURACIÓN DE SEGURIDAD (un solo lugar para todos los parámetros)
//  Librerías: helmet · argon2 · jsonwebtoken · cookie-parser
//  Cambiar una política de seguridad = cambiar este archivo, nada más.
// =====================================================================
const argon2 = require("argon2");
const { IS_PROD, JWT_EXPIRES_IN } = require("./env");

/** helmet: cabeceras HTTP de seguridad. La CSP solo permite recursos propios. */
const HELMET_OPTIONS = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],          // fuentes locales (public/assets/vendor)
      imgSrc: ["'self'", "data:"],
      scriptSrc: ["'self'"],        // sin scripts de terceros → mitiga XSS
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],   // anti-clickjacking
      formAction: ["'self'"],
      upgradeInsecureRequests: IS_PROD ? [] : null, // en localhost no se fuerza HTTPS
    },
  },
};

/** argon2: parámetros recomendados por OWASP (19 MiB, 2 iteraciones, 1 hilo). */
const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

/** jsonwebtoken: algoritmo fijado (evita "algorithm confusion") y expiración. */
const JWT_OPTIONS = { algorithm: "HS256", expiresIn: JWT_EXPIRES_IN };
const JWT_VERIFY_OPTIONS = { algorithms: ["HS256"] };

/** cookie-parser: la sesión viaja en una cookie que JavaScript no puede leer. */
const COOKIE_NAME = "cs_session";
const COOKIE_OPTIONS = {
  httpOnly: true,      // inaccesible desde JavaScript → protege contra robo por XSS
  secure: IS_PROD,     // en producción solo por HTTPS
  sameSite: "strict",  // no se envía desde otros sitios → protege contra CSRF
  path: "/",
  maxAge: 2 * 60 * 60 * 1000, // 2 horas (igual que el JWT)
};

/** Bloqueo temporal de cuenta tras fallos de contraseña consecutivos. */
const LOGIN_POLICY = { maxIntentos: 5, minutosBloqueo: 15 };

module.exports = {
  HELMET_OPTIONS, ARGON2_OPTIONS, JWT_OPTIONS, JWT_VERIFY_OPTIONS,
  COOKIE_NAME, COOKIE_OPTIONS, LOGIN_POLICY,
};
