// =====================================================================
//  DAO de usuarios y perfiles de proveedor.
//  ÚNICO lugar del sistema con SQL sobre las tablas usuarios y
//  perfiles_proveedor.
// =====================================================================
const BaseDAO = require("./BaseDAO");

const COLUMNAS_PUBLICAS = "u.id, u.nombres, u.apellidos, u.email, u.telefono, u.rol, u.activo, u.creado_en, u.ultimo_login";

class UsuarioDAO extends BaseDAO {
  /** Usuario por correo, con los campos de seguridad (solo para el login). */
  buscarParaLogin(email) {
    return this.uno(
      `SELECT id, nombres, apellidos, email, telefono, rol, password_hash, activo, intentos_fallidos, bloqueado_hasta
         FROM public.usuarios WHERE email = $1`,
      [email]
    );
  }

  /** Usuario activo por id, con su perfil de proveedor si lo tiene. */
  buscarPorId(id) {
    return this.uno(
      `SELECT ${COLUMNAS_PUBLICAS},
              p.nombre_comercial, p.documento, p.descripcion, p.distrito, p.verificacion, p.motivo_rechazo
         FROM public.usuarios u
         LEFT JOIN public.perfiles_proveedor p ON p.usuario_id = u.id
        WHERE u.id = $1 AND u.activo = TRUE`,
      [id]
    );
  }

  /** Crea el usuario (y su perfil si es proveedor) en una sola transacción. */
  crear({ nombres, apellidos, email, telefono, passwordHash, rol }) {
    return this.tx(async (q) => {
      const { rows } = await q(
        `INSERT INTO public.usuarios (nombres, apellidos, email, telefono, password_hash, rol)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, nombres, apellidos, email, telefono, rol`,
        [nombres, apellidos, email, telefono || null, passwordHash, rol]
      );
      if (rol === "proveedor") {
        await q(`INSERT INTO public.perfiles_proveedor (usuario_id, nombre_comercial) VALUES ($1, $2)`, [rows[0].id, `${nombres} ${apellidos}`]);
      }
      return rows[0];
    });
  }

  registrarFallo(id, intentos, bloquear, minutos) {
    return this.query(
      `UPDATE public.usuarios
          SET intentos_fallidos = $2,
              bloqueado_hasta = CASE WHEN $3 THEN NOW() + ($4 || ' minutes')::interval ELSE NULL END
        WHERE id = $1`,
      [id, bloquear ? 0 : intentos, bloquear, String(minutos)]
    );
  }

  registrarLoginExitoso(id) {
    return this.query(
      `UPDATE public.usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_login = NOW() WHERE id = $1`,
      [id]
    );
  }

  actualizarHash(id, hash) {
    return this.query(`UPDATE public.usuarios SET password_hash = $2 WHERE id = $1`, [id, hash]);
  }

  /** Actualiza datos personales y, si corresponde, el perfil comercial. */
  actualizarPerfil(id, rol, { nombres, apellidos, telefono, perfil }) {
    return this.tx(async (q) => {
      await q(`UPDATE public.usuarios SET nombres = $2, apellidos = $3, telefono = $4 WHERE id = $1`, [id, nombres, apellidos, telefono || null]);
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

  // ------------------------------------------------------- ADMINISTRACIÓN
  listar({ rol, q, limite = 100 }) {
    return this.varios(
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
  }

  /** Activa o desactiva una cuenta (nunca la de un administrador). */
  cambiarEstado(id, activo) {
    return this.afecta(`UPDATE public.usuarios SET activo = $2 WHERE id = $1 AND rol <> 'admin'`, [id, activo]);
  }

  listarProveedores({ verificacion }) {
    return this.varios(
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
  }

  verificarProveedor(id, adminId, estado, motivo) {
    return this.afecta(
      `UPDATE public.perfiles_proveedor
          SET verificacion = $2, motivo_rechazo = $3, verificado_por = $4, verificado_en = NOW()
        WHERE usuario_id = $1`,
      [id, estado, estado === "rechazado" ? motivo : null, adminId]
    );
  }
}

module.exports = UsuarioDAO;
