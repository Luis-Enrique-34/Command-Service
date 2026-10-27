// =====================================================================
//  Enrutador principal de la API: monta los grupos de rutas.
//    /api/auth/...  → autenticación (pública, con límite de intentos)
//    /api/...       → negocio (exige sesión; límite general por IP)
// =====================================================================
const { Router } = require("express");
const { apiLimiter } = require("../middlewares/rateLimit.middleware");
const authRoutes = require("./auth.routes");
const apiRoutes = require("./api.routes");

const router = Router();

router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store"); // datos privados: el navegador no los guarda
  next();
});
router.use("/auth", authRoutes);
router.use("/", apiLimiter, apiRoutes);
router.use((req, res) => res.status(404).json({ ok: false, mensaje: "Ruta no encontrada" }));

module.exports = router;
