// ══════════════════════════════════════════════════
// backend/models/itemModel.js
// Fase 3 — Migrado de arrays en memoria a SQL Server.
//
// La columna en la base se llama 'anio' (sin tilde, ver schema.sql),
// pero el resto de la app (JSON de la API, frontend) sigue hablando
// de 'año' — por eso toRow()/fromRow() hacen ese mapeo en los dos
// sentidos, y el resto del código no necesita saber que existe esa
// diferencia de nombre.
// ══════════════════════════════════════════════════

const { getPool, sql } = require('../config/db');

/** Convierte una fila de la base (columna 'anio') al objeto que espera el resto de la app ('año'). */
function fromRow(row) {
  if (!row) return null;
  const { anio, ...rest } = row;
  return { ...rest, año: anio };
}

const MaquinariaModel = {
  /**
   * Obtener maquinaria, con filtros opcionales aplicados en SQL
   * (antes se hacían con .filter() en JS sobre el array completo).
   * Mantiene el mismo comportamiento: comparación insensible a
   * mayúsculas, y 'search' es un "contains" sobre nombre/marca/modelo.
   */
  async getAll({ categoria, estado, search } = {}) {
    const pool = await getPool();
    const request = pool.request();

    const condiciones = [];

    if (categoria) {
      request.input('categoria', sql.NVarChar, categoria);
      condiciones.push('LOWER(categoria) = LOWER(@categoria)');
    }
    if (estado) {
      request.input('estado', sql.NVarChar, estado);
      condiciones.push('LOWER(estado) = LOWER(@estado)');
    }
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      condiciones.push('(nombre LIKE @search OR marca LIKE @search OR modelo LIKE @search)');
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const result = await request.query(`SELECT * FROM maquinaria ${where} ORDER BY id`);

    return result.recordset.map(fromRow);
  },

  async getById(id) {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) return null;

    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, numId)
      .query('SELECT * FROM maquinaria WHERE id = @id');

    return fromRow(result.recordset[0]);
  },

  async getByCategoria(categoria) {
    const pool = await getPool();
    const result = await pool.request()
      .input('categoria', sql.NVarChar, categoria)
      .query('SELECT * FROM maquinaria WHERE LOWER(categoria) = LOWER(@categoria) ORDER BY id');

    return result.recordset.map(fromRow);
  },

  // Las categorías son un valor fijo de negocio (no cambian con el
  // catálogo), así que se mantienen como constante igual que en la
  // versión en memoria, en vez de hacer SELECT DISTINCT a la tabla.
  getCategorias() {
    return [
      'Excavación', 'Transporte', 'Perforación', 'Nivelación', 'Carga',
      'Empuje', 'Compactación', 'Izaje', 'Transporte Subterráneo',
      'Carga Subterránea', 'Riego de Caminos', 'Chancado',
    ];
  },

  async create(data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('nombre', sql.NVarChar, data.nombre)
      .input('categoria', sql.NVarChar, data.categoria)
      .input('marca', sql.NVarChar, data.marca)
      .input('modelo', sql.NVarChar, data.modelo)
      .input('anio', sql.Int, data.año ? parseInt(data.año, 10) : new Date().getFullYear())
      .input('capacidad', sql.NVarChar, data.capacidad || 'No especificado')
      .input('potencia', sql.NVarChar, data.potencia || 'No especificado')
      .input('descripcion', sql.NVarChar, data.descripcion)
      .input('estado', sql.NVarChar, data.estado || 'Disponible')
      .input('precio_arriendo_dia', sql.Decimal(12, 2), data.precio_arriendo_dia ? parseFloat(data.precio_arriendo_dia) : 0)
      .input('imagen', sql.NVarChar, data.imagen || `https://via.placeholder.com/400x250/eef1f4/0058a3?text=${encodeURIComponent(data.nombre)}`)
      .query(`
        INSERT INTO maquinaria
          (nombre, categoria, marca, modelo, anio, capacidad, potencia, descripcion, estado, precio_arriendo_dia, imagen)
        OUTPUT INSERTED.*
        VALUES
          (@nombre, @categoria, @marca, @modelo, @anio, @capacidad, @potencia, @descripcion, @estado, @precio_arriendo_dia, @imagen)
      `);

    return fromRow(result.recordset[0]);
  },

  async update(id, data) {
    const numId = parseInt(id, 10);
    const actual = await MaquinariaModel.getById(numId);
    if (!actual) return null;

    // Mezcla los datos existentes con los nuevos, igual que hacía
    // el spread { ...maquinaria[index], ...data } en memoria.
    const fusionado = { ...actual, ...data };

    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, numId)
      .input('nombre', sql.NVarChar, fusionado.nombre)
      .input('categoria', sql.NVarChar, fusionado.categoria)
      .input('marca', sql.NVarChar, fusionado.marca)
      .input('modelo', sql.NVarChar, fusionado.modelo)
      .input('anio', sql.Int, parseInt(fusionado.año, 10))
      .input('capacidad', sql.NVarChar, fusionado.capacidad)
      .input('potencia', sql.NVarChar, fusionado.potencia)
      .input('descripcion', sql.NVarChar, fusionado.descripcion)
      .input('estado', sql.NVarChar, fusionado.estado)
      .input('precio_arriendo_dia', sql.Decimal(12, 2), parseFloat(fusionado.precio_arriendo_dia))
      .input('imagen', sql.NVarChar, fusionado.imagen)
      .query(`
        UPDATE maquinaria SET
          nombre = @nombre, categoria = @categoria, marca = @marca, modelo = @modelo,
          anio = @anio, capacidad = @capacidad, potencia = @potencia,
          descripcion = @descripcion, estado = @estado,
          precio_arriendo_dia = @precio_arriendo_dia, imagen = @imagen
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    return fromRow(result.recordset[0]);
  },

  async delete(id) {
    const numId = parseInt(id, 10);
    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.Int, numId)
      .query('DELETE FROM maquinaria OUTPUT DELETED.* WHERE id = @id');

    return fromRow(result.recordset[0]);
  },

  // search() se mantiene por compatibilidad — getAll({ search }) ya
  // cubre el mismo caso de uso desde el controller.
  async search(query) {
    return MaquinariaModel.getAll({ search: query });
  },
};

module.exports = MaquinariaModel;