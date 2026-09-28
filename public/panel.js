// Página protegida: si no hay sesión válida, redirige al login.
(async () => {
  const { ok, data } = await api("/api/auth/me");
  if (!ok) {
    window.location.replace("login.html");
    return;
  }

  const u = data.usuario;
  document.getElementById("avatar").textContent = (u.nombres[0] + u.apellidos[0]).toUpperCase();
  document.getElementById("saludo").textContent = `Hola, ${u.nombres} ${u.apellidos}`;
  document.getElementById("rolBadge").textContent = u.rol === "proveedor" ? "Proveedor" : "Cliente";
  document.getElementById("email").textContent = u.email;
  document.getElementById("userId").textContent = u.id;
  document.getElementById("panel").hidden = false;
})();

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  window.location.replace("login.html");
});
