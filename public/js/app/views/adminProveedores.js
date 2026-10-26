// Vista: Verificación de proveedores — aprobar o rechazar con motivo.
import { api, html, $, fecha, estrellas, VERIFICACION, modal, campo, datosForm, toast, vacio, iniciales } from "../core.js";
import { actualizarContador } from "../main.js";

export default async function vistaProveedores(cont) {
  let filtro = "pendiente";
  cont.innerHTML = String(html`
    <div class="page-head"><div><h2>Verificación de proveedores</h2><p>Solo los proveedores aprobados aparecen en el catálogo. Revisa su documento y presentación.</p></div></div>
    <div class="tabs" id="tabs">
      ${["pendiente", "aprobado", "rechazado", ""].map((k) => html`<button class="tab ${k === filtro ? "active" : ""}" data-v="${k}">${{ pendiente: "Pendientes", aprobado: "Verificados", rechazado: "Rechazados", "": "Todos" }[k]}</button>`)}
    </div>
    <div id="lista" class="grid grid-2"></div>`);

  async function cargar() {
    const { ok, data } = await api(`/api/admin/proveedores${filtro ? `?verificacion=${filtro}` : ""}`);
    if (!ok) throw new Error(data.mensaje);
    $("#lista").innerHTML = String(data.proveedores.length ? html`${data.proveedores.map((p) => html`
      <div class="card">
        <div style="display:flex;gap:14px;align-items:flex-start">
          <span class="avatar">${iniciales(p.nombres, p.apellidos)}</span>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
              <h3 style="font-size:1.02rem">${p.nombre_comercial}</h3>
              <span class="badge ${VERIFICACION[p.verificacion].clase}">${VERIFICACION[p.verificacion].label}</span>
            </div>
            <div class="subtle">${p.nombres} ${p.apellidos} · ${p.email}</div>
          </div>
        </div>
        <dl class="dl" style="margin-top:14px">
          <div><dt>DNI / RUC</dt><dd class="mono">${p.documento || html`<span class="red">No registrado</span>`}</dd></div>
          <div><dt>Distrito</dt><dd>${p.distrito || "—"}</dd></div>
          <div><dt>Servicios activos</dt><dd>${p.servicios}</dd></div>
          <div><dt>Calificación</dt><dd>${estrellas(p.calificacion)}</dd></div>
          <div style="grid-column:1/-1"><dt>Presentación</dt><dd class="muted">${p.descripcion || "Sin presentación."}</dd></div>
          ${p.motivo_rechazo ? html`<div style="grid-column:1/-1"><dt>Motivo de rechazo</dt><dd class="red">${p.motivo_rechazo}</dd></div>` : ""}
          <div style="grid-column:1/-1"><dt>Registro</dt><dd class="subtle">${fecha(p.creado_en)}${p.verificado_en ? ` · revisado ${fecha(p.verificado_en)}` : ""}</dd></div>
        </dl>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          ${p.verificacion !== "rechazado" ? html`<button class="btn btn-sm btn-danger" data-rechazar="${p.id}" data-nombre="${p.nombre_comercial}"><i class="fas fa-ban"></i> Rechazar</button>` : ""}
          ${p.verificacion !== "aprobado" ? html`<button class="btn btn-sm btn-ok" data-aprobar="${p.id}"><i class="fas fa-check"></i> Aprobar</button>` : ""}
        </div>
      </div>`)}` : html`<div class="card" style="grid-column:1/-1">${vacio("fa-user-check", "No hay proveedores en este estado")}</div>`);
  }

  async function verificar(id, estado, motivo) {
    const { ok, data } = await api(`/api/admin/proveedores/${id}/verificacion`, { method: "PATCH", body: { estado, motivo } });
    toast(data.mensaje, ok ? "ok" : "error");
    if (ok) { cargar(); actualizarContador(); }
    return { ok, data };
  }

  $("#tabs").addEventListener("click", (e) => {
    const t = e.target.closest("[data-v]");
    if (!t) return;
    filtro = t.dataset.v;
    cont.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
    cargar();
  });
  $("#lista").addEventListener("click", async (e) => {
    const ap = e.target.closest("[data-aprobar]");
    if (ap) return verificar(ap.dataset.aprobar, "aprobado");
    const re = e.target.closest("[data-rechazar]");
    if (re) {
      await modal({
        titulo: `Rechazar a ${re.dataset.nombre}`,
        textoOk: "Rechazar",
        claseOk: "btn-danger",
        cuerpo: campo({ nombre: "motivo", label: "Motivo (lo verá el proveedor)", tipo: "textarea", attrs: 'maxlength="255" required', placeholder: "Ej. El RUC no corresponde al nombre comercial" }),
        onSubmit: async (form) => {
          const { ok, data } = await verificar(re.dataset.rechazar, "rechazado", datosForm(form).motivo);
          return ok ? true : { errores: data.errores || {} };
        },
      });
    }
  });
  await cargar();
}
