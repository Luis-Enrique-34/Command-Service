// =====================================================================
//  Rutas de negocio. Cada ruta declara, en orden: autenticación, rol,
//  validación y controlador. Así se lee de un vistazo quién puede hacer qué.
// =====================================================================
const { Router } = require("express");
const { validate, idParam } = require("../middleware/validate");
const { requireAuth, requireRol } = require("../middleware/requireAuth");
const s = require("../validators/negocio.schemas");
const servicio = require("../controllers/servicio.controller");
const solicitud = require("../controllers/solicitud.controller");
const panel = require("../controllers/panel.controller");

const router = Router();
router.use(requireAuth); // todo lo de aquí exige sesión

const cliente = requireRol("cliente");
const proveedor = requireRol("proveedor");
const admin = requireRol("admin");

// ---------- Inicio y perfil (todos los roles)
router.get("/inicio", panel.inicio);
router.get("/perfil", panel.verPerfil);
router.put("/perfil", validate(s.perfilSchema), panel.actualizarPerfil);

// ---------- Catálogo
router.get("/categorias", servicio.categorias);
router.get("/servicios", validate(s.catalogoQuery, "query"), servicio.catalogo);
router.get("/servicios/:id", idParam, servicio.detalle);

// ---------- Mis servicios (proveedor)
router.get("/mis-servicios", proveedor, servicio.misServicios);
router.post("/mis-servicios", proveedor, validate(s.servicioSchema), servicio.crear);
router.put("/mis-servicios/:id", proveedor, idParam, validate(s.servicioSchema), servicio.actualizar);
router.patch("/mis-servicios/:id/estado", proveedor, idParam, validate(s.estadoServicioSchema), servicio.cambiarEstado);

// ---------- Solicitudes (el alcance por rol se aplica en el DAO/servicio)
router.get("/solicitudes", validate(s.listarSolicitudesQuery, "query"), solicitud.listar);
router.post("/solicitudes", cliente, validate(s.crearSolicitudSchema), solicitud.crear);
router.get("/solicitudes/:id", idParam, solicitud.detalle);
router.patch("/solicitudes/:id/estado", idParam, validate(s.accionSchema), solicitud.accion);
router.post("/solicitudes/:id/mensajes", idParam, validate(s.mensajeSchema), solicitud.mensaje);
router.post("/solicitudes/:id/resena", cliente, idParam, validate(s.resenaSchema), solicitud.resena);
router.get("/agenda", proveedor, solicitud.agenda);

// ---------- Administración
router.get("/admin/usuarios", admin, validate(s.usuariosQuery, "query"), panel.usuarios);
router.patch("/admin/usuarios/:id/estado", admin, idParam, validate(s.estadoUsuarioSchema), panel.estadoUsuario);
router.get("/admin/proveedores", admin, validate(s.proveedoresQuery, "query"), panel.proveedores);
router.patch("/admin/proveedores/:id/verificacion", admin, idParam, validate(s.verificacionSchema), panel.verificarProveedor);
router.get("/admin/reportes", admin, panel.reportes);
router.get("/admin/reportes/solicitudes.csv", admin, panel.exportarCsv);
router.get("/admin/auditoria", admin, validate(s.auditoriaQuery, "query"), panel.verAuditoria);

// ---------- Sistema: verificación en vivo de librerías y salud
router.get("/sistema/librerias", admin, panel.librerias);
router.get("/sistema/salud", admin, panel.salud);

module.exports = router;
