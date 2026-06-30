// ══════════════════════════════════════════════════
// backend/models/userModel.js
// Fase 3 — Migrado de arrays en memoria a SQL Server.
//
// La interfaz pública (nombres de métodos y forma de los objetos
// que devuelve) se mantiene IDÉNTICA a la versión en memoria, para
// que controllers/authController.js, config/passport.js y
// middleware/authMiddleware.js no necesiten cambios de lógica —
// solo se les agregó 'await' donde antes llamaban a un método
// síncrono que ahora es async (ver nota al final del archivo).
// ══════════════════════════════════════════════════

const bcrypt = require('bcrypt');
const { getPool, sql } = require('../config/db');

const SALT_ROUNDS = 10;

/**
 * Quita el campo password antes de devolver el usuario a las capas
 * superiores — igual que hacía safe() en la versión en memoria.
 */
function safe(row) {
  if (!row) return null;
  const { password, ...rest } = row;
  return rest;
}

const UserModel = {
  // El seed (admin + usuario demo) ya se carga una sola vez desde
  // database/schema.sql. init() se mantiene como no-op para no tener
  // que tocar app.js, que todavía la llama al arrancar el servidor.
  async init() {
    return Promise.resolve();
  },

  async getAll() {
    const pool = await getPool();
    const result = await pool.request().query(
      'SELECT id, nombre, email, rol, creado_en FROM usuarios ORDER BY id'
    );
    return result.recordset;
  },

  async getById(id) {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) return null;

    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, numId)
      .query('SELECT id, nombre, email, rol, creado_en FROM usuarios WHERE id = @id');

    return result.recordset[0] || null;
  },

  // OJO: a diferencia de getAll/getById, este SÍ necesita el password
  // (lo usan verifyPassword y la estrategia de Google), así que no
  // filtra columnas — pero el resultado pasa por safe() antes de salir
  // en los métodos que no deben exponerlo.
  async getByEmail(email) {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar, email.toLowerCase())
      .query('SELECT * FROM usuarios WHERE LOWER(email) = @email');

    return result.recordset[0] || null;
  },

  async create({ nombre, email, password }) {
    const existente = await UserModel.getByEmail(email);
    if (existente) throw new Error('Ya existe una cuenta con ese correo');

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const pool = await getPool();
    const result = await pool.request()
      .input('nombre', sql.NVarChar, nombre)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hash)
      .input('rol', sql.NVarChar, 'usuario')
      .query(`
        INSERT INTO usuarios (nombre, email, password, rol)
        OUTPUT INSERTED.id, INSERTED.nombre, INSERTED.email, INSERTED.rol, INSERTED.creado_en
        VALUES (@nombre, @email, @password, @rol)
      `);

    return result.recordset[0];
  },

  // ── Crear usuario desde Google (sin contraseña) ──
  async createFromGoogle({ nombre, email }) {
    const existente = await UserModel.getByEmail(email);
    if (existente) throw new Error('Ya existe una cuenta con ese correo');

    const pool = await getPool();
    const result = await pool.request()
      .input('nombre', sql.NVarChar, nombre)
      .input('email', sql.NVarChar, email)
      .input('rol', sql.NVarChar, 'usuario')
      .query(`
        INSERT INTO usuarios (nombre, email, password, rol)
        OUTPUT INSERTED.id, INSERTED.nombre, INSERTED.email, INSERTED.rol, INSERTED.creado_en
        VALUES (@nombre, @email, NULL, @rol)
      `);

    return result.recordset[0];
  },

  async verifyPassword(email, password) {
    const u = await UserModel.getByEmail(email);
    if (!u || !u.password) return null; // usuarios Google no tienen password

    const ok = await bcrypt.compare(password, u.password);
    return ok ? safe(u) : null;
  },

  async updateNombre(id, nombre) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, parseInt(id, 10))
      .input('nombre', sql.NVarChar, nombre)
      .query(`
        UPDATE usuarios SET nombre = @nombre WHERE id = @id;
        SELECT id, nombre, email, rol, creado_en FROM usuarios WHERE id = @id;
      `);

    return result.recordset[0] || null;
  },

  async updatePassword(id, passwordActual, passwordNueva) {
    const pool = await getPool();
    const numId = parseInt(id, 10);

    const actual = await pool.request()
      .input('id', sql.Int, numId)
      .query('SELECT * FROM usuarios WHERE id = @id');

    const u = actual.recordset[0];
    if (!u) throw new Error('Usuario no encontrado');
    if (!u.password) throw new Error('Esta cuenta usa Google, no tiene contraseña local');

    const ok = await bcrypt.compare(passwordActual, u.password);
    if (!ok) throw new Error('La contraseña actual es incorrecta');

    const hash = await bcrypt.hash(passwordNueva, SALT_ROUNDS);
    await pool.request()
      .input('id', sql.Int, numId)
      .input('password', sql.NVarChar, hash)
      .query('UPDATE usuarios SET password = @password WHERE id = @id');

    return UserModel.getById(numId);
  },

  async updateRol(id, rol) {
    const pool = await getPool();
    const numId = parseInt(id, 10);

    const result = await pool.request()
      .input('id', sql.Int, numId)
      .input('rol', sql.NVarChar, rol)
      .query(`
        UPDATE usuarios SET rol = @rol WHERE id = @id;
        SELECT id, nombre, email, rol, creado_en FROM usuarios WHERE id = @id;
      `);

    return result.recordset[0] || null;
  },

  async delete(id) {
    const pool = await getPool();
    const numId = parseInt(id, 10);

    const existente = await pool.request()
      .input('id', sql.Int, numId)
      .query('SELECT id, nombre, email, rol, creado_en FROM usuarios WHERE id = @id');

    const eliminado = existente.recordset[0];
    if (!eliminado) return null;

    await pool.request()
      .input('id', sql.Int, numId)
      .query('DELETE FROM usuarios WHERE id = @id');

    return eliminado;
  },
};

module.exports = UserModel;

// ══════════════════════════════════════════════════
// NOTA — métodos que cambiaron de síncronos a async:
//   getAll, getById, getByEmail, updateRol, delete
//
// Los siguientes archivos los llamaban SIN await y tuvieron que
// actualizarse en este mismo paso 4 (ver esos archivos):
//   - controllers/authController.js  (me, getUsers, updateRol, deleteUser)
//   - config/passport.js             (estrategia Google, deserializeUser)
//   - middleware/authMiddleware.js   (requireAuth)
// ══════════════════════════════════════════════════