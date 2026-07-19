// ══════════════════════════════════════════════════════════════════
// backend/controllers/aiController.js
//
// Endpoints de IA orientados al sitio web.
// ══════════════════════════════════════════════════════════════════
const { preguntar, estaHabilitada } = require('../services/aiService');
const { contextoPublico } = require('../services/aiContext');
const { promptChatPublico } = require('../services/aiPrompts');

const MAX_LARGO_MENSAJE = 500;
const MAX_TURNOS_HISTORIAL = 8;   // 4 idas y vueltas: suficiente contexto, poco gasto

const AiController = {
  // GET /api/ia/estado
  // Le permite al frontend saber si debe mostrar el chat o esconderlo.
  estado(req, res) {
    res.status(200).json({ success: true, habilitada: estaHabilitada() });
  },

  // POST /api/ia/chat   { mensaje, historial: [{rol, texto}] }
  // Público: lo usa cualquier visitante del sitio.
  async chat(req, res) {
    try {
      if (!estaHabilitada()) {
        return res.status(503).json({
          success: false,
          message: 'El asistente no está disponible en este momento.',
        });
      }

      const mensaje = String(req.body?.mensaje || '').trim();
      if (!mensaje) {
        return res.status(400).json({ success: false, message: 'Escribe una consulta.' });
      }
      if (mensaje.length > MAX_LARGO_MENSAJE) {
        return res.status(400).json({
          success: false,
          message: `Tu consulta es muy larga (máximo ${MAX_LARGO_MENSAJE} caracteres).`,
        });
      }

      // El historial llega del navegador, así que se sanea: solo los
      // últimos turnos, con roles válidos y texto acotado.
      const historialCrudo = Array.isArray(req.body?.historial) ? req.body.historial : [];
      const historial = historialCrudo
        .slice(-MAX_TURNOS_HISTORIAL)
        .filter(m => m && typeof m.texto === 'string' && m.texto.trim())
        .map(m => ({
          rol: m.rol === 'asistente' ? 'asistente' : 'usuario',
          texto: String(m.texto).slice(0, MAX_LARGO_MENSAJE),
        }));

      const contexto = await contextoPublico();
      const instruccion = promptChatPublico(contexto);

      const respuesta = await preguntar(
        instruccion,
        [...historial, { rol: 'usuario', texto: mensaje }],
        { temperatura: 0.4, maxTokens: 2048 }
      );

      if (!respuesta) {
        return res.status(502).json({
          success: false,
          message: 'No pude procesar tu consulta en este momento. Intenta de nuevo en unos segundos.',
        });
      }

      res.status(200).json({ success: true, respuesta });
    } catch (error) {
      console.error('✖  Chat IA:', error.message);
      res.status(500).json({ success: false, message: 'Error al procesar la consulta.' });
    }
  },
};

module.exports = AiController;
