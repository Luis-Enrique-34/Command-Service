// Controlador del panel: inicio (indicadores), perfil, administración,
// reportes, auditoría y verificación del sistema.
const usuarioDao = require("../dao/usuario.dao");
const solicitudDao = require("../dao/solicitud.dao");
const reporteDao = require("../dao/reporte.dao");
const auditoria = require("../dao/auditoria.dao");
const sistemaService = require("../services/sistema.service");
const { usuarioPublico } = require("./auth.controller");
const { noEncontrado, HttpError, ipDe } = require("../utils/http");

// ------------------------------------------------------------ INICIO
async function inicio(req, res) {
  const { id, rol } = req.usuario;
  const [indicadores, recientes] = await Promise.all([
    reporteDao.indicadores(id, rol),
    solicitudDao.listar({ usuarioId: id, rol }),
  ]);
  res.json({ ok: true, indicadores, recientes: recientes.slice(0, 6) });
}

// ------------------------------------------------------------ PERFIL
async function verPerfil(req, res) {
  const u = await usuarioDao.buscarPorId(req.usuario.id);
  if (!u) throw noEncontrado("el usuario");
  res.json({ ok: true, usuario: usuarioPublico(u) });
}

async function actualizarPerfil(req, res) {
  await usuarioDao.actualizarPerfil(req.usuario.id, req.usuario.rol, req.body);
  const u = await usuarioDao.buscarPorId(req.usuario.id);
  res.json({ ok: true, mensaje: "Perfil actualizado", usuario: usuarioPublico(u) });
}

// ------------------------------------------------------------ ADMIN
async function usuarios(req, res) {
  res.json({ ok: true, usuarios: await usuarioDao.listar(req.datos) });
}

async function estadoUsuario(req, res) {
  if (req.params.id === req.usuario.id) throw new HttpError(400, "No puedes desactivar tu propia cuenta");
  const ok = await usuarioDao.cambiarEstado(req.params.id, req.body.activo);
  if (!ok) throw noEncontrado("el usuario");
  await auditoria.registrar({ usuarioId: req.usuario.id, accion: req.body.activo ? "ACTIVAR_USUARIO" : "DESACTIVAR_USUARIO",
    entidad: "usuarios", entidadId: req.params.id, ip: ipDe(req) });
  res.json({ ok: true, mensaje: req.body.activo ? "Usuario activado" : "Usuario desactivado" });
}

async function proveedores(req, res) {
  res.json({ ok: true, proveedores: await usuarioDao.listarProveedores(req.datos) });
}

async function verificarProveedor(req, res) {
  const { estado, motivo } = req.body;
  const ok = await usuarioDao.verificarProveedor(req.params.id, req.usuario.id, estado, motivo);
  if (!ok) throw noEncontrado("el proveedor");
  await auditoria.registrar({ usuarioId: req.usuario.id, accion: "VERIFICAR_PROVEEDOR", entidad: "perfiles_proveedor",
    entidadId: req.params.id, ip: ipDe(req), detalle: { estado, motivo: motivo || null } });
  res.json({ ok: true, mensaje: estado === "aprobado" ? "Proveedor verificado" : "Proveedor rechazado" });
}

async function reportes(req, res) {
  res.json({ ok: true, reportes: await reporteDao.reportesAdmin() });
}

/** Exporta las solicitudes a CSV (se abre en Excel). */
async function exportarCsv(req, res) {
  const filas = await reporteDao.exportarSolicitudes();
  const columnas = ["codigo", "estado", "creado_en", "servicio", "categoria", "cliente", "proveedor", "monto", "pago", "comision", "neto_proveedor"];
  // Evita "CSV injection": celdas que empiezan con = + - @ se anteponen con '
  const celda = (v) => {
    let s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [columnas.join(";"), ...filas.map((f) => columnas.map((c) => celda(f[c])).join(";"))].join("\r\n");
  await auditoria.registrar({ usuarioId: req.usuario.id, accion: "EXPORTAR_REPORTE", entidad: "solicitudes", ip: ipDe(req), detalle: { filas: filas.length } });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="solicitudes_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("﻿" + csv); // BOM para que Excel respete las tildes
}

async function verAuditoria(req, res) {
  const [registros, acciones] = await Promise.all([auditoria.listar(req.datos), auditoria.acciones()]);
  res.json({ ok: true, registros, acciones });
}

// ------------------------------------------------------------ SISTEMA
async function librerias(req, res) {
  res.json({ ok: true, ...(await sistemaService.verificarLibrerias(req)) });
}

async function salud(req, res) {
  res.json({ ok: true, ...(await sistemaService.salud()) });
}

module.exports = {
  inicio, verPerfil, actualizarPerfil, usuarios, estadoUsuario, proveedores, verificarProveedor,
  reportes, exportarCsv, verAuditoria, librerias, salud,
};
