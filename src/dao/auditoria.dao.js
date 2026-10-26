// =====================================================================
//  DAO de auditoría: bitácora de operaciones críticas (solo inserción).
// =====================================================================
const db = require("../config/db");
const logger = require("../utils/logger");

/**
 * Registra un evento. Nunca interrumpe la operación principal: si la
 * bitácora falla, se anota en el log y la petición continúa.
 */
async function registrar({ usuarioId = null, accion, entidad = null, entidadId = null, ip = null, detalle = null }) {
  try {
    await db.query(
      `INSERT INTO public.auditoria (usuario_id, accion, entidad, entidad_id, ip, detalle) VALUES ($1, $2, $3, $4, $5, $6)`,
      [usuarioId, accion, entidad, entidadId ? String(entidadId) : null, ip, detalle]
    );
  } catch (err) {
    logger.warn("No se pudo registrar auditoría", { accion, error: err.message });
  }
}

async function listar({ accion, limite = 100 }) {
  const { rows } = await db.query(
    `SELECT a.id, a.accion, a.entidad, a.entidad_id, a.ip, a.detalle, a.creado_en,
            u.nombres || ' ' || u.apellidos AS usuario, u.email, u.rol
       FROM public.auditoria a LEFT JOIN public.usuarios u ON u.id = a.usuario_id
      WHERE ($1::text IS NULL OR a.accion = $1)
      ORDER BY a.creado_en DESC LIMIT $2`,
    [accion || null, limite]
  );
  return rows;
}

async function acciones() {
  const { rows } = await db.query(`SELECT DISTINCT accion FROM public.auditoria ORDER BY 1`);
  return rows.map((r) => r.accion);
}

module.exports = { registrar, listar, acciones };
