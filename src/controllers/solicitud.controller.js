// =====================================================================
//  CONTROLADOR de solicitudes: traduce HTTP ↔ SolicitudService.
//  No contiene reglas de negocio ni SQL.
// =====================================================================
const { solicitudService } = require("../services");
const { ipDe } = require("../utils/HttpError");

/** GET /api/solicitudes */
async function listar(req, res) {
  res.json({ ok: true, ...(await solicitudService.listar(req.usuario, req.datos)) });
}

/** GET /api/solicitudes/:id */
async function detalle(req, res) {
  const solicitud = await solicitudService.obtenerDetalle(req.params.id, req.usuario);
  res.json({ ok: true, solicitud });
}

/** POST /api/solicitudes */
async function crear(req, res) {
  const nueva = await solicitudService.crear(req.usuario, req.body, ipDe(req));
  const mensaje = `Solicitud ${nueva.codigo} enviada al proveedor`;
  res.status(201).json({ ok: true, mensaje, solicitud: nueva });
}

/** PATCH /api/solicitudes/:id/estado  { accion: "aceptar" | "pagar" | ... } */
async function accion(req, res) {
  const { id } = req.params;
  const solicitud = await solicitudService.ejecutarAccion(id, req.usuario, req.body, ipDe(req));
  res.json({ ok: true, mensaje: "Solicitud actualizada", solicitud });
}

/** POST /api/solicitudes/:id/mensajes */
async function mensaje(req, res) {
  const m = await solicitudService.enviarMensaje(req.params.id, req.usuario, req.body.contenido);
  res.status(201).json({ ok: true, mensaje: m });
}

/** POST /api/solicitudes/:id/resena */
async function resena(req, res) {
  await solicitudService.calificar(req.params.id, req.usuario, req.body, ipDe(req));
  res.status(201).json({ ok: true, mensaje: "¡Gracias por tu calificación!" });
}

/** GET /api/agenda (proveedor) */
async function agenda(req, res) {
  res.json({ ok: true, agenda: await solicitudService.agenda(req.usuario) });
}

module.exports = { listar, detalle, crear, accion, mensaje, resena, agenda };
