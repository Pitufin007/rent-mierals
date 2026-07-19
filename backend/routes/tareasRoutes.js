// ══════════════════════════════════════════════════════════════════
// backend/routes/tareasRoutes.js
//
// Tareas programadas. Un servicio de cron externo y gratuito
// (por ejemplo cron-job.org) llama estas rutas cada cierto tiempo, y
// la aplicación hace el trabajo.
//
// ¿Por qué así y no con un temporizador dentro de Node?
// Porque en el plan gratuito de Render la instancia se duerme tras unos
// minutos sin tráfico, y un temporizador interno dejaría de dispararse.
// Un cron externo, además, despierta la aplicación al llamarla.
//
// Seguridad: las rutas exigen el encabezado  X-Cron-Secret  con el valor
// de CRON_SECRET. Sin eso, cualquiera en internet podría dispararlas.
// ══════════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const { generarResumen } = require('../services/reportesService');
const { enviarMensaje } = require('../services/telegramNotifier');

// Middleware: exige el secreto compartido con el servicio de cron.
function requireCronSecret(req, res, next) {
  const esperado = process.env.CRON_SECRET;

  if (!esperado) {
    return res.status(503).json({
      success: false,
      message: 'Tareas programadas deshabilitadas: falta CRON_SECRET en las variables de entorno.',
    });
  }

  const recibido = req.get('X-Cron-Secret') || req.query.secret;
  if (recibido !== esperado) {
    console.warn('✖  Tarea programada: secreto inválido, petición rechazada.');
    return res.status(401).json({ success: false, message: 'No autorizado.' });
  }
  next();
}

router.use(requireCronSecret);

// GET|POST /api/tareas/resumen
// Genera el informe del negocio con IA y lo envía a los administradores.
async function ejecutarResumen(req, res) {
  try {
    const periodo = String(req.query.periodo || 'semanal').slice(0, 20);
    console.log(`→ Tarea programada: generando resumen ${periodo}…`);

    const texto = await generarResumen(periodo);
    if (!texto) {
      return res.status(500).json({ success: false, message: 'No se pudo generar el resumen.' });
    }

    await enviarMensaje(texto);
    res.status(200).json({ success: true, message: 'Resumen generado y enviado.' });
  } catch (error) {
    console.error('✖  Tarea resumen:', error.message);
    res.status(500).json({ success: false, message: 'Error al generar el resumen.' });
  }
}

router.get('/resumen', ejecutarResumen);
router.post('/resumen', ejecutarResumen);

// GET /api/tareas/ping — mantiene despierta la instancia y sirve para
// comprobar que el secreto está bien configurado.
router.get('/ping', (req, res) => {
  res.status(200).json({ success: true, message: 'pong', hora: new Date().toISOString() });
});

module.exports = router;
