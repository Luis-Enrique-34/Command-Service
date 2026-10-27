// =====================================================================
//  CONTROLADOR de administración: usuarios, verificación de proveedores,
//  reportes, exportación CSV y auditoría. Todas sus rutas exigen rol admin.
// =====================================================================
const { usuarioService, reporteService } = require("../services");
const { ipDe } = require("../utils/HttpError");

async function usuarios(req, res) {
  res.json({ ok: true, usuarios: await usuarioService.listar(req.datos) });
}

async function estadoUsuario(req, res) {
  await usuarioService.cambiarEstado(req.usuario, req.params.id, req.body.activo, ipDe(req));
  res.json({ ok: true, mensaje: req.body.activo ? "Usuario activado" : "Usuario desactivado" });
}

async function proveedores(req, res) {
  res.json({ ok: true, proveedores: await usuarioService.listarProveedores(req.datos) });
}

async function verificarProveedor(req, res) {
  await usuarioService.verificarProveedor(req.usuario, req.params.id, req.body, ipDe(req));
  res.json({ ok: true, mensaje: req.body.estado === "aprobado" ? "Proveedor verificado" : "Proveedor rechazado" });
}

async function reportes(req, res) {
  res.json({ ok: true, reportes: await reporteService.reportesAdmin() });
}

/** Descarga el CSV de solicitudes (se abre en Excel). */
async function exportarCsv(req, res) {
  const { nombre, contenido } = await reporteService.exportarSolicitudes(req.usuario, ipDe(req));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
  res.send(contenido);
}

async function auditoria(req, res) {
  res.json({ ok: true, ...(await reporteService.auditoriaReciente(req.datos)) });
}

module.exports = { usuarios, estadoUsuario, proveedores, verificarProveedor, reportes, exportarCsv, auditoria };
