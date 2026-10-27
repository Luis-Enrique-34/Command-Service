// =====================================================================
//  Exportación a CSV compatible con Excel (equivalente a Apache POI en Java).
//  · Separador ";" y BOM UTF-8: Excel en español abre el archivo con tildes.
//  · Protección contra "CSV injection": una celda que empieza con = + - @
//    podría ejecutarse como fórmula; se le antepone un apóstrofo.
// =====================================================================
const BOM = "﻿";

/** Convierte un valor a una celda CSV segura. */
function celda(valor) {
  let s = valor instanceof Date ? valor.toISOString() : valor == null ? "" : String(valor);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * @param {object[]} filas
 * @param {string[]} columnas orden y nombre de las columnas
 * @returns {string} contenido CSV listo para descargar
 */
function aCsv(filas, columnas) {
  const encabezado = columnas.join(";");
  const cuerpo = filas.map((f) => columnas.map((c) => celda(f[c])).join(";"));
  const lineas = [encabezado, ...cuerpo];
  return BOM + lineas.join("\r\n");
}

module.exports = { aCsv, celda };
