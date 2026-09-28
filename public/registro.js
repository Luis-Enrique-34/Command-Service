const regForm = document.getElementById("registroForm");
const regBtn = document.getElementById("submitBtn");

// Si ya hay sesión activa, ir directo al panel
api("/api/auth/me").then(({ ok }) => {
  if (ok) window.location.replace("panel.html");
});

// Preseleccionar el rol si viene en la URL: registro.html?rol=proveedor
const rolUrl = new URLSearchParams(window.location.search).get("rol");
if (rolUrl === "cliente" || rolUrl === "proveedor") {
  regForm.querySelector(`input[name="rol"][value="${rolUrl}"]`).checked = true;
}

// ---------- Medidor de fortaleza de contraseña ----------
const reglas = {
  len: (p) => p.length >= 8,
  upper: (p) => /[A-Z]/.test(p),
  lower: (p) => /[a-z]/.test(p),
  num: (p) => /[0-9]/.test(p),
};
const colores = ["#3f3f46", "#f87171", "#fb923c", "#facc15", "#4ade80"];
const bar = document.getElementById("strengthBar");

regForm.password.addEventListener("input", () => {
  const p = regForm.password.value;
  let cumplidas = 0;
  for (const [nombre, test] of Object.entries(reglas)) {
    const ok = test(p);
    if (ok) cumplidas++;
    document.querySelector(`[data-rule="${nombre}"]`).classList.toggle("ok", ok);
  }
  bar.style.width = `${(cumplidas / 4) * 100}%`;
  bar.style.backgroundColor = colores[cumplidas];
});

// ---------- Envío ----------
regForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors(regForm);

  const datos = {
    rol: regForm.rol.value,
    nombres: regForm.nombres.value.trim(),
    apellidos: regForm.apellidos.value.trim(),
    email: regForm.email.value.trim(),
    telefono: regForm.telefono.value.trim(),
    password: regForm.password.value,
    confirmPassword: regForm.confirmPassword.value,
    aceptaTerminos: regForm.aceptaTerminos.checked,
  };

  // Validación en el navegador (comodidad para el usuario)
  const errores = {};
  if (datos.nombres.length < 2) errores.nombres = "Ingresa tus nombres";
  if (datos.apellidos.length < 2) errores.apellidos = "Ingresa tus apellidos";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) errores.email = "Ingresa un correo válido";
  if (datos.telefono && !/^\+?[0-9\s]{7,20}$/.test(datos.telefono)) errores.telefono = "Teléfono no válido";
  if (!Object.values(reglas).every((t) => t(datos.password)))
    errores.password = "La contraseña no cumple los requisitos";
  if (datos.password !== datos.confirmPassword) errores.confirmPassword = "Las contraseñas no coinciden";
  if (!datos.aceptaTerminos) errores.aceptaTerminos = "Debes aceptar los términos y condiciones";

  if (Object.keys(errores).length) {
    showServerErrors(errores);
    document.querySelector(".field.invalid input")?.focus();
    return;
  }

  setLoading(regBtn, true);
  const { ok, data } = await api("/api/auth/registro", { method: "POST", body: datos });
  setLoading(regBtn, false);

  if (!ok) {
    showServerErrors(data.errores);
    showAlert(data.mensaje || "No se pudo crear la cuenta");
    return;
  }

  showAlert("¡Cuenta creada con éxito! Redirigiendo a tu panel...", "success");
  regForm.reset();
  setTimeout(() => window.location.replace("panel.html"), 900);
});
