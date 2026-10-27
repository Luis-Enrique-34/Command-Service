// =====================================================================
//  DAO de servicios y categorías.
// =====================================================================
const BaseDAO = require("./BaseDAO");

const SELECT_SERVICIO = `
  SELECT s.id, s.titulo, s.descripcion, s.precio, s.modalidad, s.zona_cobertura, s.duracion_horas,
         s.activo, s.creado_en, s.proveedor_id,
         c.id AS categoria_id, c.nombre AS categoria, c.icono AS categoria_icono,
         COALESCE(p.nombre_comercial, u.nombres || ' ' || u.apellidos) AS proveedor,
         p.verificacion, p.distrito,
         r.calificacion, COALESCE(r.resenas, 0) AS resenas,
         COALESCE(v.contrataciones, 0) AS contrataciones
    FROM public.servicios s
    JOIN public.usuarios u ON u.id = s.proveedor_id
    LEFT JOIN public.perfiles_proveedor p ON p.usuario_id = u.id
    LEFT JOIN public.categorias c ON c.id = s.categoria_id
    LEFT JOIN LATERAL (
         SELECT ROUND(AVG(puntaje), 1) AS calificacion, COUNT(*)::int AS resenas
           FROM public.resenas WHERE proveedor_id = s.proveedor_id) r ON TRUE
    LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS contrataciones
           FROM public.solicitudes WHERE servicio_id = s.id AND estado = 'completada') v ON TRUE`;

/** Lista blanca de ordenamientos: el ORDER BY nunca sale del texto del usuario. */
const ORDENES = {
  recientes: "s.creado_en DESC",
  precio_asc: "s.precio ASC",
  precio_desc: "s.precio DESC",
  calificacion: "r.calificacion DESC NULLS LAST, s.creado_en DESC",
};

class ServicioDAO extends BaseDAO {
  listarCategorias() {
    return this.varios(
      `SELECT c.id, c.nombre, c.slug, c.icono, c.descripcion,
              COUNT(s.id) FILTER (WHERE s.activo)::int AS servicios
         FROM public.categorias c
         LEFT JOIN public.servicios s ON s.categoria_id = c.id
        WHERE c.activo
        GROUP BY c.id ORDER BY c.nombre`
    );
  }

  /** Catálogo: solo servicios activos de proveedores APROBADOS y activos. */
  catalogo({ q, categoria, modalidad, orden }) {
    return this.varios(
      `${SELECT_SERVICIO}
        WHERE s.activo AND u.activo AND p.verificacion = 'aprobado'
          AND ($1::text IS NULL OR s.titulo ILIKE '%' || $1 || '%' OR s.descripcion ILIKE '%' || $1 || '%'
               OR p.nombre_comercial ILIKE '%' || $1 || '%')
          AND ($2::smallint IS NULL OR s.categoria_id = $2)
          AND ($3::public.modalidad_servicio IS NULL OR s.modalidad = $3)
        ORDER BY ${ORDENES[orden] || ORDENES.recientes}
        LIMIT 60`,
      [q || null, categoria || null, modalidad || null]
    );
  }

  buscarPorId(id) {
    return this.uno(`${SELECT_SERVICIO} WHERE s.id = $1`, [id]);
  }

  listarDeProveedor(proveedorId) {
    return this.varios(`${SELECT_SERVICIO} WHERE s.proveedor_id = $1 ORDER BY s.activo DESC, s.creado_en DESC`, [proveedorId]);
  }

  async crear(proveedorId, d) {
    const fila = await this.uno(
      `INSERT INTO public.servicios (proveedor_id, categoria_id, titulo, descripcion, precio, modalidad, zona_cobertura, duracion_horas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [proveedorId, d.categoria_id, d.titulo, d.descripcion || null, d.precio, d.modalidad, d.zona_cobertura || null, d.duracion_horas || null]
    );
    return fila.id;
  }

  /** Solo actualiza si el servicio pertenece al proveedor (evita IDOR). */
  actualizar(id, proveedorId, d) {
    return this.afecta(
      `UPDATE public.servicios
          SET categoria_id = $3, titulo = $4, descripcion = $5, precio = $6, modalidad = $7,
              zona_cobertura = $8, duracion_horas = $9
        WHERE id = $1 AND proveedor_id = $2`,
      [id, proveedorId, d.categoria_id, d.titulo, d.descripcion || null, d.precio, d.modalidad, d.zona_cobertura || null, d.duracion_horas || null]
    );
  }

  cambiarEstado(id, proveedorId, activo) {
    return this.afecta(`UPDATE public.servicios SET activo = $3 WHERE id = $1 AND proveedor_id = $2`, [id, proveedorId, activo]);
  }
}

module.exports = ServicioDAO;
