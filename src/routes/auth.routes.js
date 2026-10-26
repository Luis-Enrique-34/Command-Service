const { Router } = require("express");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/requireAuth");
const { loginLimiter, registroLimiter } = require("../middleware/rateLimiters");
const { registroSchema, loginSchema } = require("../validators/auth.schemas");
const auth = require("../controllers/auth.controller");

const router = Router();

//     Método  Ruta                 Middlewares (en orden)                         Controlador
router.post("/registro", registroLimiter, validate(registroSchema), auth.registrar);
router.post("/login",    loginLimiter,    validate(loginSchema),    auth.login);
router.post("/logout",                                               auth.logout);
router.get ("/me",       requireAuth,                                auth.me);

module.exports = router;
