// ══════════════════════════════════════════════════════════════════
// backend/models/agendaModel.js
//
// La AGENDA guarda las reservas que el admin YA APROBÓ. Es la fuente
// de verdad de "qué días está ocupada cada máquina": cuando una reserva
// se aprueba, se inserta acá; cuando se rechaza/cancela/elimina, se saca.
//
// Guarda un "snapshot" con más información que la reserva (contacto del
// cliente, precio por día y total, notas), para que el admin pueda ver
// la agenda completa sin tener que cruzar tablas a mano.
//
// La disponibilidad del catálogo se calcula SOLO por fechas: una máquina
// sigue "Disponible" salvo en los rangos que estén en esta tabla.
// ══════════════════════════════════════════════════════════════════

const { getPool, sql } = require('../config/db');

function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    reservaId: row.reserva_id,
    maquinariaId: row.maquinaria_id,
    maquinariaNombre: row.maquinaria_nombre,
    usuarioId: row.usuario_id,
    clienteNombre: row.cliente_nombre,
    clienteEmail: row.cliente_email,
    clienteTelefono: row.cliente_telefono,
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    precioDia: row.precio_dia,
    precioTotal: row.precio_total,
    notas: row.notas,
    agendada_en: row.agendada_en,
  };
}

const AgendaModel = {
  // Todas las entradas de la agenda (vista admin), más recientes primero.
  async getAll() {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM agenda ORDER BY fecha_inicio ASC, id ASC');
    return result.recordset.map(fromRow);
  },

  // Rangos ocupados de UNA máquina (para pintar el calendario y bloquear).
  // Devuelve solo lo necesario para el frontend.
  async getByMaquinaria(maquinariaId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('maquinariaId', sql.Int, parseInt(maquinariaId, 10))
      .query(`
        SELECT fecha_inicio, fecha_fin, cliente_nombre
        FROM agenda
        WHERE maquinaria_id = @maquinariaId
        ORDER BY fecha_inicio ASC
      `);
    return result.recordset.map(r => ({
      fecha_inicio: r.fecha_inicio,
      fecha_fin: r.fecha_fin,
      cliente: r.cliente_nombre,
    }));
  },

  // ¿Chocan las fechas [inicio, fin] con algo ya agendado para esa máquina?
  // Solapamiento inclusivo: (inicio <= finExistente) AND (fin >= inicioExistente).
  // excludeReservaId permite ignorar la propia reserva al re-chequear.
  async hayConflicto(maquinariaId, inicio, fin, excludeReservaId = null) {
    const pool = await getPool();
    const req = pool.request()
      .input('maquinariaId', sql.Int, parseInt(maquinariaId, 10))
      .input('inicio', sql.Date, inicio)
      .input('fin', sql.Date, fin);

    let sqlText = `
      SELECT TOP 1 fecha_inicio, fecha_fin, cliente_nombre
      FROM agenda
      WHERE maquinaria_id = @maquinariaId
        AND fecha_inicio <= @fin
        AND fecha_fin   >= @inicio
    `;
    if (excludeReservaId != null) {
      req.input('excludeReservaId', sql.Int, parseInt(excludeReservaId, 10));
      sqlText += ' AND reserva_id <> @excludeReservaId';
    }

    const result = await req.query(sqlText);
    const row = result.recordset[0];
    return row
      ? { fecha_inicio: row.fecha_inicio, fecha_fin: row.fecha_fin, cliente: row.cliente_nombre }
      : null;
  },

  async existsByReserva(reservaId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('reservaId', sql.Int, parseInt(reservaId, 10))
      .query('SELECT TOP 1 id FROM agenda WHERE reserva_id = @reservaId');
    return result.recordset.length > 0;
  },

  async create({
    reservaId, maquinariaId, maquinariaNombre, usuarioId,
    clienteNombre, clienteEmail, clienteTelefono,
    fecha_inicio, fecha_fin, precioDia, precioTotal, notas,
  }) {
    const pool = await getPool();
    const result = await pool.request()
      .input('reservaId', sql.Int, parseInt(reservaId, 10))
      .input('maquinariaId', sql.Int, parseInt(maquinariaId, 10))
      .input('maquinariaNombre', sql.NVarChar, maquinariaNombre)
      .input('usuarioId', sql.Int, parseInt(usuarioId, 10))
      .input('clienteNombre', sql.NVarChar, clienteNombre)
      .input('clienteEmail', sql.NVarChar, clienteEmail || null)
      .input('clienteTelefono', sql.NVarChar, clienteTelefono || null)
      .input('fecha_inicio', sql.Date, fecha_inicio)
      .input('fecha_fin', sql.Date, fecha_fin)
      .input('precioDia', sql.Decimal(12, 2), precioDia || 0)
      .input('precioTotal', sql.Decimal(12, 2), precioTotal || 0)
      .input('notas', sql.NVarChar, notas || '')
      .query(`
        INSERT INTO agenda
          (reserva_id, maquinaria_id, maquinaria_nombre, usuario_id,
           cliente_nombre, cliente_email, cliente_telefono,
           fecha_inicio, fecha_fin, precio_dia, precio_total, notas)
        OUTPUT INSERTED.*
        VALUES
          (@reservaId, @maquinariaId, @maquinariaNombre, @usuarioId,
           @clienteNombre, @clienteEmail, @clienteTelefono,
           @fecha_inicio, @fecha_fin, @precioDia, @precioTotal, @notas)
      `);
    return fromRow(result.recordset[0]);
  },

  // Saca de la agenda la entrada asociada a una reserva (al rechazar,
  // cancelar o eliminar la reserva). Devuelve cuántas filas borró.
  async deleteByReserva(reservaId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('reservaId', sql.Int, parseInt(reservaId, 10))
      .query('DELETE FROM agenda WHERE reserva_id = @reservaId');
    return result.rowsAffected[0];
  },
};

module.exports = AgendaModel;
