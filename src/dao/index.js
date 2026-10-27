// =====================================================================
//  Registro de DAO: crea UNA instancia de cada DAO con la conexión de la
//  aplicación. Los servicios los reciben desde aquí (inyección de
//  dependencias), así una prueba puede reemplazarlos por DAO simulados.
// =====================================================================
const UsuarioDAO = require("./UsuarioDAO");
const ServicioDAO = require("./ServicioDAO");
const SolicitudDAO = require("./SolicitudDAO");
const ReporteDAO = require("./ReporteDAO");
const AuditoriaDAO = require("./AuditoriaDAO");

module.exports = {
  usuarioDAO: new UsuarioDAO(),
  servicioDAO: new ServicioDAO(),
  solicitudDAO: new SolicitudDAO(),
  reporteDAO: new ReporteDAO(),
  auditoriaDAO: new AuditoriaDAO(),
};
