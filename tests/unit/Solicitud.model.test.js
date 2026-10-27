// =====================================================================
//  PRUEBAS UNITARIAS del modelo Solicitud (máquina de estados).
//  TDD: estas reglas se escribieron como pruebas ANTES de implementar el
//  modelo (rojo → verde → refactor). No usan base de datos.
//  Ejecutar:  npm run test:unit
// =====================================================================
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Solicitud, TRANSICIONES } = require("../../src/models/Solicitud");
const { Usuario, Proveedor } = require("../../src/models/Usuario");

const cliente = { id: "c1", rol: "cliente" };
const proveedor = { id: "p1", rol: "proveedor" };
const otroProveedor = { id: "p2", rol: "proveedor" };
const admin = { id: "a1", rol: "admin" };
const sol = (estado) => new Solicitud({ estado, cliente_id: "c1", proveedor_id: "p1" });
const acciones = (s, u) => s.accionesPara(u).map((a) => a.accion).sort();

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

test("validarAccion explica por qué una acción no procede (403 / 409)", () => {
  assert.throws(() => sol("por_confirmar").validarAccion("aceptar", cliente), { status: 403 });
  assert.throws(() => sol("por_confirmar").validarAccion("completar", cliente), { status: 409 });
  assert.throws(() => sol("completada").validarAccion("cancelar", cliente), { status: 409, message: "La solicitud ya está cerrada" });
  assert.equal(sol("por_confirmar").validarAccion("aceptar", proveedor).hacia, "aceptada");
});

test("POO: la fábrica crea la subclase del rol y oculta datos sensibles", () => {
  const u = Usuario.desde({ id: "p1", nombres: "Diego", apellidos: "Salazar", rol: "proveedor", password_hash: "secreto" });
  assert.ok(u instanceof Proveedor);
  assert.ok(u instanceof Usuario); // herencia
  assert.equal(JSON.parse(JSON.stringify(u)).password_hash, undefined); // encapsulamiento
  assert.equal(u.perfil.verificacion, "pendiente");
});
