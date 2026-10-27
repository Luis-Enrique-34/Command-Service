// =====================================================================
//  SERVICIO de autenticación: registro, login y sesión.
//  Librerías: argon2 (hash de contraseñas) · jsonwebtoken (sesión).
//  No conoce HTTP (no usa req/res) ni SQL: usa los DAO que recibe.
// =====================================================================
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const { ARGON2_OPTIONS, JWT_OPTIONS, JWT_VERIFY_OPTIONS, LOGIN_POLICY } = require("../config/security");
const { Usuario } = require("../models/Usuario");
const { HttpError } = require("../utils/HttpError");

const ERROR_GENERICO = "Correo o contraseña incorrectos";

class AuthService {
  /** Hash ficticio: si el correo no existe se compara igual, para que el login tarde lo mismo. */
  #hashFicticio;

  /** @param {{usuarioDAO: import('../dao/UsuarioDAO'), auditoriaDAO: import('../dao/AuditoriaDAO')}} daos */
  constructor({ usuarioDAO, auditoriaDAO }) {
    this.usuarios = usuarioDAO;
    this.auditoria = auditoriaDAO;
  }

  /** Crea la cuenta con la contraseña cifrada con Argon2id. */
  async registrar({ nombres, apellidos, email, telefono, password, rol }, ip) {
    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
    let fila;
    try {
      fila = await this.usuarios.crear({ nombres, apellidos, email, telefono, passwordHash, rol });
    } catch (err) {
      if (err.code === "23505") {
        // 23505 = violación de UNIQUE en PostgreSQL → el correo ya existe
        throw new HttpError(409, "No se pudo crear la cuenta", { email: "Este correo ya está registrado" });
      }
      throw err;
    }
    await this.auditoria.registrar({ usuarioId: fila.id, accion: "REGISTRO", entidad: "usuarios", entidadId: fila.id, ip, detalle: { rol } });
    return Usuario.desde(fila);
  }

  /** Verifica credenciales, aplica el bloqueo por intentos y devuelve el usuario. */
  async login({ email, password }, ip) {
    const fila = await this.usuarios.buscarParaLogin(email);

    if (!fila) {
      this.#hashFicticio ??= argon2.hash("contraseña-ficticia-igualar-tiempos", ARGON2_OPTIONS);
      await argon2.verify(await this.#hashFicticio, password).catch(() => {});
      throw new HttpError(401, ERROR_GENERICO);
    }

    if (fila.bloqueado_hasta && new Date(fila.bloqueado_hasta) > new Date()) {
      const minutos = LOGIN_POLICY.minutosBloqueo;
      throw new HttpError(423, `Cuenta bloqueada temporalmente por varios intentos fallidos. Intenta en ${minutos} minutos.`);
    }

    if (!(await argon2.verify(fila.password_hash, password))) {
      const intentos = fila.intentos_fallidos + 1;
      const bloquear = intentos >= LOGIN_POLICY.maxIntentos;
      await this.usuarios.registrarFallo(fila.id, intentos, bloquear, LOGIN_POLICY.minutosBloqueo);
      await this.auditoria.registrar({
        usuarioId: fila.id, accion: bloquear ? "CUENTA_BLOQUEADA" : "LOGIN_FALLIDO",
        entidad: "usuarios", entidadId: fila.id, ip, detalle: { intentos },
      });
      throw new HttpError(401, ERROR_GENERICO);
    }

    if (!fila.activo) throw new HttpError(403, "Tu cuenta está desactivada. Contacta a soporte.");

    await this.usuarios.registrarLoginExitoso(fila.id);
    // Si en el futuro se suben los parámetros de Argon2, se vuelve a cifrar al vuelo
    if (argon2.needsRehash(fila.password_hash, ARGON2_OPTIONS)) {
      await this.usuarios.actualizarHash(fila.id, await argon2.hash(password, ARGON2_OPTIONS));
    }
    await this.auditoria.registrar({ usuarioId: fila.id, accion: "LOGIN", entidad: "usuarios", entidadId: fila.id, ip });
    return Usuario.desde(fila); // el modelo descarta password_hash
  }

  /** Usuario de la sesión actual, o null si ya no existe o fue desactivado. */
  async usuarioActual(id) {
    const fila = await this.usuarios.buscarPorId(id);
    return fila ? Usuario.desde(fila) : null;
  }

  /** Firma el token de sesión (JWT HS256, expira en 2 h). */
  emitirToken(usuario) {
    return jwt.sign({ sub: usuario.id, rol: usuario.rol }, JWT_SECRET, JWT_OPTIONS);
  }

  /** Verifica firma y expiración del token. @returns {{id:string, rol:string}} */
  verificarToken(token) {
    const payload = jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS);
    return { id: payload.sub, rol: payload.rol };
  }
}

module.exports = AuthService;
