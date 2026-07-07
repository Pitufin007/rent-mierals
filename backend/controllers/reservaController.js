// ══════════════════════════════════════════════════════════════════
// backend/controllers/reservaController.js
//
// Refactor del área de reservas:
//  - Al CREAR una reserva se valida que las fechas no choquen con lo que
//    ya está agendado (aprobado) para esa máquina.
//  - Al APROBAR, la reserva se "agenda": se inserta en la tabla `agenda`,
//    lo que bloquea esos días para el resto de los usuarios.
//  - Al RECHAZAR / CANCELAR / volver a Pendiente / ELIMINAR, se libera
//    la agenda (se borra la entrada correspondiente).
//  - Nuevo endpoint de disponibilidad: entrega los rangos ocupados de una
//    máquina para que el frontend pinte el calendario y avise al usuario.
// ══════════════════════════════════════════════════════════════════
const ReservaModel = require('../models/reservaModel');
const MaquinariaModel = require('../models/itemModel');
const AgendaModel = require('../models/agendaModel');
const UserModel = require('../models/userModel');

// Días (inclusivos) entre dos fechas YYYY-MM-DD. 10→15 = 6 días.
function diasEntre(inicio, fin) {
  const ms = new Date(fin) - new Date(inicio);
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

// Formatea una fecha (Date o string) a YYYY-MM-DD para mensajes.
function fechaCorta(f) {
  const d = new Date(f);
  return Number.isNaN(d.getTime()) ? String(f) : d.toISOString().split('T')[0];
}

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

  // GET /api/reservas/disponibilidad/:maquinariaId
  // Devuelve los rangos ya ocupados (agendados) de una máquina.
  // Lo usa el frontend para bloquear días en el calendario de reserva.
  async getDisponibilidad(req, res) {
    try {
      const { maquinariaId } = req.params;
      const maquina = await MaquinariaModel.getById(maquinariaId);
      if (!maquina) {
        return res.status(404).json({ success: false, message: `No se encontró maquinaria con ID ${maquinariaId}` });
      }
      const ocupadas = await AgendaModel.getByMaquinaria(maquinariaId);
      res.status(200).json({
        success: true,
        maquinariaId: maquina.id,
        maquinariaNombre: maquina.nombre,
        precioDia: maquina.precio_arriendo_dia,
        ocupadas,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al obtener la disponibilidad', error: error.message });
    }
  },

  // POST /api/reservas - Cualquier usuario autenticado puede reservar
  async create(req, res) {
    try {
      const { maquinariaId, fecha_inicio, fecha_fin, notas, telefono } = req.body;

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

      // ── Bloqueo por fechas: no permitir pisar días ya agendados ──
      const conflicto = await AgendaModel.hayConflicto(maquina.id, fecha_inicio, fecha_fin);
      if (conflicto) {
        return res.status(409).json({
          success: false,
          message: `Esas fechas no están disponibles: el equipo ya está reservado del ${fechaCorta(conflicto.fecha_inicio)} al ${fechaCorta(conflicto.fecha_fin)}. Elige otro rango de fechas.`
        });
      }

      const nueva = await ReservaModel.create({
        usuarioId: req.user.id,
        usuarioNombre: req.user.nombre,
        maquinariaId: maquina.id,
        maquinariaNombre: maquina.nombre,
        fecha_inicio,
        fecha_fin,
        notas,
        telefono,
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

      const reserva = await ReservaModel.getById(id);
      if (!reserva) {
        return res.status(404).json({ success: false, message: `No se encontró la reserva con ID ${id}` });
      }

      // ── APROBAR → agendar (bloquea los días) ──
      if (estado === 'Aprobada') {
        // Re-chequear conflicto por si otra reserva aprobada ya tomó esos días.
        const conflicto = await AgendaModel.hayConflicto(
          reserva.maquinariaId, reserva.fecha_inicio, reserva.fecha_fin, reserva.id
        );
        if (conflicto) {
          return res.status(409).json({
            success: false,
            message: `No se puede aprobar: el equipo ya está agendado del ${fechaCorta(conflicto.fecha_inicio)} al ${fechaCorta(conflicto.fecha_fin)} para ${conflicto.cliente}.`
          });
        }

        const actualizada = await ReservaModel.updateEstado(id, 'Aprobada');

        // Insertar en la agenda si aún no está (evita duplicados si se re-aprueba).
        if (!(await AgendaModel.existsByReserva(reserva.id))) {
          const maquina = await MaquinariaModel.getById(reserva.maquinariaId);
          const precioDia = maquina ? Number(maquina.precio_arriendo_dia) || 0 : 0;
          const dias = diasEntre(reserva.fecha_inicio, reserva.fecha_fin);
          const usuario = await UserModel.getById(reserva.usuarioId);

          await AgendaModel.create({
            reservaId: reserva.id,
            maquinariaId: reserva.maquinariaId,
            maquinariaNombre: reserva.maquinariaNombre,
            usuarioId: reserva.usuarioId,
            clienteNombre: reserva.usuarioNombre,
            clienteEmail: usuario ? usuario.email : null,
            clienteTelefono: reserva.telefono || null,
            fecha_inicio: reserva.fecha_inicio,
            fecha_fin: reserva.fecha_fin,
            precioDia,
            precioTotal: precioDia * dias,
            notas: reserva.notas || '',
          });
        }

        return res.status(200).json({ success: true, message: 'Reserva aprobada y agendada', data: actualizada });
      }

      // ── RECHAZAR / CANCELAR / volver a PENDIENTE → liberar la agenda ──
      const actualizada = await ReservaModel.updateEstado(id, estado);
      await AgendaModel.deleteByReserva(id);

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

      await AgendaModel.deleteByReserva(id); // liberar agenda (por si estaba agendada)
      await ReservaModel.delete(id);
      res.status(200).json({ success: true, message: 'Reserva eliminada exitosamente', data: reserva });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al eliminar la reserva', error: error.message });
    }
  }
};

module.exports = ReservaController;
