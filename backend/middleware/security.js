// ══════════════════════════════════════════════════════════════════
// backend/middleware/security.js
// Cabeceras de seguridad (Helmet) + limitadores de tasa (rate limit).
// ══════════════════════════════════════════════════════════════════
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ── Cabeceras HTTP seguras ──────────────────────────────────────────
// Content-Security-Policy afinada a lo que el sitio realmente usa:
//   - Fuentes de Google (fonts.googleapis.com / fonts.gstatic.com)
//   - Imágenes de maquinaria alojadas en muchos dominios externos → https:
//   - 'unsafe-inline' en script/style: el frontend usa manejadores
//     inline (onclick=) y estilos inline. Si a futuro se refactoriza
//     todo eso a archivos .js/.css externos, se puede quitar
//     'unsafe-inline' y endurecer aún más.
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      // Helmet trae por defecto script-src-attr 'none', que BLOQUEA los
      // manejadores en línea (onclick, onchange, etc.). El frontend usa
      // muchos onclick, así que hay que permitirlos explícitamente.
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'https:', 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
  // HSTS solo tiene sentido bajo HTTPS (producción / Render).
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 15552000, includeSubDomains: true } // 180 días
    : false,
  crossOriginEmbedderPolicy: false, // permite cargar imágenes de terceros
});

// ── Rate limiting ───────────────────────────────────────────────────
// Limitador general para toda la API: frena abuso y escaneos.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,        // 15 minutos
  limit: 300,                      // 300 peticiones por IP por ventana
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas peticiones. Intenta de nuevo en unos minutos.' },
});

// Limitador estricto para autenticación: frena fuerza bruta a las
// contraseñas (login) y creación masiva de cuentas (register).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,        // 15 minutos
  limit: 10,                       // 10 intentos por IP por ventana
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,    // solo cuentan los intentos fallidos
  message: { success: false, message: 'Demasiados intentos de acceso. Espera unos minutos e intenta otra vez.' },
});

module.exports = { securityHeaders, generalLimiter, authLimiter };