// =====================================================================
//  APLICACIÓN EXPRESS: arma la cadena por la que pasa cada petición.
//    1. Seguridad (helmet)          4. API REST (/api → routes/)
//    2. Lectura de JSON y cookies   5. Vistas (public/ → la "V" de MVC)
//    3. Registro de peticiones      6. Manejador central de errores
// =====================================================================
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { IS_PROD } = require("./config/env");
const { HELMET_OPTIONS } = require("./config/security");
const logger = require("./utils/logger");
const { HttpError } = require("./utils/HttpError");
const apiRouter = require("./routes");

const app = express();
const PUBLIC_DIR = path.join(__dirname, "..", "public");

app.disable("x-powered-by");
if (IS_PROD) app.set("trust proxy", 1); // detrás de un proxy, permite ver la IP real

// 1-3 ---------- middlewares globales
app.use(helmet(HELMET_OPTIONS));
app.use(express.json({ limit: "10kb" })); // limita el tamaño del body
app.use(cookieParser());
app.use(logger.httpLogger);

// 4 ---------- API REST
app.use("/api", apiRouter);

// 5 ---------- Vistas (archivos estáticos)
app.get("/", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "landing.html")));
app.get(["/panel", "/panel.html"], (req, res) => res.redirect(301, "/app")); // el panel de prueba ahora es la app
app.use(express.static(PUBLIC_DIR, { extensions: ["html"], maxAge: IS_PROD ? "1h" : 0 })); // /login → login.html

// 6 ---------- Manejador central de errores
// Nunca se envía el detalle técnico al navegador: se registra en el log y
// se responde un mensaje genérico. Los HttpError sí llevan un mensaje seguro.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ ok: false, mensaje: "JSON mal formado" });
  if (err.type === "entity.too.large") return res.status(413).json({ ok: false, mensaje: "La petición es demasiado grande" });

  if (err instanceof HttpError) {
    return res.status(err.status).json({ ok: false, mensaje: err.message, ...(err.errores && { errores: err.errores }) });
  }
  // Restricciones de la BD que se escaparon de la validación
  if (err.code === "23503") return res.status(409).json({ ok: false, mensaje: "El registro está relacionado con otros datos" });
  if (err.code === "23514") return res.status(400).json({ ok: false, mensaje: "Algún dato no cumple las reglas" });
  if (err.code === "23505") return res.status(409).json({ ok: false, mensaje: "El registro ya existe" });

  logger.error("Error no controlado", { ruta: `${req.method} ${req.originalUrl}`, error: err.message, code: err.code });
  res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
});

module.exports = app;
