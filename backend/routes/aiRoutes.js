// ══════════════════════════════════════════════════════════════════
// backend/routes/aiRoutes.js
// ══════════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const AiController = require('../controllers/aiController');
const { iaLimiter } = require('../middleware/security');

// GET /api/ia/estado - ¿está disponible el asistente?
router.get('/estado', AiController.estado);

// POST /api/ia/chat - chat público de atención.
// Lleva su propio limitador (más estricto que el general) porque cada
// consulta gasta cuota del proveedor de IA.
router.post('/chat', iaLimiter, AiController.chat);

module.exports = router;
