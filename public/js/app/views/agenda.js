// Vista: Agenda del proveedor — servicios por programar, agendados y en curso.
import { api, html, dinero, badgeEstado, vacio } from "../core.js";
import { abrirDetalle } from "./solicitudes.js";

const dia = (v) => {
  const t = new Date(v).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const hora = (v) => new Date(v).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

export default async function vistaAgenda(cont) {
  async function pintar() {
    const { ok, data } = await api("/api/agenda");
    if (!ok) throw new Error(data.mensaje);
    const sinFecha = data.agenda.filter((s) => !s.fecha_programada || s.estado === "pago_confirmado");
    const grupos = {};
    for (const s of data.agenda.filter((x) => x.fecha_programada && x.estado !== "pago_confirmado")) {
      (grupos[new Date(s.fecha_programada).toDateString()] ||= []).push(s);
    }
    const item = (s) => html`<div class="card clic" data-id="${s.id}" style="cursor:pointer;display:flex;gap:16px;align-items:center;padding:14px 18px">
      <div style="text-align:center;min-width:64px">
        <div class="kpi-value" style="font-size:1.1rem">${s.fecha_programada && s.estado !== "pago_confirmado" ? hora(s.fecha_programada) : "—"}</div>
        <div class="subtle mono">${s.codigo}</div>
      </div>
      <div style="flex:1;min-width:0">
        <div class="titulo" style="font-weight:600">${s.servicio}</div>
        <div class="subtle"><i class="fas fa-user"></i> ${s.cliente}${s.cliente_telefono ? ` · ${s.cliente_telefono}` : ""}${s.direccion ? html` · <i class="fas fa-location-dot"></i> ${s.direccion}` : ""}</div>
      </div>
      <div style="text-align:right">${badgeEstado(s.estado)}<div class="subtle" style="margin-top:4px">${dinero(s.monto)}</div></div>
    </div>`;

    cont.innerHTML = String(html`
      <div class="page-head"><div><h2>Mi agenda</h2><p>Servicios pagados (en custodia) que debes programar y ejecutar.</p></div></div>
      ${sinFecha.length ? html`<h3 style="margin:6px 0 12px"><i class="fas fa-calendar-plus red"></i> Por programar <span class="subtle">(${sinFecha.length})</span></h3>
        <div class="grid">${sinFecha.map(item)}</div>` : ""}
      ${Object.keys(grupos).length ? Object.entries(grupos).map(([, lista]) => html`
        <h3 style="margin:22px 0 12px"><i class="fas fa-calendar-day red"></i> ${dia(lista[0].fecha_programada)}</h3>
        <div class="grid">${lista.map(item)}</div>`)
        : !sinFecha.length ? html`<div class="card">${vacio("fa-calendar-check", "Tu agenda está libre", "Cuando un cliente pague una solicitud aceptada, aparecerá aquí para que la programes.")}</div>` : ""}
    `);
    cont.querySelectorAll("[data-id]").forEach((c) => c.addEventListener("click", () => abrirDetalle(c.dataset.id, pintar)));
  }
  await pintar();
}
