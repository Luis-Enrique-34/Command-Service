// Vista: Auditoría — bitácora de operaciones críticas (solo lectura).
import { api, html, $, fechaHora, ROLES, vacio } from "../core.js";

const ICONOS = {
  LOGIN: "fa-right-to-bracket", LOGIN_FALLIDO: "fa-user-lock", CUENTA_BLOQUEADA: "fa-lock", REGISTRO: "fa-user-plus",
  CREAR_SOLICITUD: "fa-file-circle-plus", CAMBIO_ESTADO: "fa-arrows-rotate", PAGO_CUSTODIA: "fa-shield-halved",
  VERIFICAR_PROVEEDOR: "fa-user-check", CREAR_SERVICIO: "fa-briefcase", RESENA: "fa-star",
  ACTIVAR_USUARIO: "fa-toggle-on", DESACTIVAR_USUARIO: "fa-toggle-off", EXPORTAR_REPORTE: "fa-file-export",
};
const PELIGRO = ["LOGIN_FALLIDO", "CUENTA_BLOQUEADA", "DESACTIVAR_USUARIO"];

function resumen(d) {
  if (!d) return "";
  return Object.entries(d).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
}

export default async function vistaAuditoria(cont) {
  let accion = "";
  cont.innerHTML = String(html`
    <div class="page-head"><div><h2>Auditoría</h2><p>Registro inalterable de accesos y operaciones críticas (quién, qué, cuándo y desde qué IP).</p></div></div>
    <div class="toolbar"><select class="select" id="accion" aria-label="Acción"><option value="">Todas las acciones</option></select></div>
    <div id="tabla"></div>`);

  async function cargar() {
    const { ok, data } = await api(`/api/admin/auditoria${accion ? `?accion=${accion}` : ""}`);
    if (!ok) throw new Error(data.mensaje);
    const sel = $("#accion");
    if (sel.options.length === 1) data.acciones.forEach((a) => sel.add(new Option(a.replaceAll("_", " ").toLowerCase(), a)));
    $("#tabla").innerHTML = String(data.registros.length ? html`<div class="table-wrap"><table>
      <thead><tr><th>Fecha</th><th>Acción</th><th>Usuario</th><th>Entidad</th><th>Detalle</th><th>IP</th></tr></thead>
      <tbody>${data.registros.map((r) => html`<tr>
        <td class="subtle nowrap">${fechaHora(r.creado_en)}</td>
        <td><span class="badge no-dot ${PELIGRO.includes(r.accion) ? "b-danger" : "b-red"}"><i class="fas ${ICONOS[r.accion] || "fa-circle-dot"}"></i> ${r.accion.replaceAll("_", " ")}</span></td>
        <td>${r.usuario ? html`<div class="titulo">${r.usuario}</div><div class="sub">${ROLES[r.rol] || ""}</div>` : html`<span class="subtle">—</span>`}</td>
        <td class="subtle">${r.entidad || "—"}</td>
        <td class="subtle" style="max-width:320px">${resumen(r.detalle)}</td>
        <td class="mono subtle">${r.ip || "—"}</td>
      </tr>`)}</tbody></table></div>` : html`<div class="card">${vacio("fa-clipboard-list", "Sin registros")}</div>`);
  }
  $("#accion").addEventListener("change", (e) => { accion = e.target.value; cargar(); });
  await cargar();
}
