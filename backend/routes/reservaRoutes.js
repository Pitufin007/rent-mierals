// ══════════════════════════════════════════════════
// backend/routes/reservaRoutes.js
// ══════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const ReservaController = require('../controllers/reservaController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const {
  reservaValidator, estadoReservaValidator, idParamValidator, maquinariaIdParamValidator,
} = require('../middleware/validators');

// Todas las rutas de reservas requieren estar autenticado
router.use(requireAuth);

// GET /api/reservas - admin ve todas, usuario ve las propias
router.get('/', ReservaController.getAll);

// GET /api/reservas/disponibilidad/:maquinariaId - rangos ocupados de una máquina
// (cualquier usuario logueado; lo usa el calendario del modal de reserva)
router.get('/disponibilidad/:maquinariaId', maquinariaIdParamValidator, ReservaController.getDisponibilidad);

// POST /api/reservas - crear una reserva (cualquier usuario logueado)
router.post('/', reservaValidator, ReservaController.create);

// PUT /api/reservas/:id/estado - solo admin puede aprobar/rechazar
router.put('/:id/estado', requireAdmin, estadoReservaValidator, ReservaController.updateEstado);

// DELETE /api/reservas/:id - dueño de la reserva o admin
router.delete('/:id', idParamValidator, ReservaController.delete);

module.exports = router;
