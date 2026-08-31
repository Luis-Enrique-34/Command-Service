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
      // Remover la clase "active" de todos los botones y contenidos
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      // Añadir la clase "active" al botón actual
      btn.classList.add("active");

      // Mostrar el contenido correspondiente mediante su ID
      const targetId = btn.getAttribute("data-target");
      document.getElementById(targetId).classList.add("active");
    });
  });

  // 3. Scroll Suave para anclas (#)
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));

      if (target) {
        // Compensación por el alto del header fijo (80px)
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition =
          elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
    });
  });
});
