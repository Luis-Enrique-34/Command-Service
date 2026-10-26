// =====================================================================
//  DAO de reportes e indicadores (dashboard y módulo de reportes).
// =====================================================================
const db = require("../config/db");

/** Indicadores del panel de inicio según el rol. */
async function indicadores(usuarioId, rol) {
  if (rol === "admin") {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM public.usuarios WHERE activo)::int                                   AS usuarios,
        (SELECT COUNT(*) FROM public.perfiles_proveedor WHERE verificacion = 'pendiente')::int      AS proveedores_pendientes,
        (SELECT COUNT(*) FROM public.servicios WHERE activo)::int                                   AS servicios_activos,
        (SELECT COUNT(*) FROM public.solicitudes
          WHERE estado NOT IN ('completada','rechazada','cancelada'))::int                          AS solicitudes_abiertas,
        (SELECT COALESCE(SUM(comision), 0) FROM public.pagos
          WHERE estado = 'liberado' AND liberado_en >= date_trunc('month', NOW()))                  AS comisiones_mes,
        (SELECT COALESCE(SUM(monto), 0) FROM public.pagos WHERE estado = 'retenido')                AS en_custodia`);
    return rows[0];
  }
  const campo = rol === "proveedor" ? "proveedor_id" : "cliente_id";
  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE s.estado = 'por_confirmar')::int                              AS por_confirmar,
       COUNT(*) FILTER (WHERE s.estado IN ('aceptada','pago_confirmado','agendada','en_curso'))::int AS en_proceso,
       COUNT(*) FILTER (WHERE s.estado = 'completada')::int                                 AS completadas,
       COALESCE(SUM(pg.${rol === "proveedor" ? "neto_proveedor" : "monto"})
                FILTER (WHERE pg.estado = 'liberado' AND pg.liberado_en >= date_trunc('month', NOW())), 0) AS monto_mes,
       COALESCE(SUM(pg.monto) FILTER (WHERE pg.estado = 'retenido'), 0)                     AS en_custodia,
       (SELECT ROUND(AVG(puntaje), 1) FROM public.resenas WHERE proveedor_id = $1)           AS calificacion,
       (SELECT COUNT(*)::int FROM public.servicios WHERE proveedor_id = $1 AND activo)        AS servicios_activos
     FROM public.solicitudes s
     LEFT JOIN public.pagos pg ON pg.solicitud_id = s.id
     WHERE s.${campo} = $1`,
    [usuarioId]
  );
  return rows[0];
}

/** Datos para el módulo de reportes del administrador. */
async function reportesAdmin() {
  const [porEstado, porMes, porCategoria, topProveedores, conversion, tiempo] = await Promise.all([
    db.query(`SELECT estado, COUNT(*)::int AS total FROM public.solicitudes GROUP BY estado ORDER BY total DESC`),
    db.query(`
      SELECT to_char(m.mes, 'YYYY-MM') AS mes,
             COALESCE(SUM(p.monto), 0) AS bruto, COALESCE(SUM(p.comision), 0) AS comision, COUNT(p.id)::int AS pagos
        FROM generate_series(date_trunc('month', NOW()) - INTERVAL '5 months', date_trunc('month', NOW()), INTERVAL '1 month') m(mes)
        LEFT JOIN public.pagos p ON date_trunc('month', p.creado_en) = m.mes AND p.estado <> 'reembolsado'
       GROUP BY m.mes ORDER BY m.mes`),
    db.query(`
      SELECT c.nombre, c.icono, COUNT(s.id)::int AS solicitudes, COALESCE(SUM(s.monto) FILTER (WHERE s.estado = 'completada'), 0) AS facturado
        FROM public.categorias c
        LEFT JOIN public.servicios sv ON sv.categoria_id = c.id
        LEFT JOIN public.solicitudes s ON s.servicio_id = sv.id
       GROUP BY c.id ORDER BY solicitudes DESC`),
    db.query(`
      SELECT COALESCE(pp.nombre_comercial, u.nombres) AS proveedor,
             COUNT(s.id) FILTER (WHERE s.estado = 'completada')::int AS completadas,
             COALESCE(SUM(pg.neto_proveedor) FILTER (WHERE pg.estado = 'liberado'), 0) AS neto,
             (SELECT ROUND(AVG(puntaje), 1) FROM public.resenas r WHERE r.proveedor_id = u.id) AS calificacion
        FROM public.usuarios u
        JOIN public.perfiles_proveedor pp ON pp.usuario_id = u.id
        LEFT JOIN public.solicitudes s ON s.proveedor_id = u.id
        LEFT JOIN public.pagos pg ON pg.solicitud_id = s.id
       GROUP BY u.id, pp.nombre_comercial ORDER BY completadas DESC, neto DESC LIMIT 5`),
    db.query(`
      SELECT COUNT(*)::int AS creadas,
             COUNT(*) FILTER (WHERE estado = 'completada')::int AS completadas,
             COUNT(*) FILTER (WHERE estado = 'rechazada')::int AS rechazadas,
             COUNT(*) FILTER (WHERE estado = 'cancelada')::int AS canceladas
        FROM public.solicitudes`),
    db.query(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (h.creado_en - s.creado_en)) / 3600)::numeric, 1) AS horas_hasta_aceptar
        FROM public.solicitud_historial h JOIN public.solicitudes s ON s.id = h.solicitud_id
       WHERE h.estado_nuevo = 'aceptada'`),
  ]);
  return {
    porEstado: porEstado.rows,
    porMes: porMes.rows,
    porCategoria: porCategoria.rows,
    topProveedores: topProveedores.rows,
    conversion: conversion.rows[0],
    tiempoAtencion: tiempo.rows[0].horas_hasta_aceptar,
  };
}

/** Filas para exportar a CSV. */
async function exportarSolicitudes() {
  const { rows } = await db.query(`
    SELECT s.codigo, s.estado, s.creado_en, sv.titulo AS servicio, c.nombre AS categoria,
           cu.nombres || ' ' || cu.apellidos AS cliente, COALESCE(pp.nombre_comercial, pu.nombres) AS proveedor,
           s.monto, pg.estado AS pago, pg.comision, pg.neto_proveedor
      FROM public.solicitudes s
      JOIN public.servicios sv ON sv.id = s.servicio_id
      LEFT JOIN public.categorias c ON c.id = sv.categoria_id
      JOIN public.usuarios cu ON cu.id = s.cliente_id
      JOIN public.usuarios pu ON pu.id = s.proveedor_id
      LEFT JOIN public.perfiles_proveedor pp ON pp.usuario_id = s.proveedor_id
      LEFT JOIN public.pagos pg ON pg.solicitud_id = s.id
     ORDER BY s.creado_en DESC`);
  return rows;
}

/** Estado de las tablas (para el módulo Sistema): filas y RLS. */
async function estadoTablas() {
  const { rows } = await db.query(`
    SELECT c.relname AS tabla, c.relrowsecurity AS rls,
           (xpath('/row/n/text()', query_to_xml(format('SELECT COUNT(*) AS n FROM public.%I', c.relname), false, true, '')))[1]::text::int AS filas
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
     ORDER BY c.relname`);
  return rows;
}

module.exports = { indicadores, reportesAdmin, exportarSolicitudes, estadoTablas };
