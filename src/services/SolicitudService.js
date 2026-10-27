// =====================================================================
//  SERVICIO de solicitudes: reglas de negocio del flujo de contratación.
//  · Las reglas de estados viven en el modelo Solicitud (TRANSICIONES).
//  · Este servicio coordina: valida con el modelo, guarda con el DAO y
//    registra la auditoría. No conoce HTTP ni escribe SQL.
//  · Recibe los DAO por constructor (principio D de SOLID): en las pruebas
//    unitarias se le pasan DAO simulados, sin base de datos.
// =====================================================================
const crypto = require("crypto");
const { Solicitud } = require("../models/Solicitud");
const { HttpError, noEncontrado, conflicto } = require("../utils/HttpError");

class SolicitudService {
  /** @param {{solicitudDAO:object, servicioDAO:object, auditoriaDAO:object}} daos */
  constructor({ solicitudDAO, servicioDAO, auditoriaDAO }) {
    this.solicitudes = solicitudDAO;
    this.servicios = servicioDAO;
    this.auditoria = auditoriaDAO;
  }

  /** Lista con el alcance del rol + resumen por estado. */
  async listar(usuario, filtros = {}) {
    const alcance = { usuarioId: usuario.id, rol: usuario.rol };
    const [solicitudes, resumen] = await Promise.all([
      this.solicitudes.listar({ ...alcance, ...filtros }),
      this.solicitudes.resumenPorEstado(alcance),
    ]);
    return { solicitudes, resumen };
  }

  agenda(usuario) {
    return this.solicitudes.agenda(usuario.id);
  }

  /** Busca la solicitud y comprueba que el usuario pueda verla (si no, 404: no revela que existe). */
  async #cargar(id, usuario) {
    const fila = await this.solicitudes.buscarBase(id);
    const solicitud = fila && new Solicitud(fila);
    if (!solicitud || !solicitud.visiblePara(usuario)) throw noEncontrado("la solicitud");
    return solicitud;
  }

  async crear(usuario, datos, ip) {
    const servicio = await this.servicios.buscarPorId(datos.servicio_id);
    if (!servicio || !servicio.activo || servicio.verificacion !== "aprobado") throw noEncontrado("el servicio");
    if (servicio.proveedor_id === usuario.id) throw conflicto("No puedes solicitar tu propio servicio");

    const nueva = await this.solicitudes.crear({
      clienteId: usuario.id, servicio, descripcion: datos.descripcion,
      direccion: datos.direccion, fechaPreferida: datos.fecha_preferida,
    });
    await this.auditoria.registrar({ usuarioId: usuario.id, accion: "CREAR_SOLICITUD", entidad: "solicitudes", entidadId: nueva.id, ip,
      detalle: { codigo: nueva.codigo, servicio: servicio.titulo, monto: servicio.precio } });
    return nueva;
  }

  async obtenerDetalle(id, usuario) {
    const fila = await this.solicitudes.detalle(id);
    const solicitud = fila && new Solicitud(fila);
    if (!solicitud || !solicitud.visiblePara(usuario)) throw noEncontrado("la solicitud");
    return { ...fila, acciones: solicitud.accionesPara(usuario) };
  }

  /**
   * Ejecuta una acción de la máquina de estados (aceptar, pagar, agendar...).
   * @param {string} id solicitud
   * @param {{id:string, rol:string}} usuario
   * @param {{accion:string, motivo?:string, metodo?:string, fecha_programada?:string}} datos
   */
  async ejecutarAccion(id, usuario, datos, ip) {
    const solicitud = await this.#cargar(id, usuario);
    const t = solicitud.validarAccion(datos.accion, usuario); // lanza 400/403/409 si no procede

    const campos = {};
    let pago;
    if (t.requiere?.includes("motivo")) campos.motivo = datos.motivo;
    if (datos.accion === "agendar") {
      if (new Date(datos.fecha_programada) <= new Date()) {
        throw new HttpError(400, "Revisa los datos",
          { fecha_programada: "La fecha debe ser futura" });
      }
      campos.fecha_programada = datos.fecha_programada;
    }
    if (datos.accion === "pagar") {
      const referencia = `OP-${crypto.randomInt(100000, 999999)}`;
      pago = { crear: { monto: solicitud.monto, metodo: datos.metodo, referencia } };
    }
    if (datos.accion === "completar") pago = { estado: "liberado" };
    if (datos.accion === "cancelar" && solicitud.pago_estado === "retenido") {
      pago = { estado: "reembolsado" }; // se devuelve el dinero en custodia
    }

    const comentario = campos.motivo || (datos.accion === "pagar" ? `Pago con ${datos.metodo} (custodia)` : "");
    const ok = await this.solicitudes.cambiarEstado({
      id, usuarioId: usuario.id, estadoActual: solicitud.estado, estadoNuevo: t.hacia, campos, pago, comentario,
    });
    if (!ok) throw conflicto("La solicitud cambió mientras tanto. Actualiza la página.");

    await this.auditoria.registrar({
      usuarioId: usuario.id, accion: datos.accion === "pagar" ? "PAGO_CUSTODIA" : "CAMBIO_ESTADO",
      entidad: "solicitudes", entidadId: id, ip,
      detalle: { codigo: solicitud.codigo, de: solicitud.estado, a: t.hacia, ...(pago?.estado && { pago: pago.estado }) },
    });

    return this.obtenerDetalle(id, usuario);
  }

  async enviarMensaje(id, usuario, contenido) {
    const solicitud = await this.#cargar(id, usuario);
    if (usuario.rol === "admin") throw noEncontrado("la solicitud");
    if (solicitud.esFinal && solicitud.estado !== "completada") throw conflicto("La solicitud está cerrada");
    return this.solicitudes.agregarMensaje(id, usuario.id, contenido);
  }

  async calificar(id, usuario, { puntaje, comentario }, ip) {
    const fila = await this.solicitudes.buscarBase(id);
    if (!fila || fila.cliente_id !== usuario.id) throw noEncontrado("la solicitud");
    if (fila.estado !== "completada") throw conflicto("Solo puedes calificar servicios completados");
    try {
      await this.solicitudes.crearResena({ solicitudId: id, clienteId: usuario.id, proveedorId: fila.proveedor_id, puntaje, comentario });
    } catch (err) {
      if (err.code === "23505") throw conflicto("Ya calificaste esta solicitud"); // UNIQUE(solicitud_id)
      throw err;
    }
    await this.auditoria.registrar({ usuarioId: usuario.id, accion: "RESENA", entidad: "solicitudes", entidadId: id, ip, detalle: { puntaje } });
  }
}

module.exports = SolicitudService;
