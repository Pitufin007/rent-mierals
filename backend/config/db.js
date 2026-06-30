// ══════════════════════════════════════════════════
// backend/config/db.js
// Pool de conexión a SQL Server (driver: mssql)
// ══════════════════════════════════════════════════
//
// Este módulo expone una única función getPool() que devuelve
// siempre el mismo pool de conexiones ya conectado, reutilizándolo
// entre llamadas en vez de abrir una conexión nueva por cada query.
//
// Uso típico desde un modelo:
//
//   const { getPool, sql } = require('../config/db');
//
//   async function getById(id) {
//     const pool = await getPool();
//     const result = await pool.request()
//       .input('id', sql.Int, id)
//       .query('SELECT * FROM maquinaria WHERE id = @id');
//     return result.recordset[0] || null;
//   }
//
// ══════════════════════════════════════════════════

require('dotenv').config();
const sql = require('mssql');

const config = {
  server:   process.env.DB_SERVER   || 'localhost',
  port:     parseInt(process.env.DB_PORT, 10) || 1433,
  database: process.env.DB_DATABASE || 'RentMining',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    // SQL Server Express local normalmente no tiene un certificado
    // válido firmado por una CA, así que hay que decirle al driver
    // que confíe en el certificado igualmente (solo para desarrollo
    // local; en producción contra un servidor real esto se ajusta).
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise = null;

/**
 * Devuelve una promesa que resuelve al pool de conexión ya conectado.
 * Si ya existe un pool conectándose o conectado, reutiliza esa misma
 * promesa en vez de crear una conexión nueva cada vez.
 */
function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then((pool) => {
        console.log('✔  Conectado a SQL Server:', config.database, `@ ${config.server}:${config.port}`);
        return pool;
      })
      .catch((err) => {
        // Si la conexión falla, limpiamos poolPromise para que el
        // próximo intento vuelva a intentar conectarse desde cero
        // en lugar de quedar atascado con una promesa rechazada.
        poolPromise = null;
        console.error('✖  Error al conectar a SQL Server:', err.message);
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { getPool, sql };