// Vista: Mis servicios (proveedor) — publicar, editar y activar/desactivar.
import { api, estado, html, raw, $, dinero, MODALIDAD, modal, campo, datosForm, toast, vacio, VERIFICACION } from "../core.js";

let categorias = [];

function formulario(s = {}) {
  return html`<div class="form-grid">
    ${campo({ nombre: "titulo", label: "Título del servicio", valor: s.titulo || "", full: true, placeholder: "Ej. Mantenimiento preventivo de laptop", attrs: 'maxlength="120" required' })}
    ${campo({ nombre: "categoria_id", label: "Categoría", tipo: "select", opciones: html`<option value="">Elige...</option>${categorias.map((c) => html`<option value="${c.id}" ${s.categoria_id === c.id ? raw("selected") : ""}>${c.nombre}</option>`)}` })}
    ${campo({ nombre: "modalidad", label: "Modalidad", tipo: "select", opciones: html`${Object.entries(MODALIDAD).map(([k, v]) => html`<option value="${k}" ${s.modalidad === k ? raw("selected") : ""}>${v}</option>`)}` })}
    ${campo({ nombre: "precio", label: "Precio base (S/)", tipo: "number", valor: s.precio ? Number(s.precio) : "", attrs: 'min="1" step="0.01" required' })}
    ${campo({ nombre: "duracion_horas", label: "Duración estimada (horas)", tipo: "number", opcional: true, valor: s.duracion_horas ? Number(s.duracion_horas) : "", attrs: 'min="0.5" step="0.5"' })}
    ${campo({ nombre: "zona_cobertura", label: "Zona de cobertura", opcional: true, full: true, valor: s.zona_cobertura || "", placeholder: "Ej. Lima Norte / Todo el Perú", attrs: 'maxlength="120"' })}
    ${campo({ nombre: "descripcion", label: "Descripción", tipo: "textarea", opcional: true, full: true, valor: s.descripcion || "", placeholder: "¿Qué incluye? ¿Qué necesitas del cliente?", attrs: 'maxlength="2000"' })}
  </div>`;
}

export default async function vistaMisServicios(cont) {
  const [{ data: dc }, ] = await Promise.all([api("/api/categorias")]);
  categorias = dc.categorias || [];
  const perfil = estado.usuario.perfil;

  async function pintar() {
    const { ok, data } = await api("/api/mis-servicios");
    if (!ok) throw new Error(data.mensaje);
    const lista = data.servicios;
    const activos = lista.filter((s) => s.activo).length;

    cont.innerHTML = String(html`
      ${perfil && perfil.verificacion !== "aprobado" ? html`<div class="banner"><i class="fas fa-eye-slash"></i>
        <div><strong>Tus servicios aún no son visibles en el catálogo.</strong><div class="muted">Estado de tu perfil: ${VERIFICACION[perfil.verificacion].label}. Se publicarán cuando el administrador lo verifique.</div></div></div>` : ""}
      <div class="page-head">
        <div><h2>Mis servicios</h2><p>${lista.length} publicados · ${activos} activos</p></div>
        <button class="btn btn-red" id="nuevo"><i class="fas fa-plus"></i> Nuevo servicio</button>
      </div>
      ${lista.length ? html`<div class="table-wrap"><table>
        <thead><tr><th>Servicio</th><th>Categoría</th><th>Modalidad</th><th class="num">Precio</th><th class="num">Contratado</th><th>Visible</th><th></th></tr></thead>
        <tbody>${lista.map((s) => html`<tr>
          <td><div class="titulo">${s.titulo}</div><div class="sub">${s.zona_cobertura || "—"}</div></td>
          <td><i class="fas ${s.categoria_icono} red"></i> ${s.categoria || "—"}</td>
          <td>${MODALIDAD[s.modalidad]}</td>
          <td class="num">${dinero(s.precio)}</td>
          <td class="num">${s.contrataciones}</td>
          <td><label class="switch" title="${s.activo ? "Activo" : "Inactivo"}"><input type="checkbox" data-toggle="${s.id}" ${s.activo ? raw("checked") : ""} aria-label="Activar o desactivar"><span></span></label></td>
          <td><button class="btn btn-sm btn-ghost" data-editar="${s.id}"><i class="fas fa-pen"></i> Editar</button></td>
        </tr>`)}</tbody></table></div>`
        : html`<div class="card">${vacio("fa-briefcase", "Aún no publicas servicios", "Crea tu primer servicio para empezar a recibir solicitudes.")}</div>`}
    `);

    $("#nuevo").addEventListener("click", () => editar());
    cont.querySelectorAll("[data-editar]").forEach((b) => b.addEventListener("click", () => editar(lista.find((s) => s.id === b.dataset.editar))));
    cont.querySelectorAll("[data-toggle]").forEach((chk) => chk.addEventListener("change", async () => {
      const { ok, data } = await api(`/api/mis-servicios/${chk.dataset.toggle}/estado`, { method: "PATCH", body: { activo: chk.checked } });
      if (ok) toast(data.mensaje); else { chk.checked = !chk.checked; toast(data.mensaje, "error"); }
    }));
  }

  async function editar(s) {
    const r = await modal({
      titulo: s ? "Editar servicio" : "Publicar nuevo servicio",
      textoOk: s ? "Guardar cambios" : "Publicar",
      cuerpo: formulario(s),
      onSubmit: async (form) => {
        const { ok, data } = await api(s ? `/api/mis-servicios/${s.id}` : "/api/mis-servicios", { method: s ? "PUT" : "POST", body: datosForm(form) });
        if (!ok) { if (!data.errores) toast(data.mensaje, "error"); return { errores: data.errores }; }
        return data;
      },
    });
    if (r) { toast(r.mensaje); pintar(); }
  }

  await pintar();
}
