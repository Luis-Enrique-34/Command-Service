// =====================================================================
//  DAO de usuarios: ÚNICO lugar con SQL de la tabla usuarios y
//  perfiles_proveedor. Los controladores no escriben SQL (patrón DAO).
// =====================================================================
const db = require("../config/db");

const COLUMNAS_PUBLICAS = "u.id, u.nombres, u.apellidos, u.email, u.telefono, u.rol, u.activo, u.creado_en, u.ultimo_login";

/** Busca un usuario por correo, incluyendo los campos de seguridad (solo para login). */
async function buscarParaLogin(email) {
  const { rows } = await db.query(
    `SELECT id, nombres, apellidos, email, rol, password_hash, activo, intentos_fallidos, bloqueado_hasta
       FROM public.usuarios WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

/** Usuario activo por id, con su perfil de proveedor si lo tiene. */
async function buscarPorId(id) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_PUBLICAS},
            p.nombre_comercial, p.documento, p.descripcion, p.distrito, p.verificacion, p.motivo_rechazo
       FROM public.usuarios u
       LEFT JOIN public.perfiles_proveedor p ON p.usuario_id = u.id
      WHERE u.id = $1 AND u.activo = TRUE`,
    [id]
  );
  return rows[0] || null;
}

/** Crea usuario (y su perfil si es proveedor) en una sola transacción. */
async function crear({ nombres, apellidos, email, telefono, passwordHash, rol }) {
  return db.tx(async (q) => {
    const { rows } = await q(
      `INSERT INTO public.usuarios (nombres, apellidos, email, telefono, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombres, apellidos, email, rol`,
      [nombres, apellidos, email, telefono || null, passwordHash, rol]
    );
    if (rol === "proveedor") {
      await q(
        `INSERT INTO public.perfiles_proveedor (usuario_id, nombre_comercial) VALUES ($1, $2)`,
        [rows[0].id, `${nombres} ${apellidos}`]
      );
    }
    return rows[0];
  });
}

async function registrarFallo(id, intentos, bloquear, minutos) {
  await db.query(
    `UPDATE public.usuarios
        SET intentos_fallidos = $2,
            bloqueado_hasta = CASE WHEN $3 THEN NOW() + ($4 || ' minutes')::interval ELSE NULL END
      WHERE id = $1`,
    [id, bloquear ? 0 : intentos, bloquear, String(minutos)]
  );
}

async function registrarLoginExitoso(id) {
  await db.query(
    `UPDATE public.usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_login = NOW() WHERE id = $1`,
    [id]
  );
}

async function actualizarHash(id, hash) {
  await db.query(`UPDATE public.usuarios SET password_hash = $2 WHERE id = $1`, [id, hash]);
}

/** Actualiza datos personales y, si corresponde, el perfil comercial. */
async function actualizarPerfil(id, rol, { nombres, apellidos, telefono, perfil }) {
  return db.tx(async (q) => {
    await q(
      `UPDATE public.usuarios SET nombres = $2, apellidos = $3, telefono = $4 WHERE id = $1`,
      [id, nombres, apellidos, telefono || null]
    );
    if (rol === "proveedor" && perfil) {
      await q(
        `INSERT INTO public.perfiles_proveedor (usuario_id, nombre_comercial, documento, descripcion, distrito)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (usuario_id) DO UPDATE
            SET nombre_comercial = EXCLUDED.nombre_comercial, documento = EXCLUDED.documento,
                descripcion = EXCLUDED.descripcion, distrito = EXCLUDED.distrito,
                -- si estaba rechazado y corrige sus datos, vuelve a revisión
                verificacion = CASE WHEN perfiles_proveedor.verificacion = 'rechazado'
                                    THEN 'pendiente'::public.estado_verificacion
                                    ELSE perfiles_proveedor.verificacion END`,
        [id, perfil.nombre_comercial, perfil.documento || null, perfil.descripcion || null, perfil.distrito || null]
      );
    }
  });
}

// ------------------------------------------------------------- ADMIN
async function listar({ rol, q, limite = 100 }) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_PUBLICAS}, p.nombre_comercial, p.verificacion,
            (SELECT COUNT(*)::int FROM public.solicitudes s WHERE s.cliente_id = u.id OR s.proveedor_id = u.id) AS solicitudes
       FROM public.usuarios u
       LEFT JOIN public.perfiles_proveedor p ON p.usuario_id = u.id
      WHERE ($1::public.rol_usuario IS NULL OR u.rol = $1)
        AND ($2::text IS NULL OR u.nombres || ' ' || u.apellidos || ' ' || u.email ILIKE '%' || $2 || '%')
      ORDER BY u.creado_en DESC
      LIMIT $3`,
    [rol || null, q || null, limite]
  );
  return rows;
}

async function cambiarEstado(id, activo) {
  const { rowCount } = await db.query(
    `UPDATE public.usuarios SET activo = $2 WHERE id = $1 AND rol <> 'admin'`,
    [id, activo]
  );
  return rowCount > 0;
}

async function listarProveedores({ verificacion }) {
  const { rows } = await db.query(
    `SELECT u.id, u.nombres, u.apellidos, u.email, u.telefono, u.activo, u.creado_en,
            p.nombre_comercial, p.documento, p.descripcion, p.distrito, p.verificacion, p.motivo_rechazo, p.verificado_en,
            (SELECT COUNT(*)::int FROM public.servicios s WHERE s.proveedor_id = u.id AND s.activo) AS servicios,
            (SELECT ROUND(AVG(r.puntaje), 1) FROM public.resenas r WHERE r.proveedor_id = u.id) AS calificacion
       FROM public.usuarios u
       JOIN public.perfiles_proveedor p ON p.usuario_id = u.id
      WHERE ($1::public.estado_verificacion IS NULL OR p.verificacion = $1)
      ORDER BY (p.verificacion = 'pendiente') DESC, u.creado_en DESC`,
    [verificacion || null]
  );
  return rows;
}

async function verificarProveedor(id, adminId, estado, motivo) {
  const { rowCount } = await db.query(
    `UPDATE public.perfiles_proveedor
        SET verificacion = $2, motivo_rechazo = $3, verificado_por = $4, verificado_en = NOW()
      WHERE usuario_id = $1`,
    [id, estado, estado === "rechazado" ? motivo : null, adminId]
  );
  return rowCount > 0;
}

module.exports = {
  buscarParaLogin, buscarPorId, crear, registrarFallo, registrarLoginExitoso, actualizarHash,
  actualizarPerfil, listar, cambiarEstado, listarProveedores, verificarProveedor,
};
