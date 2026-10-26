// Pruebas UNITARIAS de la máquina de estados (no usan la base de datos).
// Ejecutar:  npm test
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { TRANSICIONES, accionesDisponibles } = require("../src/services/solicitud.service");

const cliente = { id: "c1", rol: "cliente" };
const proveedor = { id: "p1", rol: "proveedor" };
const otroProveedor = { id: "p2", rol: "proveedor" };
const admin = { id: "a1", rol: "admin" };
const sol = (estado) => ({ estado, cliente_id: "c1", proveedor_id: "p1" });
const acciones = (s, u) => accionesDisponibles(s, u).map((a) => a.accion).sort();

test("el flujo feliz recorre los 6 estados en orden", () => {
  const camino = ["aceptar", "pagar", "agendar", "iniciar", "completar"];
  let estado = "por_confirmar";
  for (const accion of camino) {
    assert.ok(TRANSICIONES[accion].desde.includes(estado), `${accion} debe poder ejecutarse desde ${estado}`);
    estado = TRANSICIONES[accion].hacia;
  }
  assert.equal(estado, "completada");
});

test("solo el proveedor dueño puede aceptar o rechazar", () => {
  assert.deepEqual(acciones(sol("por_confirmar"), proveedor), ["aceptar", "cancelar", "rechazar"]);
  assert.deepEqual(acciones(sol("por_confirmar"), otroProveedor), []); // no es su solicitud
  assert.deepEqual(acciones(sol("por_confirmar"), cliente), ["cancelar"]);
});

test("solo el cliente paga y da la conformidad", () => {
  assert.deepEqual(acciones(sol("aceptada"), cliente), ["cancelar", "pagar"]);
  assert.ok(!acciones(sol("aceptada"), proveedor).includes("pagar"));
  assert.deepEqual(acciones(sol("en_curso"), cliente), ["completar"]);
  assert.deepEqual(acciones(sol("en_curso"), proveedor), []);
});

test("no se puede saltar estados (por_confirmar → completada)", () => {
  assert.ok(!acciones(sol("por_confirmar"), cliente).includes("completar"));
  assert.ok(!TRANSICIONES.completar.desde.includes("por_confirmar"));
});

test("los estados finales no admiten acciones", () => {
  for (const final of ["completada", "rechazada", "cancelada"]) {
    for (const u of [cliente, proveedor, admin]) assert.deepEqual(acciones(sol(final), u), [], `${final} / ${u.rol}`);
  }
});

test("el administrador solo puede cancelar (supervisión)", () => {
  assert.deepEqual(acciones(sol("agendada"), admin), ["cancelar"]);
  assert.deepEqual(acciones(sol("en_curso"), admin), []);
});

test("las acciones que piden datos los declaran", () => {
  assert.deepEqual(TRANSICIONES.rechazar.requiere, ["motivo"]);
  assert.deepEqual(TRANSICIONES.pagar.requiere, ["metodo"]);
  assert.deepEqual(TRANSICIONES.agendar.requiere, ["fecha_programada"]);
});
