// =====================================================================
//  Controlador de autenticación: registro, login, logout y "¿quién soy?".
//  No contiene SQL: usa usuario.dao (patrón DAO). Express 5 envía al
//  manejador central cualquier error lanzado en una función async.
// =====================================================================
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const usuarioDao = require("../dao/usuario.dao");
const auditoria = require("../dao/auditoria.dao");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/env");
const { COOKIE_NAME, cookieOptions } = require("../utils/cookies");
const { ipDe } = require("../utils/http");

// Parámetros de Argon2id recomendados por OWASP (19 MiB de memoria, 2 iteraciones).
const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

// Bloqueo temporal de la cuenta tras varios fallos seguidos
const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

// Hash "de mentira" para comparar cuando el correo no existe. Así el login
// tarda lo mismo exista o no el usuario (evita enumerar correos por tiempo).
const hashFicticio = argon2.hash("contraseña-ficticia-para-igualar-tiempos", ARGON_OPTS);

/** Datos públicos del usuario (NUNCA devolver password_hash al frontend). */
const usuarioPublico = (u) => ({
  id: u.id,
  nombres: u.nombres,
  apellidos: u.apellidos,
  email: u.email,
  telefono: u.telefono ?? null,
  rol: u.rol,
  ...(u.rol === "proveedor" && {
    perfil: {
      nombre_comercial: u.nombre_comercial ?? null,
      documento: u.documento ?? null,
      descripcion: u.descripcion ?? null,
      distrito: u.distrito ?? null,
      verificacion: u.verificacion ?? "pendiente",
      motivo_rechazo: u.motivo_rechazo ?? null,
    },
  }),
});

function emitirSesion(res, usuario) {
  const token = jwt.sign({ sub: usuario.id, rol: usuario.rol }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: JWT_EXPIRES_IN,
  });
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

// ---------------------------------------------------------------- REGISTRO
async function registrar(req, res) {
  const { nombres, apellidos, email, telefono, password, rol } = req.body;
  const passwordHash = await argon2.hash(password, ARGON_OPTS);

  let usuario;
  try {
    usuario = await usuarioDao.crear({ nombres, apellidos, email, telefono, passwordHash, rol });
  } catch (err) {
    // 23505 = violación de UNIQUE en PostgreSQL -> el correo ya existe
    if (err.code === "23505") {
      return res.status(409).json({
        ok: false,
        mensaje: "No se pudo crear la cuenta",
        errores: { email: "Este correo ya está registrado" },
      });
    }
    throw err;
  }

  emitirSesion(res, usuario); // queda logueado automáticamente tras registrarse
  await auditoria.registrar({ usuarioId: usuario.id, accion: "REGISTRO", entidad: "usuarios", entidadId: usuario.id, ip: ipDe(req), detalle: { rol } });
  return res.status(201).json({ ok: true, mensaje: "Cuenta creada con éxito", usuario: usuarioPublico(usuario) });
}

// ------------------------------------------------------------------- LOGIN
async function login(req, res) {
  const ERROR_GENERICO = "Correo o contraseña incorrectos";
  const { email, password } = req.body;
  const ip = ipDe(req);
  const usuario = await usuarioDao.buscarParaLogin(email);

  // Si el usuario no existe, igual verificamos contra un hash ficticio
  if (!usuario) {
    await argon2.verify(await hashFicticio, password).catch(() => {});
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
    await usuarioDao.registrarFallo(usuario.id, intentos, bloquear, MINUTOS_BLOQUEO);
    await auditoria.registrar({ usuarioId: usuario.id, accion: bloquear ? "CUENTA_BLOQUEADA" : "LOGIN_FALLIDO", entidad: "usuarios", entidadId: usuario.id, ip, detalle: { intentos } });
    return res.status(401).json({ ok: false, mensaje: ERROR_GENERICO });
  }

  if (!usuario.activo) {
    return res.status(403).json({ ok: false, mensaje: "Tu cuenta está desactivada. Contacta a soporte." });
  }

  await usuarioDao.registrarLoginExitoso(usuario.id);

  // Si en el futuro se suben los parámetros de Argon2, se re-hashea al vuelo
  if (argon2.needsRehash(usuario.password_hash, ARGON_OPTS)) {
    await usuarioDao.actualizarHash(usuario.id, await argon2.hash(password, ARGON_OPTS));
  }

  emitirSesion(res, usuario);
  await auditoria.registrar({ usuarioId: usuario.id, accion: "LOGIN", entidad: "usuarios", entidadId: usuario.id, ip });
  return res.json({ ok: true, mensaje: "Bienvenido de nuevo", usuario: usuarioPublico(usuario) });
}

// ------------------------------------------------------------------ LOGOUT
function logout(req, res) {
  const { maxAge, ...opts } = cookieOptions;
  res.clearCookie(COOKIE_NAME, opts);
  return res.json({ ok: true, mensaje: "Sesión cerrada" });
}

// -------------------------------------------------------------- ¿QUIÉN SOY?
async function me(req, res) {
  const usuario = await usuarioDao.buscarPorId(req.usuario.id);
  if (!usuario) return res.status(401).json({ ok: false, mensaje: "Sesión inválida" });
  return res.json({ ok: true, usuario: usuarioPublico(usuario) });
}

module.exports = { registrar, login, logout, me, usuarioPublico };
