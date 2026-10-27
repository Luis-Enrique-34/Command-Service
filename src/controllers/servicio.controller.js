// =====================================================================
//  CONTROLADOR del catálogo, categorías y "Mis servicios" (proveedor).
// =====================================================================
const { servicioService } = require("../services");
const { ipDe } = require("../utils/HttpError");

async function categorias(req, res) {
  res.json({ ok: true, categorias: await servicioService.categorias() });
}

async function catalogo(req, res) {
  res.json({ ok: true, servicios: await servicioService.catalogo(req.datos) });
}

async function detalle(req, res) {
  res.json({ ok: true, servicio: await servicioService.detalle(req.params.id, req.usuario) });
}

async function misServicios(req, res) {
  res.json({ ok: true, servicios: await servicioService.deProveedor(req.usuario) });
}

async function crear(req, res) {
  const servicio = await servicioService.crear(req.usuario, req.body, ipDe(req));
  res.status(201).json({ ok: true, mensaje: "Servicio publicado", servicio });
}

async function actualizar(req, res) {
  const servicio = await servicioService.actualizar(req.usuario, req.params.id, req.body);
  res.json({ ok: true, mensaje: "Servicio actualizado", servicio });
}

async function cambiarEstado(req, res) {
  await servicioService.cambiarEstado(req.usuario, req.params.id, req.body.activo);
  res.json({ ok: true, mensaje: req.body.activo ? "Servicio activado" : "Servicio desactivado" });
}

module.exports = { categorias, catalogo, detalle, misServicios, crear, actualizar, cambiarEstado };
