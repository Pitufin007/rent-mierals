// ══════════════════════════════════════════════════
// authMiddleware.js — Protección de rutas
//
// Fase 3 — UserModel.getById ahora es async (consulta SQL Server),
// así que requireAuth pasó a ser un middleware async.
// ══════════════════════════════════════════════════
const UserModel = require('../models/userModel');

async function requireAuth(req, res, next) {
  if (!req.session.userId)
    return res.status(401).json({ success: false, message: 'Debes iniciar sesión' });

  const user = await UserModel.getById(req.session.userId);
  if (!user)
    return res.status(401).json({ success: false, message: 'Sesión inválida' });

  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.rol !== 'admin')
    return res.status(403).json({ success: false, message: 'Acceso solo para administradores' });
  next();
}

module.exports = { requireAuth, requireAdmin };




