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
//
// ── SOBRE LA AUTO-PAUSA DE AZURE ──────────────────────────────────
// El plan gratuito de Azure SQL es "serverless con auto-pausa": si la
// base pasa un rato sin recibir consultas, se apaga sola para no gastar
// cuota. La primera conexión después de eso NO falla porque haya algo
// mal: simplemente la base está despertando, y eso tarda entre 30 y 60
// segundos.
//
// Por eso aquí se hacen dos cosas:
//   1. Un timeout de conexión largo (60 s en lugar de los 15 s por
//      defecto de la librería, que era justo lo que hacía fallar).
//   2. Reintentos automáticos: si el primer intento no alcanza, se
//      vuelve a intentar en vez de darse por vencido.
// ══════════════════════════════════════════════════

require('dotenv').config();
const sql = require('mssql');

const isAzure = process.env.DB_ENCRYPT === 'true';

// Azure serverless puede tardar ~1 minuto en despertar; en local la
// respuesta es inmediata y no tiene sentido esperar tanto.
const TIMEOUT_CONEXION = isAzure ? 60000 : 15000;
const INTENTOS_MAX     = isAzure ? 3 : 1;
const ESPERA_REINTENTO = 5000;

const config = {
  server:   process.env.DB_SERVER   || 'localhost',
  port:     parseInt(process.env.DB_PORT, 10) || 1433,
  database: process.env.DB_DATABASE || 'RentMining',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeout: TIMEOUT_CONEXION,
  requestTimeout:    TIMEOUT_CONEXION,
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

const esperar = ms => new Promise(r => setTimeout(r, ms));

// Intenta conectar, reintentando si la base todavía está despertando.
async function conectarConReintentos() {
  let ultimoError;

  for (let intento = 1; intento <= INTENTOS_MAX; intento++) {
    try {
      if (intento > 1) {
        console.log(`   ↻ Reintentando conexión (intento ${intento} de ${INTENTOS_MAX})…`);
      }
      const pool = await new sql.ConnectionPool(config).connect();
      console.log('✔  Conectado a SQL Server:', config.database, `@ ${config.server}:${config.port}`);
      return pool;
    } catch (err) {
      ultimoError = err;
      if (intento < INTENTOS_MAX) {
        console.warn(`⏳ La base no respondió (intento ${intento}). Probablemente Azure la tiene`);
        console.warn(`   en pausa y está despertando. Esperando ${ESPERA_REINTENTO / 1000}s…`);
        await esperar(ESPERA_REINTENTO);
      }
    }
  }

  console.error('✖  Error al conectar a SQL Server:', ultimoError.message);
  if (isAzure) {
    console.error('   Pistas: (1) la base puede estar despertando, prueba de nuevo en 1 minuto;');
    console.error('           (2) revisa en el portal de Azure que no se haya agotado la cuota');
    console.error('               mensual gratuita; (3) verifica la regla de firewall.');
  }
  throw ultimoError;
}

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = conectarConReintentos().catch((err) => {
      // Se limpia para que la próxima petición vuelva a intentarlo
      // (clave con la auto-pausa: el segundo intento suele funcionar).
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

module.exports = { getPool, sql };