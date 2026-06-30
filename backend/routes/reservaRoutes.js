// ══════════════════════════════════════════════════
// backend/routes/reservaRoutes.js
// ══════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const ReservaController = require('../controllers/reservaController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// Todas las rutas de reservas requieren estar autenticado
router.use(requireAuth);

// GET /api/reservas - admin ve todas, usuario ve las propias
router.get('/', ReservaController.getAll);

// POST /api/reservas - crear una reserva (cualquier usuario logueado)
router.post('/', ReservaController.create);

// PUT /api/reservas/:id/estado - solo admin puede aprobar/rechazar
router.put('/:id/estado', requireAdmin, ReservaController.updateEstado);

// DELETE /api/reservas/:id - dueño de la reserva o admin
router.delete('/:id', ReservaController.delete);

module.exports = router;
