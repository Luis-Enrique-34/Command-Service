// =====================================================================
//  Núcleo del frontend: llamadas a la API, plantillas seguras (anti-XSS),
//  formatos, estados y componentes reutilizables (toast, modal, panel).
// =====================================================================

// ------------------------------------------------------------- Estado global
export const estado = { usuario: null };

// ------------------------------------------------------------- API
/**
 * Llama a la API del backend con la cookie de sesión.
 * Si la sesión expiró (401) redirige al login.
 * @returns {Promise<{ok:boolean,status:number,data:any}>}
 */
export async function api(url, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, data: { mensaje: "No se pudo conectar con el servidor. ¿Está encendido?" } };
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith("/api/auth/login")) {
    window.location.replace("login.html");
  }
  return { ok: res.ok, status: res.status, data };
}

// ------------------------------------------------------------- Plantillas seguras
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

class Raw { constructor(v) { this.v = v; } toString() { return this.v; } }
/** Marca HTML de confianza (generado por nosotros) para que no se escape. */
export const raw = (v) => new Raw(v);

/**
 * Plantilla con escape automático: todo valor interpolado se escapa salvo
 * que sea raw() o un arreglo de resultados de html``. Evita XSS al mostrar
 * datos escritos por usuarios (descripciones, mensajes, nombres...).
 */
export function html(strings, ...vals) {
  let out = "";
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) {
      const v = vals[i];
      if (v instanceof Raw) out += v.v;
      else if (Array.isArray(v)) out += v.map((x) => (x instanceof Raw ? x.v : esc(x))).join("");
      else if (v === false || v == null) out += "";
      else out += esc(v);
    }
  });
  return raw(out);
}

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// ------------------------------------------------------------- Formatos
const soles = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
export const dinero = (n) => soles.format(Number(n || 0));
export const fecha = (v) => (v ? new Date(v.length === 10 ? v + "T12:00:00" : v).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const fechaHora = (v) => (v ? new Date(v).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
export function hace(v) {
  const s = (Date.now() - new Date(v).getTime()) / 1000;
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 172800) return "ayer";
  return `hace ${Math.floor(s / 86400)} días`;
}
export const iniciales = (n = "", a = "") => ((n[0] || "") + (a[0] || "")).toUpperCase();

export function estrellas(valor) {
  if (valor == null) return html`<span class="subtle">Sin reseñas</span>`;
  const n = Math.round(Number(valor));
  return html`<span class="stars" title="${valor} de 5">${raw("★".repeat(n))}<span class="vacia">${raw("★".repeat(5 - n))}</span></span> <strong>${valor}</strong>`;
}

// ------------------------------------------------------------- Estados del negocio
export const ESTADOS = {
  por_confirmar:   { label: "Por confirmar",   clase: "b-warn",   icono: "fa-hourglass-half" },
  aceptada:        { label: "Aceptada",        clase: "b-info",   icono: "fa-thumbs-up" },
  rechazada:       { label: "Rechazada",       clase: "b-danger", icono: "fa-ban" },
  pago_confirmado: { label: "Pago confirmado", clase: "b-violet", icono: "fa-shield-halved" },
  agendada:        { label: "Agendada",        clase: "b-info",   icono: "fa-calendar-check" },
  en_curso:        { label: "En curso",        clase: "b-red",    icono: "fa-person-digging" },
  completada:      { label: "Completada",      clase: "b-ok",     icono: "fa-circle-check" },
  cancelada:       { label: "Cancelada",       clase: "",         icono: "fa-xmark" },
};
export const FLUJO = ["por_confirmar", "aceptada", "pago_confirmado", "agendada", "en_curso", "completada"];
export const badgeEstado = (e) => html`<span class="badge ${ESTADOS[e]?.clase || ""}">${ESTADOS[e]?.label || e}</span>`;

export const PAGO = {
  retenido:    { label: "En custodia", clase: "b-violet" },
  liberado:    { label: "Liberado",    clase: "b-ok" },
  reembolsado: { label: "Reembolsado", clase: "b-info" },
  pendiente:   { label: "Pendiente",   clase: "b-warn" },
};
export const VERIFICACION = {
  aprobado:  { label: "Verificado", clase: "b-ok" },
  pendiente: { label: "Pendiente",  clase: "b-warn" },
  rechazado: { label: "Rechazado",  clase: "b-danger" },
};
export const MODALIDAD = { presencial: "Presencial", virtual: "Virtual", mixta: "Presencial o virtual" };
export const METODOS = { yape: "Yape", plin: "Plin", tarjeta: "Tarjeta", transferencia: "Transferencia" };
export const ROLES = { cliente: "Cliente", proveedor: "Proveedor", admin: "Administrador" };

// ------------------------------------------------------------- Toasts
export function toast(texto, tipo = "ok") {
  const cont = $("#toasts");
  const el = document.createElement("div");
  el.className = `toast ${tipo === "error" ? "error" : ""}`;
  el.innerHTML = `<i class="fas ${tipo === "error" ? "fa-circle-exclamation" : "fa-circle-check"}"></i><span></span>`;
  el.querySelector("span").textContent = texto;
  cont.append(el);
  setTimeout(() => { el.classList.add("saliendo"); setTimeout(() => el.remove(), 300); }, 3800);
}

// ------------------------------------------------------------- Modal
/**
 * Abre un modal. `cuerpo` es html``. `onSubmit(form)` puede devolver
 * { errores } para marcar campos, o true para cerrar.
 */
export function modal({ titulo, cuerpo, textoOk = "Guardar", claseOk = "btn-red", onSubmit, textoCancelar = "Cancelar" }) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = String(html`
      <form class="modal" role="dialog" aria-modal="true" novalidate>
        <div class="modal-head"><h3>${titulo}</h3><button type="button" class="icon-btn" data-cerrar aria-label="Cerrar"><i class="fas fa-xmark"></i></button></div>
        <div class="modal-body">${cuerpo}</div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-cerrar>${textoCancelar}</button>
          ${onSubmit ? html`<button type="submit" class="btn ${claseOk}">${textoOk}</button>` : ""}
        </div>
      </form>`);
    const form = ov.querySelector("form");
    const cerrar = (v) => {
      ov.remove();
      document.removeEventListener("keydown", esc);
      window.removeEventListener("hashchange", alNavegar);
      resolve(v);
    };
    const esc = (e) => e.key === "Escape" && cerrar(null);
    const alNavegar = () => cerrar(null);
    document.addEventListener("keydown", esc);
    window.addEventListener("hashchange", alNavegar);
    ov.addEventListener("mousedown", (e) => e.target === ov && cerrar(null));
    $$("[data-cerrar]", ov).forEach((b) => b.addEventListener("click", () => cerrar(null)));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      limpiarErrores(form);
      const btn = form.querySelector('button[type="submit"]');
      cargando(btn, true);
      const r = await onSubmit(form);
      cargando(btn, false);
      if (r === true || (r && !r.errores && r !== false)) cerrar(r);
      else if (r?.errores) mostrarErrores(form, r.errores);
    });
    document.body.append(ov);
    setTimeout(() => form.querySelector("input, select, textarea")?.focus(), 50);
  });
}

export function confirmar(titulo, mensaje, { textoOk = "Confirmar", claseOk = "btn-red" } = {}) {
  return modal({ titulo, cuerpo: html`<p class="muted">${mensaje}</p>`, textoOk, claseOk, onSubmit: async () => true });
}

/** Panel lateral derecho. Devuelve { el, cerrar }. */
export function drawer(onClose) {
  const ov = document.createElement("div");
  ov.className = "overlay drawer-overlay";
  ov.innerHTML = `<aside class="drawer" role="dialog" aria-modal="true"><div class="drawer-body"><div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:220px"></div></div></aside>`;
  const cerrar = () => {
    ov.remove();
    document.removeEventListener("keydown", tecla);
    window.removeEventListener("hashchange", alNavegar);
    onClose?.();
  };
  const tecla = (e) => e.key === "Escape" && !document.querySelector(".overlay:not(.drawer-overlay)") && cerrar();
  const alNavegar = () => { ov.remove(); document.removeEventListener("keydown", tecla); }; // al cambiar de vista se cierra sin recargar la anterior
  document.addEventListener("keydown", tecla);
  window.addEventListener("hashchange", alNavegar);
  ov.addEventListener("mousedown", (e) => e.target === ov && cerrar());
  document.body.append(ov);
  return { el: ov.querySelector(".drawer"), cerrar };
}

// ------------------------------------------------------------- Formularios
export function datosForm(form) {
  const d = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") d[el.name] = el.checked;
    else if (el.type === "radio") { if (el.checked) d[el.name] = el.value; }
    else d[el.name] = el.value.trim();
  }
  return d;
}
export function limpiarErrores(form) {
  $$(".field.invalid", form).forEach((f) => f.classList.remove("invalid"));
  $$(".field .error", form).forEach((e) => (e.textContent = ""));
}
export function mostrarErrores(form, errores = {}) {
  for (const [campo, msg] of Object.entries(errores)) {
    const input = form.querySelector(`[name="${CSS.escape(campo)}"]`);
    const field = input?.closest(".field");
    if (field) { field.classList.add("invalid"); field.querySelector(".error").textContent = msg; }
    else toast(msg, "error");
  }
  form.querySelector(".field.invalid input, .field.invalid select, .field.invalid textarea")?.focus();
}
export function cargando(btn, si) {
  if (!btn) return;
  btn.disabled = si;
  if (si) { btn.dataset.txt = btn.innerHTML; btn.innerHTML = '<span class="spin"></span> Procesando...'; }
  else if (btn.dataset.txt) btn.innerHTML = btn.dataset.txt;
}

/** Campo de formulario estándar. */
export const campo = ({ nombre, label, tipo = "text", valor = "", opcional, full, placeholder = "", attrs = "", opciones }) => html`
  <div class="field ${full ? "full" : ""}">
    <label for="f-${nombre}">${label} ${opcional ? html`<span class="opt">(opcional)</span>` : ""}</label>
    ${tipo === "select"
      ? html`<select class="select" id="f-${nombre}" name="${nombre}" ${raw(attrs)}>${opciones}</select>`
      : tipo === "textarea"
        ? html`<textarea class="textarea" id="f-${nombre}" name="${nombre}" placeholder="${placeholder}" ${raw(attrs)}>${valor}</textarea>`
        : html`<input class="input" id="f-${nombre}" name="${nombre}" type="${tipo}" value="${valor}" placeholder="${placeholder}" ${raw(attrs)}>`}
    <div class="error"></div>
  </div>`;

export const vacio = (icono, titulo, texto = "") => html`<div class="vacio"><i class="fas ${icono}"></i><h4>${titulo}</h4><p>${texto}</p></div>`;
export const cargandoVista = () => html`<div class="grid grid-kpi">${[1, 2, 3, 4].map(() => raw('<div class="skeleton" style="height:96px"></div>'))}</div><div class="skeleton mt" style="height:320px"></div>`;

export function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
