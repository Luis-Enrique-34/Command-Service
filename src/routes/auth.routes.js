// =====================================================================
//  RUTAS de autenticación (/api/auth/...).
//  Cada línea declara: método · ruta · middlewares en orden · controlador.
// =====================================================================
const { Router } = require("express");
const { validate } = require("../middlewares/validate.middleware");
const { requireAuth } = require("../middlewares/auth.middleware");
const { loginLimiter, registroLimiter } = require("../middlewares/rateLimit.middleware");
const { registroSchema, loginSchema } = require("../validators/auth.schemas");
const auth = require("../controllers/auth.controller");

const router = Router();

//     Método  Ruta                 Middlewares (en orden)                         Controlador
router.post("/registro", registroLimiter, validate(registroSchema), auth.registrar);
router.post("/login",    loginLimiter,    validate(loginSchema),    auth.login);
router.post("/logout",                                               auth.logout);
router.get ("/me",       requireAuth,                                auth.me);

module.exports = router;
