// Vista: Inicio — indicadores y actividad reciente según el rol.
import { api, estado, html, raw, dinero, hace, badgeEstado, cargandoVista, vacio, estrellas, VERIFICACION } from "../core.js";

const kpi = (icono, clase, label, valor, sub = "") => html`
  <div class="card kpi">
    <div class="kpi-icon ${clase}"><i class="fas ${icono}"></i></div>
    <div><div class="kpi-label">${label}</div><div class="kpi-value">${valor}</div>${sub ? html`<div class="kpi-sub">${sub}</div>` : ""}</div>
  </div>`;

function bienvenida(u, i) {
  const nombre = u.nombres.split(" ")[0];
  if (u.rol === "admin") {
    return html`<div class="welcome">
      <h2>Hola, ${nombre} 👋</h2>
      <p>Supervisa la operación de la plataforma: verifica proveedores, revisa solicitudes y monitorea la salud del sistema.</p>
      <div class="acciones">
        <a href="#/proveedores" class="btn btn-red"><i class="fas fa-user-check"></i> Verificar proveedores ${i.proveedores_pendientes ? `(${i.proveedores_pendientes})` : ""}</a>
        <a href="#/reportes" class="btn"><i class="fas fa-chart-column"></i> Ver reportes</a>
        <a href="#/sistema" class="btn"><i class="fas fa-microchip"></i> Estado del sistema</a>
      </div>
      <img src="assets/img/isotipo-dark.png" alt="" class="only-dark"><img src="assets/img/isotipo-light.png" alt="" class="only-light">
    </div>`;
  }
  if (u.rol === "proveedor") {
    return html`<div class="welcome">
      <h2>Hola, ${nombre} 👋</h2>
      <p>Gestiona tus servicios, responde solicitudes y organiza tu agenda. Tus cobros quedan protegidos en custodia hasta la conformidad del cliente.</p>
      <div class="acciones">
        <a href="#/solicitudes?estado=por_confirmar" class="btn btn-red"><i class="fas fa-inbox"></i> Revisar solicitudes</a>
        <a href="#/mis-servicios" class="btn"><i class="fas fa-plus"></i> Publicar servicio</a>
        <a href="#/agenda" class="btn"><i class="fas fa-calendar-days"></i> Mi agenda</a>
      </div>
      <img src="assets/img/isotipo-dark.png" alt="" class="only-dark"><img src="assets/img/isotipo-light.png" alt="" class="only-light">
    </div>`;
  }
  return html`<div class="welcome">
    <h2>Hola, ${nombre} 👋</h2>
    <p>Encuentra especialistas verificados y contrata con tranquilidad: tu pago queda protegido hasta que confirmes que el servicio se completó.</p>
    <div class="acciones">
      <a href="#/catalogo" class="btn btn-red"><i class="fas fa-store"></i> Explorar catálogo</a>
      <a href="#/solicitudes" class="btn"><i class="fas fa-file-signature"></i> Mis solicitudes</a>
    </div>
    <img src="assets/img/isotipo-dark.png" alt="" class="only-dark"><img src="assets/img/isotipo-light.png" alt="" class="only-light">
  </div>`;
}

function indicadores(rol, i) {
  if (rol === "admin") {
    return html`<div class="grid grid-kpi">
      ${kpi("fa-users", "info", "Usuarios activos", i.usuarios)}
      ${kpi("fa-user-clock", "warn", "Proveedores por verificar", i.proveedores_pendientes)}
      ${kpi("fa-briefcase", "violet", "Servicios publicados", i.servicios_activos)}
      ${kpi("fa-file-signature", "", "Solicitudes abiertas", i.solicitudes_abiertas)}
      ${kpi("fa-shield-halved", "violet", "Dinero en custodia", dinero(i.en_custodia), "Retenido hasta la conformidad")}
      ${kpi("fa-coins", "ok", "Comisiones del mes", dinero(i.comisiones_mes))}
    </div>`;
  }
  const esProv = rol === "proveedor";
  return html`<div class="grid grid-kpi">
    ${kpi("fa-hourglass-half", "warn", "Por confirmar", i.por_confirmar, esProv ? "Esperan tu respuesta" : "Esperando al proveedor")}
    ${kpi("fa-person-digging", "info", "En proceso", i.en_proceso)}
    ${kpi("fa-circle-check", "ok", "Completadas", i.completadas)}
    ${kpi("fa-shield-halved", "violet", "En custodia", dinero(i.en_custodia), esProv ? "Se libera con la conformidad" : "Protegido por la plataforma")}
    ${esProv
      ? html`${kpi("fa-wallet", "", "Ingresos netos del mes", dinero(i.monto_mes))}${kpi("fa-star", "warn", "Calificación", i.calificacion ?? "—", `${i.servicios_activos} servicios activos`)}`
      : kpi("fa-receipt", "", "Pagado este mes", dinero(i.monto_mes))}
  </div>`;
}

export default async function vistaInicio(cont) {
  cont.innerHTML = String(cargandoVista());
  const { ok, data } = await api("/api/inicio");
  if (!ok) throw new Error(data.mensaje);
  const u = estado.usuario;
  const i = data.indicadores;
  const perfil = u.perfil;

  const aviso = u.rol === "proveedor" && perfil && perfil.verificacion !== "aprobado"
    ? html`<div class="banner ${perfil.verificacion === "rechazado" ? "danger" : ""}">
        <i class="fas ${perfil.verificacion === "rechazado" ? "fa-circle-xmark" : "fa-user-clock"}"></i>
        <div><strong>Tu perfil está ${VERIFICACION[perfil.verificacion].label.toLowerCase()}.</strong>
        <div class="muted">${perfil.verificacion === "rechazado" ? `Motivo: ${perfil.motivo_rechazo || "—"}. Corrige tus datos para volver a revisión.` : "Tus servicios aparecerán en el catálogo cuando un administrador verifique tu perfil."}</div></div>
        <a href="#/perfil" class="btn btn-sm">Completar perfil</a>
      </div>`
    : "";

  const columnaOtro = u.rol === "proveedor" ? "Cliente" : "Proveedor";
  cont.innerHTML = String(html`
    ${aviso}
    ${bienvenida(u, i)}
    ${indicadores(u.rol, i)}
    <div class="card mt">
      <div class="card-head"><h3>Actividad reciente</h3><a href="#/solicitudes" class="btn btn-sm btn-ghost">Ver todas <i class="fas fa-arrow-right"></i></a></div>
      ${data.recientes.length
        ? html`<div class="table-wrap"><table>
            <thead><tr><th>Código</th><th>Servicio</th><th>${u.rol === "admin" ? "Cliente → Proveedor" : columnaOtro}</th><th class="num">Monto</th><th>Estado</th><th>Actualizado</th></tr></thead>
            <tbody>${data.recientes.map((s) => html`<tr class="clic" data-href="#/solicitudes?id=${s.id}">
              <td class="mono">${s.codigo}</td>
              <td><div class="titulo">${s.servicio}</div><div class="sub"><i class="fas ${s.categoria_icono}"></i> ${s.categoria}</div></td>
              <td>${u.rol === "admin" ? `${s.cliente} → ${s.proveedor}` : u.rol === "proveedor" ? s.cliente : s.proveedor}</td>
              <td class="num">${dinero(s.monto)}</td>
              <td>${badgeEstado(s.estado)}</td>
              <td class="subtle nowrap">${hace(s.actualizado_en)}</td>
            </tr>`)}</tbody></table></div>`
        : vacio("fa-inbox", "Aún no hay actividad", u.rol === "cliente" ? "Explora el catálogo y solicita tu primer servicio." : "")}
    </div>
    ${u.rol === "proveedor" && i.calificacion ? html`<p class="subtle mt">Tu reputación: ${estrellas(i.calificacion)}</p>` : raw("")}
  `);

  cont.querySelectorAll("tr[data-href]").forEach((tr) => tr.addEventListener("click", () => (location.hash = tr.dataset.href)));
}
