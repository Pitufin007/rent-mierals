// ── Configuración ──────────────────────────────────────────────
const API_BASE = '/maquinaria';

// ── Estado global ──────────────────────────────────────────────
let allData = [];
let currentFilter = { search: '', categoria: '', estado: '' };
let editId = null;
let currentUser = null; // se llena en init() según la sesión activa

function isAdmin() {
  return currentUser && currentUser.rol === 'admin';
}

function isUsuario() {
  return !!currentUser && !isAdmin();
}

// ── Helpers ────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function estadoClass(estado) {
  const map = {
    'Disponible': 'estado-disponible',
    'En uso': 'estado-en-uso',
    'Mantenimiento': 'estado-mantenimiento'
  };
  return map[estado] || 'estado-disponible';
}

function formatPrice(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

// ── Toast ──────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const container = $('#toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── API calls ──────────────────────────────────────────────────
// Se utiliza la función apiFetch global de main.js


// ── Renderizado ────────────────────────────────────────────────
function renderCards(lista) {
  const grid = $('#machinery-grid');
  const countEl = $('#result-count');
  countEl.textContent = lista.length;

  if (lista.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <div class="icon">⛏️</div>
      <p>Sin resultados para esta búsqueda</p>
    </div>`;
    return;
  }

  grid.innerHTML = lista.map((m, i) => `
    <article class="card" style="animation-delay:${i * 0.05}s">
      <img class="card-img"
           src="${m.imagen}"
           alt="${m.nombre}"
           onerror="this.src='https://via.placeholder.com/400x250/eef1f4/5b6b7a?text=SIN+IMAGEN'">
      <span class="card-estado ${estadoClass(m.estado)}">${m.estado}</span>
      <div class="card-body">
        <div class="card-cat">${m.categoria}</div>
        <h3 class="card-title">${m.nombre}</h3>
        <div class="card-meta">
          <span data-label="Marca">${m.marca}</span>
          <span data-label="Modelo">${m.modelo}</span>
          <span data-label="Año">${m.año}</span>
          <span data-label="Potencia">${m.potencia || '—'}</span>
        </div>
        <p class="card-desc">${m.descripcion}</p>
        <div class="card-footer">
          <div class="price">${formatPrice(m.precio_arriendo_dia)} <span>/ día</span></div>
          <div class="card-actions">
            <button class="btn btn-outline btn-sm" onclick="openDetail(${m.id})">VER</button>
            ${cardActionsHtml(m)}
          </div>
        </div>
      </div>
    </article>
  `).join('');
}

// ── Acciones de la tarjeta según rol ────────────────────────────
function cardActionsHtml(m) {
  if (isAdmin()) {
    return `
      <button class="btn btn-primary btn-sm" onclick="openEdit(${m.id})">EDITAR</button>
      <button class="btn btn-danger btn-sm" onclick="confirmDelete(${m.id}, '${m.nombre.replace(/'/g, "\\'")}')">✕</button>
    `;
  }
  if (isUsuario()) {
    const disponible = m.estado === 'Disponible';
    return `
      <button class="btn btn-primary btn-sm" ${disponible ? '' : 'disabled title="No disponible actualmente"'}
        onclick="openReserva(${m.id}, '${m.nombre.replace(/'/g, "\\'")}')">RESERVAR</button>
    `;
  }
  // Visitante sin sesión: solo puede ver, se invita a iniciar sesión para reservar
  return `<a class="btn btn-outline btn-sm" href="/views/login.html">INICIAR SESIÓN PARA RESERVAR</a>`;
}

// ── Cargar datos ───────────────────────────────────────────────
async function loadData() {
  const grid = $('#machinery-grid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div>Cargando maquinaria...</div>';

  try {
    const params = new URLSearchParams();
    if (currentFilter.search) params.append('search', currentFilter.search);
    if (currentFilter.categoria) params.append('categoria', currentFilter.categoria);
    if (currentFilter.estado) params.append('estado', currentFilter.estado);

    const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
    const data = await apiFetch(url);
    allData = data.data;
    renderCards(allData);
    updateStats(data.total);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">
      <div class="icon">⚠️</div>
      <p>Error al cargar: ${err.message}</p>
    </div>`;
  }
}

async function updateStats(total) {
  $('#stat-total').textContent = total;
  const all = await apiFetch(API_BASE);
  const disponibles = all.data.filter(m => m.estado === 'Disponible').length;
  $('#stat-disponibles').textContent = disponibles;
}

// ── Categorías ─────────────────────────────────────────────────
async function loadCategorias() {
  try {
    const data = await apiFetch(`${API_BASE}/categorias`);
    const select = $('#filter-categoria');
    const formSelect = $('#form-categoria');
    data.data.forEach(cat => {
      const opt1 = new Option(cat, cat);
      const opt2 = new Option(cat, cat);
      select.add(opt1);
      if (formSelect) formSelect.add(opt2);
    });
  } catch (e) {}
}

// ── Modal helpers ──────────────────────────────────────────────
function openModal(id) {
  const overlay = $(`#${id}`);
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const overlay = $(`#${id}`);
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Cerrar al click fuera
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
    editId = null;
  }
});

// ── Modal Detalle ──────────────────────────────────────────────
async function openDetail(id) {
  try {
    const data = await apiFetch(`${API_BASE}/${id}`);
    const m = data.data;

    const body = $('#detail-body');
    body.innerHTML = `
      <div class="detail-price-box">
        <div>
          <div style="font-family:'Barlow Condensed';font-size:.7rem;letter-spacing:2px;text-transform:uppercase;color:var(--silver)">Arriendo diario</div>
          <div class="price">${formatPrice(m.precio_arriendo_dia)} <span>/ día</span></div>
        </div>
        <span class="card-estado ${estadoClass(m.estado)}" style="position:static">${m.estado}</span>
      </div>
      <div class="detail-desc">${m.descripcion}</div>
      <div class="detail-grid">
        <div class="detail-item"><label>Categoría</label><div class="val">${m.categoria}</div></div>
        <div class="detail-item"><label>Marca</label><div class="val">${m.marca}</div></div>
        <div class="detail-item"><label>Modelo</label><div class="val">${m.modelo}</div></div>
        <div class="detail-item"><label>Año</label><div class="val">${m.año}</div></div>
        <div class="detail-item"><label>Capacidad</label><div class="val">${m.capacidad}</div></div>
        <div class="detail-item"><label>Potencia</label><div class="val">${m.potencia}</div></div>
      </div>
      <div style="display:flex;gap:.7rem;justify-content:flex-end">
        ${detailActionsHtml(m)}
        <button class="btn btn-outline" onclick="closeModal('modal-detail')">CERRAR</button>
      </div>
    `;
    $('#detail-title').textContent = m.nombre;
    openModal('modal-detail');
  } catch (err) {
    toast('Error al cargar detalle: ' + err.message, 'error');
  }
}

function detailActionsHtml(m) {
  if (isAdmin()) {
    return `<button class="btn btn-primary" onclick="openEdit(${m.id});closeModal('modal-detail')">EDITAR</button>`;
  }
  if (isUsuario()) {
    const disponible = m.estado === 'Disponible';
    return `<button class="btn btn-primary" ${disponible ? '' : 'disabled title="No disponible actualmente"'}
      onclick="closeModal('modal-detail');openReserva(${m.id}, '${m.nombre.replace(/'/g, "\\'")}')">RESERVAR</button>`;
  }
  return '';
}

// ── Modal Crear/Editar ─────────────────────────────────────────
function openCreate() {
  editId = null;
  $('#form-modal-title').textContent = 'AGREGAR MAQUINARIA';
  $('#item-form').reset();
  clearErrors();
  openModal('modal-form');
}

async function openEdit(id) {
  try {
    const data = await apiFetch(`${API_BASE}/${id}`);
    const m = data.data;
    editId = id;

    $('#form-modal-title').textContent = 'EDITAR MAQUINARIA';
    $('#form-nombre').value = m.nombre;
    $('#form-categoria').value = m.categoria;
    $('#form-marca').value = m.marca;
    $('#form-modelo').value = m.modelo;
    $('#form-año').value = m.año;
    $('#form-capacidad').value = m.capacidad;
    $('#form-potencia').value = m.potencia;
    $('#form-descripcion').value = m.descripcion;
    $('#form-estado').value = m.estado;
    $('#form-precio').value = m.precio_arriendo_dia;
    clearErrors();
    openModal('modal-form');
  } catch (err) {
    toast('Error al cargar datos: ' + err.message, 'error');
  }
}

function clearErrors() {
  $$('.form-error').forEach(e => e.textContent = '');
  $$('.error').forEach(e => e.classList.remove('error'));
}

function setError(fieldId, msg) {
  const field = $(`#${fieldId}`);
  const errEl = $(`#err-${fieldId.replace('form-', '')}`);
  if (field) field.classList.add('error');
  if (errEl) errEl.textContent = msg;
}

// ── Submit form ────────────────────────────────────────────────
$('#item-form').addEventListener('submit', async e => {
  e.preventDefault();
  clearErrors();

  const payload = {
    nombre:             $('#form-nombre').value.trim(),
    categoria:          $('#form-categoria').value,
    marca:              $('#form-marca').value.trim(),
    modelo:             $('#form-modelo').value.trim(),
    año:                $('#form-año').value,
    capacidad:          $('#form-capacidad').value.trim(),
    potencia:           $('#form-potencia').value.trim(),
    descripcion:        $('#form-descripcion').value.trim(),
    estado:             $('#form-estado').value,
    precio_arriendo_dia: $('#form-precio').value
  };

  // Validación frontend
  let valid = true;
  if (!payload.nombre) { setError('form-nombre', 'El nombre es requerido'); valid = false; }
  if (!payload.categoria) { setError('form-categoria', 'Seleccione una categoría'); valid = false; }
  if (!payload.marca) { setError('form-marca', 'La marca es requerida'); valid = false; }
  if (!payload.modelo) { setError('form-modelo', 'El modelo es requerido'); valid = false; }
  if (!payload.descripcion) { setError('form-descripcion', 'La descripción es requerida'); valid = false; }
  if (!valid) return;

  try {
    const btn = $('#btn-submit');
    btn.textContent = 'GUARDANDO...';
    btn.disabled = true;

    if (editId) {
      await apiFetch(`${API_BASE}/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Maquinaria actualizada exitosamente ✓', 'success');
    } else {
      await apiFetch(API_BASE, { method: 'POST', body: JSON.stringify(payload) });
      toast('Maquinaria agregada exitosamente ✓', 'success');
    }

    closeModal('modal-form');
    editId = null;
    await loadData();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  } finally {
    const btn = $('#btn-submit');
    btn.textContent = 'GUARDAR';
    btn.disabled = false;
  }
});

// ── Eliminar ───────────────────────────────────────────────────
function confirmDelete(id, nombre) {
  $('#delete-name').textContent = nombre;
  $('#btn-confirm-delete').onclick = () => deleteMaquina(id);
  openModal('modal-confirm');
}

async function deleteMaquina(id) {
  try {
    await apiFetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    toast('Maquinaria eliminada ✓', 'success');
    closeModal('modal-confirm');
    await loadData();
  } catch (err) {
    toast('Error al eliminar: ' + err.message, 'error');
  }
}

// ── Filtros ────────────────────────────────────────────────────
let searchTimeout;
$('#search-input').addEventListener('input', e => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentFilter.search = e.target.value;
    loadData();
  }, 350);
});

$('#filter-categoria').addEventListener('change', e => {
  currentFilter.categoria = e.target.value;
  loadData();
});

$('#filter-estado').addEventListener('change', e => {
  currentFilter.estado = e.target.value;
  loadData();
});

$('#btn-clear').addEventListener('click', () => {
  $('#search-input').value = '';
  $('#filter-categoria').value = '';
  $('#filter-estado').value = '';
  currentFilter = { search: '', categoria: '', estado: '' };
  loadData();
});

// ── Reservar equipo (usuario normal) ────────────────────────────
let reservaMaquinariaId = null;

function openReserva(id, nombre) {
  if (!currentUser) {
    window.location.href = '/views/login.html';
    return;
  }
  reservaMaquinariaId = id;
  $('#reserva-nombre').textContent = nombre;
  $('#reserva-form').reset();
  $$('#reserva-form .form-error').forEach(e => e.textContent = '');
  const today = new Date().toISOString().split('T')[0];
  $('#reserva-inicio').min = today;
  $('#reserva-fin').min = today;
  openModal('modal-reserva');
}

const reservaFormEl = $('#reserva-form');
if (reservaFormEl) {
  reservaFormEl.addEventListener('submit', async e => {
    e.preventDefault();
    $$('#reserva-form .form-error').forEach(el => el.textContent = '');

    const inicio = $('#reserva-inicio').value;
    const fin = $('#reserva-fin').value;
    const notas = $('#reserva-notas').value.trim();

    let valid = true;
    if (!inicio) { $('#err-reserva-inicio').textContent = 'Selecciona una fecha de inicio'; valid = false; }
    if (!fin) { $('#err-reserva-fin').textContent = 'Selecciona una fecha de término'; valid = false; }
    if (inicio && fin && fin < inicio) { $('#err-reserva-fin').textContent = 'Debe ser igual o posterior al inicio'; valid = false; }
    if (!valid) return;

    const btn = $('#btn-reserva-submit');
    try {
      btn.textContent = 'RESERVANDO...';
      btn.disabled = true;

      await apiFetch('/reservas', {
        method: 'POST',
        body: JSON.stringify({
          maquinariaId: reservaMaquinariaId,
          fecha_inicio: inicio,
          fecha_fin: fin,
          notas
        })
      });

      toast('Reserva creada exitosamente ✓', 'success');
      closeModal('modal-reserva');
    } catch (err) {
      toast('Error al reservar: ' + err.message, 'error');
    } finally {
      btn.textContent = 'CONFIRMAR RESERVA';
      btn.disabled = false;
    }
  });
}

// ── Init ───────────────────────────────────────────────────────
(async () => {
  try {
    currentUser = await getSession();
  } catch (_) {
    currentUser = null;
  }

  // Mostrar botón "Agregar equipo" solo a administradores
  const btnAdd = $('#btn-add-equipo');
  if (btnAdd) btnAdd.style.display = isAdmin() ? '' : 'none';

  await loadCategorias();
  await loadData();
})();