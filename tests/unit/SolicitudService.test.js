// =====================================================================
//  PRUEBAS UNITARIAS de SolicitudService con DAO SIMULADOS.
//  El servicio recibe sus DAO por constructor (inyección de dependencias,
//  principio D de SOLID). Aquí se le pasan objetos falsos en memoria:
//  se prueban las reglas de negocio sin base de datos ni servidor.
// =====================================================================
const { test } = require("node:test");
const assert = require("node:assert/strict");
const SolicitudService = require("../../src/services/SolicitudService");

/** Crea el servicio con una solicitud en memoria y registra lo que se guardó. */
function crearServicio(estado) {
  const guardado = { cambios: [], auditoria: [] };
  const fila = { id: "s1", codigo: "SOL-000001", estado, monto: 120, cliente_id: "c1", proveedor_id: "p1", pago_estado: null };
  const solicitudDAO = {
    buscarBase: async () => ({ ...fila }),
    detalle: async () => ({ ...fila, historial: [], mensajes: [] }),
    cambiarEstado: async (c) => { guardado.cambios.push(c); fila.estado = c.estadoNuevo; return true; },
  };
  const auditoriaDAO = { registrar: async (e) => guardado.auditoria.push(e.accion) };
  const servicio = new SolicitudService({ solicitudDAO, servicioDAO: {}, auditoriaDAO });
  return { servicio, guardado };
}

const proveedor = { id: "p1", rol: "proveedor" };
const cliente = { id: "c1", rol: "cliente" };

test("aceptar: el proveedor cambia el estado y queda auditado", async () => {
  const { servicio, guardado } = crearServicio("por_confirmar");
  const r = await servicio.ejecutarAccion("s1", proveedor, { accion: "aceptar" }, "127.0.0.1");
  assert.equal(guardado.cambios[0].estadoNuevo, "aceptada");
  assert.equal(guardado.cambios[0].estadoActual, "por_confirmar"); // bloqueo optimista
  assert.deepEqual(guardado.auditoria, ["CAMBIO_ESTADO"]);
  assert.ok(Array.isArray(r.acciones));
});

test("pagar: crea el pago en custodia por el monto de la solicitud", async () => {
  const { servicio, guardado } = crearServicio("aceptada");
  await servicio.ejecutarAccion("s1", cliente, { accion: "pagar", metodo: "yape" });
  assert.equal(guardado.cambios[0].pago.crear.monto, 120);
  assert.match(guardado.cambios[0].pago.crear.referencia, /^OP-\d{6}$/);
});

test("una acción inválida no llega a tocar la base de datos", async () => {
  const { servicio, guardado } = crearServicio("por_confirmar");
  await assert.rejects(servicio.ejecutarAccion("s1", cliente, { accion: "completar" }), { status: 409 });
  await assert.rejects(servicio.ejecutarAccion("s1", { id: "x", rol: "proveedor" }, { accion: "aceptar" }), { status: 404 });
  assert.equal(guardado.cambios.length, 0);
});
