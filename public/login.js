const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("submitBtn");

// Si ya hay sesión activa, no tiene sentido mostrar el login
api("/api/auth/me").then(({ ok }) => {
  if (ok) window.location.replace("panel.html");
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors(loginForm);

  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;

  // Validación rápida en el navegador (la definitiva la hace el servidor)
  let valido = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) valido = !setFieldError("email", "Ingresa un correo válido");
  if (!password) valido = !setFieldError("password", "Ingresa tu contraseña");
  if (!valido) return;

  setLoading(loginBtn, true);
  const { ok, data } = await api("/api/auth/login", { method: "POST", body: { email, password } });
  setLoading(loginBtn, false);

  if (!ok) {
    showServerErrors(data.errores);
    showAlert(data.mensaje || "No se pudo iniciar sesión");
    loginForm.password.value = "";
    return;
  }

  showAlert(`${data.mensaje}, ${data.usuario.nombres.split(" ")[0]}. Redirigiendo...`, "success");
  setTimeout(() => window.location.replace("panel.html"), 700);
});
