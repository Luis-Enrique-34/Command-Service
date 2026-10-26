// Utilidades HTTP compartidas por los controladores.

/** Error de negocio con código HTTP. El manejador central lo convierte en JSON. */
class HttpError extends Error {
  /**
   * @param {number} status código HTTP (400, 403, 404, 409...)
   * @param {string} mensaje texto seguro para mostrar al usuario
   * @param {Record<string,string>} [errores] errores por campo
   */
  constructor(status, mensaje, errores) {
    super(mensaje);
    this.status = status;
    this.errores = errores;
  }
}

/** noEncontrado("la solicitud") -> "No se encontró la solicitud" */
const noEncontrado = (que = "el recurso") => new HttpError(404, `No se encontró ${que}`);
const prohibido = (msg = "No tienes permiso para esta acción") => new HttpError(403, msg);
const conflicto = (msg) => new HttpError(409, msg);

/** IP del cliente (respeta "trust proxy" en producción). */
const ipDe = (req) => (req.ip || "").replace(/^::ffff:/, "").slice(0, 45);

module.exports = { HttpError, noEncontrado, prohibido, conflicto, ipDe };
