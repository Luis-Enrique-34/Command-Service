// Vista: Reportes de gestión (administrador) + exportación a CSV/Excel.
import { api, html, raw, dinero, ESTADOS, vacio } from "../core.js";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

export default async function vistaReportes(cont) {
  const { ok, data } = await api("/api/admin/reportes");
  if (!ok) throw new Error(data.mensaje);
  const r = data.reportes;
  const c = r.conversion;
  const tasa = c.creadas ? Math.round((c.completadas / c.creadas) * 100) : 0;
  const maxMes = Math.max(1, ...r.porMes.map((m) => Number(m.bruto)));
  const maxEstado = Math.max(1, ...r.porEstado.map((e) => e.total));
  const maxCat = Math.max(1, ...r.porCategoria.map((x) => x.solicitudes));
  const totalBruto = r.porMes.reduce((a, m) => a + Number(m.bruto), 0);
  const totalCom = r.porMes.reduce((a, m) => a + Number(m.comision), 0);

  cont.innerHTML = String(html`
    <div class="page-head">
      <div><h2>Reportes de gestión</h2><p>Indicadores calculados en tiempo real desde la base de datos.</p></div>
      <a class="btn btn-red" href="/api/admin/reportes/solicitudes.csv" download><i class="fas fa-file-excel"></i> Exportar solicitudes (CSV)</a>
    </div>

    <div class="grid grid-kpi">
      <div class="card kpi"><div class="kpi-icon"><i class="fas fa-file-signature"></i></div><div><div class="kpi-label">Solicitudes creadas</div><div class="kpi-value">${c.creadas}</div></div></div>
      <div class="card kpi"><div class="kpi-icon ok"><i class="fas fa-percent"></i></div><div><div class="kpi-label">Tasa de conversión</div><div class="kpi-value">${tasa}%</div><div class="kpi-sub">${c.completadas} completadas</div></div></div>
      <div class="card kpi"><div class="kpi-icon warn"><i class="fas fa-stopwatch"></i></div><div><div class="kpi-label">Tiempo hasta aceptar</div><div class="kpi-value">${r.tiempoAtencion ?? "—"} h</div><div class="kpi-sub">promedio</div></div></div>
      <div class="card kpi"><div class="kpi-icon violet"><i class="fas fa-coins"></i></div><div><div class="kpi-label">Comisiones (6 meses)</div><div class="kpi-value">${dinero(totalCom)}</div><div class="kpi-sub">de ${dinero(totalBruto)} transaccionados</div></div></div>
    </div>

    <div class="grid grid-2 mt">
      <div class="card">
        <div class="card-head"><h3>Pagos por mes</h3><div class="leyenda"><span><i style="background:var(--primary-red)"></i>Monto</span><span><i style="background:var(--text-main)"></i>Comisión</span></div></div>
        <div class="barras">${r.porMes.map((m) => {
          const alto = (Number(m.bruto) / maxMes) * 100;
          const com = Number(m.bruto) ? (Number(m.comision) / Number(m.bruto)) * 100 : 0;
          return html`<div class="barra" title="${m.pagos} pagos · ${dinero(m.bruto)}">
            <span class="val">${Number(m.bruto) ? dinero(m.bruto).replace(".00", "") : ""}</span>
            <div class="col" style="height:${alto.toFixed(1)}%"><div class="com" style="height:${com.toFixed(1)}%"></div></div>
            <span class="lab">${MESES[Number(m.mes.slice(5)) - 1]}</span>
          </div>`;
        })}</div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Solicitudes por estado</h3></div>
        ${r.porEstado.map((e) => html`<div class="hbar"><span>${ESTADOS[e.estado].label}</span>
          <div class="pista"><div class="relleno" style="width:${((e.total / maxEstado) * 100).toFixed(1)}%"></div></div><strong class="num">${e.total}</strong></div>`)}
      </div>
    </div>

    <div class="grid grid-2 mt">
      <div class="card">
        <div class="card-head"><h3>Demanda por categoría</h3></div>
        ${r.porCategoria.map((x) => html`<div class="hbar"><span><i class="fas ${x.icono} red"></i> ${x.nombre}</span>
          <div class="pista"><div class="relleno" style="width:${((x.solicitudes / maxCat) * 100).toFixed(1)}%"></div></div><strong class="num">${x.solicitudes}</strong></div>`)}
      </div>
      <div class="card">
        <div class="card-head"><h3>Top proveedores</h3></div>
        ${r.topProveedores.length ? html`<div class="table-scroll"><table>
          <thead><tr><th>Proveedor</th><th class="num">Completados</th><th class="num">Neto cobrado</th><th class="num">★</th></tr></thead>
          <tbody>${r.topProveedores.map((p, i) => html`<tr><td>${raw(i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : "")}${p.proveedor}</td><td class="num">${p.completadas}</td><td class="num">${dinero(p.neto)}</td><td class="num">${p.calificacion ?? "—"}</td></tr>`)}</tbody>
        </table></div>` : vacio("fa-trophy", "Sin datos aún")}
      </div>
    </div>`);
}
