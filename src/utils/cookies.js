// Configuración de la cookie donde viaja el token de sesión.
const { IS_PROD } = require("../config/env");

const COOKIE_NAME = "cs_session";

const cookieOptions = {
  httpOnly: true,     // JavaScript del navegador NO puede leerla -> protege contra robo por XSS
  secure: IS_PROD,    // En producción solo viaja por HTTPS
  sameSite: "strict", // No se envía desde otros sitios -> protege contra CSRF
  path: "/",
  maxAge: 2 * 60 * 60 * 1000, // 2 horas (igual que JWT_EXPIRES_IN)
};

module.exports = { COOKIE_NAME, cookieOptions };
