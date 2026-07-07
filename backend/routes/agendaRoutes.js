// ══════════════════════════════════════════════════════════════════
// backend/routes/agendaRoutes.js
// ══════════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const AgendaController = require('../controllers/agendaController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.use(requireAuth);

// GET /api/agenda - lista completa de la agenda (solo admin)
router.get('/', requireAdmin, AgendaController.getAll);

module.exports = router;
