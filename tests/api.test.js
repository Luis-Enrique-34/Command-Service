// Pruebas de INTEGRACIÓN de la API (servidor real + base de datos del .env).
// Usan las cuentas demo (npm run db:seed). Solo leen datos o prueban rechazos:
// no crean solicitudes, así se pueden ejecutar también contra Supabase.
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent"; // salida limpia en las pruebas
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const app = require("../src/app");
const db = require("../src/config/db");

const PASS = "Demo2026!";
let server, base;

before(async () => {
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((ok) => server.close(ok));
  await db.pool.end();
});

async function pedir(ruta, { method = "GET", body, cookie } = {}) {
  const res = await fetch(base + ruta, {
    method,
    headers: { ...(body && { "Content-Type": "application/json" }), ...(cookie && { Cookie: cookie }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const tipo = res.headers.get("content-type") || "";
  return { status: res.status, headers: res.headers, data: tipo.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer()) };
}

async function entrar(usuario) {
  const r = await pedir("/api/auth/login", { method: "POST", body: { email: `${usuario}@demo.commandservice.pe`, password: PASS } });
  assert.equal(r.status, 200, `login de ${usuario}: ${JSON.stringify(r.data)}`);
  return r.headers.get("set-cookie").split(";")[0];
}

test("login correcto entrega cookie HttpOnly y SameSite=Strict", async () => {
  const r = await pedir("/api/auth/login", { method: "POST", body: { email: "ana.torres@demo.commandservice.pe", password: PASS } });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.equal(r.data.usuario.password_hash, undefined, "nunca se devuelve el hash");
});

test("login incorrecto responde mensaje genérico", async () => {
  const r = await pedir("/api/auth/login", { method: "POST", body: { email: "no-existe@demo.commandservice.pe", password: "Xx123456" } });
  assert.equal(r.status, 401);
  assert.equal(r.data.mensaje, "Correo o contraseña incorrectos");
});

test("las rutas privadas exigen sesión", async () => {
  for (const ruta of ["/api/inicio", "/api/solicitudes", "/api/servicios", "/api/sistema/librerias"]) {
    assert.equal((await pedir(ruta)).status, 401, ruta);
  }
});

test("un cliente no accede a rutas de administración ni de proveedor", async () => {
  const cookie = await entrar("ana.torres");
  assert.equal((await pedir("/api/admin/usuarios", { cookie })).status, 403);
  assert.equal((await pedir("/api/sistema/librerias", { cookie })).status, 403);
  assert.equal((await pedir("/api/mis-servicios", { cookie })).status, 403);
});

test("el catálogo solo muestra proveedores verificados", async () => {
  const cookie = await entrar("ana.torres");
  const r = await pedir("/api/servicios", { cookie });
  assert.equal(r.status, 200);
  assert.ok(r.data.servicios.length > 0);
  assert.ok(r.data.servicios.every((s) => s.verificacion === "aprobado"));
});

test("un proveedor no ve solicitudes de otro proveedor (IDOR → 404)", async () => {
  const diego = await entrar("diego.salazar");
  const valeria = await entrar("valeria.quispe");
  const { data } = await pedir("/api/solicitudes", { cookie: diego });
  const ajena = data.solicitudes[0];
  assert.ok(ajena, "Diego debe tener solicitudes en la demo");
  assert.equal((await pedir(`/api/solicitudes/${ajena.id}`, { cookie: valeria })).status, 404);
  assert.equal((await pedir(`/api/solicitudes/${ajena.id}`, { cookie: diego })).status, 200);
});

test("la validación rechaza datos inválidos e IDs mal formados", async () => {
  const cookie = await entrar("ana.torres");
  assert.equal((await pedir("/api/solicitudes/123", { cookie })).status, 400);
  const r = await pedir("/api/solicitudes", { method: "POST", cookie, body: { servicio_id: "x", descripcion: "corto" } });
  assert.equal(r.status, 400);
  assert.ok(r.data.errores.servicio_id && r.data.errores.descripcion);
});

test("un cliente no puede aceptar solicitudes (rol incorrecto)", async () => {
  const cookie = await entrar("ana.torres");
  const { data } = await pedir("/api/solicitudes?estado=por_confirmar", { cookie });
  if (!data.solicitudes.length) return; // sin datos para probar
  const r = await pedir(`/api/solicitudes/${data.solicitudes[0].id}/estado`, { method: "PATCH", cookie, body: { accion: "aceptar" } });
  assert.equal(r.status, 403);
});

test("el admin verifica las librerías en vivo y todas funcionan", async () => {
  const cookie = await entrar("admin");
  const r = await pedir("/api/sistema/librerias", { cookie });
  assert.equal(r.status, 200);
  const caidas = r.data.librerias.filter((l) => !l.ok).map((l) => `${l.nombre}: ${l.detalle}`);
  assert.deepEqual(caidas, []);
});

test("el reporte CSV se descarga con BOM y cabeceras", async () => {
  const cookie = await entrar("admin");
  const r = await pedir("/api/admin/reportes/solicitudes.csv", { cookie });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/csv/);
  assert.deepEqual([...r.data.subarray(0, 3)], [0xef, 0xbb, 0xbf], "BOM UTF-8 para que Excel respete tildes");
  assert.ok(r.data.toString("utf8", 3).startsWith("codigo;estado"));
});

test("cabeceras de seguridad presentes (Helmet) y sin X-Powered-By", async () => {
  const r = await pedir("/login.html");
  assert.ok(r.headers.get("content-security-policy"));
  assert.equal(r.headers.get("x-powered-by"), null);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});
