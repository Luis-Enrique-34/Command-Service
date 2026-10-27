// =====================================================================
//  DAO de auditoría: bitácora de operaciones críticas (solo inserción).
// =====================================================================
const BaseDAO = require("./BaseDAO");
const logger = require("../utils/logger");

class AuditoriaDAO extends BaseDAO {
  /**
   * Registra un evento. Nunca interrumpe la operación principal: si la
   * bitácora falla, se anota en el log y la petición continúa.
   */
  async registrar({ usuarioId = null, accion, entidad = null, entidadId = null, ip = null, detalle = null }) {
    try {
      await this.query(
        `INSERT INTO public.auditoria (usuario_id, accion, entidad, entidad_id, ip, detalle) VALUES ($1, $2, $3, $4, $5, $6)`,
        [usuarioId, accion, entidad, entidadId ? String(entidadId) : null, ip, detalle]
      );
    } catch (err) {
      logger.warn("No se pudo registrar auditoría", { accion, error: err.message });
    }
  }

  listar({ accion, limite = 100 }) {
    return this.varios(
      `SELECT a.id, a.accion, a.entidad, a.entidad_id, a.ip, a.detalle, a.creado_en,
              u.nombres || ' ' || u.apellidos AS usuario, u.email, u.rol
         FROM public.auditoria a LEFT JOIN public.usuarios u ON u.id = a.usuario_id
        WHERE ($1::text IS NULL OR a.accion = $1)
        ORDER BY a.creado_en DESC LIMIT $2`,
      [accion || null, limite]
    );
  }

  async acciones() {
    const filas = await this.varios(`SELECT DISTINCT accion FROM public.auditoria ORDER BY 1`);
    return filas.map((r) => r.accion);
  }
}

module.exports = AuditoriaDAO;
