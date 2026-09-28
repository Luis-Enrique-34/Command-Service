// Configuración de la aplicación Express.
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { IS_PROD } = require("./config/env");
const authRoutes = require("./routes/auth.routes");

const app = express();
const PUBLIC_DIR = path.join(__dirname, "..", "public");

// Si despliegas detrás de un proxy (Render, Railway, Nginx) esto permite
// que el rate limiter vea la IP real del usuario.
if (IS_PROD) app.set("trust proxy", 1);

// Helmet agrega cabeceras HTTP de seguridad (CSP, anti-clickjacking, etc.)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        // En desarrollo (http://localhost) no forzamos HTTPS
        upgradeInsecureRequests: IS_PROD ? [] : null,
      },
    },
  })
);

app.use(express.json({ limit: "10kb" })); // limita el tamaño del body
app.use(cookieParser());

// ---------- API ----------
app.use("/api/auth", authRoutes);

// ---------- Frontend (archivos estáticos) ----------
app.get("/", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "landing.html")));
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] })); // /login -> login.html

// ---------- 404 para rutas de API inexistentes ----------
app.use("/api", (req, res) => res.status(404).json({ ok: false, mensaje: "Ruta no encontrada" }));

// ---------- Manejador de errores central ----------
// Nunca enviamos el detalle técnico del error al navegador (podría revelar
// información interna). Se registra en consola y se responde un mensaje genérico.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ ok: false, mensaje: "JSON mal formado" });
  }
  console.error("💥 Error:", err);
  res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
});

module.exports = app;
