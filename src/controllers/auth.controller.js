// =====================================================================
//  CONTROLADOR de autenticación (la "C" de MVC).
//  Solo traduce HTTP ↔ servicio: lee la petición, llama a AuthService y
//  responde. La sesión se entrega en una cookie HttpOnly.
//  Express 5 envía al manejador central cualquier error de un async.
// =====================================================================
const { authService } = require("../services");
const { COOKIE_NAME, COOKIE_OPTIONS } = require("../config/security");
const { ipDe } = require("../utils/HttpError");

function iniciarSesion(res, usuario) {
  res.cookie(COOKIE_NAME, authService.emitirToken(usuario), COOKIE_OPTIONS);
}

/** POST /api/auth/registro */
async function registrar(req, res) {
  const usuario = await authService.registrar(req.body, ipDe(req));
  iniciarSesion(res, usuario); // queda con sesión iniciada tras registrarse
  res.status(201).json({ ok: true, mensaje: "Cuenta creada con éxito", usuario });
}

/** POST /api/auth/login */
async function login(req, res) {
  const usuario = await authService.login(req.body, ipDe(req));
  iniciarSesion(res, usuario);
  res.json({ ok: true, mensaje: "Bienvenido de nuevo", usuario });
}

/** POST /api/auth/logout */
function logout(req, res) {
  const { maxAge, ...opciones } = COOKIE_OPTIONS;
  res.clearCookie(COOKIE_NAME, opciones);
  res.json({ ok: true, mensaje: "Sesión cerrada" });
}

/** GET /api/auth/me */
async function me(req, res) {
  const usuario = await authService.usuarioActual(req.usuario.id);
  if (!usuario) return res.status(401).json({ ok: false, mensaje: "Sesión inválida" });
  res.json({ ok: true, usuario });
}

module.exports = { registrar, login, logout, me };
