// ══════════════════════════════════════════════════════════════════
// backend/services/reportesService.js
//
// Genera el informe del negocio con análisis de IA.
//
// Degradación elegante: si la IA no está disponible o falla, igual se
// entrega un resumen con las cifras clave calculadas por código. El
// administrador siempre recibe información útil, aunque sin el análisis.
// ══════════════════════════════════════════════════════════════════

const { preguntar, estaHabilitada } = require('./aiService');
const { contextoAdmin, ymd, hoyYMD } = require('./aiContext');
const { promptResumen } = require('./aiPrompts');

const CLP = n => '$' + Number(n || 0).toLocaleString('es-CL');

// Resumen determinista (sin IA): solo las cifras.
function resumenBasico(ctx) {
  const hoy = ctx.fecha_de_hoy;

  // Arriendos que empiezan dentro de los próximos 7 días.
  const en7dias = new Date(hoy);
  en7dias.setDate(en7dias.getDate() + 7);
  const limite = ymd(en7dias.toISOString());

  const proximos = ctx.agenda_confirmada.filter(a => a.desde >= hoy && a.desde <= limite);
  const vigentes = ctx.agenda_confirmada.filter(a => a.desde <= hoy && a.hasta >= hoy);
  const facturacionConfirmada = ctx.agenda_confirmada.reduce((s, a) => s + Number(a.total_CLP || 0), 0);

  return [
    '📊 RESUMEN DEL NEGOCIO',
    '',
    'NÚMEROS',
    `- Equipos en catálogo: ${ctx.resumen.total_equipos}`,
    `- Solicitudes pendientes: ${ctx.resumen.reservas_pendientes}`,
    `- Arriendos vigentes hoy: ${vigentes.length}`,
    `- Arriendos que comienzan en 7 días: ${proximos.length}`,
    `- Equipos en mantención: ${ctx.mantenciones.length}`,
    `- Total confirmado en agenda: ${CLP(facturacionConfirmada)}`,
    '',
    '(Análisis con IA no disponible en este momento.)',
  ].join('\n');
}

/**
 * Genera el informe del negocio.
 * @param {string} periodo  Texto descriptivo ('semanal', 'mensual', 'a pedido').
 * @returns {Promise<string|null>} El informe listo para enviar.
 */
async function generarResumen(periodo = 'semanal') {
  try {
    const ctx = await contextoAdmin();

    if (!estaHabilitada()) {
      return resumenBasico(ctx);
    }

    const texto = await preguntar(
      promptResumen(ctx, periodo),
      [{ rol: 'usuario', texto: `Redacta el informe ${periodo} del negocio con los datos entregados.` }],
      { temperatura: 0.4, maxTokens: 2048 }
    );

    // Si la IA falló, no dejamos al admin sin nada.
    return texto ? `📊 INFORME ${periodo.toUpperCase()}\n\n${texto}` : resumenBasico(ctx);
  } catch (err) {
    console.error('✖  Resumen del negocio:', err.message);
    return null;
  }
}

module.exports = { generarResumen, hoyYMD };
