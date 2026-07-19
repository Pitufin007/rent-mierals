#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// renombrar-a-minerals.js
//
// Cambia el nombre visible "Rent Mierals" → "Rent Minerals" en todo el
// proyecto, SIN tocar nada que pueda romper producción.
//
// ── POR QUÉ ES SEGURO ─────────────────────────────────────────────
// El nombre visible siempre se escribe con espacio ("Rent Mierals"),
// mientras que las referencias técnicas van pegadas o con guion:
//
//   rentmierals-server.database.windows.net   ← servidor de Azure
//   rent-mierals.onrender.com                 ← dirección de producción
//   admin@rentmierals.cl                      ← usuarios ya creados en la BD
//   @rentmierals_bot                          ← usuario del bot de Telegram
//
// Como este script solo reemplaza la forma CON ESPACIO, esas cuatro
// cosas quedan intactas. Cambiarlas rompería el inicio de sesión, la
// conexión a la base de datos o el despliegue.
//
// USO — desde la raíz del proyecto:
//   node renombrar-a-minerals.js          (muestra qué cambiaría, sin tocar nada)
//   node renombrar-a-minerals.js --aplicar   (aplica los cambios)
// ══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const RAIZ = process.cwd();
const APLICAR = process.argv.includes('--aplicar');

const EXTENSIONES = ['.js', '.html', '.css', '.sql', '.md', '.json'];
const IGNORAR = ['node_modules', '.git', 'dist', 'build'];

// Solo la forma con espacio. Ese es el truco de seguridad.
const REEMPLAZOS = [
  ['Rent Mierals', 'Rent Minerals'],
  ['RENT MIERALS', 'RENT MINERALS'],
  ['rent mierals', 'rent minerals'],
];

// Estas cadenas NO se tocan jamás. Si una línea contiene alguna, se
// deja intacta como medida extra de seguridad.
const INTOCABLES = [
  'rentmierals-server',
  'rent-mierals.onrender',
  '@rentmierals.cl',
  'rentmierals_bot',
  'rentmierals_app',
];

function recorrer(dir, archivos = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.includes(entrada.name) || entrada.name.startsWith('.git')) continue;
    const completo = path.join(dir, entrada.name);
    // Este script se excluye a sí mismo: contiene los textos de búsqueda
    // en sus propias reglas, y reescribirse las corrompería.
    if (path.resolve(completo) === path.resolve(__filename)) continue;
    if (entrada.isDirectory()) recorrer(completo, archivos);
    else if (EXTENSIONES.includes(path.extname(entrada.name))) archivos.push(completo);
  }
  return archivos;
}

let totalArchivos = 0;
let totalCambios = 0;
let protegidas = 0;

for (const archivo of recorrer(RAIZ)) {
  const original = fs.readFileSync(archivo, 'utf8');
  const lineas = original.split('\n');
  let cambiosEnArchivo = 0;

  const nuevas = lineas.map(linea => {
    // Salvaguarda: si la línea toca algo técnico, no se modifica.
    if (INTOCABLES.some(t => linea.includes(t))) {
      if (REEMPLAZOS.some(([de]) => linea.includes(de))) protegidas++;
      return linea;
    }
    let resultado = linea;
    for (const [de, a] of REEMPLAZOS) {
      if (resultado.includes(de)) {
        cambiosEnArchivo += resultado.split(de).length - 1;
        resultado = resultado.split(de).join(a);
      }
    }
    return resultado;
  });

  if (cambiosEnArchivo > 0) {
    totalArchivos++;
    totalCambios += cambiosEnArchivo;
    const relativo = path.relative(RAIZ, archivo);
    console.log(`  ${String(cambiosEnArchivo).padStart(3)} cambio(s)  ${relativo}`);
    if (APLICAR) fs.writeFileSync(archivo, nuevas.join('\n'), 'utf8');
  }
}

console.log('\n─────────────────────────────────────────────');
if (totalCambios === 0) {
  console.log('No se encontró "Rent Mierals" en el proyecto.');
  console.log('Puede que el cambio ya esté aplicado.');
} else if (APLICAR) {
  console.log(`✅ Listo: ${totalCambios} cambio(s) en ${totalArchivos} archivo(s).`);
  console.log('\n   Siguiente paso: reinicia el servidor (Ctrl+C y npm run dev)');
  console.log('   y recarga el navegador con Ctrl+Shift+R.');
} else {
  console.log(`Se encontraron ${totalCambios} cambio(s) en ${totalArchivos} archivo(s).`);
  console.log('\n   Esto fue solo una vista previa: NO se modificó nada.');
  console.log('   Para aplicarlos de verdad, ejecuta:');
  console.log('\n      node renombrar-a-minerals.js --aplicar\n');
}
if (protegidas > 0) {
  console.log(`\n🔒 Se protegieron ${protegidas} línea(s) con direcciones técnicas`);
  console.log('   (servidor de Azure, URL de producción, correos de acceso).');
}
console.log('─────────────────────────────────────────────\n');