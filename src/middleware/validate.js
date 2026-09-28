// Middleware genérico: valida req.body contra un esquema de Zod.
// Si es válido, reemplaza req.body por los datos "limpios" (trim, minúsculas...).
module.exports = (schema) => (req, res, next) => {
  const resultado = schema.safeParse(req.body ?? {});

  if (!resultado.success) {
    const errores = {};
    for (const issue of resultado.error.issues) {
      const campo = issue.path[0] ?? "general";
      if (!errores[campo]) errores[campo] = issue.message; // primer error por campo
    }
    return res.status(400).json({ ok: false, mensaje: "Revisa los datos ingresados", errores });
  }

  req.body = resultado.data;
  next();
};
