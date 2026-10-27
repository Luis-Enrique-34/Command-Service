# `models/` — Modelo de dominio (POO)

| Archivo | Concepto |
|---|---|
| `Usuario.js` | **Herencia**: `Cliente`, `Proveedor` y `Administrador` extienden `Usuario`. **Polimorfismo**: `participaEn()` responde distinto en cada rol. **Encapsulamiento**: `toJSON()` decide qué sale al navegador (nunca el hash). **Fábrica**: `Usuario.desde()` crea la subclase correcta. |
| `Solicitud.js` | **Máquina de estados**: la tabla `TRANSICIONES` define qué rol puede ejecutar cada acción y desde qué estado. Agregar una acción = agregar una entrada (**O** de SOLID). |

Pruebas: `tests/unit/Solicitud.model.test.js` (escritas antes del código, TDD).
