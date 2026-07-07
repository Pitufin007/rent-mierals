// ══════════════════════════════════════════════════════════════════
// backend/controllers/agendaController.js
// Vista de la agenda para el administrador: todas las reservas ya
// aprobadas (agendadas), con contacto del cliente, precio y notas.
// ══════════════════════════════════════════════════════════════════
const AgendaModel = require('../models/agendaModel');

const AgendaController = {
  // GET /api/agenda - solo admin
  async getAll(req, res) {
    try {
      const data = await AgendaModel.getAll();
      res.status(200).json({ success: true, total: data.length, data });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al obtener la agenda', error: error.message });
    }
  },
};

module.exports = AgendaController;
