// =====================================================================
//  CONTROLADOR del módulo "Sistema y librerías" (solo administrador).
// =====================================================================
const { sistemaService } = require("../services");

/** GET /api/sistema/librerias — ejecuta una prueba real por librería. */
async function librerias(req, res) {
  res.json({ ok: true, ...(await sistemaService.verificarLibrerias(req)) });
}

/** GET /api/sistema/salud — base de datos, servidor y últimas peticiones. */
async function salud(req, res) {
  res.json({ ok: true, ...(await sistemaService.salud()) });
}

module.exports = { librerias, salud };
