// Vista: Catálogo de servicios — búsqueda, filtros y solicitud de servicio.
import { api, estado, html, raw, $, $$, dinero, estrellas, MODALIDAD, modal, campo, datosForm, toast, vacio, debounce } from "../core.js";
import { actualizarContador } from "../main.js";

const filtros = { q: "", categoria: "", modalidad: "", orden: "recientes" };

function tarjeta(s) {
  const puedeSolicitar = estado.usuario.rol === "cliente";
  return html`<article class="servicio">
    <div class="servicio-top">
      <div class="ico"><i class="fas ${s.categoria_icono || "fa-briefcase"}"></i></div>
      <span class="badge no-dot">${s.categoria || "General"}</span>
    </div>
    <div class="servicio-body">
      <h3>${s.titulo}</h3>
      <div class="muted" style="font-size:.85rem">${s.proveedor} ${s.verificacion === "aprobado" ? html`<i class="fas fa-circle-check verificado" title="Proveedor verificado"></i>` : ""}</div>
      <p class="desc">${s.descripcion || "Sin descripción."}</p>
      <div class="servicio-meta">
        <span><i class="fas fa-location-dot"></i>${MODALIDAD[s.modalidad]}${s.zona_cobertura ? ` · ${s.zona_cobertura}` : ""}</span>
        ${s.duracion_horas ? html`<span><i class="fas fa-clock"></i>${Number(s.duracion_horas)} h aprox.</span>` : ""}
        ${s.contrataciones ? html`<span><i class="fas fa-handshake"></i>${s.contrataciones} contratados</span>` : ""}
      </div>
      <div>${estrellas(s.calificacion)} ${s.resenas ? html`<span class="subtle">(${s.resenas})</span>` : ""}</div>
    </div>
    <div class="servicio-foot">
      <div class="precio">${dinero(s.precio)} <small>precio base</small></div>
      ${puedeSolicitar ? html`<button class="btn btn-red btn-sm" data-solicitar="${s.id}"><i class="fas fa-paper-plane"></i> Solicitar</button>` : ""}
    </div>
  </article>`;
}

async function solicitar(servicio) {
  const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const r = await modal({
    titulo: "Solicitar servicio",
    textoOk: "Enviar solicitud",
    cuerpo: html`
      <div class="card" style="margin-bottom:16px;padding:14px 16px">
        <strong>${servicio.titulo}</strong>
        <div class="muted" style="font-size:.85rem">${servicio.proveedor} · ${dinero(servicio.precio)}</div>
      </div>
      <div class="form-grid">
        ${campo({ nombre: "descripcion", label: "¿Qué necesitas?", tipo: "textarea", full: true, placeholder: "Describe el trabajo, plazos y cualquier detalle importante", attrs: 'maxlength="1000" required' })}
        ${campo({ nombre: "direccion", label: "Dirección o referencia", opcional: true, placeholder: "Distrito / dirección", attrs: 'maxlength="200"' })}
        ${campo({ nombre: "fecha_preferida", label: "Fecha preferida", tipo: "date", opcional: true, attrs: `min="${manana}"` })}
      </div>
      <p class="subtle" style="margin-top:14px"><i class="fas fa-shield-halved"></i> No pagas nada ahora: primero el proveedor acepta tu solicitud. Luego tu pago queda en custodia hasta que confirmes el servicio.</p>`,
    onSubmit: async (form) => {
      const { ok, data } = await api("/api/solicitudes", { method: "POST", body: { servicio_id: servicio.id, ...datosForm(form) } });
      if (!ok) { if (!data.errores) toast(data.mensaje, "error"); return { errores: data.errores }; }
      return data;
    },
  });
  if (r) {
    toast(r.mensaje);
    actualizarContador();
    location.hash = `#/solicitudes?id=${r.solicitud.id}`;
  }
}

export default async function vistaCatalogo(cont) {
  const { data: dc } = await api("/api/categorias");
  const categorias = dc.categorias || [];

  cont.innerHTML = String(html`
    <div class="page-head">
      <div><h2>Catálogo de servicios</h2><p>Solo se muestran servicios de proveedores verificados por Command Service.</p></div>
    </div>
    <div class="toolbar">
      <div class="search"><i class="fas fa-magnifying-glass"></i><input class="input" id="q" placeholder="Buscar por servicio, descripción o proveedor..." value="${filtros.q}" maxlength="80"></div>
      <select class="select" id="modalidad" aria-label="Modalidad">
        <option value="">Toda modalidad</option>
        ${Object.entries(MODALIDAD).map(([k, v]) => html`<option value="${k}" ${filtros.modalidad === k ? raw("selected") : ""}>${v}</option>`)}
      </select>
      <select class="select" id="orden" aria-label="Ordenar">
        <option value="recientes">Más recientes</option><option value="calificacion">Mejor calificados</option>
        <option value="precio_asc">Precio: menor a mayor</option><option value="precio_desc">Precio: mayor a menor</option>
      </select>
    </div>
    <div class="chips" id="chips">
      <button class="chip ${filtros.categoria ? "" : "active"}" data-cat="">Todas</button>
      ${categorias.map((c) => html`<button class="chip ${String(filtros.categoria) === String(c.id) ? "active" : ""}" data-cat="${c.id}"><i class="fas ${c.icono}"></i>${c.nombre}<span class="n">${c.servicios}</span></button>`)}
    </div>
    <p class="subtle" id="conteo" style="margin-bottom:12px"></p>
    <div class="servicios-grid" id="grid"></div>
  `);
  $("#orden").value = filtros.orden;

  let servicios = [];
  async function cargar() {
    const grid = $("#grid");
    grid.innerHTML = '<div class="skeleton" style="height:300px"></div>'.repeat(3);
    const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v));
    const { ok, data } = await api(`/api/servicios?${qs}`);
    servicios = ok ? data.servicios : [];
    $("#conteo").textContent = `${servicios.length} servicio${servicios.length === 1 ? "" : "s"} encontrado${servicios.length === 1 ? "" : "s"}`;
    grid.innerHTML = String(servicios.length ? html`${servicios.map(tarjeta)}` : vacio("fa-magnifying-glass", "Sin resultados", "Prueba con otra palabra o categoría."));
  }

  $("#q").addEventListener("input", debounce((e) => { filtros.q = e.target.value.trim(); cargar(); }, 350));
  $("#modalidad").addEventListener("change", (e) => { filtros.modalidad = e.target.value; cargar(); });
  $("#orden").addEventListener("change", (e) => { filtros.orden = e.target.value; cargar(); });
  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    filtros.categoria = b.dataset.cat;
    $$(".chip", cont).forEach((c) => c.classList.toggle("active", c === b));
    cargar();
  });
  $("#grid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-solicitar]");
    if (b) solicitar(servicios.find((s) => s.id === b.dataset.solicitar));
  });

  await cargar();
}
