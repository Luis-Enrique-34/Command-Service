// Limitadores de peticiones: frenan ataques de fuerza bruta
// (alguien probando miles de contraseñas con un script).
const rateLimit = require("express-rate-limit");

const mensaje = (texto) => ({ ok: false, mensaje: texto });

// Login: 10 intentos cada 15 minutos por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: mensaje("Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos."),
});

// Registro: 5 cuentas por hora por IP (evita creación masiva de cuentas falsas)
const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: mensaje("Demasiados registros desde esta conexión. Intenta más tarde."),
});

module.exports = { loginLimiter, registroLimiter };
