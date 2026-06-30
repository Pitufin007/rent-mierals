// ══════════════════════════════════════════════════
// backend/config/passport.js
// Configuración de Passport con estrategia Google
//
// Fase 3 — getByEmail y getById ahora son async (consultan SQL
// Server), así que la estrategia y deserializeUser usan await /
// reciben un callback async respectivamente.
// ══════════════════════════════════════════════════
require('dotenv').config();
const passport      = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const UserModel     = require('../models/userModel');

passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email  = profile.emails[0].value;
      const nombre = profile.displayName;

      // Buscar si el usuario ya existe
      let user = await UserModel.getByEmail(email);

      if (!user) {
        // Crear usuario nuevo sin contraseña (login solo Google)
        user = await UserModel.createFromGoogle({ nombre, email });
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

// Guardar solo el id en la sesión
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await UserModel.getById(id);
    done(null, user || false);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;