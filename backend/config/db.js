// ══════════════════════════════════════════════════
// backend/config/db.js
// Pool de conexión compatible con SQL Server local Y Azure SQL.
//
// La diferencia clave entre local y Azure:
//   Local:  encrypt=false, trustServerCertificate=true
//   Azure:  encrypt=true,  trustServerCertificate=false
//
// Esto se controla con la variable DB_ENCRYPT en el .env:
//   DB_ENCRYPT=false  → SQL Server local (Express)
//   DB_ENCRYPT=true   → Azure SQL Database
// ══════════════════════════════════════════════════

require('dotenv').config();
const sql = require('mssql');

const isAzure = process.env.DB_ENCRYPT === 'true';

const config = {
  server:   process.env.DB_SERVER   || 'localhost',
  port:     parseInt(process.env.DB_PORT, 10) || 1433,
  database: process.env.DB_DATABASE || 'RentMining',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt:                isAzure,   // true en Azure, false en local
    trustServerCertificate: !isAzure,  // true en local, false en Azure
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then((pool) => {
        console.log('✔  Conectado a SQL Server:', config.database, `@ ${config.server}:${config.port}`);
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        console.error('✖  Error al conectar a SQL Server:', err.message);
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { getPool, sql };