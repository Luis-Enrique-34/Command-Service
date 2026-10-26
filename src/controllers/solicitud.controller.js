// Controlador de solicitudes: traduce HTTP ↔ capa de servicio.
const solicitudDao = require("../dao/solicitud.dao");
const solicitudService = require("../services/solicitud.service");
const { ipDe } = require("../utils/http");

async function listar(req, res) {
  const filtro = { usuarioId: req.usuario.id, rol: req.usuario.rol };
  const [solicitudes, resumen] = await Promise.all([
    solicitudDao.listar({ ...filtro, ...req.datos }),
    solicitudDao.resumenPorEstado(filtro),
  ]);
  res.json({ ok: true, solicitudes, resumen });
}

async function detalle(req, res) {
  res.json({ ok: true, solicitud: await solicitudService.obtenerDetalle(req.params.id, req.usuario) });
}

async function crear(req, res) {
  const nueva = await solicitudService.crear(req.usuario, req.body, ipDe(req));
  res.status(201).json({ ok: true, mensaje: `Solicitud ${nueva.codigo} enviada al proveedor`, solicitud: nueva });
}

async function accion(req, res) {
  const solicitud = await solicitudService.ejecutarAccion(req.params.id, req.usuario, req.body, ipDe(req));
  res.json({ ok: true, mensaje: "Solicitud actualizada", solicitud });
}

async function mensaje(req, res) {
  const m = await solicitudService.enviarMensaje(req.params.id, req.usuario, req.body.contenido);
  res.status(201).json({ ok: true, mensaje: m });
}

async function resena(req, res) {
  await solicitudService.calificar(req.params.id, req.usuario, req.body, ipDe(req));
  res.status(201).json({ ok: true, mensaje: "¡Gracias por tu calificación!" });
}

async function agenda(req, res) {
  res.json({ ok: true, agenda: await solicitudDao.agenda(req.usuario.id) });
}

module.exports = { listar, detalle, crear, accion, mensaje, resena, agenda };
