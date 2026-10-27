// =====================================================================
//  Utilidades de formularios compartidas por login.js y registro.js
// =====================================================================

// Llamada a la API del backend. credentials: "same-origin" hace que el
// navegador envíe y reciba la cookie de sesión automáticamente.
async function api(url, { method = "GET", body } = {}) {
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
  return { ok: res.ok, status: res.status, data };
}

function showAlert(texto, tipo = "error") {
  const alert = document.getElementById("alert");
  if (!alert) return;
  const icono = tipo === "error" ? "fa-circle-exclamation" : "fa-circle-check";
  alert.className = `alert ${tipo} show`;
  // textContent (no innerHTML) para no ejecutar HTML que venga en el mensaje -> evita XSS
  alert.innerHTML = `<i class="fas ${icono}"></i><span></span>`;
  alert.querySelector("span").textContent = texto;
}

function hideAlert() {
  const alert = document.getElementById("alert");
  if (alert) alert.className = "alert";
}

function setFieldError(campo, mensaje) {
  const el = document.querySelector(`[data-error-for="${campo}"]`);
  if (!el) return false;
  el.textContent = mensaje || "";
  el.closest(".field")?.classList.toggle("invalid", Boolean(mensaje));
  return true;
}

function clearErrors(form) {
  form.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
  form.querySelectorAll(".field.invalid").forEach((el) => el.classList.remove("invalid"));
  hideAlert();
}

// Muestra los errores por campo que devuelve el backend: { email: "...", ... }
function showServerErrors(errores = {}) {
  for (const [campo, msg] of Object.entries(errores)) setFieldError(campo, msg);
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.classList.toggle("loading", loading);
}

// Botones de mostrar / ocultar contraseña
document.querySelectorAll("[data-toggle]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.toggle);
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    btn.querySelector("i").className = visible ? "fas fa-eye" : "fas fa-eye-slash";
    btn.setAttribute("aria-label", visible ? "Mostrar contraseña" : "Ocultar contraseña");
  });
});

// Al escribir en un campo con error, se limpia su mensaje
document.querySelectorAll("input").forEach((input) => {
  input.addEventListener("input", () => setFieldError(input.name, ""));
});
