// ══════════════════════════════════════════════════════════════════
// backend/controllers/mantenimientoController.js
// ══════════════════════════════════════════════════════════════════
const MantenimientoModel = require('../models/mantenimientoModel');
const MaquinariaModel = require('../models/itemModel');
const AgendaModel = require('../models/agendaModel');

function fechaCorta(f) {
  const d = new Date(f);
  return Number.isNaN(d.getTime()) ? String(f) : d.toISOString().split('T')[0];
}

const MantenimientoController = {
  // GET /api/mantenimiento - lista completa (admin)
  async getAll(req, res) {
    try {
      const data = await MantenimientoModel.getAll();
      res.status(200).json({ success: true, total: data.length, data });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al obtener las mantenciones', error: error.message });
    }
  },

  // POST /api/mantenimiento - registrar un rango de mantención (admin)
  async create(req, res) {
    try {
      const { maquinariaId, fecha_inicio, fecha_fin, motivo } = req.body;

      const maquina = await MaquinariaModel.getById(maquinariaId);
      if (!maquina) {
        return res.status(404).json({ success: false, message: `No se encontró maquinaria con ID ${maquinariaId}` });
      }
      if (new Date(fecha_fin) < new Date(fecha_inicio)) {
        return res.status(400).json({ success: false, message: 'La fecha de fin no puede ser anterior a la de inicio' });
      }

      // No pisar otra mantención existente.
      const chocaMant = await MantenimientoModel.hayConflicto(maquina.id, fecha_inicio, fecha_fin);
      if (chocaMant) {
        return res.status(409).json({
          success: false,
          message: `Ya hay una mantención registrada del ${fechaCorta(chocaMant.fecha_inicio)} al ${fechaCorta(chocaMant.fecha_fin)} para este equipo.`
        });
      }

      // No pisar una reserva ya aprobada (agendada).
      const chocaReserva = await AgendaModel.hayConflicto(maquina.id, fecha_inicio, fecha_fin);
      if (chocaReserva) {
        return res.status(409).json({
          success: false,
          message: `No se puede: el equipo ya está reservado del ${fechaCorta(chocaReserva.fecha_inicio)} al ${fechaCorta(chocaReserva.fecha_fin)} en esas fechas.`
        });
      }

      const nueva = await MantenimientoModel.create({
        maquinariaId: maquina.id,
        maquinariaNombre: maquina.nombre,
        fecha_inicio,
        fecha_fin,
        motivo,
      });
      res.status(201).json({ success: true, message: 'Mantención registrada', data: nueva });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al registrar la mantención', error: error.message });
    }
  },

  // DELETE /api/mantenimiento/:id (admin)
  async delete(req, res) {
    try {
      const { id } = req.params;
      const borradas = await MantenimientoModel.delete(id);
      if (!borradas) {
        return res.status(404).json({ success: false, message: `No se encontró la mantención con ID ${id}` });
      }
      res.status(200).json({ success: true, message: 'Mantención eliminada' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al eliminar la mantención', error: error.message });
    }
  },
};

module.exports = MantenimientoController;
