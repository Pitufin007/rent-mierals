// ══════════════════════════════════════════════════
// backend/routes/authRoutes.js
// Agrega rutas Google OAuth
// ══════════════════════════════════════════════════
const express    = require('express');
const passport   = require('../config/passport');
const router     = express.Router();
const AuthController      = require('../controllers/authController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// ── Rutas locales (email + password) ──────────────
router.post('/register', AuthController.register);
router.post('/login',    AuthController.login);
router.post('/logout',   AuthController.logout);
router.get('/me',        AuthController.me);

// ── Rutas Google OAuth ────────────────────────────
// 1. Redirige al login de Google
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// 2. Google llama a esta URL con el código de autorización
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/views/login.html?error=google' }),
  (req, res) => {
    // Passport ya autenticó → guardamos userId en sesión (igual que login local)
    req.session.userId = req.user.id;
    res.redirect('/views/dashboard.html');
  }
);

// ── Rutas privadas ────────────────────────────────
router.put('/profile', requireAuth, AuthController.profile);

// ── Rutas solo admin ──────────────────────────────
router.get('/users',           requireAuth, requireAdmin, AuthController.getUsers);
router.put('/users/:id/rol',   requireAuth, requireAdmin, AuthController.updateRol);
router.delete('/users/:id',    requireAuth, requireAdmin, AuthController.deleteUser);

module.exports = router;
