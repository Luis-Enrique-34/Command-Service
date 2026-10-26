// Esquemas Zod de los módulos de negocio (servicios, solicitudes, perfil, admin).
const { z } = require("zod");

const textoOpcional = (max) =>
  z.string().trim().max(max, `Máximo ${max} caracteres`).optional().or(z.literal("")).transform((v) => v || null);

const MODALIDADES = ["presencial", "virtual", "mixta"];
const ESTADOS = ["por_confirmar", "aceptada", "rechazada", "pago_confirmado", "agendada", "en_curso", "completada", "cancelada"];

// ----------------------------------------------------------- Servicios
const servicioSchema = z.object({
  titulo: z.string({ error: "El título es obligatorio" }).trim().min(5, "Mínimo 5 caracteres").max(120),
  descripcion: textoOpcional(2000),
  categoria_id: z.coerce.number({ error: "Elige una categoría" }).int().positive("Elige una categoría"),
  precio: z.coerce.number({ error: "Precio no válido" }).min(1, "El precio mínimo es S/ 1").max(99999, "Precio demasiado alto"),
  modalidad: z.enum(MODALIDADES, { error: "Modalidad no válida" }),
  zona_cobertura: textoOpcional(120),
  duracion_horas: z.union([z.literal(""), z.null(), z.coerce.number().positive("Debe ser mayor a 0").max(999)]).optional()
    .transform((v) => (v === "" || v == null ? null : v)),
});

const estadoServicioSchema = z.object({ activo: z.boolean({ error: "Valor no válido" }) });

const catalogoQuery = z.object({
  q: z.string().trim().max(80).optional(),
  categoria: z.coerce.number().int().positive().optional().catch(undefined),
  modalidad: z.enum(MODALIDADES).optional().catch(undefined),
  orden: z.enum(["recientes", "precio_asc", "precio_desc", "calificacion"]).optional().catch(undefined),
});

// ----------------------------------------------------------- Solicitudes
const crearSolicitudSchema = z.object({
  servicio_id: z.uuid("Servicio no válido"),
  descripcion: z.string({ error: "Describe lo que necesitas" }).trim().min(10, "Cuéntanos un poco más (mínimo 10 caracteres)").max(1000),
  direccion: textoOpcional(200),
  fecha_preferida: z.union([z.literal(""), z.iso.date("Fecha no válida")]).optional().transform((v) => v || null),
});

const accionSchema = z
  .object({
    accion: z.enum(["aceptar", "rechazar", "pagar", "agendar", "iniciar", "completar", "cancelar"], { error: "Acción no válida" }),
    motivo: z.string().trim().max(255).optional(),
    metodo: z.enum(["tarjeta", "yape", "plin", "transferencia"], { error: "Elige un método de pago" }).optional(),
    fecha_programada: z.iso.datetime({ offset: true, local: true, error: "Fecha y hora no válidas" }).optional(),
  })
  .superRefine((d, ctx) => {
    if (["rechazar", "cancelar"].includes(d.accion) && (!d.motivo || d.motivo.length < 5)) {
      ctx.addIssue({ code: "custom", path: ["motivo"], message: "Indica el motivo (mínimo 5 caracteres)" });
    }
    if (d.accion === "pagar" && !d.metodo) ctx.addIssue({ code: "custom", path: ["metodo"], message: "Elige un método de pago" });
    if (d.accion === "agendar" && !d.fecha_programada) {
      ctx.addIssue({ code: "custom", path: ["fecha_programada"], message: "Indica la fecha y hora" });
    }
  });

const listarSolicitudesQuery = z.object({
  estado: z.enum(ESTADOS).optional().catch(undefined),
  q: z.string().trim().max(80).optional(),
});

const mensajeSchema = z.object({
  contenido: z.string({ error: "Escribe un mensaje" }).trim().min(1, "Escribe un mensaje").max(1000, "Máximo 1000 caracteres"),
});

const resenaSchema = z.object({
  puntaje: z.coerce.number({ error: "Elige una calificación" }).int().min(1, "Elige de 1 a 5 estrellas").max(5),
  comentario: textoOpcional(500),
});

// ----------------------------------------------------------- Perfil
const nombre = (campo) =>
  z.string({ error: `${campo} es obligatorio` }).trim().min(2, `${campo} debe tener al menos 2 caracteres`).max(80)
    .regex(/^[\p{L}\s'.-]+$/u, `${campo} solo puede contener letras`);

const perfilSchema = z.object({
  nombres: nombre("Nombres"),
  apellidos: nombre("Apellidos"),
  telefono: z.string().trim().regex(/^\+?[0-9\s]{7,20}$/, "Teléfono no válido").optional().or(z.literal("")),
  perfil: z
    .object({
      nombre_comercial: z.string().trim().min(3, "Mínimo 3 caracteres").max(120),
      documento: z.string().trim().regex(/^([0-9]{8}|[0-9]{11})$/, "DNI (8 dígitos) o RUC (11 dígitos)").optional().or(z.literal("")),
      descripcion: textoOpcional(1000),
      distrito: textoOpcional(80),
    })
    .optional(),
});

// ----------------------------------------------------------- Admin
const usuariosQuery = z.object({
  rol: z.enum(["cliente", "proveedor", "admin"]).optional().catch(undefined),
  q: z.string().trim().max(80).optional(),
});
const estadoUsuarioSchema = z.object({ activo: z.boolean({ error: "Valor no válido" }) });
const proveedoresQuery = z.object({ verificacion: z.enum(["pendiente", "aprobado", "rechazado"]).optional().catch(undefined) });
const verificacionSchema = z
  .object({
    estado: z.enum(["aprobado", "rechazado"], { error: "Estado no válido" }),
    motivo: z.string().trim().max(255).optional(),
  })
  .refine((d) => d.estado !== "rechazado" || (d.motivo && d.motivo.length >= 5), {
    path: ["motivo"], message: "Indica el motivo del rechazo (mínimo 5 caracteres)",
  });
const auditoriaQuery = z.object({ accion: z.string().trim().max(40).regex(/^[A-Z_]*$/).optional().catch(undefined) });

module.exports = {
  servicioSchema, estadoServicioSchema, catalogoQuery,
  crearSolicitudSchema, accionSchema, listarSolicitudesQuery, mensajeSchema, resenaSchema,
  perfilSchema, usuariosQuery, estadoUsuarioSchema, proveedoresQuery, verificacionSchema, auditoriaQuery,
};
