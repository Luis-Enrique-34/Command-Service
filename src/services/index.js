// =====================================================================
//  Composición de servicios: aquí se "conectan" las capas.
//  Cada servicio recibe los DAO que necesita (inyección de dependencias).
//  Los controladores importan los servicios desde este archivo.
// =====================================================================
const daos = require("../dao");
const database = require("../config/database");
const AuthService = require("./AuthService");
const UsuarioService = require("./UsuarioService");
const ServicioService = require("./ServicioService");
const SolicitudService = require("./SolicitudService");
const ReporteService = require("./ReporteService");
const SistemaService = require("./SistemaService");

module.exports = {
  authService: new AuthService(daos),
  usuarioService: new UsuarioService(daos),
  servicioService: new ServicioService(daos),
  solicitudService: new SolicitudService(daos),
  reporteService: new ReporteService(daos),
  sistemaService: new SistemaService({ reporteDAO: daos.reporteDAO, db: database }),
};
