# `controllers/` — Controlador (la "C" de MVC)

Un controlador **solo traduce HTTP ↔ servicio**: lee la petición, llama al servicio y responde JSON. No tiene SQL ni reglas de negocio. Los errores (`HttpError`) los convierte en respuesta el manejador central de `app.js`.

| Controlador | Rutas |
|---|---|
| `auth.controller.js` | `/api/auth/registro · login · logout · me` (cookie de sesión HttpOnly) |
| `panel.controller.js` | `/api/inicio`, `/api/perfil` |
| `servicio.controller.js` | `/api/categorias`, `/api/servicios`, `/api/mis-servicios` |
| `solicitud.controller.js` | `/api/solicitudes/...`, `/api/agenda` |
| `admin.controller.js` | `/api/admin/...` (usuarios, proveedores, reportes, CSV, auditoría) |
| `sistema.controller.js` | `/api/sistema/librerias`, `/api/sistema/salud` |
