// Vista: Administración de usuarios — búsqueda, filtro por rol y activación.
import { api, estado, html, raw, $, fecha, hace, iniciales, ROLES, VERIFICACION, toast, vacio, debounce, confirmar } from "../core.js";

export default async function vistaUsuarios(cont) {
  const filtro = { rol: "", q: "" };
  cont.innerHTML = String(html`
    <div class="page-head"><div><h2>Usuarios</h2><p>Clientes, proveedores y administradores registrados.</p></div></div>
    <div class="toolbar">
      <div class="search"><i class="fas fa-magnifying-glass"></i><input class="input" id="q" placeholder="Buscar por nombre o correo..." maxlength="80"></div>
      <select class="select" id="rol" aria-label="Rol"><option value="">Todos los roles</option>${Object.entries(ROLES).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select>
    </div>
    <div id="tabla"></div>`);

  async function cargar() {
    const qs = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v));
    const { ok, data } = await api(`/api/admin/usuarios?${qs}`);
    if (!ok) throw new Error(data.mensaje);
    $("#tabla").innerHTML = String(data.usuarios.length ? html`<div class="table-wrap"><table>
      <thead><tr><th>Usuario</th><th>Rol</th><th>Teléfono</th><th class="num">Solicitudes</th><th>Registro</th><th>Último acceso</th><th>Activo</th></tr></thead>
      <tbody>${data.usuarios.map((u) => html`<tr>
        <td><div style="display:flex;gap:10px;align-items:center"><span class="avatar" style="width:32px;height:32px;font-size:.7rem">${iniciales(u.nombres, u.apellidos)}</span>
          <div><div class="titulo">${u.nombres} ${u.apellidos}</div><div class="sub">${u.email}</div></div></div></td>
        <td><span class="badge no-dot ${u.rol === "admin" ? "b-red" : u.rol === "proveedor" ? "b-violet" : "b-info"}">${ROLES[u.rol]}</span>
          ${u.verificacion ? html` <span class="badge ${VERIFICACION[u.verificacion].clase}">${VERIFICACION[u.verificacion].label}</span>` : ""}</td>
        <td>${u.telefono || "—"}</td>
        <td class="num">${u.solicitudes}</td>
        <td class="subtle">${fecha(u.creado_en)}</td>
        <td class="subtle">${u.ultimo_login ? hace(u.ultimo_login) : "Nunca"}</td>
        <td>${u.rol === "admin" || u.id === estado.usuario.id ? html`<span class="subtle">—</span>`
          : html`<label class="switch"><input type="checkbox" data-id="${u.id}" data-nombre="${u.nombres}" ${u.activo ? raw("checked") : ""} aria-label="Activar o desactivar"><span></span></label>`}</td>
      </tr>`)}</tbody></table></div>` : html`<div class="card">${vacio("fa-users", "Sin resultados")}</div>`);
  }

  $("#q").addEventListener("input", debounce((e) => { filtro.q = e.target.value.trim(); cargar(); }, 350));
  $("#rol").addEventListener("change", (e) => { filtro.rol = e.target.value; cargar(); });
  $("#tabla").addEventListener("change", async (e) => {
    const chk = e.target.closest("input[data-id]");
    if (!chk) return;
    if (!chk.checked && !(await confirmar("Desactivar usuario", `${chk.dataset.nombre} no podrá iniciar sesión hasta que lo reactives.`, { textoOk: "Desactivar", claseOk: "btn-danger" }))) {
      chk.checked = true;
      return;
    }
    const { ok, data } = await api(`/api/admin/usuarios/${chk.dataset.id}/estado`, { method: "PATCH", body: { activo: chk.checked } });
    toast(data.mensaje, ok ? "ok" : "error");
    if (!ok) chk.checked = !chk.checked;
  });
  await cargar();
}
