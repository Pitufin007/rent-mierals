const app = require('./app');
const config = require('./config/config');
const { logEstadoInicial } = require('./services/telegramNotifier');

const PORT = config.port;

app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       🏗️  MINING CATALOG - SERVER INICIADO       ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Servidor:  http://localhost:${PORT}                ║`);
  console.log(`║  API Base:  http://localhost:${PORT}/api/maquinaria ║`);
  console.log(`║  Entorno:   ${config.nodeEnv.padEnd(37)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  logEstadoInicial();
});

module.exports = app;