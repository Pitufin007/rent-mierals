// ══════════════════════════════════════════════════════════════════
// backend/controllers/telegramWebhookController.js
//
// Recibe los mensajes que el ADMINISTRADOR le escribe al bot de
// Telegram y los responde usando IA sobre los datos reales del sistema.
//
// Seguridad (tres capas):
//  1. Telegram firma cada petición con la cabecera
//     X-Telegram-Bot-Api-Secret-Token, que debe coincidir con
//     TELEGRAM_WEBHOOK_SECRET. Si no coincide, se descarta.
//  2. Solo se atienden los chats listados en TELEGRAM_CHAT_IDS
//     (los administradores). A cualquier otro se le responde que no
//     tiene acceso, y no se consulta la IA (no gasta cuota).
//  3. El contexto de administrador solo se arma después de pasar 1 y 2.
//
// Rendimiento: Telegram espera una respuesta HTTP rápida, y una consulta
// a la IA puede tardar varios segundos. Por eso respondemos 200 de
// inmediato y seguimos procesando en segundo plano, enviando la
// respuesta como un mensaje aparte.
// ══════════════════════════════════════════════════════════════════

const { preguntar, estaHabilitada } = require('../services/aiService');
const { contextoAdmin } = require('../services/aiContext');
const { promptAsistenteAdmin } = require('../services/aiPrompts');
const { enviarMensajeA, mostrarEscribiendo, esChatAutorizado } = require('../services/telegramNotifier');
const { generarResumen } = require('../services/reportesService');

const AYUDA = [
  '🤖 Asistente de Rent Minerals',
  '',
  'Escríbeme en lenguaje natural y te respondo con los datos reales del sistema.',
  '',
  'Ejemplos:',
  '• ¿Qué equipos están libres la próxima semana?',
  '• ¿Cuántas reservas pendientes tengo?',
  '• ¿Qué máquina lleva más tiempo sin arrendarse?',
  '• ¿Cuánto suman los arriendos confirmados de este mes?',
  '',
  'Comandos:',
  '/resumen — informe del negocio con análisis',
  '/ayuda — muestra este mensaje',
].join('\n');

// Procesa el mensaje en segundo plano (no bloquea la respuesta a Telegram).
async function procesarMensaje(chatId, texto) {
  try {
    const limpio = texto.trim();

    // ── Comandos ──
    if (/^\/(start|ayuda|help)/i.test(limpio)) {
      await enviarMensajeA(chatId, AYUDA);
      return;
    }

    if (/^\/resumen/i.test(limpio)) {
      await mostrarEscribiendo(chatId);
      const resumen = await generarResumen('a pedido');
      await enviarMensajeA(chatId, resumen || 'No pude generar el resumen en este momento.');
      return;
    }

    // ── Consulta libre a la IA ──
    if (!estaHabilitada()) {
      await enviarMensajeA(chatId, 'El asistente de IA no está configurado (falta IA_API_KEY).');
      return;
    }

    await mostrarEscribiendo(chatId);

    const contexto = await contextoAdmin();
    const respuesta = await preguntar(
      promptAsistenteAdmin(contexto),
      [{ rol: 'usuario', texto: limpio }],
      { temperatura: 0.2, maxTokens: 2048 }
    );

    await enviarMensajeA(
      chatId,
      respuesta || 'No pude procesar tu consulta en este momento. Inténtalo de nuevo en unos segundos.'
    );
  } catch (err) {
    console.error('✖  Asistente Telegram:', err.message);
    await enviarMensajeA(chatId, 'Ocurrió un error al procesar tu consulta.').catch(() => {});
  }
}

const TelegramWebhookController = {
  // POST /api/telegram/webhook
  async recibir(req, res) {
    // 1. Verificar que la petición venga realmente de Telegram.
    const secreto = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secreto) {
      const recibido = req.get('X-Telegram-Bot-Api-Secret-Token');
      if (recibido !== secreto) {
        console.warn('✖  Webhook de Telegram: secreto inválido, petición descartada.');
        return res.sendStatus(401);
      }
    }

    // 2. Responder de inmediato para que Telegram no reintente.
    res.sendStatus(200);

    try {
      const mensaje = req.body?.message || req.body?.edited_message;
      const chatId = mensaje?.chat?.id;
      const texto = mensaje?.text;

      if (!chatId || !texto) return;   // ignoramos fotos, stickers, etc.

      // 3. Solo administradores.
      if (!esChatAutorizado(chatId)) {
        console.warn(`✖  Webhook: chat no autorizado (${chatId}).`);
        await enviarMensajeA(chatId, 'No tienes acceso a este asistente.').catch(() => {});
        return;
      }

      console.log(`→ Asistente Telegram: consulta del admin ${chatId}: "${texto.slice(0, 80)}"`);
      // Fire-and-forget: ya respondimos 200 a Telegram.
      procesarMensaje(chatId, texto).catch(err =>
        console.error('✖  Asistente Telegram:', err.message)
      );
    } catch (err) {
      console.error('✖  Webhook de Telegram:', err.message);
    }
  },
};

module.exports = TelegramWebhookController;
