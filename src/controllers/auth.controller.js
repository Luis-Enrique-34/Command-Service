// Lógica de registro, login, logout y "¿quién soy?".
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/env");
const { COOKIE_NAME, cookieOptions } = require("../utils/cookies");

// Parámetros de Argon2id recomendados por OWASP (19 MiB de memoria, 2 iteraciones).
// Argon2id es el algoritmo ganador de la Password Hashing Competition y la
// primera recomendación de OWASP para guardar contraseñas.
const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

// Bloqueo temporal de la cuenta tras varios fallos seguidos
const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

// Hash "de mentira" para comparar cuando el correo no existe. Así el login
// tarda lo mismo exista o no el usuario, y un atacante no puede averiguar
// qué correos están registrados midiendo el tiempo de respuesta.
let hashFicticio;
argon2.hash("contraseña-ficticia-para-igualar-tiempos", ARGON_OPTS).then((h) => (hashFicticio = h));

// Datos públicos del usuario (NUNCA devolver password_hash al frontend)
const usuarioPublico = (u) => ({
  id: u.id,
  nombres: u.nombres,
  apellidos: u.apellidos,
  email: u.email,
  rol: u.rol,
});

function emitirSesion(res, usuario) {
  const token = jwt.sign({ sub: usuario.id, rol: usuario.rol }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: JWT_EXPIRES_IN,
  });
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

// ---------------------------------------------------------------- REGISTRO
async function registrar(req, res, next) {
  try {
    const { nombres, apellidos, email, telefono, password, rol } = req.body;

    const passwordHash = await argon2.hash(password, ARGON_OPTS);

    const { rows } = await db.query(
      `INSERT INTO usuarios (nombres, apellidos, email, telefono, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombres, apellidos, email, rol`,
      [nombres, apellidos, email, telefono || null, passwordHash, rol]
    );

    const usuario = rows[0];
    emitirSesion(res, usuario); // queda logueado automáticamente tras registrarse
    return res.status(201).json({ ok: true, mensaje: "Cuenta creada con éxito", usuario: usuarioPublico(usuario) });
  } catch (err) {
    // 23505 = violación de UNIQUE en PostgreSQL -> el correo ya existe
    if (err.code === "23505") {
      return res.status(409).json({
        ok: false,
        mensaje: "No se pudo crear la cuenta",
        errores: { email: "Este correo ya está registrado" },
      });
    }
    next(err);
  }
}

// ------------------------------------------------------------------- LOGIN
async function login(req, res, next) {
  const ERROR_GENERICO = "Correo o contraseña incorrectos";
  try {
    const { email, password } = req.body;

    const { rows } = await db.query(
      `SELECT id, nombres, apellidos, email, rol, password_hash, activo,
              intentos_fallidos, bloqueado_hasta
         FROM usuarios WHERE email = $1`,
      [email]
    );
    const usuario = rows[0];

    // Si el usuario no existe, igual verificamos contra un hash ficticio
    if (!usuario) {
      await argon2.verify(hashFicticio, password).catch(() => {});
      return res.status(401).json({ ok: false, mensaje: ERROR_GENERICO });
    }

    if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
      return res.status(423).json({
        ok: false,
        mensaje: `Cuenta bloqueada temporalmente por varios intentos fallidos. Intenta en ${MINUTOS_BLOQUEO} minutos.`,
      });
    }

    const passwordOk = await argon2.verify(usuario.password_hash, password);

    if (!passwordOk) {
      const intentos = usuario.intentos_fallidos + 1;
      const bloquear = intentos >= MAX_INTENTOS;
      await db.query(
        `UPDATE usuarios
            SET intentos_fallidos = $2,
                bloqueado_hasta = CASE WHEN $3 THEN NOW() + ($4 || ' minutes')::interval ELSE NULL END
          WHERE id = $1`,
        [usuario.id, bloquear ? 0 : intentos, bloquear, String(MINUTOS_BLOQUEO)]
      );
      return res.status(401).json({ ok: false, mensaje: ERROR_GENERICO });
    }

    if (!usuario.activo) {
      return res.status(403).json({ ok: false, mensaje: "Tu cuenta está desactivada. Contacta a soporte." });
    }

    // Login correcto: reiniciar contador y registrar la fecha
    await db.query(
      `UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_login = NOW() WHERE id = $1`,
      [usuario.id]
    );

    // Si en el futuro subes los parámetros de Argon2, se re-hashea al vuelo
    if (argon2.needsRehash(usuario.password_hash, ARGON_OPTS)) {
      const nuevo = await argon2.hash(password, ARGON_OPTS);
      await db.query(`UPDATE usuarios SET password_hash = $2 WHERE id = $1`, [usuario.id, nuevo]);
    }

    emitirSesion(res, usuario);
    return res.json({ ok: true, mensaje: "Bienvenido de nuevo", usuario: usuarioPublico(usuario) });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------------ LOGOUT
function logout(req, res) {
  const { maxAge, ...opts } = cookieOptions;
  res.clearCookie(COOKIE_NAME, opts);
  return res.json({ ok: true, mensaje: "Sesión cerrada" });
}

// -------------------------------------------------------------- ¿QUIÉN SOY?
async function me(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT id, nombres, apellidos, email, rol FROM usuarios WHERE id = $1 AND activo = TRUE`,
      [req.usuario.id]
    );
    if (!rows[0]) return res.status(401).json({ ok: false, mensaje: "Sesión inválida" });
    return res.json({ ok: true, usuario: usuarioPublico(rows[0]) });
  } catch (err) {
    next(err);
  }
}

module.exports = { registrar, login, logout, me };
