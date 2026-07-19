// ══════════════════════════════════════════════════════════════════
// backend/services/aiContext.js
//
// Arma el "contexto" que se le entrega al modelo de IA: una foto
// compacta y actualizada de los datos del sistema.
//
// ¿Por qué así y no dejando que la IA escriba consultas SQL?
// Porque a esta escala (decenas de equipos) el catálogo completo cabe
// sin problema en el prompt, y evitamos por completo el riesgo de que
// un modelo genere SQL peligroso contra la base de datos. Es más
// simple, más rápido y mucho más seguro.
//
// PRIVACIDAD: hay DOS contextos distintos, a propósito.
//   - contextoPublico(): lo que ve el chat de la web. NO incluye
//     nombres, correos ni teléfonos de clientes. Solo catálogo y qué
//     días están ocupados.
//   - contextoAdmin(): lo que ve el asistente del administrador por
//     Telegram. Sí incluye datos de reservas y clientes.
// ══════════════════════════════════════════════════════════════════

const MaquinariaModel = require('../models/itemModel');
const ReservaModel = require('../models/reservaModel');
const AgendaModel = require('../models/agendaModel');
const MantenimientoModel = require('../models/mantenimientoModel');

const ymd = v => String(v).slice(0, 10);

function hoyYMD() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

// Agrupa rangos ocupados por máquina: { [maquinariaId]: ['2026-08-10→2026-08-12', ...] }
function agruparPorMaquina(filas) {
  const mapa = {};
  for (const f of filas) {
    const id = f.maquinariaId;
    if (!mapa[id]) mapa[id] = [];
    mapa[id].push(`${ymd(f.fecha_inicio)}→${ymd(f.fecha_fin)}`);
  }
  return mapa;
}

/**
 * Contexto PÚBLICO — para el chat de atención de la web.
 * Sin datos personales de ningún cliente.
 */
async function contextoPublico() {
  const [maquinas, agenda, mantenciones] = await Promise.all([
    MaquinariaModel.getAll({}),
    AgendaModel.getAll(),
    MantenimientoModel.getAll(),
  ]);

  const ocupadasPorMaquina = agruparPorMaquina(agenda);
  const mantencionPorMaquina = agruparPorMaquina(mantenciones);

  const catalogo = maquinas.map(m => ({
    id: m.id,
    nombre: m.nombre,
    categoria: m.categoria,
    marca: m.marca,
    modelo: m.modelo,
    anio: m.año,
    potencia: m.potencia,
    capacidad: m.capacidad,
    precio_por_dia_CLP: m.precio_arriendo_dia,
    descripcion: m.descripcion,
    dias_ya_reservados: ocupadasPorMaquina[m.id] || [],
    dias_en_mantencion: mantencionPorMaquina[m.id] || [],
  }));

  return {
    fecha_de_hoy: hoyYMD(),
    total_equipos: catalogo.length,
    catalogo,
  };
}

/**
 * Contexto ADMINISTRADOR — para el asistente por Telegram.
 * Incluye reservas y clientes.
 */
async function contextoAdmin() {
  const [maquinas, reservas, agenda, mantenciones] = await Promise.all([
    MaquinariaModel.getAll({}),
    ReservaModel.getAll(),
    AgendaModel.getAll(),
    MantenimientoModel.getAll(),
  ]);

  const hoy = hoyYMD();

  return {
    fecha_de_hoy: hoy,
    resumen: {
      total_equipos: maquinas.length,
      reservas_pendientes: reservas.filter(r => r.estado === 'Pendiente').length,
      reservas_aprobadas: reservas.filter(r => r.estado === 'Aprobada').length,
      arriendos_vigentes: agenda.filter(a => ymd(a.fecha_inicio) <= hoy && ymd(a.fecha_fin) >= hoy).length,
    },
    catalogo: maquinas.map(m => ({
      id: m.id,
      nombre: m.nombre,
      categoria: m.categoria,
      marca: m.marca,
      modelo: m.modelo,
      precio_por_dia_CLP: m.precio_arriendo_dia,
    })),
    reservas: reservas.map(r => ({
      id: r.id,
      equipo: r.maquinariaNombre,
      cliente: r.usuarioNombre,
      desde: ymd(r.fecha_inicio),
      hasta: ymd(r.fecha_fin),
      estado: r.estado,
      telefono: r.telefono || null,
      notas: r.notas || null,
    })),
    agenda_confirmada: agenda.map(a => ({
      equipo: a.maquinariaNombre,
      cliente: a.clienteNombre,
      desde: ymd(a.fecha_inicio),
      hasta: ymd(a.fecha_fin),
      total_CLP: a.precioTotal,
    })),
    mantenciones: mantenciones.map(m => ({
      equipo: m.maquinariaNombre,
      desde: ymd(m.fecha_inicio),
      hasta: ymd(m.fecha_fin),
      motivo: m.motivo || null,
    })),
  };
}

module.exports = { contextoPublico, contextoAdmin, hoyYMD, ymd };
