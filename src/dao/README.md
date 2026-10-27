# `dao/` — Patrón DAO (Data Access Object)

Los DAO son el **único lugar del sistema con SQL**. Los servicios piden datos ("busca la solicitud X") sin saber cómo se consultan.

- `BaseDAO.js` — clase base: `query()`, `uno()`, `varios()`, `afecta()` y `tx()` (transacciones). Recibe la conexión por constructor.
- `UsuarioDAO`, `ServicioDAO`, `SolicitudDAO`, `ReporteDAO`, `AuditoriaDAO` — **heredan** de `BaseDAO`, uno por entidad.
- `index.js` — crea una instancia de cada DAO para inyectarla en los servicios.

Reglas: consultas **parametrizadas** (`$1, $2…`, nunca texto concatenado → sin inyección SQL); el alcance por rol se aplica en el `WHERE`; los cambios de estado usan **bloqueo optimista** (`WHERE estado = $2`).
