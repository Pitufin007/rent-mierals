// ══════════════════════════════════════════════════
// backend/controllers/reservaController.js
// Fase 3 — ReservaModel y MaquinariaModel ahora consultan SQL Server,
// así que todos los métodos pasaron a ser async/await.
// ══════════════════════════════════════════════════
const ReservaModel = require('../models/reservaModel');
const MaquinariaModel = require('../models/itemModel');

const ReservaController = {
  // GET /api/reservas
  // Admin ve todas las reservas. Usuario normal ve solo las suyas.
  async getAll(req, res) {
    try {
      const data = req.user.rol === 'admin'
        ? await ReservaModel.getAll()
        : await ReservaModel.getByUsuario(req.user.id);

      res.status(200).json({ success: true, total: data.length, data });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al obtener las reservas', error: error.message });
    }
  },

  // POST /api/reservas - Cualquier usuario autenticado puede reservar
  async create(req, res) {
    try {
      const { maquinariaId, fecha_inicio, fecha_fin, notas } = req.body;

      if (!maquinariaId || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({
          success: false,
          message: 'Debes indicar maquinariaId, fecha_inicio y fecha_fin'
        });
      }

      const maquina = await MaquinariaModel.getById(maquinariaId);
      if (!maquina) {
        return res.status(404).json({ success: false, message: `No se encontró maquinaria con ID ${maquinariaId}` });
      }

      if (new Date(fecha_fin) < new Date(fecha_inicio)) {
        return res.status(400).json({ success: false, message: 'La fecha de fin no puede ser anterior a la fecha de inicio' });
      }

      const nueva = await ReservaModel.create({
        usuarioId: req.user.id,
        usuarioNombre: req.user.nombre,
        maquinariaId: maquina.id,
        maquinariaNombre: maquina.nombre,
        fecha_inicio,
        fecha_fin,
        notas
      });

      res.status(201).json({ success: true, message: 'Reserva creada exitosamente', data: nueva });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al crear la reserva', error: error.message });
    }
  },

  // PUT /api/reservas/:id/estado - Solo admin (aprobar / rechazar / etc.)
  async updateEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado } = req.body;
      const validos = ['Pendiente', 'Aprobada', 'Rechazada', 'Cancelada'];

      if (!estado || !validos.includes(estado)) {
        return res.status(400).json({ success: false, message: `Estado inválido. Use uno de: ${validos.join(', ')}` });
      }

      const actualizada = await ReservaModel.updateEstado(id, estado);
      if (!actualizada) {
        return res.status(404).json({ success: false, message: `No se encontró la reserva con ID ${id}` });
      }

      res.status(200).json({ success: true, message: 'Estado de la reserva actualizado', data: actualizada });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al actualizar la reserva', error: error.message });
    }
  },

  // DELETE /api/reservas/:id - El propio usuario o el admin pueden cancelar/eliminar
  async delete(req, res) {
    try {
      const { id } = req.params;
      const reserva = await ReservaModel.getById(id);

      if (!reserva) {
        return res.status(404).json({ success: false, message: `No se encontró la reserva con ID ${id}` });
      }

      const esDueño = reserva.usuarioId === req.user.id;
      if (!esDueño && req.user.rol !== 'admin') {
        return res.status(403).json({ success: false, message: 'No tienes permiso para eliminar esta reserva' });
      }

      await ReservaModel.delete(id);
      res.status(200).json({ success: true, message: 'Reserva eliminada exitosamente', data: reserva });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al eliminar la reserva', error: error.message });
    }
  }
};

module.exports = ReservaController;