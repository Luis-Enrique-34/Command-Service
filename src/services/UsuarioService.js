// =====================================================================
//  SERVICIO de usuarios: perfil propio y administración de cuentas y
//  verificación de proveedores.
// =====================================================================
const { Usuario } = require("../models/Usuario");
const { HttpError, noEncontrado } = require("../utils/HttpError");

class UsuarioService {
  constructor({ usuarioDAO, auditoriaDAO }) {
    this.usuarios = usuarioDAO;
    this.auditoria = auditoriaDAO;
  }

  async perfil(id) {
    const fila = await this.usuarios.buscarPorId(id);
    if (!fila) throw noEncontrado("el usuario");
    return Usuario.desde(fila);
  }

  async actualizarPerfil(usuario, datos) {
    await this.usuarios.actualizarPerfil(usuario.id, usuario.rol, datos);
    return this.perfil(usuario.id);
  }

  // ------------------------------------------------------- ADMINISTRACIÓN
  listar(filtros) {
    return this.usuarios.listar(filtros);
  }

  async cambiarEstado(admin, id, activo, ip) {
    if (id === admin.id) throw new HttpError(400, "No puedes desactivar tu propia cuenta");
    if (!(await this.usuarios.cambiarEstado(id, activo))) throw noEncontrado("el usuario");
    await this.auditoria.registrar({ usuarioId: admin.id, accion: activo ? "ACTIVAR_USUARIO" : "DESACTIVAR_USUARIO",
      entidad: "usuarios", entidadId: id, ip });
  }

  listarProveedores(filtros) {
    return this.usuarios.listarProveedores(filtros);
  }

  async verificarProveedor(admin, id, { estado, motivo }, ip) {
    if (!(await this.usuarios.verificarProveedor(id, admin.id, estado, motivo))) throw noEncontrado("el proveedor");
    await this.auditoria.registrar({ usuarioId: admin.id, accion: "VERIFICAR_PROVEEDOR", entidad: "perfiles_proveedor",
      entidadId: id, ip, detalle: { estado, motivo: motivo || null } });
  }
}

module.exports = UsuarioService;
