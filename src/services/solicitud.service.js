// =====================================================================
//  Reglas de negocio de las solicitudes (capa de servicio).
//  Aquí vive la MÁQUINA DE ESTADOS: qué acción puede hacer cada rol y
//  desde qué estado. El controlador solo traduce HTTP ↔ servicio y el DAO
//  solo habla con la BD (principio de responsabilidad única - SOLID).
// =====================================================================
const crypto = require("crypto");
const solicitudDao = require("../dao/solicitud.dao");
const servicioDao = require("../dao/servicio.dao");
const auditoria = require("../dao/auditoria.dao");
const { HttpError, noEncontrado, prohibido, conflicto } = require("../utils/http");

/**
 * Transiciones válidas. Agregar una acción nueva = agregar una entrada
 * (abierto a extensión, cerrado a modificación - SOLID "O").
 */
const TRANSICIONES = {
  aceptar:   { desde: ["por_confirmar"], hacia: "aceptada", roles: ["proveedor"], etiqueta: "Aceptar" },
  rechazar:  { desde: ["por_confirmar"], hacia: "rechazada", roles: ["proveedor"], etiqueta: "Rechazar", requiere: ["motivo"] },
  pagar:     { desde: ["aceptada"], hacia: "pago_confirmado", roles: ["cliente"], etiqueta: "Pagar", requiere: ["metodo"] },
  agendar:   { desde: ["pago_confirmado", "agendada"], hacia: "agendada", roles: ["proveedor"], etiqueta: "Agendar", requiere: ["fecha_programada"] },
  iniciar:   { desde: ["agendada"], hacia: "en_curso", roles: ["proveedor"], etiqueta: "Iniciar servicio" },
  completar: { desde: ["en_curso"], hacia: "completada", roles: ["cliente"], etiqueta: "Dar conformidad" },
  cancelar:  { desde: ["por_confirmar", "aceptada", "pago_confirmado", "agendada"], hacia: "cancelada",
               roles: ["cliente", "proveedor", "admin"], etiqueta: "Cancelar", requiere: ["motivo"] },
};

const ESTADOS_FINALES = ["completada", "rechazada", "cancelada"];

/** ¿El usuario participa en la solicitud (o es admin)? */
function puedeVer(solicitud, usuario) {
  return usuario.rol === "admin" || solicitud.cliente_id === usuario.id || solicitud.proveedor_id === usuario.id;
}

/** Acciones que este usuario puede ejecutar ahora sobre la solicitud. */
function accionesDisponibles(solicitud, usuario) {
  const esParte =
    usuario.rol === "admin" ||
    (usuario.rol === "cliente" && solicitud.cliente_id === usuario.id) ||
    (usuario.rol === "proveedor" && solicitud.proveedor_id === usuario.id);
  if (!esParte) return [];
  return Object.entries(TRANSICIONES)
    .filter(([, t]) => t.roles.includes(usuario.rol) && t.desde.includes(solicitud.estado))
    .map(([accion, t]) => ({ accion, etiqueta: t.etiqueta, requiere: t.requiere || [] }));
}

async function crear(usuario, datos, ip) {
  const servicio = await servicioDao.buscarPorId(datos.servicio_id);
  if (!servicio || !servicio.activo || servicio.verificacion !== "aprobado") throw noEncontrado("el servicio");
  if (servicio.proveedor_id === usuario.id) throw conflicto("No puedes solicitar tu propio servicio");

  const nueva = await solicitudDao.crear({
    clienteId: usuario.id,
    servicio,
    descripcion: datos.descripcion,
    direccion: datos.direccion,
    fechaPreferida: datos.fecha_preferida,
  });
  await auditoria.registrar({ usuarioId: usuario.id, accion: "CREAR_SOLICITUD", entidad: "solicitudes", entidadId: nueva.id, ip,
    detalle: { codigo: nueva.codigo, servicio: servicio.titulo, monto: servicio.precio } });
  return nueva;
}

async function obtenerDetalle(id, usuario) {
  const d = await solicitudDao.detalle(id);
  if (!d || !puedeVer(d, usuario)) throw noEncontrado("la solicitud"); // 404 también si no es suya (no revela que existe)
  return { ...d, acciones: accionesDisponibles(d, usuario) };
}

/**
 * Ejecuta una acción de la máquina de estados.
 * @param {string} id
 * @param {{id:string, rol:string}} usuario
 * @param {{accion:string, motivo?:string, metodo?:string, fecha_programada?:string}} datos
 */
async function ejecutarAccion(id, usuario, datos, ip) {
  const t = TRANSICIONES[datos.accion];
  if (!t) throw new HttpError(400, "Acción no válida");

  const s = await solicitudDao.buscarBase(id);
  if (!s || !puedeVer(s, usuario)) throw noEncontrado("la solicitud");
  if (!accionesDisponibles(s, usuario).some((a) => a.accion === datos.accion)) {
    if (ESTADOS_FINALES.includes(s.estado)) throw conflicto("La solicitud ya está cerrada");
    if (!t.roles.includes(usuario.rol)) throw prohibido(`Tu rol no puede ${t.etiqueta.toLowerCase()} esta solicitud`);
    throw conflicto(`No se puede ${t.etiqueta.toLowerCase()} una solicitud en estado "${s.estado.replace("_", " ")}"`);
  }

  const campos = {};
  let pago;
  if (t.requiere?.includes("motivo")) campos.motivo = datos.motivo;
  if (datos.accion === "agendar") {
    if (new Date(datos.fecha_programada) <= new Date()) {
      throw new HttpError(400, "Revisa los datos", { fecha_programada: "La fecha debe ser futura" });
    }
    campos.fecha_programada = datos.fecha_programada;
  }
  if (datos.accion === "pagar") {
    pago = { crear: { monto: s.monto, metodo: datos.metodo, referencia: `OP-${crypto.randomInt(100000, 999999)}` } };
  }
  if (datos.accion === "completar") pago = { estado: "liberado" };
  if (datos.accion === "cancelar" && s.pago_estado === "retenido") pago = { estado: "reembolsado" };

  const ok = await solicitudDao.cambiarEstado({
    id, usuarioId: usuario.id, estadoActual: s.estado, estadoNuevo: t.hacia, campos, pago,
    comentario: campos.motivo || (datos.accion === "pagar" ? `Pago con ${datos.metodo} (custodia)` : ""),
  });
  if (!ok) throw conflicto("La solicitud cambió mientras tanto. Actualiza la página.");

  await auditoria.registrar({ usuarioId: usuario.id, accion: datos.accion === "pagar" ? "PAGO_CUSTODIA" : "CAMBIO_ESTADO",
    entidad: "solicitudes", entidadId: id, ip, detalle: { codigo: s.codigo, de: s.estado, a: t.hacia, ...(pago?.estado && { pago: pago.estado }) } });

  return obtenerDetalle(id, usuario);
}

async function enviarMensaje(id, usuario, contenido) {
  const s = await solicitudDao.buscarBase(id);
  if (!s || !puedeVer(s, usuario) || usuario.rol === "admin") throw noEncontrado("la solicitud");
  if (ESTADOS_FINALES.includes(s.estado) && s.estado !== "completada") throw conflicto("La solicitud está cerrada");
  return solicitudDao.agregarMensaje(id, usuario.id, contenido);
}

async function calificar(id, usuario, { puntaje, comentario }, ip) {
  const s = await solicitudDao.buscarBase(id);
  if (!s || s.cliente_id !== usuario.id) throw noEncontrado("la solicitud");
  if (s.estado !== "completada") throw conflicto("Solo puedes calificar servicios completados");
  try {
    await solicitudDao.crearResena({ solicitudId: id, clienteId: usuario.id, proveedorId: s.proveedor_id, puntaje, comentario });
  } catch (err) {
    if (err.code === "23505") throw conflicto("Ya calificaste esta solicitud"); // UNIQUE(solicitud_id)
    throw err;
  }
  await auditoria.registrar({ usuarioId: usuario.id, accion: "RESENA", entidad: "solicitudes", entidadId: id, ip, detalle: { puntaje } });
}

module.exports = { TRANSICIONES, accionesDisponibles, crear, obtenerDetalle, ejecutarAccion, enviarMensaje, calificar };
