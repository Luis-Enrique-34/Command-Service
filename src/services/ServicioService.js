// =====================================================================
//  SERVICIO del catálogo y de "Mis servicios" (proveedor).
// =====================================================================
const { Usuario } = require("../models/Usuario");
const { noEncontrado } = require("../utils/HttpError");

class ServicioService {
  constructor({ servicioDAO, auditoriaDAO }) {
    this.servicios = servicioDAO;
    this.auditoria = auditoriaDAO;
  }

  categorias() {
    return this.servicios.listarCategorias();
  }

  catalogo(filtros) {
    return this.servicios.catalogo(filtros);
  }

  /** Un cliente no ve servicios inactivos ni de proveedores sin verificar. */
  async detalle(id, usuario) {
    const s = await this.servicios.buscarPorId(id);
    const u = Usuario.desde(usuario);
    const visible = s && ((s.activo && s.verificacion === "aprobado") || s.proveedor_id === u.id || u.esAdmin);
    if (!visible) throw noEncontrado("el servicio");
    return s;
  }

  deProveedor(usuario) {
    return this.servicios.listarDeProveedor(usuario.id);
  }

  async crear(usuario, datos, ip) {
    const id = await this.servicios.crear(usuario.id, datos);
    await this.auditoria.registrar({ usuarioId: usuario.id, accion: "CREAR_SERVICIO", entidad: "servicios", entidadId: id, ip,
      detalle: { titulo: datos.titulo } });
    return this.servicios.buscarPorId(id);
  }

  async actualizar(usuario, id, datos) {
    if (!(await this.servicios.actualizar(id, usuario.id, datos))) throw noEncontrado("el servicio");
    return this.servicios.buscarPorId(id);
  }

  async cambiarEstado(usuario, id, activo) {
    if (!(await this.servicios.cambiarEstado(id, usuario.id, activo))) throw noEncontrado("el servicio");
  }
}

module.exports = ServicioService;
