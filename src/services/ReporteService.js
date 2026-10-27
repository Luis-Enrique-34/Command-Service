// =====================================================================
//  SERVICIO de indicadores, reportes, exportación y auditoría.
// =====================================================================
const { aCsv } = require("../utils/csv");

const COLUMNAS_CSV = ["codigo", "estado", "creado_en", "servicio", "categoria", "cliente", "proveedor", "monto", "pago", "comision", "neto_proveedor"];

class ReporteService {
  constructor({ reporteDAO, solicitudDAO, auditoriaDAO }) {
    this.reportes = reporteDAO;
    this.solicitudes = solicitudDAO;
    this.auditoria = auditoriaDAO;
  }

  /** Panel de inicio: indicadores del rol + últimas 6 solicitudes. */
  async inicio(usuario) {
    const [indicadores, recientes] = await Promise.all([
      this.reportes.indicadores(usuario.id, usuario.rol),
      this.solicitudes.listar({ usuarioId: usuario.id, rol: usuario.rol }),
    ]);
    return { indicadores, recientes: recientes.slice(0, 6) };
  }

  reportesAdmin() {
    return this.reportes.reportesAdmin();
  }

  /** Genera el CSV de solicitudes (apto para Excel) y deja constancia en la auditoría. */
  async exportarSolicitudes(admin, ip) {
    const filas = await this.reportes.exportarSolicitudes();
    await this.auditoria.registrar({ usuarioId: admin.id, accion: "EXPORTAR_REPORTE", entidad: "solicitudes", ip, detalle: { filas: filas.length } });
    return {
      nombre: `solicitudes_${new Date().toISOString().slice(0, 10)}.csv`,
      contenido: aCsv(filas, COLUMNAS_CSV),
    };
  }

  async auditoriaReciente(filtros) {
    const [registros, acciones] = await Promise.all([this.auditoria.listar(filtros), this.auditoria.acciones()]);
    return { registros, acciones };
  }
}

module.exports = ReporteService;
