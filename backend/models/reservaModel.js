// ══════════════════════════════════════════════════
// backend/models/reservaModel.js
// Fase 3 — Migrado de arrays en memoria a SQL Server.
//
// La tabla guarda usuario_nombre y maquinaria_nombre "snapshot"
// (no son FKs a esos campos, solo se copian al crear la reserva),
// igual que hacía la versión en memoria al recibir usuarioNombre
// y maquinariaNombre ya resueltos desde el controller.
// ══════════════════════════════════════════════════

const { getPool, sql } = require('../config/db');

/** Convierte snake_case de la base a camelCase, igual que el objeto que devolvía la versión en memoria. */
function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    usuarioId: row.usuario_id,
    usuarioNombre: row.usuario_nombre,
    maquinariaId: row.maquinaria_id,
    maquinariaNombre: row.maquinaria_nombre,
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    notas: row.notas,
    estado: row.estado,
    creada_en: row.creada_en,
  };
}

const ReservaModel = {
  async getAll() {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM reservas ORDER BY id DESC');
    return result.recordset.map(fromRow);
  },

  async getByUsuario(usuarioId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('usuarioId', sql.Int, parseInt(usuarioId, 10))
      .query('SELECT * FROM reservas WHERE usuario_id = @usuarioId ORDER BY id DESC');

    return result.recordset.map(fromRow);
  },

  async getById(id) {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) return null;

    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, numId)
      .query('SELECT * FROM reservas WHERE id = @id');

    return fromRow(result.recordset[0]);
  },

  async create({ usuarioId, usuarioNombre, maquinariaId, maquinariaNombre, fecha_inicio, fecha_fin, notas }) {
    const pool = await getPool();
    const result = await pool.request()
      .input('usuarioId', sql.Int, parseInt(usuarioId, 10))
      .input('usuarioNombre', sql.NVarChar, usuarioNombre)
      .input('maquinariaId', sql.Int, parseInt(maquinariaId, 10))
      .input('maquinariaNombre', sql.NVarChar, maquinariaNombre)
      .input('fecha_inicio', sql.Date, fecha_inicio)
      .input('fecha_fin', sql.Date, fecha_fin)
      .input('notas', sql.NVarChar, notas || '')
      .query(`
        INSERT INTO reservas
          (usuario_id, usuario_nombre, maquinaria_id, maquinaria_nombre, fecha_inicio, fecha_fin, notas, estado)
        OUTPUT INSERTED.*
        VALUES
          (@usuarioId, @usuarioNombre, @maquinariaId, @maquinariaNombre, @fecha_inicio, @fecha_fin, @notas, 'Pendiente')
      `);

    return fromRow(result.recordset[0]);
  },

  async updateEstado(id, estado) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, parseInt(id, 10))
      .input('estado', sql.NVarChar, estado)
      .query(`
        UPDATE reservas SET estado = @estado
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    return fromRow(result.recordset[0]);
  },

  async delete(id) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, parseInt(id, 10))
      .query('DELETE FROM reservas OUTPUT DELETED.* WHERE id = @id');

    return fromRow(result.recordset[0]);
  },
};

module.exports = ReservaModel;