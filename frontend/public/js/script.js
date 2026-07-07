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
           src="${encodeURI(m.imagen || '')}"
           alt="${escapeHtml(m.nombre)}"
           onerror="this.src='https://via.placeholder.com/400x250/eef1f4/5b6b7a?text=SIN+IMAGEN'">
      <span class="card-estado ${estadoClass(m.estado)}">${escapeHtml(m.estado)}</span>
      <div class="card-body">
        <div class="card-cat">${escapeHtml(m.categoria)}</div>
        <h3 class="card-title">${escapeHtml(m.nombre)}</h3>
        <div class="card-meta">
          <span data-label="Marca">${escapeHtml(m.marca)}</span>
          <span data-label="Modelo">${escapeHtml(m.modelo)}</span>
          <span data-label="Año">${escapeHtml(m.año)}</span>
          <span data-label="Potencia">${escapeHtml(m.potencia || '—')}</span>
        </div>
        <p class="card-desc">${escapeHtml(m.descripcion)}</p>
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
        <span class="card-estado ${estadoClass(m.estado)}" style="position:static">${escapeHtml(m.estado)}</span>
      </div>
      <div class="detail-desc">${escapeHtml(m.descripcion)}</div>
      <div class="detail-grid">
        <div class="detail-item"><label>Categoría</label><div class="val">${escapeHtml(m.categoria)}</div></div>
        <div class="detail-item"><label>Marca</label><div class="val">${escapeHtml(m.marca)}</div></div>
        <div class="detail-item"><label>Modelo</label><div class="val">${escapeHtml(m.modelo)}</div></div>
        <div class="detail-item"><label>Año</label><div class="val">${escapeHtml(m.año)}</div></div>
        <div class="detail-item"><label>Capacidad</label><div class="val">${escapeHtml(m.capacidad)}</div></div>
        <div class="detail-item"><label>Potencia</label><div class="val">${escapeHtml(m.potencia)}</div></div>
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

// ── Reservar equipo — calendario con bloqueo de fechas ──────────
//
// El usuario elige inicio y término haciendo clic en un calendario.
// Los días que ya están agendados (aprobados) para esa máquina se
// pintan como "ocupados" y no se pueden seleccionar. Además se
// muestra un aviso con los rangos ocupados. La disponibilidad se
// pide al backend: GET /reservas/disponibilidad/:maquinariaId.

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

const reserva = {
  maquinariaId: null,
  precioDia: 0,
  ocupadas: [],          // [{ini: Date, fin: Date, cliente}]
  viewY: 0, viewM: 0,    // mes visible en el calendario
  inicio: null, fin: null,
};

// Fecha local (medianoche) a partir de 'YYYY-MM-DD' o ISO. Evita el
// corrimiento de un día que produce new Date('YYYY-MM-DD') en zonas UTC-.
function toLocalDate(v) {
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const s = String(v).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function fmtFecha(date) {
  return `${date.getDate()} ${MESES_CORTO[date.getMonth()]} ${date.getFullYear()}`;
}
function hoyLocal() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function diasInclusivos(a, b) {
  return Math.round((b - a) / 86400000) + 1;
}
// ¿La fecha cae dentro de algún rango ocupado (inclusive)?
function estaOcupado(date) {
  return reserva.ocupadas.some(r => date >= r.ini && date <= r.fin);
}
// ¿El rango [a, b] pisa algún día ocupado?
function rangoPisaOcupado(a, b) {
  return reserva.ocupadas.some(r => a <= r.fin && b >= r.ini);
}

async function openReserva(id, nombre) {
  if (!currentUser) {
    window.location.href = '/views/login.html';
    return;
  }
  reserva.maquinariaId = id;
  reserva.inicio = null;
  reserva.fin = null;
  reserva.ocupadas = [];
  reserva.precioDia = 0;

  $('#reserva-nombre').textContent = nombre;
  $('#reserva-telefono').value = '';
  $('#reserva-notas').value = '';
  $('#btn-reserva-submit').disabled = true;

  const h = hoyLocal();
  reserva.viewY = h.getFullYear();
  reserva.viewM = h.getMonth();

  $('#cal-days').innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--silver);padding:1rem">Cargando disponibilidad…</div>';
  $('#reserva-ocupadas').style.display = 'none';
  updateReservaSummary();
  openModal('modal-reserva');

  try {
    const data = await apiFetch(`/reservas/disponibilidad/${id}`);
    reserva.precioDia = Number(data.precioDia) || 0;
    reserva.ocupadas = (data.ocupadas || []).map(o => ({
      ini: toLocalDate(o.fecha_inicio),
      fin: toLocalDate(o.fecha_fin),
      cliente: o.cliente,
    }));
  } catch (err) {
    toast('No se pudo cargar la disponibilidad: ' + err.message, 'error');
  }
  renderOcupadas();
  renderCalendar();
}

function renderOcupadas() {
  const box = $('#reserva-ocupadas');
  if (!reserva.ocupadas.length) { box.style.display = 'none'; return; }
  const items = reserva.ocupadas
    .slice()
    .sort((a, b) => a.ini - b.ini)
    .map(r => `<li>🔒 ${fmtFecha(r.ini)} → ${fmtFecha(r.fin)}</li>`)
    .join('');
  box.innerHTML = `<strong>Fechas ya reservadas para este equipo:</strong><ul>${items}</ul>`;
  box.style.display = 'block';
}

function renderCalendar() {
  $('#cal-title').textContent = `${MESES[reserva.viewM]} ${reserva.viewY}`;

  const primero = new Date(reserva.viewY, reserva.viewM, 1);
  const diasEnMes = new Date(reserva.viewY, reserva.viewM + 1, 0).getDate();
  // getDay(): 0=Dom..6=Sáb. Queremos semana Lu..Do → offset con lunes=0.
  const offset = (primero.getDay() + 6) % 7;
  const hoy = hoyLocal();

  let html = '';
  for (let i = 0; i < offset; i++) html += '<span class="cal-day empty"></span>';

  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = new Date(reserva.viewY, reserva.viewM, d);
    const clases = ['cal-day'];
    let clickable = true;

    if (fecha < hoy) { clases.push('past'); clickable = false; }
    else if (estaOcupado(fecha)) { clases.push('ocup'); clickable = false; }

    if (reserva.inicio && reserva.fin && fecha >= reserva.inicio && fecha <= reserva.fin) clases.push('in-range');
    if (reserva.inicio && +fecha === +reserva.inicio) clases.push('sel');
    if (reserva.fin && +fecha === +reserva.fin) clases.push('sel');

    const attr = clickable ? `onclick="onDayClick('${ymd(fecha)}')"` : '';
    html += `<span class="${clases.join(' ')}" ${attr}>${d}</span>`;
  }
  $('#cal-days').innerHTML = html;

  // Deshabilitar "mes anterior" si ya estamos en el mes actual
  const prevBtn = $('#cal-prev');
  const enMesActual = (reserva.viewY === hoy.getFullYear() && reserva.viewM === hoy.getMonth());
  prevBtn.disabled = enMesActual;
}

function onDayClick(ymdStr) {
  const fecha = toLocalDate(ymdStr);

  if (!reserva.inicio || (reserva.inicio && reserva.fin)) {
    // Empezar nueva selección
    reserva.inicio = fecha;
    reserva.fin = null;
  } else if (fecha < reserva.inicio) {
    // Clic antes del inicio → reinicia el inicio
    reserva.inicio = fecha;
    reserva.fin = null;
  } else {
    // Cerrar el rango, validando que no pise días ocupados
    if (rangoPisaOcupado(reserva.inicio, fecha)) {
      toast('El rango elegido incluye días ya reservados. Elige otro término.', 'error');
      reserva.fin = null;
    } else {
      reserva.fin = fecha;
    }
  }
  renderCalendar();
  updateReservaSummary();
}

function updateReservaSummary() {
  const box = $('#reserva-summary');
  const btn = $('#btn-reserva-submit');

  if (reserva.inicio && reserva.fin) {
    const dias = diasInclusivos(reserva.inicio, reserva.fin);
    const total = reserva.precioDia * dias;
    box.innerHTML = `
      <div><strong>Del ${fmtFecha(reserva.inicio)} al ${fmtFecha(reserva.fin)}</strong></div>
      <div style="color:var(--silver);margin-top:.2rem">
        ${dias} ${dias === 1 ? 'día' : 'días'}${reserva.precioDia ? ` · ${formatPrice(reserva.precioDia)}/día` : ''}
        ${reserva.precioDia ? ` · Total estimado: <strong style="color:var(--gold)">${formatPrice(total)}</strong>` : ''}
      </div>`;
    btn.disabled = false;
  } else if (reserva.inicio) {
    box.innerHTML = `<div>Inicio: <strong>${fmtFecha(reserva.inicio)}</strong></div>
      <div style="color:var(--silver);margin-top:.2rem">Ahora elige la fecha de término.</div>`;
    btn.disabled = true;
  } else {
    box.textContent = 'Selecciona la fecha de inicio y término en el calendario.';
    btn.disabled = true;
  }
}

// Navegación de meses
(function initCalNav() {
  const prev = $('#cal-prev');
  const next = $('#cal-next');
  if (prev) prev.addEventListener('click', () => {
    if (prev.disabled) return;
    reserva.viewM--; if (reserva.viewM < 0) { reserva.viewM = 11; reserva.viewY--; }
    renderCalendar();
  });
  if (next) next.addEventListener('click', () => {
    reserva.viewM++; if (reserva.viewM > 11) { reserva.viewM = 0; reserva.viewY++; }
    renderCalendar();
  });
})();

const reservaFormEl = $('#reserva-form');
if (reservaFormEl) {
  reservaFormEl.addEventListener('submit', async e => {
    e.preventDefault();

    if (!reserva.inicio || !reserva.fin) {
      toast('Selecciona el rango de fechas en el calendario', 'error');
      return;
    }
    // Última validación en cliente (el backend igual valida)
    if (rangoPisaOcupado(reserva.inicio, reserva.fin)) {
      toast('Esas fechas ya no están disponibles', 'error');
      return;
    }

    const telefono = $('#reserva-telefono').value.trim();
    const notas = $('#reserva-notas').value.trim();
    const btn = $('#btn-reserva-submit');

    try {
      btn.textContent = 'RESERVANDO...';
      btn.disabled = true;

      await apiFetch('/reservas', {
        method: 'POST',
        body: JSON.stringify({
          maquinariaId: reserva.maquinariaId,
          fecha_inicio: ymd(reserva.inicio),
          fecha_fin: ymd(reserva.fin),
          telefono,
          notas,
        })
      });

      toast('Reserva creada exitosamente ✓ Queda pendiente de aprobación.', 'success');
      closeModal('modal-reserva');
    } catch (err) {
      toast('Error al reservar: ' + err.message, 'error');
      // Si el backend rechazó por choque de fechas, recargar disponibilidad
      if (err.status === 409) openReserva(reserva.maquinariaId, $('#reserva-nombre').textContent);
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