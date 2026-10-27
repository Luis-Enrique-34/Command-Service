// Vista: Sistema y librerías — verificación EN VIVO de cada librería (se
// ejecuta una prueba real en el servidor), salud de la BD y log de peticiones
// que se actualiza solo mientras se usa la plataforma.
import { api, html, raw, $, hace, toast } from "../core.js";

const CAPAS = [
  { icono: "fa-display", nombre: "Vista", texto: "HTML, CSS y JS (módulos ES). Tema claro/oscuro.", codigo: "public/" },
  { icono: "fa-route", nombre: "Rutas + middleware", texto: "Sesión JWT, roles, validación Zod, rate limit.", codigo: "src/routes · src/middleware" },
  { icono: "fa-gamepad", nombre: "Controlador", texto: "Traduce HTTP ↔ negocio. Sin SQL.", codigo: "src/controllers" },
  { icono: "fa-gears", nombre: "Servicio", texto: "Reglas de negocio y máquina de estados.", codigo: "src/services" },
  { icono: "fa-database", nombre: "DAO → PostgreSQL", texto: "Único lugar con SQL parametrizado.", codigo: "src/dao → Supabase" },
];

export default async function vistaSistema(cont) {
  let auto = true;
  let timer = null;

  cont.innerHTML = String(html`
    <div class="page-head">
      <div><h2>Sistema y librerías</h2><p>Cada librería se verifica ejecutándola en el servidor en este momento: versión instalada, resultado y tiempo.</p></div>
      <div style="display:flex;gap:10px;align-items:center">
        <label class="subtle" style="display:flex;gap:8px;align-items:center;cursor:pointer"><span class="switch"><input type="checkbox" id="auto" checked><span></span></span> Monitoreo en vivo</label>
        <button class="btn btn-red" id="verificar"><i class="fas fa-rotate"></i> Verificar ahora</button>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3><i class="fas fa-layer-group red"></i> Arquitectura por capas (MVC + Servicio + DAO)</h3><span class="subtle">una petición recorre las capas de izquierda a derecha</span></div>
      <div class="arq">${CAPAS.map((c) => html`<div class="capa"><h4><i class="fas ${c.icono}"></i>${c.nombre}</h4><p>${c.texto}</p><code>${c.codigo}</code></div>`)}</div>
    </div>

    <div class="card mt">
      <div class="card-head"><h3><i class="fas fa-cubes red"></i> Librerías del proyecto</h3><span class="subtle" id="libResumen"></span></div>
      <div class="table-wrap" style="box-shadow:none"><table>
        <thead><tr><th></th><th>Librería</th><th>Versión</th><th>Capa</th><th>Uso y seguridad</th><th>Prueba en vivo</th><th class="num">ms</th></tr></thead>
        <tbody id="libs"><tr><td colspan="7"><div class="skeleton" style="height:160px"></div></td></tr></tbody>
      </table></div>
      <p class="subtle" id="devLibs" style="margin-top:10px"></p>
    </div>

    <div class="grid grid-3 mt" id="salud"></div>

    <div class="grid grid-2 mt">
      <div class="card">
        <div class="card-head"><h3><i class="fas fa-table red"></i> Tablas en la base de datos</h3><span class="subtle">RLS = Row Level Security</span></div>
        <div id="tablas"></div>
      </div>
      <div class="card">
        <div class="card-head"><h3><span class="estado-dot pulso"></span>&nbsp; Peticiones recientes a la API</h3><span class="subtle">se actualiza cada 5 s</span></div>
        <div class="log" id="log"></div>
      </div>
    </div>`);

  async function cargarLibrerias() {
    const btn = $("#verificar");
    btn.disabled = true;
    const { ok, data } = await api("/api/sistema/librerias");
    btn.disabled = false;
    if (!ok) return toast(data.mensaje, "error");
    const okN = data.librerias.filter((l) => l.ok).length;
    $("#libResumen").innerHTML = String(html`<span class="badge ${okN === data.librerias.length ? "b-ok" : "b-danger"}">${okN}/${data.librerias.length} operativas</span> · verificado ${new Date().toLocaleTimeString("es-PE")}`);
    $("#libs").innerHTML = String(html`${data.librerias.map((l) => html`<tr>
      <td><span class="estado-dot ${l.ok ? "" : "mal"}" title="${l.ok ? "Operativa" : "Falló"}"></span></td>
      <td><strong class="mono">${l.nombre}</strong><div class="sub">${l.categoria}</div></td>
      <td class="mono nowrap">${l.instalada || "no instalada"}<div class="sub">declarada ${l.declarada}</div></td>
      <td class="subtle">${l.capa}</td>
      <td style="max-width:300px"><div style="font-size:.85rem">${l.uso}</div><div class="sub"><i class="fas fa-lock"></i> ${l.seguridad}</div></td>
      <td style="max-width:260px;font-size:.83rem" class="${l.ok ? "" : "red"}">${l.detalle}</td>
      <td class="num mono">${l.ms ?? "—"}</td>
    </tr>`)}`);
    $("#devLibs").textContent = `Desarrollo: ${data.desarrollo.map((d) => `${d.nombre} ${d.instalada || d.declarada}`).join(", ")} · Pruebas automáticas: node:test (incluido en Node.js)`;
  }

  async function cargarSalud() {
    const { ok, data } = await api("/api/sistema/salud");
    if (!ok) return;
    const b = data.baseDatos;
    $("#salud").innerHTML = String(html`
      <div class="card kpi"><div class="kpi-icon ${b.ok ? "ok" : ""}"><i class="fas fa-database"></i></div><div>
        <div class="kpi-label">Base de datos · ${b.motor}</div><div class="kpi-value">${b.latencia_ms ?? "—"} ms</div>
        <div class="kpi-sub">SSL: ${b.ssl} · pool ${b.pool.abiertas}/${b.pool.max} (${b.pool.libres} libres)</div></div></div>
      <div class="card kpi"><div class="kpi-icon info"><i class="fas fa-bolt"></i></div><div>
        <div class="kpi-label">Consultas SQL ejecutadas</div><div class="kpi-value">${b.consultas.total}</div>
        <div class="kpi-sub">promedio ${b.consultas.promedio_ms} ms · ${b.consultas.lentas} lentas · ${b.consultas.errores} con error</div></div></div>
      <div class="card kpi"><div class="kpi-icon violet"><i class="fab fa-node-js"></i></div><div>
        <div class="kpi-label">Servidor ${data.app.nombre} v${data.app.version}</div><div class="kpi-value">${data.runtime.node}</div>
        <div class="kpi-sub">${data.app.entorno} · ${data.runtime.memoria_mb} MB · activo hace ${Math.floor(data.runtime.uptime_s / 60)} min</div></div></div>`);
    $("#tablas").innerHTML = String(html`<div class="table-scroll"><table><thead><tr><th>Tabla</th><th class="num">Filas</th><th>RLS</th></tr></thead><tbody>
      ${b.tablas.map((t) => html`<tr><td class="mono">${t.tabla}</td><td class="num">${t.filas}</td><td>${t.rls ? html`<span class="badge b-ok">activo</span>` : html`<span class="badge b-danger">inactivo</span>`}</td></tr>`)}
    </tbody></table></div>`);
    $("#log").innerHTML = String(html`${data.peticiones.map((p) => {
      const seg = String(p.estado)[0];
      return html`<div><span class="subtle">${new Date(p.fecha).toLocaleTimeString("es-PE", { hour12: false })}</span><span class="m-${p.metodo.toLowerCase()}">${p.metodo}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.ruta}">${p.ruta.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id")}</span>
        <span class="s${seg}">${p.estado}</span><span class="subtle num">${p.ms} ms</span></div>`;
    })}`);
  }

  $("#verificar").addEventListener("click", () => { cargarLibrerias(); cargarSalud(); });
  $("#auto").addEventListener("change", (e) => { auto = e.target.checked; });

  await Promise.all([cargarLibrerias(), cargarSalud()]);
  timer = setInterval(() => { if (auto && document.visibilityState === "visible") cargarSalud(); }, 5000);
  return () => clearInterval(timer); // se detiene al salir de la vista
}
