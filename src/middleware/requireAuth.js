// Middleware que protege rutas: solo deja pasar si hay un token válido.
// Uso:  router.get("/ruta-privada", requireAuth, controlador)
//       router.post("/servicios", requireAuth, requireRol("proveedor"), ...)
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const { COOKIE_NAME } = require("../utils/cookies");

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ ok: false, mensaje: "No has iniciado sesión" });
  }

  try {
    // verify() comprueba la firma y la fecha de expiración.
    // Fijamos el algoritmo para evitar ataques de "algorithm confusion".
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    req.usuario = { id: payload.sub, rol: payload.rol };
    next();
  } catch {
    return res.status(401).json({ ok: false, mensaje: "Sesión inválida o expirada" });
  }
}

// Autorización por rol (ej.: solo proveedores pueden publicar servicios)
const requireRol = (...roles) => (req, res, next) => {
  if (!roles.includes(req.usuario?.rol)) {
    return res.status(403).json({ ok: false, mensaje: "No tienes permiso para esta acción" });
  }
  next();
};

module.exports = { requireAuth, requireRol };
