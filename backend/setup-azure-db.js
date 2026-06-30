// ══════════════════════════════════════════════════
// backend/setup-azure-db.js
// Carga el schema completo en Azure SQL Database.
//
// Cómo usarlo:
//   1. Asegúrate de tener el .env actualizado con las
//      credenciales de Azure SQL (DB_SERVER, DB_DATABASE,
//      DB_USER, DB_PASSWORD, DB_ENCRYPT=true).
//   2. Corre: node backend/setup-azure-db.js
// ══════════════════════════════════════════════════

require('dotenv').config();
const sql = require('mssql');
const fs  = require('fs');
const path = require('path');

const config = {
  server:   process.env.DB_SERVER,
  port:     parseInt(process.env.DB_PORT, 10) || 1433,
  database: process.env.DB_DATABASE,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt:                true,   // Requerido por Azure SQL
    trustServerCertificate: false,  // Azure tiene certificado válido
  },
  pool: { max: 5, min: 0, idleTimeoutMillis: 10000 },
};

async function runSchema() {
  console.log('Conectando a Azure SQL:', config.server, '/', config.database);

  let pool;
  try {
    pool = await sql.connect(config);
    console.log('✔  Conexión exitosa\n');

    // Leer el archivo schema
    const schemaPath = path.join(__dirname, '..', 'database', 'schema_azure.sql');

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`No se encontró el archivo: ${schemaPath}`);
    }

    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Azure SQL no entiende GO como separador dentro del driver mssql.
    // Hay que dividir el script en bloques por GO y ejecutarlos uno a uno.
    const bloques = schemaSQL
      .split(/^\s*GO\s*$/im)   // Divide por líneas que solo contengan "GO"
      .map(b => b.trim())
      .filter(b => {
        // Un bloque es válido si, al quitarle las líneas que son
        // puramente comentario (empiezan con --), todavía le queda
        // algo de SQL real. Esto es distinto de "no empieza con --":
        // un bloque puede arrancar con un comentario de encabezado
        // y tener el CREATE TABLE real un poco más abajo — ese caso
        // SÍ debe ejecutarse.
        const soloCodigo = b
          .split('\n')
          .filter(linea => !linea.trim().startsWith('--'))
          .join('\n')
          .trim();
        return soloCodigo.length > 0;
      });

    console.log(`Ejecutando ${bloques.length} bloques SQL...\n`);

    for (let i = 0; i < bloques.length; i++) {
      try {
        await pool.request().query(bloques[i]);
        process.stdout.write(`✔  Bloque ${i + 1}/${bloques.length}\r`);
      } catch (err) {
        // Algunos bloques son esperablemente "idempotentes" (IF NOT EXISTS),
        // pero si algo falla de verdad lo reportamos con contexto.
        console.error(`\n✖  Error en bloque ${i + 1}:`);
        console.error('   ', err.message);
        console.error('   SQL:', bloques[i].substring(0, 120), '...');
      }
    }

    console.log('\n\nVerificando datos cargados...');
    const r1 = await pool.request().query('SELECT COUNT(*) AS total FROM usuarios');
    const r2 = await pool.request().query('SELECT COUNT(*) AS total FROM maquinaria');
    const r3 = await pool.request().query('SELECT COUNT(*) AS total FROM reservas');

    console.log('  usuarios:  ', r1.recordset[0].total);
    console.log('  maquinaria:', r2.recordset[0].total);
    console.log('  reservas:  ', r3.recordset[0].total);
    console.log('\n✅ Schema cargado correctamente en Azure SQL');

  } catch (err) {
    console.error('\n✖  Error fatal:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
    process.exit(0);
  }
}

runSchema();