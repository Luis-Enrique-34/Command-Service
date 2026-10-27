// =====================================================================
//  MIDDLEWARE de autenticación y autorización.
//  · requireAuth: deja pasar solo si la cookie trae un token válido.
//  · requireRol:  deja pasar solo a los roles indicados.
//  Uso: router.post("/mis-servicios", requireAuth, requireRol("proveedor"), ...)
// =====================================================================
const { COOKIE_NAME } = require("../config/security");
const { authService } = require("../services");

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ ok: false, mensaje: "No has iniciado sesión" });
  try {
    req.usuario = authService.verificarToken(token); // { id, rol }
    next();
  } catch {
    return res.status(401).json({ ok: false, mensaje: "Sesión inválida o expirada" });
  }
}

/** Fábrica de middlewares: requireRol("admin"), requireRol("cliente", "proveedor")... */
const requireRol = (...roles) => (req, res, next) => {
  if (!roles.includes(req.usuario?.rol)) {
    return res.status(403).json({ ok: false, mensaje: "No tienes permiso para esta acción" });
  }
  next();
};

module.exports = { requireAuth, requireRol };
