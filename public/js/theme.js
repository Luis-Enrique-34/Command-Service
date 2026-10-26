// =====================================================================
//  Tema claro / oscuro. Se carga en el <head> (sin defer) para aplicar el
//  tema ANTES de pintar y evitar el parpadeo. Recuerda la elección del
//  usuario en localStorage. Por defecto: oscuro (identidad de la marca).
//  Cualquier elemento con [data-theme-toggle] cambia el tema al hacer clic.
// =====================================================================
(function () {
  var CLAVE = "cs-tema";
  var raiz = document.documentElement;

  function leer() {
    try { return localStorage.getItem(CLAVE); } catch (e) { return null; }
  }

  function aplicar(tema, animar) {
    if (animar) {
      raiz.classList.add("tema-anim");
      setTimeout(function () { raiz.classList.remove("tema-anim"); }, 350);
    }
    raiz.setAttribute("data-theme", tema);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", tema === "light" ? "#ffffff" : "#09090b");
  }

  var guardado = leer();
  aplicar(guardado === "light" || guardado === "dark" ? guardado : "dark", false);

  document.addEventListener("click", function (e) {
    var boton = e.target.closest && e.target.closest("[data-theme-toggle]");
    if (!boton) return;
    var nuevo = raiz.getAttribute("data-theme") === "dark" ? "light" : "dark";
    aplicar(nuevo, true);
    try { localStorage.setItem(CLAVE, nuevo); } catch (err) { /* modo privado: solo para esta visita */ }
    boton.setAttribute("aria-label", nuevo === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
    document.dispatchEvent(new CustomEvent("temachange", { detail: nuevo }));
  });
})();
