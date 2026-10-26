// Controlador de catálogo, categorías y "Mis servicios" (proveedor).
const servicioDao = require("../dao/servicio.dao");
const auditoria = require("../dao/auditoria.dao");
const { noEncontrado, ipDe } = require("../utils/http");

async function categorias(req, res) {
  res.json({ ok: true, categorias: await servicioDao.listarCategorias() });
}

async function catalogo(req, res) {
  res.json({ ok: true, servicios: await servicioDao.catalogo(req.datos) });
}

async function detalle(req, res) {
  const s = await servicioDao.buscarPorId(req.params.id);
  // Un cliente no puede ver servicios inactivos o de proveedores no verificados
  const visible = s && ((s.activo && s.verificacion === "aprobado") || s.proveedor_id === req.usuario.id || req.usuario.rol === "admin");
  if (!visible) throw noEncontrado("el servicio");
  res.json({ ok: true, servicio: s });
}

async function misServicios(req, res) {
  res.json({ ok: true, servicios: await servicioDao.listarDeProveedor(req.usuario.id) });
}

async function crear(req, res) {
  const id = await servicioDao.crear(req.usuario.id, req.body);
  await auditoria.registrar({ usuarioId: req.usuario.id, accion: "CREAR_SERVICIO", entidad: "servicios", entidadId: id, ip: ipDe(req), detalle: { titulo: req.body.titulo } });
  res.status(201).json({ ok: true, mensaje: "Servicio publicado", servicio: await servicioDao.buscarPorId(id) });
}

async function actualizar(req, res) {
  const ok = await servicioDao.actualizar(req.params.id, req.usuario.id, req.body);
  if (!ok) throw noEncontrado("el servicio");
  res.json({ ok: true, mensaje: "Servicio actualizado", servicio: await servicioDao.buscarPorId(req.params.id) });
}

async function cambiarEstado(req, res) {
  const ok = await servicioDao.cambiarEstado(req.params.id, req.usuario.id, req.body.activo);
  if (!ok) throw noEncontrado("el servicio");
  res.json({ ok: true, mensaje: req.body.activo ? "Servicio activado" : "Servicio desactivado" });
}

module.exports = { categorias, catalogo, detalle, misServicios, crear, actualizar, cambiarEstado };
