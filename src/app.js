// =====================================================================
//  Configuración de la aplicación Express (capa de presentación HTTP).
//  Orden: seguridad → parsers → logs → API → frontend → 404 → errores.
// =====================================================================
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { IS_PROD } = require("./config/env");
const logger = require("./utils/logger");
const { apiLimiter } = require("./middleware/rateLimiters");
const authRoutes = require("./routes/auth.routes");
const apiRoutes = require("./routes/api.routes");

const app = express();
const PUBLIC_DIR = path.join(__dirname, "..", "public");

app.disable("x-powered-by");
// Detrás de un proxy (Render, Railway, Nginx) permite ver la IP real del usuario.
if (IS_PROD) app.set("trust proxy", 1);

// Helmet agrega cabeceras HTTP de seguridad (CSP, anti-clickjacking, etc.)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Fuentes e íconos se sirven desde public/vendor: no se depende de CDNs externos
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        // En desarrollo (http://localhost) no forzamos HTTPS
        upgradeInsecureRequests: IS_PROD ? [] : null,
      },
    },
  })
);

app.use(express.json({ limit: "10kb" })); // limita el tamaño del body
app.use(cookieParser());
app.use(logger.httpLogger);

// ---------- API ----------
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store"); // datos privados: que el navegador no los guarde
  next();
});
app.use("/api/auth", authRoutes);
app.use("/api", apiLimiter, apiRoutes);

// ---------- Frontend (archivos estáticos) ----------
app.get("/", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "landing.html")));
// El antiguo panel de prueba ahora es la aplicación completa
app.get(["/panel", "/panel.html"], (req, res) => res.redirect(301, "/app"));
app.use(express.static(PUBLIC_DIR, { extensions: ["html"], maxAge: IS_PROD ? "1h" : 0 })); // /login -> login.html

// ---------- 404 para rutas de API inexistentes ----------
app.use("/api", (req, res) => res.status(404).json({ ok: false, mensaje: "Ruta no encontrada" }));

// ---------- Manejador de errores central ----------
// Nunca se envía el detalle técnico al navegador (podría revelar información
// interna). Se registra en el log y se responde un mensaje genérico.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ ok: false, mensaje: "JSON mal formado" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ ok: false, mensaje: "La petición es demasiado grande" });
  }
  if (err.status && err.status < 500) {
    // Errores de negocio (HttpError): el mensaje es seguro para el usuario
    return res.status(err.status).json({ ok: false, mensaje: err.message, ...(err.errores && { errores: err.errores }) });
  }
  // Violaciones de restricciones de la BD que se escaparon de la validación
  if (err.code === "23503") return res.status(409).json({ ok: false, mensaje: "El registro está relacionado con otros datos" });
  if (err.code === "23514") return res.status(400).json({ ok: false, mensaje: "Algún dato no cumple las reglas" });
  if (err.code === "23505") return res.status(409).json({ ok: false, mensaje: "El registro ya existe" });

  logger.error("Error no controlado", { ruta: `${req.method} ${req.originalUrl}`, error: err.message, code: err.code });
  res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
});

module.exports = app;
