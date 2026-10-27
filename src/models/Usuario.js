// =====================================================================
//  MODELO: Usuario y sus roles (Programación Orientada a Objetos)
//
//  · Herencia ......... Cliente, Proveedor y Administrador extienden Usuario.
//  · Polimorfismo ..... participaEn() responde distinto según el rol.
//  · Encapsulamiento .. el hash de la contraseña nunca entra al modelo y
//                        toJSON() decide qué datos salen hacia el navegador.
//  · Fábrica .......... Usuario.desde() crea la subclase correcta.
// =====================================================================

class Usuario {
  /** @param {{id:string, rol:string, nombres?:string, apellidos?:string, email?:string, telefono?:string}} d */
  constructor({ id, nombres, apellidos, email, telefono, rol }) {
    this.id = id;
    this.nombres = nombres;
    this.apellidos = apellidos;
    this.email = email;
    this.telefono = telefono ?? null;
    this.rol = rol;
  }

  /**
   * Fábrica: recibe una fila de la BD (o el contenido del token de sesión)
   * y devuelve la subclase que corresponde a su rol.
   * @returns {Usuario}
   */
  static desde(datos) {
    if (datos instanceof Usuario) return datos;
    const Clase = ROLES[datos.rol] || Usuario;
    return new Clase(datos);
  }

  get nombreCompleto() {
    return `${this.nombres ?? ""} ${this.apellidos ?? ""}`.trim();
  }

  get esAdmin() {
    return false;
  }

  /** ¿Participa este usuario en la solicitud? Cada rol lo redefine (polimorfismo). */
  participaEn(_solicitud) {
    return false;
  }

  /** Datos públicos: lo único que se envía al navegador (nunca el hash). */
  toJSON() {
    const { id, nombres, apellidos, email, telefono, rol } = this;
    return { id, nombres, apellidos, email, telefono, rol };
  }
}

class Cliente extends Usuario {
  participaEn(solicitud) {
    return solicitud.cliente_id === this.id;
  }
}

class Proveedor extends Usuario {
  constructor(datos) {
    super(datos);
    this.perfil = {
      nombre_comercial: datos.nombre_comercial ?? null,
      documento: datos.documento ?? null,
      descripcion: datos.descripcion ?? null,
      distrito: datos.distrito ?? null,
      verificacion: datos.verificacion ?? "pendiente",
      motivo_rechazo: datos.motivo_rechazo ?? null,
    };
  }

  get estaVerificado() {
    return this.perfil.verificacion === "aprobado";
  }

  participaEn(solicitud) {
    return solicitud.proveedor_id === this.id;
  }

  toJSON() {
    return { ...super.toJSON(), perfil: this.perfil };
  }
}

class Administrador extends Usuario {
  get esAdmin() {
    return true;
  }

  /** El administrador supervisa todas las solicitudes. */
  participaEn() {
    return true;
  }
}

const ROLES = { cliente: Cliente, proveedor: Proveedor, admin: Administrador };

module.exports = { Usuario, Cliente, Proveedor, Administrador };
