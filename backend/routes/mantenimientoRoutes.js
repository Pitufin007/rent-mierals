// ══════════════════════════════════════════════════════════════════
// backend/routes/mantenimientoRoutes.js
// ══════════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const MantenimientoController = require('../controllers/mantenimientoController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { mantenimientoValidator, idParamValidator } = require('../middleware/validators');

router.use(requireAuth);

// GET /api/mantenimiento - lista (cualquier usuario logueado puede leer;
// el calendario la usa vía /disponibilidad, pero dejamos el listado para el admin)
router.get('/', requireAdmin, MantenimientoController.getAll);

// POST /api/mantenimiento - registrar (solo admin)
router.post('/', requireAdmin, mantenimientoValidator, MantenimientoController.create);

// DELETE /api/mantenimiento/:id - eliminar (solo admin)
router.delete('/:id', requireAdmin, idParamValidator, MantenimientoController.delete);

module.exports = router;
