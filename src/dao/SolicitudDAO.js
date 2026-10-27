// =====================================================================
//  DAO de solicitudes, historial, pagos, mensajes y reseñas.
//  El alcance por rol se aplica SIEMPRE en el SQL: un cliente solo ve sus
//  solicitudes, un proveedor solo las que recibe y el admin ve todas.
// =====================================================================
const BaseDAO = require("./BaseDAO");

const SELECT_LISTA = `
  SELECT s.id, s.codigo, s.estado, s.monto, s.descripcion, s.fecha_preferida, s.fecha_programada,
         s.creado_en, s.actualizado_en,
         sv.titulo AS servicio, c.nombre AS categoria, c.icono AS categoria_icono,
         cu.nombres || ' ' || cu.apellidos AS cliente,
         COALESCE(pp.nombre_comercial, pu.nombres || ' ' || pu.apellidos) AS proveedor,
         pg.estado AS pago_estado
    FROM public.solicitudes s
    JOIN public.servicios sv ON sv.id = s.servicio_id
    LEFT JOIN public.categorias c ON c.id = sv.categoria_id
    JOIN public.usuarios cu ON cu.id = s.cliente_id
    JOIN public.usuarios pu ON pu.id = s.proveedor_id
    LEFT JOIN public.perfiles_proveedor pp ON pp.usuario_id = s.proveedor_id
    LEFT JOIN public.pagos pg ON pg.solicitud_id = s.id`;

/** Filtro por rol: fragmento SQL fijo (nunca contiene texto del usuario). */
function alcance(rol, alias = "s") {
  if (rol === "cliente") return `${alias}.cliente_id = $1`;
  if (rol === "proveedor") return `${alias}.proveedor_id = $1`;
  return "($1::uuid IS NOT NULL)"; // admin: todas
}

class SolicitudDAO extends BaseDAO {
  listar({ usuarioId, rol, estado, q }) {
    return this.varios(
      `${SELECT_LISTA}
        WHERE ${alcance(rol)}
          AND ($2::public.estado_solicitud IS NULL OR s.estado = $2)
          AND ($3::text IS NULL OR s.codigo ILIKE '%' || $3 || '%' OR sv.titulo ILIKE '%' || $3 || '%'
               OR cu.nombres || ' ' || cu.apellidos ILIKE '%' || $3 || '%')
        ORDER BY s.creado_en DESC
        LIMIT 200`,
      [usuarioId, estado || null, q || null]
    );
  }

  async resumenPorEstado({ usuarioId, rol }) {
    const filas = await this.varios(
      `SELECT s.estado, COUNT(*)::int AS total FROM public.solicitudes s WHERE ${alcance(rol)} GROUP BY s.estado`,
      [usuarioId]
    );
    return Object.fromEntries(filas.map((r) => [r.estado, r.total]));
  }

  /** Solicitud "cruda" para validar permisos y transiciones. */
  buscarBase(id) {
    return this.uno(
      `SELECT s.*, (SELECT estado FROM public.pagos WHERE solicitud_id = s.id) AS pago_estado
         FROM public.solicitudes s WHERE s.id = $1`,
      [id]
    );
  }

  /** Expediente completo: datos, historial, pago, reseña y mensajes. */
  async detalle(id) {
    const [base, historial, pago, resena, mensajes] = await Promise.all([
      this.uno(
        `${SELECT_LISTA.replace("SELECT s.id,", `SELECT s.id, s.direccion, s.motivo, s.cliente_id, s.proveedor_id, s.servicio_id,
           cu.email AS cliente_email, cu.telefono AS cliente_telefono, pu.email AS proveedor_email, pp.verificacion,`)}
          WHERE s.id = $1`,
        [id]
      ),
      this.varios(
        `SELECT h.estado_anterior, h.estado_nuevo, h.comentario, h.creado_en,
                u.nombres || ' ' || u.apellidos AS usuario, u.rol
           FROM public.solicitud_historial h LEFT JOIN public.usuarios u ON u.id = h.cambiado_por
          WHERE h.solicitud_id = $1 ORDER BY h.creado_en, h.id`,
        [id]
      ),
      this.uno(
        `SELECT monto, comision_pct, comision, neto_proveedor, metodo, estado, referencia, creado_en, liberado_en
           FROM public.pagos WHERE solicitud_id = $1`,
        [id]
      ),
      this.uno(`SELECT puntaje, comentario, creado_en FROM public.resenas WHERE solicitud_id = $1`, [id]),
      this.varios(
        `SELECT m.id, m.contenido, m.creado_en, m.emisor_id, u.nombres || ' ' || u.apellidos AS emisor, u.rol
           FROM public.mensajes m JOIN public.usuarios u ON u.id = m.emisor_id
          WHERE m.solicitud_id = $1 ORDER BY m.creado_en, m.id`,
        [id]
      ),
    ]);
    if (!base) return null;
    return { ...base, historial, pago, resena, mensajes };
  }

  /** Crea la solicitud. El trigger de la BD registra el estado inicial en el historial. */
  crear({ clienteId, servicio, descripcion, direccion, fechaPreferida }) {
    return this.tx(
      async (q) => {
        const { rows } = await q(
          `INSERT INTO public.solicitudes (cliente_id, servicio_id, proveedor_id, monto, descripcion, direccion, fecha_preferida)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, codigo, estado`,
          [clienteId, servicio.id, servicio.proveedor_id, servicio.precio, descripcion, direccion || null, fechaPreferida || null]
        );
        return rows[0];
      },
      { usuarioId: clienteId, comentario: "Solicitud creada" }
    );
  }

  /**
   * Cambia el estado y aplica los efectos sobre el pago, en UNA transacción.
   * Bloqueo optimista: el UPDATE exige que el estado siga siendo el esperado;
   * si otra persona lo cambió antes, no se aplica y devuelve false.
   * @param {{id:string, usuarioId:string, estadoActual:string, estadoNuevo:string,
   *          campos?:object, pago?:object, comentario?:string}} p
   */
  cambiarEstado({ id, usuarioId, estadoActual, estadoNuevo, campos = {}, pago, comentario }) {
    return this.tx(
      async (q) => {
        const { rowCount } = await q(
          `UPDATE public.solicitudes
              SET estado = $3,
                  motivo = COALESCE($4, motivo),
                  fecha_programada = COALESCE($5, fecha_programada)
            WHERE id = $1 AND estado = $2`,
          [id, estadoActual, estadoNuevo, campos.motivo || null, campos.fecha_programada || null]
        );
        if (rowCount === 0) return false;

        if (pago?.crear) {
          await q(
            `INSERT INTO public.pagos (solicitud_id, monto, metodo, estado, referencia) VALUES ($1, $2, $3, 'retenido', $4)`,
            [id, pago.crear.monto, pago.crear.metodo, pago.crear.referencia]
          );
        } else if (pago?.estado) {
          await q(
            `UPDATE public.pagos SET estado = $2::public.estado_pago,
                    liberado_en = CASE WHEN $2::public.estado_pago = 'liberado' THEN NOW() END
              WHERE solicitud_id = $1 AND estado = 'retenido'`,
            [id, pago.estado]
          );
        }
        return true;
      },
      { usuarioId, comentario }
    );
  }

  agregarMensaje(solicitudId, emisorId, contenido) {
    return this.uno(
      `INSERT INTO public.mensajes (solicitud_id, emisor_id, contenido) VALUES ($1, $2, $3) RETURNING id, creado_en`,
      [solicitudId, emisorId, contenido]
    );
  }

  crearResena({ solicitudId, clienteId, proveedorId, puntaje, comentario }) {
    return this.query(
      `INSERT INTO public.resenas (solicitud_id, cliente_id, proveedor_id, puntaje, comentario) VALUES ($1, $2, $3, $4, $5)`,
      [solicitudId, clienteId, proveedorId, puntaje, comentario || null]
    );
  }

  /** Agenda del proveedor: servicios pagados, agendados o en curso, por fecha. */
  agenda(proveedorId) {
    return this.varios(
      `${SELECT_LISTA.replace("SELECT s.id,", "SELECT s.id, s.direccion, cu.telefono AS cliente_telefono,")}
        WHERE s.proveedor_id = $1 AND s.estado IN ('pago_confirmado', 'agendada', 'en_curso')
        ORDER BY s.fecha_programada NULLS LAST, s.creado_en`,
      [proveedorId]
    );
  }
}

module.exports = SolicitudDAO;
