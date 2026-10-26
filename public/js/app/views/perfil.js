// Vista: Mi perfil — datos personales y, para proveedores, perfil comercial.
import { api, estado, html, $, campo, datosForm, toast, iniciales, ROLES, VERIFICACION, limpiarErrores, mostrarErrores, cargando } from "../core.js";
import { pintarUsuario } from "../main.js";

export default async function vistaPerfil(cont) {
  const { ok, data } = await api("/api/perfil");
  if (!ok) throw new Error(data.mensaje);
  const u = data.usuario;
  const p = u.perfil;

  cont.innerHTML = String(html`
    <div class="page-head"><div><h2>Mi perfil</h2><p>Mantén tus datos actualizados para generar confianza.</p></div></div>
    <div class="grid perfil-grid">
      <form class="card" id="formPerfil" novalidate>
        <div class="card-head"><h3>Datos personales</h3></div>
        <div class="form-grid">
          ${campo({ nombre: "nombres", label: "Nombres", valor: u.nombres, attrs: 'maxlength="80" required' })}
          ${campo({ nombre: "apellidos", label: "Apellidos", valor: u.apellidos, attrs: 'maxlength="80" required' })}
          ${campo({ nombre: "email", label: "Correo (no editable)", valor: u.email, attrs: "disabled" })}
          ${campo({ nombre: "telefono", label: "Teléfono", opcional: true, valor: u.telefono || "", placeholder: "+51 987 654 321", attrs: 'maxlength="20"' })}
        </div>
        ${p ? html`
          <div class="card-head" style="margin-top:24px"><h3>Perfil comercial</h3><span class="badge ${VERIFICACION[p.verificacion].clase}">${VERIFICACION[p.verificacion].label}</span></div>
          ${p.verificacion === "rechazado" ? html`<div class="banner danger"><i class="fas fa-circle-xmark"></i><div><strong>Verificación rechazada</strong><div class="muted">${p.motivo_rechazo || ""} — al guardar los cambios vuelve a revisión.</div></div></div>` : ""}
          <div class="form-grid">
            ${campo({ nombre: "nombre_comercial", label: "Nombre comercial", valor: p.nombre_comercial || "", attrs: 'maxlength="120" required' })}
            ${campo({ nombre: "documento", label: "DNI o RUC", opcional: true, valor: p.documento || "", placeholder: "8 u 11 dígitos", attrs: 'maxlength="11" inputmode="numeric"' })}
            ${campo({ nombre: "distrito", label: "Distrito", opcional: true, valor: p.distrito || "", attrs: 'maxlength="80"' })}
            ${campo({ nombre: "descripcion", label: "Presentación", tipo: "textarea", opcional: true, full: true, valor: p.descripcion || "", placeholder: "Tu experiencia, certificaciones y forma de trabajo", attrs: 'maxlength="1000"' })}
          </div>` : ""}
        <div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn btn-red" type="submit"><i class="fas fa-floppy-disk"></i> Guardar cambios</button></div>
      </form>
      <aside class="card" style="text-align:center">
        <span class="avatar lg" id="perfilAvatar">${iniciales(u.nombres, u.apellidos)}</span>
        <h3 style="margin-top:12px" id="perfilNombre">${u.nombres} ${u.apellidos}</h3>
        <p class="muted">${u.email}</p>
        <span class="role-chip" style="display:inline-block;margin-top:12px">${ROLES[u.rol]}</span>
        <p class="subtle" style="margin-top:18px;text-align:left"><i class="fas fa-lock"></i> Tu contraseña se guarda cifrada con Argon2id. Nadie, ni siquiera el administrador, puede verla.</p>
      </aside>
    </div>`);

  $("#formPerfil").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    limpiarErrores(form);
    const d = datosForm(form);
    const body = { nombres: d.nombres, apellidos: d.apellidos, telefono: d.telefono };
    if (p) body.perfil = { nombre_comercial: d.nombre_comercial, documento: d.documento, distrito: d.distrito, descripcion: d.descripcion };
    const btn = form.querySelector('button[type="submit"]');
    cargando(btn, true);
    const r = await api("/api/perfil", { method: "PUT", body });
    cargando(btn, false);
    if (!r.ok) {
      // los errores del perfil comercial llegan como "perfil": se muestran en el toast
      if (r.data.errores) mostrarErrores(form, r.data.errores); else toast(r.data.mensaje, "error");
      return;
    }
    toast(r.data.mensaje);
    estado.usuario = r.data.usuario;
    pintarUsuario();
    vistaPerfil(cont);
  });
}
