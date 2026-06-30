// ══════════════════════════════════════════════════
// backend/app.js  — agrega Passport para Google OAuth
// ══════════════════════════════════════════════════
const express  = require('express');
const path     = require('path');
const session  = require('express-session');
const passport = require('./config/passport');           // ← NUEVO
const { notFound, errorHandler, validateContentType } = require('./middleware/errorMiddleware');
const maquinariaRoutes = require('./routes/itemRoutes');
const authRoutes       = require('./routes/authRoutes');
const reservaRoutes    = require('./routes/reservaRoutes');   // ← NUEVO
const UserModel        = require('./models/userModel');

const app = express();

// ─── Middlewares globales ──────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sesiones (debe ir ANTES de passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'rentmierals_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8, // 8 horas
  },
}));

// Passport                                             ← NUEVO
app.use(passport.initialize());
app.use(passport.session());

// Archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend/public')));
app.use('/views', express.static(path.join(__dirname, '../frontend/views')));

// CORS básico
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Rutas API ─────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/maquinaria', validateContentType, maquinariaRoutes);
app.use('/api/reservas',   validateContentType, reservaRoutes);

// Ruta raíz — ahora sirve la landing institucional
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/views/home.html'));
});

// Catálogo — antes vivía en la raíz, ahora tiene su propia ruta
app.get('/catalogo', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/views/index.html'));
});

// ─── Manejo de errores ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// Inicializar usuarios por defecto
UserModel.init().then(() => {
  console.log('✔  Usuarios por defecto cargados');
});

module.exports = app;