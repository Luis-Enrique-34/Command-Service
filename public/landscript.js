document.addEventListener("DOMContentLoaded", () => {
  // 1. Efecto Scroll en la Barra de Navegación (Header)
  const header = document.getElementById("header");

  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      header.style.boxShadow = "0 4px 25px rgba(0, 0, 0, 0.7)";
      header.style.backgroundColor = "rgba(9, 9, 11, 0.98)";
      header.style.padding = "5px 0"; // Compactar un poco
    } else {
      header.style.boxShadow = "none";
      header.style.backgroundColor = "rgba(9, 9, 11, 0.85)";
      header.style.padding = "0";
    }
  });

  // 2. Funcionalidad del Sistema de Pestañas (Tabs de Cliente/Proveedor)
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const targetId = btn.getAttribute("data-target");
      document.getElementById(targetId).classList.add("active");
    });
  });

  // 3. Scroll Suave para anclas (#)
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      // CORRECCIÓN: un href="#" solo (links aún sin destino) hacía que
      // querySelector("#") lanzara un error. Ahora se ignoran.
      if (href === "#") {
        e.preventDefault();
        return;
      }
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({ top: offsetPosition, behavior: "smooth" });
      }
    });
  });

  // 4. NUEVO: si el usuario ya inició sesión, cambiar los botones del header
  fetch("/api/auth/me", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data?.usuario) return;
      const auth = document.querySelector(".auth-buttons");
      auth.innerHTML = "";
      const saludo = document.createElement("span");
      saludo.className = "btn-login";
      saludo.textContent = `Hola, ${data.usuario.nombres.split(" ")[0]}`;
      const panel = document.createElement("a");
      panel.href = "panel.html";
      panel.className = "btn-primary";
      panel.textContent = "Ir a mi panel";
      auth.append(saludo, panel);
    })
    .catch(() => {}); // sin backend (abriendo el HTML directo) simplemente no hace nada
});
