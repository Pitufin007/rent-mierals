// ══════════════════════════════════════════════════
// auth.js — Lógica de login.html y register.html
// ══════════════════════════════════════════════════

// ── LOGIN ──────────────────────────────────────────
const loginForm = document.getElementById('login-form');
if (loginForm) {
  // Si ya tiene sesión, ir al dashboard
  getSession().then(u => { if (u) window.location.href = '/views/dashboard.html'; });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) return showAlert('Completa todos los campos', 'warning');

    const btn = document.getElementById('btn-submit');
    btn.textContent = 'INGRESANDO...'; btn.disabled = true;

    try {
      await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      window.location.href = '/views/dashboard.html';
    } catch (err) {
      showAlert(err.message, 'error');
      btn.textContent = 'INGRESAR'; btn.disabled = false;
    }
  });
}

// ── REGISTER ───────────────────────────────────────
const registerForm = document.getElementById('register-form');
if (registerForm) {
  getSession().then(u => { if (u) window.location.href = '/views/dashboard.html'; });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre   = document.getElementById('nombre').value.trim();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm  = document.getElementById('confirm-password').value;

    if (!nombre || !email || !password || !confirm)
      return showAlert('Todos los campos son obligatorios', 'warning');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return showAlert('Correo con formato inválido', 'warning');
    if (password.length < 6)
      return showAlert('La contraseña debe tener al menos 6 caracteres', 'warning');
    if (password !== confirm)
      return showAlert('Las contraseñas no coinciden', 'warning');

    const btn = document.getElementById('btn-submit');
    btn.textContent = 'CREANDO...'; btn.disabled = true;

    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ nombre, email, password }),
      });
      showAlert('¡Cuenta creada! Redirigiendo...', 'success');
      setTimeout(() => window.location.href = '/views/dashboard.html', 800);
    } catch (err) {
      showAlert(err.message, 'error');
      btn.textContent = 'CREAR CUENTA'; btn.disabled = false;
    }
  });
}
