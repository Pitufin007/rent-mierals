// ══════════════════════════════════════════════════════════════════
// backend/models/mantenimientoModel.js
//
// Rangos de mantención por máquina. Funciona igual que la agenda pero
// para bloqueos de mantenimiento (se pintan naranjo en el calendario).
// ══════════════════════════════════════════════════════════════════
const { getPool, sql } = require('../config/db');

function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    maquinariaId: row.maquinaria_id,
    maquinariaNombre: row.maquinaria_nombre,
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    motivo: row.motivo,
    creado_en: row.creado_en,
  };
}

const MantenimientoModel = {
  async getAll() {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM mantenimiento ORDER BY fecha_inicio ASC, id ASC');
    return result.recordset.map(fromRow);
  },

  // Rangos de mantención de UNA máquina (para el calendario).
  async getByMaquinaria(maquinariaId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('maquinariaId', sql.Int, parseInt(maquinariaId, 10))
      .query(`
        SELECT fecha_inicio, fecha_fin, motivo
        FROM mantenimiento
        WHERE maquinaria_id = @maquinariaId
        ORDER BY fecha_inicio ASC
      `);
    return result.recordset.map(r => ({
      fecha_inicio: r.fecha_inicio,
      fecha_fin: r.fecha_fin,
      motivo: r.motivo,
    }));
  },

  // ¿El rango [inicio, fin] choca con otra mantención de esa máquina?
  async hayConflicto(maquinariaId, inicio, fin, excludeId = null) {
    const pool = await getPool();
    const req = pool.request()
      .input('maquinariaId', sql.Int, parseInt(maquinariaId, 10))
      .input('inicio', sql.Date, inicio)
      .input('fin', sql.Date, fin);

    let sqlText = `
      SELECT TOP 1 fecha_inicio, fecha_fin
      FROM mantenimiento
      WHERE maquinaria_id = @maquinariaId
        AND fecha_inicio <= @fin
        AND fecha_fin   >= @inicio
    `;
    if (excludeId != null) {
      req.input('excludeId', sql.Int, parseInt(excludeId, 10));
      sqlText += ' AND id <> @excludeId';
    }
    const result = await req.query(sqlText);
    const row = result.recordset[0];
    return row ? { fecha_inicio: row.fecha_inicio, fecha_fin: row.fecha_fin } : null;
  },

  async create({ maquinariaId, maquinariaNombre, fecha_inicio, fecha_fin, motivo }) {
    const pool = await getPool();
    const result = await pool.request()
      .input('maquinariaId', sql.Int, parseInt(maquinariaId, 10))
      .input('maquinariaNombre', sql.NVarChar, maquinariaNombre)
      .input('fecha_inicio', sql.Date, fecha_inicio)
      .input('fecha_fin', sql.Date, fecha_fin)
      .input('motivo', sql.NVarChar, motivo || '')
      .query(`
        INSERT INTO mantenimiento
          (maquinaria_id, maquinaria_nombre, fecha_inicio, fecha_fin, motivo)
        OUTPUT INSERTED.*
        VALUES
          (@maquinariaId, @maquinariaNombre, @fecha_inicio, @fecha_fin, @motivo)
      `);
    return fromRow(result.recordset[0]);
  },

  async delete(id) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, parseInt(id, 10))
      .query('DELETE FROM mantenimiento WHERE id = @id');
    return result.rowsAffected[0];
  },
};

module.exports = MantenimientoModel;
