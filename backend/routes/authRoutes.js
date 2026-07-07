// ══════════════════════════════════════════════════
// backend/routes/authRoutes.js
// Agrega rutas Google OAuth
// ══════════════════════════════════════════════════
const express    = require('express');
const passport   = require('../config/passport');
const router     = express.Router();
const AuthController      = require('../controllers/authController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/security');
const {
  registerValidator, loginValidator, profileValidator, rolValidator, idParamValidator,
} = require('../middleware/validators');

// ── Rutas locales (email + password) ──────────────
// authLimiter frena fuerza bruta; los validadores rechazan entradas inválidas.
router.post('/register', authLimiter, registerValidator, AuthController.register);
router.post('/login',    authLimiter, loginValidator,    AuthController.login);
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
    // Passport ya autenticó → regeneramos la sesión y guardamos userId
    // (mismo endurecimiento contra session fixation que en el login local).
    req.session.regenerate(() => {
      req.session.userId = req.user.id;
      res.redirect('/views/dashboard.html');
    });
  }
);

// ── Rutas privadas ────────────────────────────────
router.put('/profile', requireAuth, profileValidator, AuthController.profile);

// ── Rutas solo admin ──────────────────────────────
router.get('/users',           requireAuth, requireAdmin, AuthController.getUsers);
router.put('/users/:id/rol',   requireAuth, requireAdmin, rolValidator, AuthController.updateRol);
router.delete('/users/:id',    requireAuth, requireAdmin, idParamValidator, AuthController.deleteUser);

module.exports = router;
