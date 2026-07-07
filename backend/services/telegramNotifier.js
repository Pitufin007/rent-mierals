// ══════════════════════════════════════════════════════════════════
// backend/services/telegramNotifier.js
//
// Envía notificaciones al/los administrador(es) por Telegram cuando
// ocurre un evento de reserva (nueva, aprobada, rechazada, cancelada).
//
// Diseño:
//  - Multi-destinatario: TELEGRAM_CHAT_IDS admite varios chats separados
//    por coma. Para sumar admins, basta con agregar sus chat IDs.
//  - A prueba de fallos: NUNCA lanza ni corta el flujo de la reserva.
//  - Lee las variables en cada envío (no al cargar el módulo), para no
//    depender del orden en que se cargue dotenv.
//  - Sin dependencias nuevas: usa fetch nativo (Node 18+).
// ══════════════════════════════════════════════════════════════════

function leerConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return { token, chatIds, habilitado: Boolean(token && chatIds.length) };
}

// Fecha (Date o string) → 'YYYY-MM-DD'
function fecha(v) {
  return String(v).slice(0, 10);
}

// Envía un texto a TODOS los chats configurados. Nunca lanza.
async function enviarMensaje(texto) {
  const { token, chatIds, habilitado } = leerConfig();

  if (!habilitado) {
    console.log('ℹ  Telegram no configurado (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_IDS). No se envía.');
    return;
  }
  if (typeof fetch !== 'function') {
    console.error('✖  Telegram: este Node no tiene fetch global (se requiere Node 18+).');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await Promise.all(chatIds.map(async chatId => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: texto, disable_web_page_preview: true }),
      });
      if (res.ok) {
        console.log(`✔  Telegram: mensaje enviado a ${chatId}`);
      } else {
        const detalle = await res.text().catch(() => '');
        console.error(`✖  Telegram: fallo enviando a ${chatId} (HTTP ${res.status}) ${detalle}`);
      }
    } catch (err) {
      console.error(`✖  Telegram: error de red enviando a ${chatId}:`, err.message);
    }
  }));
}

// Construye y envía el mensaje según el evento de reserva.
// evento: 'creada' | 'aprobada' | 'rechazada' | 'cancelada' | 'eliminada'
function notificarEventoReserva(evento, reserva) {
  const encabezados = {
    creada:    '🆕 NUEVA SOLICITUD DE RESERVA',
    aprobada:  '✅ RESERVA APROBADA',
    rechazada: '❌ RESERVA RECHAZADA',
    cancelada: '🚫 RESERVA CANCELADA',
    eliminada: '🗑️ RESERVA ELIMINADA',
  };
  const titulo = encabezados[evento] || `ℹ️ RESERVA (${evento})`;

  const lineas = [
    titulo,
    '',
    `🏗️ Equipo: ${reserva.maquinariaNombre}`,
    `👤 Cliente: ${reserva.usuarioNombre}`,
    `📅 Fechas: ${fecha(reserva.fecha_inicio)} → ${fecha(reserva.fecha_fin)}`,
  ];
  if (reserva.telefono) lineas.push(`📞 Teléfono: ${reserva.telefono}`);
  if (reserva.notas)    lineas.push(`📝 Notas: ${reserva.notas}`);
  lineas.push(`🔖 Solicitud #${reserva.id}`);

  console.log(`→ Telegram: intentando notificar evento "${evento}" de la reserva #${reserva.id}`);
  // Fire-and-forget: no bloquea la respuesta HTTP de la reserva.
  enviarMensaje(lineas.join('\n')).catch(err => console.error('✖  Telegram:', err.message));
}

// Diagnóstico al arrancar el servidor (token enmascarado).
function logEstadoInicial() {
  const { token, chatIds, habilitado } = leerConfig();
  if (habilitado) {
    const tk = token.slice(0, 6) + '…' + token.slice(-4);
    console.log(`✔  Telegram ACTIVO — token ${tk}, ${chatIds.length} chat(s): ${chatIds.join(', ')}`);
  } else {
    console.log('ℹ  Telegram DESACTIVADO (falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_IDS en .env)');
  }
}

module.exports = { enviarMensaje, notificarEventoReserva, logEstadoInicial };