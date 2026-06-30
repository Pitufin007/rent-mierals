// ══════════════════════════════════════════════════
// main.js — Compartido por TODAS las páginas
// Maneja: sesión, navbar dinámico, footer, alertas, modo claro/oscuro
// ══════════════════════════════════════════════════

const API_URL = '/api';

// ── apiFetch: wrapper de fetch con JSON y cookies ──
async function apiFetch(path, options = {}) {
  const res = await fetch(API_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Error en la petición');
    err.status = res.status;
    throw err;
  }
  return data;
}

// ── getSession: devuelve usuario logueado o null ──
async function getSession() {
  try {
    const data = await apiFetch('/auth/me');
    return data.user;
  } catch (_) { return null; }
}

// ── requireSession: redirige a login si no hay sesión ──
async function requireSession() {
  const user = await getSession();
  if (!user) { window.location.href = '/views/login.html'; return null; }
  return user;
}

// ── requireAdmin: redirige si no es admin ──
async function requireAdmin() {
  const user = await requireSession();
  if (!user) return null;
  if (user.rol !== 'admin') { window.location.href = '/views/dashboard.html'; return null; }
  return user;
}

// ── showAlert: mensaje flotante tipo toast ──
function showAlert(msg, tipo = 'info') {
  let container = document.getElementById('alert-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'alert-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `alert-msg alert-${tipo}`;
  el.innerHTML = `<span>${msg}</span><button onclick="this.parentElement.remove()">✕</button>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

// ══════════════════════════════════════════════════
// ── MODO CLARO / OSCURO ──────────────────────────
// ══════════════════════════════════════════════════
function getTheme() {
  // Default 'light' = paleta Komatsu (azul/gris/blanco), la identidad
  // base del proyecto. 'dark' es la variante de alto contraste sobre
  // gris oscuro, opcional vía el botón ☀️/🌙.
  return localStorage.getItem('theme') || 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  updateThemeBtn();
}

function updateThemeBtn() {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  const isDark = getTheme() === 'dark';
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.title = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
}

// Aplicar tema inmediatamente para evitar parpadeo
applyTheme(getTheme());

// ── renderNavbar: navbar según estado de sesión ──
async function renderNavbar() {
  const header = document.getElementById('navbar');
  if (!header) return;

  const user = await getSession();
  const path = window.location.pathname;

  // Botón de tema (siempre visible)
  const isDark = getTheme() === 'dark';
  const themeBtn = `
    <button
      id="btn-theme"
      class="btn-theme-toggle"
      title="${isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}"
      onclick="toggleTheme()"
    >${isDark ? '☀️' : '🌙'}</button>
  `;

  let links = '';
  if (user) {
    const adminLink = user.rol === 'admin'
      ? `<a href="/views/admin.html" class="nav-link ${path.includes('admin') ? 'active' : ''}">⚙ Admin</a>`
      : '';
    links = `
      <a href="/" class="nav-link ${path === '/' ? 'active' : ''}">🏠 Inicio</a>
      <a href="/catalogo" class="nav-link ${path.includes('catalogo') ? 'active' : ''}">⛏ Catálogo</a>
      <a href="/views/dashboard.html" class="nav-link ${path.includes('dashboard') ? 'active' : ''}">📊 Dashboard</a>
      ${adminLink}
      <a href="/views/profile.html" class="nav-link ${path.includes('profile') ? 'active' : ''}">👤 ${user.nombre}</a>
      ${themeBtn}
      <button class="btn btn-outline btn-sm" id="btn-logout">Salir</button>
    `;
  } else {
    links = `
      <a href="/" class="nav-link ${path === '/' ? 'active' : ''}">🏠 Inicio</a>
      <a href="/catalogo" class="nav-link ${path.includes('catalogo') ? 'active' : ''}">⛏ Catálogo</a>
      <a href="/views/login.html" class="nav-link ${path.includes('login') ? 'active' : ''}">Iniciar sesión</a>
      ${themeBtn}
      <a href="/views/register.html" class="btn btn-primary btn-sm">Registrarse</a>
    `;
  }

  header.innerHTML = `
    <nav class="navbar">
      <div class="navbar-inner">
        <a href="/" class="logo" style="text-decoration:none">
          <div class="logo-icon">⛏</div>
          <div class="logo-text">
            <span class="logo-title">RENT MIERALS</span>
            <span class="logo-sub">Maquinaria Industrial</span>
          </div>
        </a>
        <button class="nav-toggle" id="nav-toggle" aria-label="Menú">☰</button>
        <div class="nav-links" id="nav-links">${links}</div>
      </div>
    </nav>
  `;

  // Cerrar sesión
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await apiFetch('/auth/logout', { method: 'POST' });
      window.location.href = '/views/login.html';
    });
  }

  // Hamburger para móvil
  document.getElementById('nav-toggle')?.addEventListener('click', () => {
    document.getElementById('nav-links')?.classList.toggle('open');
  });
}

// ── renderFooter ──
function renderFooter() {
  const footer = document.querySelector('footer');
  if (!footer) return;
  footer.innerHTML = `
    <strong>Rent Mierals</strong> · Arriendo De Maquinarias Mineras<br>
    Ricardo Barahona ${new Date().getFullYear()}
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  renderFooter();
});