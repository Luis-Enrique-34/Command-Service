// =====================================================================
//  DAO de solicitudes, historial, pagos, mensajes y reseñas.
//  El alcance por rol se aplica SIEMPRE en el SQL (un cliente solo ve sus
//  solicitudes; un proveedor solo las que recibe; el admin ve todas).
// =====================================================================
const db = require("../config/db");

/** Filtro por rol. Devuelve un fragmento SQL fijo (sin texto del usuario). */
function alcance(rol, alias = "s") {
  if (rol === "cliente") return `${alias}.cliente_id = $1`;
  if (rol === "proveedor") return `${alias}.proveedor_id = $1`;
  return "($1::uuid IS NOT NULL)"; // admin: todas
}

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

async function listar({ usuarioId, rol, estado, q }) {
  const { rows } = await db.query(
    `${SELECT_LISTA}
      WHERE ${alcance(rol)}
        AND ($2::public.estado_solicitud IS NULL OR s.estado = $2)
        AND ($3::text IS NULL OR s.codigo ILIKE '%' || $3 || '%' OR sv.titulo ILIKE '%' || $3 || '%'
             OR cu.nombres || ' ' || cu.apellidos ILIKE '%' || $3 || '%')
      ORDER BY s.creado_en DESC
      LIMIT 200`,
    [usuarioId, estado || null, q || null]
  );
  return rows;
}

async function resumenPorEstado({ usuarioId, rol }) {
  const { rows } = await db.query(
    `SELECT s.estado, COUNT(*)::int AS total FROM public.solicitudes s WHERE ${alcance(rol)} GROUP BY s.estado`,
    [usuarioId]
  );
  return Object.fromEntries(rows.map((r) => [r.estado, r.total]));
}

/** Solicitud "cruda" para validar permisos y transiciones. */
async function buscarBase(id, q = db.query) {
  const { rows } = await q(
    `SELECT s.*, (SELECT estado FROM public.pagos WHERE solicitud_id = s.id) AS pago_estado
       FROM public.solicitudes s WHERE s.id = $1`,
    [id]
  );
  return rows[0] || null;
}

/** Expediente completo: datos, historial, pago, reseña y mensajes. */
async function detalle(id) {
  const [base, historial, pago, resena, mensajes] = await Promise.all([
    db.query(
      `${SELECT_LISTA.replace("SELECT s.id,", `SELECT s.id, s.direccion, s.motivo, s.cliente_id, s.proveedor_id, s.servicio_id,
         cu.email AS cliente_email, cu.telefono AS cliente_telefono, pu.email AS proveedor_email, pp.verificacion,`)}
        WHERE s.id = $1`,
      [id]
    ),
    db.query(
      `SELECT h.estado_anterior, h.estado_nuevo, h.comentario, h.creado_en,
              u.nombres || ' ' || u.apellidos AS usuario, u.rol
         FROM public.solicitud_historial h LEFT JOIN public.usuarios u ON u.id = h.cambiado_por
        WHERE h.solicitud_id = $1 ORDER BY h.creado_en, h.id`,
      [id]
    ),
    db.query(
      `SELECT monto, comision_pct, comision, neto_proveedor, metodo, estado, referencia, creado_en, liberado_en
         FROM public.pagos WHERE solicitud_id = $1`,
      [id]
    ),
    db.query(`SELECT puntaje, comentario, creado_en FROM public.resenas WHERE solicitud_id = $1`, [id]),
    db.query(
      `SELECT m.id, m.contenido, m.creado_en, m.emisor_id, u.nombres || ' ' || u.apellidos AS emisor, u.rol
         FROM public.mensajes m JOIN public.usuarios u ON u.id = m.emisor_id
        WHERE m.solicitud_id = $1 ORDER BY m.creado_en, m.id`,
      [id]
    ),
  ]);
  if (!base.rows[0]) return null;
  return { ...base.rows[0], historial: historial.rows, pago: pago.rows[0] || null, resena: resena.rows[0] || null, mensajes: mensajes.rows };
}

/** Crea la solicitud. El trigger registra el estado inicial en el historial. */
async function crear({ clienteId, servicio, descripcion, direccion, fechaPreferida }) {
  return db.tx(
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
 * Cambia el estado dentro de una transacción y ejecuta los efectos sobre el pago.
 * @param {object} p
 * @param {string} p.id solicitud
 * @param {string} p.usuarioId quien realiza el cambio (queda en el historial)
 * @param {string} p.estadoActual estado esperado (bloqueo optimista: si otro lo cambió antes, no se aplica)
 * @param {string} p.estadoNuevo
 * @param {object} [p.campos] motivo / fecha_programada
 * @param {object} [p.pago] { crear: {monto, metodo, referencia} } | { estado: 'liberado'|'reembolsado' }
 */
async function cambiarEstado({ id, usuarioId, estadoActual, estadoNuevo, campos = {}, pago, comentario }) {
  return db.tx(
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

async function agregarMensaje(solicitudId, emisorId, contenido) {
  const { rows } = await db.query(
    `INSERT INTO public.mensajes (solicitud_id, emisor_id, contenido) VALUES ($1, $2, $3) RETURNING id, creado_en`,
    [solicitudId, emisorId, contenido]
  );
  return rows[0];
}

async function crearResena({ solicitudId, clienteId, proveedorId, puntaje, comentario }) {
  await db.query(
    `INSERT INTO public.resenas (solicitud_id, cliente_id, proveedor_id, puntaje, comentario) VALUES ($1, $2, $3, $4, $5)`,
    [solicitudId, clienteId, proveedorId, puntaje, comentario || null]
  );
}

/** Agenda del proveedor: servicios agendados o en curso, por fecha. */
async function agenda(proveedorId) {
  const { rows } = await db.query(
    `${SELECT_LISTA.replace("SELECT s.id,", "SELECT s.id, s.direccion, cu.telefono AS cliente_telefono,")}
      WHERE s.proveedor_id = $1 AND s.estado IN ('pago_confirmado', 'agendada', 'en_curso')
      ORDER BY s.fecha_programada NULLS LAST, s.creado_en`,
    [proveedorId]
  );
  return rows;
}

module.exports = { listar, resumenPorEstado, buscarBase, detalle, crear, cambiarEstado, agregarMensaje, crearResena, agenda };
