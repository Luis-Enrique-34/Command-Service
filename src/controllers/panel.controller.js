// =====================================================================
//  CONTROLADOR del panel: inicio (indicadores) y perfil propio.
// =====================================================================
const { reporteService, usuarioService } = require("../services");

/** GET /api/inicio */
async function inicio(req, res) {
  res.json({ ok: true, ...(await reporteService.inicio(req.usuario)) });
}

/** GET /api/perfil */
async function verPerfil(req, res) {
  res.json({ ok: true, usuario: await usuarioService.perfil(req.usuario.id) });
}

/** PUT /api/perfil */
async function actualizarPerfil(req, res) {
  const usuario = await usuarioService.actualizarPerfil(req.usuario, req.body);
  res.json({ ok: true, mensaje: "Perfil actualizado", usuario });
}

module.exports = { inicio, verPerfil, actualizarPerfil };
