// ══════════════════════════════════════════════════════════════════
// backend/routes/telegramWebhookRoutes.js
//
// Ruta que Telegram llama cuando el administrador escribe al bot.
// No lleva requireAuth: la autenticación es el secreto del webhook más
// la lista de chats autorizados (ver telegramWebhookController).
// ══════════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const TelegramWebhookController = require('../controllers/telegramWebhookController');

router.post('/webhook', TelegramWebhookController.recibir);

module.exports = router;
