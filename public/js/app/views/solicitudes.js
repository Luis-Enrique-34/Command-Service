// Vista: Solicitudes — listado por estado y expediente completo (panel lateral)
// con línea de tiempo, pago en custodia, acciones de la máquina de estados,
// mensajes y reseña.
import {
  api, estado, html, raw, $, $$, dinero, fecha, fechaHora, hace, badgeEstado, ESTADOS, FLUJO, PAGO, METODOS, ROLES,
  modal, campo, datosForm, toast, vacio, drawer, debounce, iniciales,
} from "../core.js";
import { actualizarContador } from "../main.js";

const ICONO_ACCION = {
  aceptar: "fa-check", rechazar: "fa-ban", pagar: "fa-credit-card", agendar: "fa-calendar-plus",
  iniciar: "fa-play", completar: "fa-circle-check", cancelar: "fa-xmark",
};
const CLASE_ACCION = { rechazar: "btn-danger", cancelar: "btn-ghost", completar: "btn-red", aceptar: "btn-red", pagar: "btn-red", agendar: "btn-red", iniciar: "btn-red" };

// ---------------------------------------------------------------- Acciones
async function pedirDatosAccion(a, s) {
  if (!a.requiere.length && a.accion !== "completar" && a.accion !== "aceptar" && a.accion !== "iniciar") return {};
  const cuerpos = {
    aceptar: html`<p class="muted">Confirmas que puedes realizar <strong>${s.servicio}</strong> por <strong>${dinero(s.monto)}</strong>. El cliente podrá pagar y el dinero quedará en custodia.</p>`,
    iniciar: html`<p class="muted">Marca el servicio como <strong>en curso</strong>. El cliente podrá dar su conformidad al terminar.</p>`,
    completar: html`<p class="muted">Al dar conformidad, se libera el pago al proveedor (${dinero(s.pago?.neto_proveedor)} netos, tras la comisión de la plataforma). Esta acción no se puede deshacer.</p>`,
    rechazar: campo({ nombre: "motivo", label: "Motivo del rechazo", tipo: "textarea", attrs: 'maxlength="255" required', placeholder: "Explica al cliente por qué no puedes atenderlo" }),
    cancelar: html`${s.pago?.estado === "retenido" ? html`<p class="banner ok" style="margin-bottom:14px"><i class="fas fa-rotate-left"></i> El pago en custodia (${dinero(s.monto)}) será reembolsado al cliente.</p>` : ""}${campo({ nombre: "motivo", label: "Motivo de la cancelación", tipo: "textarea", attrs: 'maxlength="255" required' })}`,
    pagar: html`
      <div class="pago-box" style="margin-bottom:16px">
        <div><span>Monto</span><strong>${dinero(s.monto)}</strong></div>
        <div><span>Custodia</span><strong>Protegido</strong></div>
        <div><span>Se libera</span><strong>Al confirmar</strong></div>
      </div>
      ${campo({ nombre: "metodo", label: "Método de pago", tipo: "select", opciones: html`<option value="">Elige...</option>${Object.entries(METODOS).map(([k, v]) => html`<option value="${k}">${v}</option>`)}` })}
      <p class="subtle" style="margin-top:12px"><i class="fas fa-circle-info"></i> Pago simulado (MVP académico): no se realiza ningún cobro real.</p>`,
    agendar: campo({ nombre: "fecha_programada", label: "Fecha y hora del servicio", tipo: "datetime-local",
      valor: s.fecha_programada ? new Date(new Date(s.fecha_programada).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
      attrs: `min="${new Date(Date.now() - new Date().getTimezoneOffset() * 60000 + 3600000).toISOString().slice(0, 16)}" required` }),
  };
  return modal({
    titulo: `${a.etiqueta} · ${s.codigo}`,
    cuerpo: cuerpos[a.accion],
    textoOk: a.etiqueta,
    claseOk: a.accion === "rechazar" ? "btn-danger" : "btn-red",
    onSubmit: async (form) => {
      const d = datosForm(form);
      if (d.fecha_programada) d.fecha_programada = new Date(d.fecha_programada).toISOString();
      return d;
    },
  });
}

async function ejecutar(a, s, repintar) {
  const extra = await pedirDatosAccion(a, s);
  if (extra === null) return; // canceló el modal
  const { ok, data } = await api(`/api/solicitudes/${s.id}/estado`, { method: "PATCH", body: { accion: a.accion, ...extra } });
  if (!ok) {
    const primero = data.errores ? Object.values(data.errores)[0] : null;
    toast(primero || data.mensaje, "error");
    return;
  }
  toast(`${s.codigo}: ${ESTADOS[data.solicitud.estado].label}`);
  actualizarContador();
  repintar(data.solicitud);
}

// ---------------------------------------------------------------- Expediente
function stepper(s) {
  if (["rechazada", "cancelada"].includes(s.estado)) {
    return html`<div class="banner danger"><i class="fas ${ESTADOS[s.estado].icono}"></i><div><strong>Solicitud ${ESTADOS[s.estado].label.toLowerCase()}</strong><div class="muted">${s.motivo || ""}</div></div></div>`;
  }
  const idx = FLUJO.indexOf(s.estado);
  return html`<div class="stepper">${FLUJO.map((e, i) => html`
    <div class="step ${i <= idx ? "hecho" : ""} ${i === idx ? "actual" : ""}">
      <div class="dot">${i < idx || s.estado === "completada" ? raw('<i class="fas fa-check"></i>') : i + 1}</div>${ESTADOS[e].label}
    </div>`)}</div>`;
}

function expediente(s) {
  const u = estado.usuario;
  const puedeChatear = u.rol !== "admin" && !["rechazada", "cancelada"].includes(s.estado);
  const puedeCalificar = u.rol === "cliente" && s.estado === "completada" && !s.resena;
  return html`
    <div class="drawer-head">
      <div style="flex:1;min-width:0">
        <div class="subtle mono">${s.codigo} · creada ${fechaHora(s.creado_en)}</div>
        <h3 style="font-size:1.15rem;margin-top:2px">${s.servicio}</h3>
      </div>
      ${badgeEstado(s.estado)}
      <button class="icon-btn" data-cerrar aria-label="Cerrar"><i class="fas fa-xmark"></i></button>
    </div>
    <div class="drawer-body">
      ${stepper(s)}

      ${s.acciones.length ? html`<div class="card"><div class="card-head" style="margin-bottom:10px"><h3><i class="fas fa-bolt red"></i> Acciones disponibles</h3></div>
        <div class="acciones-box">${s.acciones.map((a) => html`<button class="btn ${CLASE_ACCION[a.accion] || ""}" data-accion="${a.accion}"><i class="fas ${ICONO_ACCION[a.accion]}"></i> ${a.etiqueta}</button>`)}</div></div>` : ""}

      <div class="card">
        <dl class="dl">
          <div><dt>Cliente</dt><dd>${s.cliente}<div class="subtle">${s.cliente_email}${s.cliente_telefono ? ` · ${s.cliente_telefono}` : ""}</div></dd></div>
          <div><dt>Proveedor</dt><dd>${s.proveedor} ${s.verificacion === "aprobado" ? html`<i class="fas fa-circle-check verificado" title="Verificado"></i>` : ""}<div class="subtle">${s.proveedor_email}</div></dd></div>
          <div><dt>Categoría</dt><dd><i class="fas ${s.categoria_icono} red"></i> ${s.categoria}</dd></div>
          <div><dt>Monto acordado</dt><dd><strong>${dinero(s.monto)}</strong></dd></div>
          <div><dt>Fecha preferida</dt><dd>${fecha(s.fecha_preferida)}</dd></div>
          <div><dt>Programada</dt><dd>${fechaHora(s.fecha_programada)}</dd></div>
          <div style="grid-column:1/-1"><dt>Detalle del cliente</dt><dd>${s.descripcion}</dd></div>
          ${s.direccion ? html`<div style="grid-column:1/-1"><dt>Dirección</dt><dd>${s.direccion}</dd></div>` : ""}
        </dl>
      </div>

      <div class="card">
        <div class="card-head"><h3><i class="fas fa-shield-halved red"></i> Pago en custodia</h3>${s.pago ? html`<span class="badge ${PAGO[s.pago.estado].clase}">${PAGO[s.pago.estado].label}</span>` : ""}</div>
        ${s.pago ? html`
          <div class="pago-box">
            <div><span>Pagado</span><strong>${dinero(s.pago.monto)}</strong></div>
            <div><span>Comisión ${Number(s.pago.comision_pct)}%</span><strong>${dinero(s.pago.comision)}</strong></div>
            <div><span>Neto proveedor</span><strong>${dinero(s.pago.neto_proveedor)}</strong></div>
          </div>
          <p class="subtle" style="margin-top:10px">${METODOS[s.pago.metodo]} · Ref. ${s.pago.referencia} · ${fechaHora(s.pago.creado_en)}${s.pago.liberado_en ? ` · liberado ${fechaHora(s.pago.liberado_en)}` : ""}</p>`
          : html`<p class="muted">Aún no se registra el pago. ${s.estado === "aceptada" ? "El cliente ya puede pagar." : "Se habilita cuando el proveedor acepta la solicitud."}</p>`}
      </div>

      <div class="card">
        <div class="card-head"><h3><i class="fas fa-timeline red"></i> Historial de estados</h3><span class="subtle">registrado por trigger en la BD</span></div>
        <ul class="timeline">${s.historial.map((h) => html`<li>
          <div class="t-head">${h.estado_anterior ? html`${ESTADOS[h.estado_anterior].label} <i class="fas fa-arrow-right subtle"></i> ` : ""}${ESTADOS[h.estado_nuevo].label}</div>
          <div class="t-sub">${fechaHora(h.creado_en)} · ${h.usuario || "Sistema"}${h.rol ? ` (${ROLES[h.rol]})` : ""}${h.comentario ? ` · “${h.comentario}”` : ""}</div>
        </li>`)}</ul>
      </div>

      ${s.resena ? html`<div class="card"><div class="card-head"><h3><i class="fas fa-star red"></i> Reseña del cliente</h3></div>
        <div class="stars" style="font-size:1.2rem">${raw("★".repeat(s.resena.puntaje))}<span class="vacia">${raw("★".repeat(5 - s.resena.puntaje))}</span></div>
        <p style="margin-top:6px">${s.resena.comentario || ""}</p></div>` : ""}

      ${puedeCalificar ? html`<form class="card" id="formResena">
        <div class="card-head"><h3><i class="fas fa-star red"></i> Califica al proveedor</h3></div>
        <div class="star-picker" role="radiogroup" aria-label="Calificación">${[1, 2, 3, 4, 5].map((n) => html`<button type="button" data-star="${n}" aria-label="${n} estrellas">★</button>`)}</div>
        <textarea class="textarea" name="comentario" maxlength="500" placeholder="Cuéntanos tu experiencia (opcional)" style="margin-top:10px"></textarea>
        <button class="btn btn-red" style="margin-top:10px" type="submit">Enviar calificación</button>
      </form>` : ""}

      <div class="card">
        <div class="card-head"><h3><i class="fas fa-comments red"></i> Mensajes</h3><span class="subtle">${s.mensajes.length}</span></div>
        <div class="chat" id="chat">${s.mensajes.length ? s.mensajes.map((m) => html`
          <div class="msg ${m.emisor_id === estado.usuario.id ? "mio" : ""}">${m.contenido}<div class="m-meta">${m.emisor} · ${hace(m.creado_en)}</div></div>`)
          : html`<p class="subtle">Sin mensajes todavía.</p>`}</div>
        ${puedeChatear ? html`<form class="chat-form" id="formChat"><input class="input" name="contenido" maxlength="1000" placeholder="Escribe un mensaje..." autocomplete="off" required><button class="btn btn-red" type="submit" aria-label="Enviar"><i class="fas fa-paper-plane"></i></button></form>` : ""}
      </div>
    </div>`;
}

/** Abre el expediente de una solicitud en el panel lateral. */
export async function abrirDetalle(id, alCerrar) {
  const d = drawer(alCerrar);
  async function cargar() {
    const { ok, data } = await api(`/api/solicitudes/${id}`);
    if (!ok) { d.cerrar(); toast(data.mensaje, "error"); return; }
    pintar(data.solicitud);
  }
  function pintar(s) {
    d.el.innerHTML = String(expediente(s));
    $("[data-cerrar]", d.el).addEventListener("click", d.cerrar);
    $$("[data-accion]", d.el).forEach((b) => b.addEventListener("click", () => ejecutar(s.acciones.find((a) => a.accion === b.dataset.accion), s, pintar)));
    const chat = $("#chat", d.el);
    chat.scrollTop = chat.scrollHeight;
    $("#formChat", d.el)?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = e.target.contenido;
      if (!input.value.trim()) return;
      const { ok, data } = await api(`/api/solicitudes/${s.id}/mensajes`, { method: "POST", body: { contenido: input.value } });
      if (!ok) return toast(data.mensaje, "error");
      cargar();
    });
    const fr = $("#formResena", d.el);
    if (fr) {
      let puntaje = 0;
      $$("[data-star]", fr).forEach((b) => b.addEventListener("click", () => {
        puntaje = Number(b.dataset.star);
        $$("[data-star]", fr).forEach((x) => x.classList.toggle("on", Number(x.dataset.star) <= puntaje));
      }));
      fr.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!puntaje) return toast("Elige de 1 a 5 estrellas", "error");
        const { ok, data } = await api(`/api/solicitudes/${s.id}/resena`, { method: "POST", body: { puntaje, comentario: fr.comentario.value } });
        toast(data.mensaje, ok ? "ok" : "error");
        if (ok) cargar();
      });
    }
  }
  await cargar();
}

// ---------------------------------------------------------------- Listado
export default async function vistaSolicitudes(cont, params) {
  const u = estado.usuario;
  const filtro = { estado: params.get("estado") || "", q: "" };
  const titulo = { cliente: "Mis solicitudes", proveedor: "Solicitudes recibidas", admin: "Todas las solicitudes" }[u.rol];
  const columnaOtro = u.rol === "cliente" ? "Proveedor" : u.rol === "proveedor" ? "Cliente" : "Cliente → Proveedor";

  cont.innerHTML = String(html`
    <div class="page-head">
      <div><h2>${titulo}</h2><p>Cada solicitud es un expediente con estados, pago en custodia, mensajes y reseña.</p></div>
      ${u.rol === "cliente" ? html`<a class="btn btn-red" href="#/catalogo"><i class="fas fa-plus"></i> Nueva solicitud</a>` : ""}
    </div>
    <div class="tabs" id="tabs"></div>
    <div class="toolbar"><div class="search"><i class="fas fa-magnifying-glass"></i><input class="input" id="q" placeholder="Buscar por código, servicio o cliente..." maxlength="80"></div></div>
    <div id="tabla"></div>`);

  async function cargar() {
    const qs = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v));
    const { ok, data } = await api(`/api/solicitudes?${qs}`);
    if (!ok) throw new Error(data.mensaje);
    const total = Object.values(data.resumen).reduce((a, b) => a + b, 0);
    $("#tabs").innerHTML = String(html`
      <button class="tab ${filtro.estado ? "" : "active"}" data-estado="">Todas <span class="n">${total}</span></button>
      ${Object.entries(ESTADOS).map(([k, e]) => html`<button class="tab ${filtro.estado === k ? "active" : ""}" data-estado="${k}"><i class="fas ${e.icono}"></i>${e.label} <span class="n">${data.resumen[k] || 0}</span></button>`)}`);

    $("#tabla").innerHTML = String(data.solicitudes.length ? html`<div class="table-wrap"><table>
      <thead><tr><th>Código</th><th>Servicio</th><th>${columnaOtro}</th><th class="num">Monto</th><th>Estado</th><th>Pago</th><th>Creada</th></tr></thead>
      <tbody>${data.solicitudes.map((s) => html`<tr class="clic" data-id="${s.id}">
        <td class="mono">${s.codigo}</td>
        <td><div class="titulo">${s.servicio}</div><div class="sub"><i class="fas ${s.categoria_icono}"></i> ${s.categoria}</div></td>
        <td>${u.rol === "cliente" ? s.proveedor : u.rol === "proveedor" ? html`<span class="avatar" style="width:28px;height:28px;font-size:.65rem;margin-right:8px">${iniciales(...s.cliente.split(" "))}</span>${s.cliente}` : html`${s.cliente} <i class="fas fa-arrow-right subtle"></i> ${s.proveedor}`}</td>
        <td class="num">${dinero(s.monto)}</td>
        <td>${badgeEstado(s.estado)}</td>
        <td>${s.pago_estado ? html`<span class="badge ${PAGO[s.pago_estado].clase}">${PAGO[s.pago_estado].label}</span>` : html`<span class="subtle">—</span>`}</td>
        <td class="subtle nowrap" title="${fechaHora(s.creado_en)}">${fecha(s.creado_en)}</td>
      </tr>`)}</tbody></table></div>`
      : html`<div class="card">${vacio("fa-inbox", "No hay solicitudes en este estado")}</div>`);
  }

  $("#tabs").addEventListener("click", (e) => {
    const t = e.target.closest("[data-estado]");
    if (!t) return;
    filtro.estado = t.dataset.estado;
    cargar();
  });
  $("#q").addEventListener("input", debounce((e) => { filtro.q = e.target.value.trim(); cargar(); }, 350));
  $("#tabla").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) abrirDetalle(tr.dataset.id, cargar);
  });

  await cargar();
  const id = params.get("id");
  if (id) {
    history.replaceState(null, "", "#/solicitudes");
    abrirDetalle(id, cargar);
  }
}
