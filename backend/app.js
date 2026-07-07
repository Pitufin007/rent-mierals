// ══════════════════════════════════════════════════
// backend/app.js  — agrega Passport para Google OAuth
// ══════════════════════════════════════════════════
const express  = require('express');
const path     = require('path');
const session  = require('express-session');
const passport = require('./config/passport');           // ← NUEVO
const { notFound, errorHandler, validateContentType } = require('./middleware/errorMiddleware');
const { securityHeaders, generalLimiter } = require('./middleware/security'); // ← NUEVO (seguridad)
const maquinariaRoutes = require('./routes/itemRoutes');
const authRoutes       = require('./routes/authRoutes');
const reservaRoutes    = require('./routes/reservaRoutes');   // ← NUEVO
const agendaRoutes     = require('./routes/agendaRoutes');    // ← NUEVO (agenda de equipos)
const UserModel        = require('./models/userModel');

const app = express();

// Render (y cualquier proxy/HTTPS) termina TLS antes de Express. Necesario
// para que las cookies "secure" y el rate-limit por IP funcionen bien.
app.set('trust proxy', 1);

// En producción exigimos un SESSION_SECRET real (no arrancar con el de ejemplo).
const SESSION_SECRET = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === 'production' && (!SESSION_SECRET || SESSION_SECRET.length < 16)) {
  throw new Error('SESSION_SECRET no está definido o es demasiado corto. Configúralo en las variables de entorno.');
}

// ─── Middlewares globales ──────────────────────────────────────────────────
// Cabeceras de seguridad HTTP (Helmet) — lo primero de todo.
app.use(securityHeaders);

// Cuerpo JSON con límite de tamaño (evita payloads gigantes).
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Sesiones (debe ir ANTES de passport)
app.use(session({
  name: 'rm.sid',                                   // nombre propio (no el 'connect.sid' por defecto)
  secret: SESSION_SECRET || 'dev_only_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,                                 // no accesible desde JS del navegador
    secure: process.env.NODE_ENV === 'production',  // solo por HTTPS en producción
    sameSite: 'lax',                                // mitiga CSRF, compatible con el login de Google
    maxAge: 1000 * 60 * 60 * 8,                     // 8 horas
  },
}));

// Passport                                             ← NUEVO
app.use(passport.initialize());
app.use(passport.session());

// Archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend/public')));
app.use('/views', express.static(path.join(__dirname, '../frontend/views')));

// CORS acotado — el frontend se sirve desde el MISMO origen que la API,
// así que por defecto no hace falta abrir CORS a nadie. Si en el futuro
// necesitas consumir la API desde otro dominio, lístalo (separado por
// comas) en la variable de entorno CORS_ORIGINS.
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Rate limiting general para toda la API.
app.use('/api', generalLimiter);

// ─── Rutas API ─────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/maquinaria', validateContentType, maquinariaRoutes);
app.use('/api/reservas',   validateContentType, reservaRoutes);
app.use('/api/agenda',     agendaRoutes);

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