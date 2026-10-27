# `services/` — Lógica de negocio

Cada servicio es una clase que recibe sus DAO **por constructor** (inyección de dependencias, **D** de SOLID). No conoce HTTP (`req`/`res`) ni escribe SQL.

| Servicio | Responsabilidad |
|---|---|
| `AuthService` | Registro, login con bloqueo por intentos, Argon2id y JWT |
| `UsuarioService` | Perfil propio, administración de cuentas y verificación de proveedores |
| `ServicioService` | Catálogo y "Mis servicios" |
| `SolicitudService` | Flujo de contratación: valida con el modelo `Solicitud`, guarda con el DAO y audita |
| `ReporteService` | Indicadores, reportes, exportación CSV y auditoría |
| `SistemaService` | Verificación en vivo de las 9 librerías y salud del sistema |

`index.js` conecta las capas: crea cada servicio con los DAO que necesita. En las pruebas unitarias (`tests/unit/SolicitudService.test.js`) se le pasan DAO simulados.
