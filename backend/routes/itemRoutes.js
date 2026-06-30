const express = require('express');
const router = express.Router();
const MaquinariaController = require('../controllers/itemController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// ── Rutas públicas / de solo lectura (cualquiera puede ver) ──────────
// GET /api/maquinaria/categorias - Debe ir ANTES de /:id para evitar conflicto
router.get('/categorias', MaquinariaController.getCategorias);

// GET /api/maquinaria - Obtener toda la maquinaria (con filtros opcionales por query)
router.get('/', MaquinariaController.getAll);

// GET /api/maquinaria/:id - Obtener por ID
router.get('/:id', MaquinariaController.getById);

// ── Rutas restringidas a ADMINISTRADOR (crear / editar / eliminar) ───
// POST /api/maquinaria - Crear nueva maquinaria
router.post('/', requireAuth, requireAdmin, MaquinariaController.create);

// PUT /api/maquinaria/:id - Actualizar maquinaria
router.put('/:id', requireAuth, requireAdmin, MaquinariaController.update);

// DELETE /api/maquinaria/:id - Eliminar maquinaria
router.delete('/:id', requireAuth, requireAdmin, MaquinariaController.delete);

module.exports = router;
