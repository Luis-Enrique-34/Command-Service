// =====================================================================
//  Arranque de la aplicación: valida la sesión, arma el menú según el rol
//  y enruta entre vistas (#/inicio, #/solicitudes, ...). SPA sin frameworks.
// =====================================================================
import { api, estado, html, $, $$, iniciales, ROLES, toast } from "./core.js";
import inicio from "./views/inicio.js";
import catalogo from "./views/catalogo.js";
import misServicios from "./views/misServicios.js";
import solicitudes from "./views/solicitudes.js";
import agenda from "./views/agenda.js";
import perfil from "./views/perfil.js";
import usuarios from "./views/adminUsuarios.js";
import proveedores from "./views/adminProveedores.js";
import reportes from "./views/reportes.js";
import auditoria from "./views/auditoria.js";
import sistema from "./views/sistema.js";

/**
 * Definición de vistas: ruta, título, ícono, roles que la ven y grupo del menú.
 * Agregar un módulo nuevo = agregar una línea aquí (abierto a extensión).
 */
const VISTAS = [
  { ruta: "inicio", titulo: "Inicio", icono: "fa-gauge-high", grupo: "Principal",
    roles: ["cliente", "proveedor", "admin"], vista: inicio },
  { ruta: "catalogo", titulo: "Catálogo de servicios", icono: "fa-store", grupo: "Principal",
    roles: ["cliente", "admin"], vista: catalogo },
  { ruta: "mis-servicios", titulo: "Mis servicios", icono: "fa-briefcase", grupo: "Principal",
    roles: ["proveedor"], vista: misServicios },
  { ruta: "solicitudes", titulo: "Solicitudes", icono: "fa-file-signature", grupo: "Operación",
    roles: ["cliente", "proveedor", "admin"], vista: solicitudes, contador: true },
  { ruta: "agenda", titulo: "Agenda", icono: "fa-calendar-days", grupo: "Operación",
    roles: ["proveedor"], vista: agenda },
  { ruta: "usuarios", titulo: "Usuarios", icono: "fa-users", grupo: "Administración",
    roles: ["admin"], vista: usuarios },
  { ruta: "proveedores", titulo: "Verificación de proveedores", icono: "fa-user-check", grupo: "Administración",
    roles: ["admin"], vista: proveedores },
  { ruta: "reportes", titulo: "Reportes", icono: "fa-chart-column", grupo: "Administración",
    roles: ["admin"], vista: reportes },
  { ruta: "auditoria", titulo: "Auditoría", icono: "fa-clipboard-list", grupo: "Administración",
    roles: ["admin"], vista: auditoria },
  { ruta: "sistema", titulo: "Sistema y librerías", icono: "fa-microchip", grupo: "Sistema",
    roles: ["admin"], vista: sistema },
  { ruta: "perfil", titulo: "Mi perfil", icono: "fa-id-badge", grupo: "Cuenta",
    roles: ["cliente", "proveedor", "admin"], vista: perfil },
];

let limpiarVista = null; // algunas vistas tienen temporizadores que se deben detener

function vistasDelRol() {
  return VISTAS.filter((v) => v.roles.includes(estado.usuario.rol));
}

function pintarMenu() {
  const grupos = {};
  for (const v of vistasDelRol()) (grupos[v.grupo] ||= []).push(v);
  $("#nav").innerHTML = String(html`${Object.entries(grupos).map(([g, vs]) => html`
    <div class="nav-group">
      <div class="nav-title">${g}</div>
      ${vs.map((v) => html`<a class="nav-link" href="#/${v.ruta}" data-ruta="${v.ruta}">
        <i class="fas ${v.icono}"></i><span>${v.titulo}</span>${v.contador ? html`<span class="nav-count" data-contador hidden></span>` : ""}
      </a>`)}
    </div>`)}`);
}

/** Actualiza el contador del menú (solicitudes que requieren atención del usuario). */
export async function actualizarContador() {
  const { ok, data } = await api("/api/solicitudes");
  if (!ok) return;
  const r = data.resumen || {};
  const rol = estado.usuario.rol;
  const n = rol === "proveedor" ? (r.por_confirmar || 0) + (r.pago_confirmado || 0)
          : rol === "cliente" ? (r.aceptada || 0) + (r.en_curso || 0)
          : r.por_confirmar || 0;
  const el = $("[data-contador]");
  if (el) { el.textContent = n; el.hidden = n === 0; }
}

async function router() {
  const [ruta, query] = (location.hash.replace(/^#\/?/, "") || "inicio").split("?");
  const def = vistasDelRol().find((v) => v.ruta === ruta) || vistasDelRol()[0];
  if (def.ruta !== ruta) { location.replace(`#/${def.ruta}`); return; }

  $$(".nav-link").forEach((a) => a.classList.toggle("active", a.dataset.ruta === def.ruta));
  $("#pageTitle").textContent = def.titulo;
  $("#crumb").textContent = `Command Service · ${def.grupo}`;
  document.title = `${def.titulo} | Command Service`;
  $("#sidebar").classList.remove("abierto");

  if (typeof limpiarVista === "function") limpiarVista();
  limpiarVista = null;
  const cont = $("#view");
  cont.scrollTop = 0;
  window.scrollTo(0, 0);
  try {
    limpiarVista = await def.vista(cont, new URLSearchParams(query || ""));
  } catch (err) {
    console.error(err);
    cont.innerHTML = String(html`<div class="vacio"><i class="fas fa-triangle-exclamation"></i><h4>No se pudo cargar la vista</h4><p>${err.message}</p></div>`);
  }
}

export function pintarUsuario() {
  const u = estado.usuario;
  $("#userAvatar").textContent = iniciales(u.nombres, u.apellidos);
  $("#userName").textContent = `${u.nombres} ${u.apellidos}`;
  $("#userRole").textContent = ROLES[u.rol];
  $("#roleChip").textContent = ROLES[u.rol];
}

(async function iniciar() {
  const { ok, data } = await api("/api/auth/me");
  if (!ok) { window.location.replace("login.html"); return; }
  estado.usuario = data.usuario;

  pintarUsuario();
  pintarMenu();
  $("#boot").remove();
  $("#layout").hidden = false;

  $("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("abierto"));
  $("#logoutBtn").addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    toast("Sesión cerrada");
    window.location.replace("login.html");
  });

  window.addEventListener("hashchange", router);
  await router();
  actualizarContador();
})();
