#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// backend/setup-telegram-webhook.js
//
// Registra (o consulta / elimina) el webhook de Telegram, que es lo que
// permite que el bot RECIBA los mensajes del administrador y responda
// con IA.
//
// USO — desde la raíz del proyecto:
//
//   Registrar el webhook apuntando a producción:
//     node backend/setup-telegram-webhook.js https://rent-mierals.onrender.com
//
//   Ver el estado actual del webhook:
//     node backend/setup-telegram-webhook.js --ver
//
//   Eliminar el webhook (para volver a usar getUpdates en local):
//     node backend/setup-telegram-webhook.js --borrar
//
// Requiere en el .env:
//   TELEGRAM_BOT_TOKEN        (el token del bot)
//   TELEGRAM_WEBHOOK_SECRET   (una contraseña larga que tú inventas)
// ══════════════════════════════════════════════════════════════════

require('dotenv').config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRETO = process.env.TELEGRAM_WEBHOOK_SECRET;

async function api(metodo, cuerpo) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo || {}),
  });
  return res.json();
}

async function main() {
  if (!TOKEN) {
    console.error('✖  Falta TELEGRAM_BOT_TOKEN en el archivo .env');
    process.exit(1);
  }

  const arg = process.argv[2];

  // ── Ver estado ──
  if (arg === '--ver') {
    const info = await api('getWebhookInfo');
    console.log('\nEstado actual del webhook:\n');
    console.log(JSON.stringify(info.result, null, 2));
    console.log('');
    return;
  }

  // ── Borrar ──
  if (arg === '--borrar') {
    const r = await api('deleteWebhook', { drop_pending_updates: true });
    console.log(r.ok ? '✔  Webhook eliminado.' : `✖  No se pudo eliminar: ${r.description}`);
    return;
  }

  // ── Registrar ──
  const base = (arg || process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (!base) {
    console.error('✖  Falta la URL pública.');
    console.error('   Ejemplo: node backend/setup-telegram-webhook.js https://rent-mierals.onrender.com');
    process.exit(1);
  }
  if (!base.startsWith('https://')) {
    console.error('✖  Telegram exige HTTPS. La URL debe empezar con https://');
    console.error('   (localhost no sirve: el webhook necesita una dirección pública.)');
    process.exit(1);
  }
  if (!SECRETO || SECRETO.length < 16) {
    console.error('✖  Falta TELEGRAM_WEBHOOK_SECRET en el .env, o es muy corto (mínimo 16 caracteres).');
    console.error('   Puedes generar uno con:');
    console.error('   node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'hex\'))"');
    process.exit(1);
  }

  const url = `${base}/api/telegram/webhook`;
  const r = await api('setWebhook', {
    url,
    secret_token: SECRETO,
    allowed_updates: ['message', 'edited_message'],
    drop_pending_updates: true,
  });

  if (r.ok) {
    console.log(`\n✔  Webhook registrado correctamente.`);
    console.log(`   URL:  ${url}`);
    console.log(`\n   Ahora escríbele al bot por Telegram y debería responderte con IA.`);
    console.log(`   Prueba con:  /ayuda\n`);
  } else {
    console.error(`\n✖  No se pudo registrar: ${r.description}\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('✖  Error:', err.message);
  process.exit(1);
});
