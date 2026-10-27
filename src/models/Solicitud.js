// =====================================================================
//  MODELO: Solicitud y su MÁQUINA DE ESTADOS
//
//  La tabla TRANSICIONES define, en un solo lugar, qué acción puede
//  ejecutar cada rol y desde qué estado. Agregar una acción nueva es
//  agregar una entrada: el resto del código no cambia
//  (principio O de SOLID: abierto a extensión, cerrado a modificación).
// =====================================================================
const { Usuario } = require("./Usuario");
const { HttpError } = require("../utils/HttpError");

//             estados de origen                       estado destino            quién puede
const TRANSICIONES = Object.freeze({
  aceptar:   { desde: ["por_confirmar"],               hacia: "aceptada",        roles: ["proveedor"],
               etiqueta: "Aceptar" },
  rechazar:  { desde: ["por_confirmar"],               hacia: "rechazada",       roles: ["proveedor"],
               etiqueta: "Rechazar", requiere: ["motivo"] },
  pagar:     { desde: ["aceptada"],                    hacia: "pago_confirmado", roles: ["cliente"],
               etiqueta: "Pagar", requiere: ["metodo"] },
  agendar:   { desde: ["pago_confirmado", "agendada"], hacia: "agendada",        roles: ["proveedor"],
               etiqueta: "Agendar", requiere: ["fecha_programada"] },
  iniciar:   { desde: ["agendada"],                    hacia: "en_curso",        roles: ["proveedor"],
               etiqueta: "Iniciar servicio" },
  completar: { desde: ["en_curso"],                    hacia: "completada",      roles: ["cliente"],
               etiqueta: "Dar conformidad" },
  cancelar:  { desde: ["por_confirmar", "aceptada", "pago_confirmado", "agendada"],
               hacia: "cancelada", roles: ["cliente", "proveedor", "admin"],
               etiqueta: "Cancelar", requiere: ["motivo"] },
});

const ESTADOS_FINALES = Object.freeze(["completada", "rechazada", "cancelada"]);

class Solicitud {
  static TRANSICIONES = TRANSICIONES;
  static ESTADOS_FINALES = ESTADOS_FINALES;

  /** @param {object} fila fila de la tabla solicitudes (id, estado, cliente_id, proveedor_id, ...) */
  constructor(fila) {
    Object.assign(this, fila);
  }

  get esFinal() {
    return ESTADOS_FINALES.includes(this.estado);
  }

  /** ¿Puede este usuario ver la solicitud? (cliente dueño, proveedor asignado o admin) */
  visiblePara(usuario) {
    return Usuario.desde(usuario).participaEn(this);
  }

  /** Acciones que el usuario puede ejecutar ahora, según su rol y el estado actual. */
  accionesPara(usuario) {
    const u = Usuario.desde(usuario);
    if (!u.participaEn(this)) return [];
    return Object.entries(TRANSICIONES)
      .filter(([, t]) => t.roles.includes(u.rol) && t.desde.includes(this.estado))
      .map(([accion, t]) => ({ accion, etiqueta: t.etiqueta, requiere: t.requiere || [] }));
  }

  /**
   * Valida una acción y devuelve su transición. Si no es válida, lanza un
   * HttpError con el motivo exacto (400, 403 o 409).
   * @returns {{desde:string[], hacia:string, roles:string[], etiqueta:string, requiere?:string[]}}
   */
  validarAccion(accion, usuario) {
    const t = TRANSICIONES[accion];
    if (!t) throw new HttpError(400, "Acción no válida");
    if (this.accionesPara(usuario).some((a) => a.accion === accion)) return t;

    const verbo = t.etiqueta.toLowerCase();
    if (this.esFinal) throw new HttpError(409, "La solicitud ya está cerrada");
    if (!t.roles.includes(usuario.rol)) throw new HttpError(403, `Tu rol no puede ${verbo} esta solicitud`);
    throw new HttpError(409, `No se puede ${verbo} una solicitud en estado "${this.estado.replace("_", " ")}"`);
  }
}

module.exports = { Solicitud, TRANSICIONES, ESTADOS_FINALES };
