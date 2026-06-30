// ══════════════════════════════════════════════════
// backend/test-db.js
// Script para probar que Node puede conectarse a SQL Server
// usando la configuración de db.js / .env
//
// Cómo usarlo:
//   1. Asegúrate de tener tu .env con DB_SERVER, DB_PORT,
//      DB_DATABASE, DB_USER, DB_PASSWORD ya completados.
//   2. Corre: node backend/test-db.js
//   3. Si todo está bien, verás el conteo de filas de cada tabla.
//      Si falla, el mensaje de error te dirá exactamente qué pasó
//      (credenciales, servidor no disponible, base no existe, etc).
// ══════════════════════════════════════════════════

const { getPool } = require('./config/db');

async function main() {
  try {
    const pool = await getPool();

    const usuarios   = await pool.request().query('SELECT COUNT(*) AS total FROM usuarios');
    const maquinaria = await pool.request().query('SELECT COUNT(*) AS total FROM maquinaria');
    const reservas    = await pool.request().query('SELECT COUNT(*) AS total FROM reservas');

    console.log('');
    console.log('Conexión exitosa. Resumen de la base:');
    console.log('  usuarios:  ', usuarios.recordset[0].total);
    console.log('  maquinaria:', maquinaria.recordset[0].total);
    console.log('  reservas:  ', reservas.recordset[0].total);
    console.log('');

    process.exit(0);
  } catch (err) {
    console.error('');
    console.error('La conexión falló. Detalle del error:');
    console.error(err.message);
    console.error('');
    process.exit(1);
  }
}

main();