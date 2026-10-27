// =====================================================================
//  MIDDLEWARE de límite de peticiones — librería: express-rate-limit
//  Frena ataques de fuerza bruta (un script probando miles de contraseñas).
// =====================================================================
const rateLimit = require("express-rate-limit");
const { IS_PROD } = require("../config/env");

const mensaje = (texto) => ({ ok: false, mensaje: texto });
const comun = { standardHeaders: "draft-7", legacyHeaders: false };

// Login: 10 intentos cada 15 minutos por IP en producción.
// En desarrollo se permite más (50) para poder cambiar de cuenta demo durante
// pruebas y exposiciones; el bloqueo por cuenta (5 fallos) sigue activo siempre.
const loginLimiter = rateLimit({
  ...comun,
  windowMs: 15 * 60 * 1000,
  limit: IS_PROD ? 10 : 50,
  message: mensaje("Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos."),
});

// Registro: 5 cuentas por hora por IP (evita creación masiva de cuentas falsas)
const registroLimiter = rateLimit({
  ...comun,
  windowMs: 60 * 60 * 1000,
  limit: IS_PROD ? 5 : 20,
  message: mensaje("Demasiados registros desde esta conexión. Intenta más tarde."),
});

// Resto de la API: el panel hace varias peticiones por vista y el módulo Sistema
// consulta cada 5 s (180 peticiones en 15 min solo por eso). 1000 cada 15 min por
// IP deja margen para el uso normal y aun así frena scripts abusivos.
const apiLimiter = rateLimit({
  ...comun,
  windowMs: 15 * 60 * 1000,
  limit: IS_PROD ? 1000 : 5000,
  message: mensaje("Demasiadas peticiones. Espera unos minutos."),
});

module.exports = { loginLimiter, registroLimiter, apiLimiter };
