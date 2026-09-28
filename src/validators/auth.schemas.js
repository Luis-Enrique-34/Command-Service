// Validación de datos con Zod.
// Regla de oro: NUNCA confiar en lo que llega del navegador. La validación del
// frontend es solo para comodidad del usuario; la real ocurre aquí, en el servidor.
const { z } = require("zod");

const email = z
  .string({ error: "El correo es obligatorio" })
  .trim()
  .toLowerCase()
  .max(255)
  .email("Correo electrónico no válido");

// Política de contraseña: mínimo 8 caracteres, una mayúscula, una minúscula
// y un número. Máximo 128 para evitar ataques de denegación de servicio
// enviando contraseñas gigantes al algoritmo de hash.
const password = z
  .string({ error: "La contraseña es obligatoria" })
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(128, "La contraseña es demasiado larga")
  .regex(/[a-z]/, "Debe contener al menos una letra minúscula")
  .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula")
  .regex(/[0-9]/, "Debe contener al menos un número");

const nombre = (campo) =>
  z
    .string({ error: `${campo} es obligatorio` })
    .trim()
    .min(2, `${campo} debe tener al menos 2 caracteres`)
    .max(80)
    .regex(/^[\p{L}\s'.-]+$/u, `${campo} solo puede contener letras`);

const registroSchema = z
  .object({
    nombres: nombre("Nombres"),
    apellidos: nombre("Apellidos"),
    email,
    telefono: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s]{7,20}$/, "Teléfono no válido")
      .optional()
      .or(z.literal("")),
    password,
    confirmPassword: z.string(),
    // Solo se permite elegir cliente o proveedor. "admin" NUNCA desde el registro.
    rol: z.enum(["cliente", "proveedor"], { error: "Rol no válido" }),
    aceptaTerminos: z.literal(true, { error: "Debes aceptar los términos y condiciones" }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  email,
  password: z.string().min(1, "La contraseña es obligatoria").max(128),
});

module.exports = { registroSchema, loginSchema };
