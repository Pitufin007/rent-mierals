// ══════════════════════════════════════════════════
// main.js — Compartido por TODAS las páginas
// Maneja: sesión, navbar dinámico, footer, alertas, modo claro/oscuro
// ══════════════════════════════════════════════════

const API_URL = '/api';

// ── escapeHtml: neutraliza HTML en datos del usuario antes de meterlos
// en innerHTML (previene XSS almacenado/reflejado). Usar SIEMPRE que se
// interpole texto que venga de la base o del usuario dentro de plantillas.
function escapeHtml(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;


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
            <span class="logo-title">RENT MINERALS</span>
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
    <strong>Rent Minerals</strong> · Arriendo De Maquinarias Mineras<br>
    Ricardo Barahona ${new Date().getFullYear()}
    <p class="footer-legal" style="font-size:0.8rem;opacity:0.65;margin-top:0.75rem;line-height:1.4;">
      Las marcas, logotipos y modelos mencionados en este sitio son propiedad de
      sus respectivos dueños. Rent Minerals es una empresa de arriendo independiente
      y no representa ni está afiliada oficialmente a ningún fabricante.
    </p>
  `;
}
// ══════════════════════════════════════════════════════════════════
// Asistente virtual (IA) — burbuja flotante presente en todo el sitio
//
// Se dibuja solo si el backend confirma que la IA está configurada
// (GET /api/ia/estado). Si no lo está, no aparece nada: la web sigue
// funcionando igual.
// ══════════════════════════════════════════════════════════════════
const chatIA = {
  abierto: false,
  enviando: false,
  historial: [],          // [{ rol: 'usuario'|'asistente', texto }]
};

function chatIAHtml() {
  return `
    <button id="ia-burbuja" class="ia-burbuja" title="Asistente virtual" aria-label="Abrir asistente virtual">
      <span class="ia-burbuja-icono">💬</span>
    </button>
    <section id="ia-panel" class="ia-panel" role="dialog" aria-label="Asistente virtual" hidden>
      <header class="ia-panel-head">
        <div>
          <strong>Asistente Rent Minerals</strong>
          <span class="ia-panel-sub">Consulta equipos y disponibilidad</span>
        </div>
        <button class="ia-cerrar" id="ia-cerrar" aria-label="Cerrar">✕</button>
      </header>
      <div class="ia-mensajes" id="ia-mensajes"></div>
      <form class="ia-form" id="ia-form">
        <input id="ia-input" type="text" autocomplete="off" maxlength="500"
               placeholder="Escribe tu consulta...">
        <button type="submit" class="ia-enviar" id="ia-enviar" aria-label="Enviar">➤</button>
      </form>
    </section>
  `;
}

function chatIAPintarMensaje(rol, texto, opciones = {}) {
  const cont = document.getElementById('ia-mensajes');
  if (!cont) return null;
  const div = document.createElement('div');
  div.className = `ia-msg ia-msg-${rol}` + (opciones.clase ? ` ${opciones.clase}` : '');
  div.innerHTML = escapeHtml(texto).replace(/\n/g, '<br>');
  cont.appendChild(div);
  cont.scrollTop = cont.scrollHeight;
  return div;
}

async function chatIAEnviar(evento) {
  evento.preventDefault();
  if (chatIA.enviando) return;

  const input = document.getElementById('ia-input');
  const mensaje = input.value.trim();
  if (!mensaje) return;

  input.value = '';
  chatIAPintarMensaje('usuario', mensaje);
  chatIA.historial.push({ rol: 'usuario', texto: mensaje });

  chatIA.enviando = true;
  document.getElementById('ia-enviar').disabled = true;
  const cargando = chatIAPintarMensaje('asistente', 'Escribiendo…', { clase: 'ia-cargando' });

  try {
    const res = await fetch(`${API_URL}/ia/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        mensaje,
        // Enviamos solo los últimos turnos: da contexto sin gastar de más.
        historial: chatIA.historial.slice(-8, -1),
      }),
    });
    const data = await res.json();

    if (cargando) cargando.remove();

    if (res.ok && data.respuesta) {
      chatIAPintarMensaje('asistente', data.respuesta);
      chatIA.historial.push({ rol: 'asistente', texto: data.respuesta });
    } else {
      chatIAPintarMensaje('asistente', data.message || 'No pude responder en este momento.', { clase: 'ia-error' });
    }
  } catch (err) {
    if (cargando) cargando.remove();
    chatIAPintarMensaje('asistente', 'Hubo un problema de conexión. Intenta de nuevo.', { clase: 'ia-error' });
  } finally {
    chatIA.enviando = false;
    const btn = document.getElementById('ia-enviar');
    if (btn) btn.disabled = false;
    input.focus();
  }
}

function chatIAAlternar() {
  const panel = document.getElementById('ia-panel');
  const burbuja = document.getElementById('ia-burbuja');
  if (!panel) return;

  chatIA.abierto = !chatIA.abierto;
  panel.hidden = !chatIA.abierto;
  burbuja.classList.toggle('ia-burbuja-activa', chatIA.abierto);

  if (chatIA.abierto) {
    // Saludo inicial la primera vez que se abre.
    if (!chatIA.historial.length) {
      chatIAPintarMensaje('asistente',
        '¡Hola! Soy el asistente de Rent Minerals. Puedo ayudarte a encontrar el equipo adecuado para tu faena, contarte precios y decirte qué días está disponible. ¿Qué necesitas?');
    }
    document.getElementById('ia-input').focus();
  }
}

async function initChatIA() {
  try {
    const res = await fetch(`${API_URL}/ia/estado`);
    const data = await res.json();
    if (!data.habilitada) return;   // IA apagada → no mostramos nada

    const contenedor = document.createElement('div');
    contenedor.id = 'ia-widget';
    contenedor.innerHTML = chatIAHtml();
    document.body.appendChild(contenedor);

    document.getElementById('ia-burbuja').addEventListener('click', chatIAAlternar);
    document.getElementById('ia-cerrar').addEventListener('click', chatIAAlternar);
    document.getElementById('ia-form').addEventListener('submit', chatIAEnviar);
  } catch (err) {
    // Si falla la comprobación, simplemente no se muestra el asistente.
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  renderFooter();
  initChatIA();
});