// ══════════════════════════════════════════════════════════════════
// backend/services/telegramNotifier.js
//
// Todo lo que sale y entra por Telegram.
//   - Notificaciones automáticas al administrador ante eventos de reserva.
//   - Envío de mensajes a un chat puntual (lo usa el asistente de IA).
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

// ¿Este chat pertenece a un administrador autorizado?
function esChatAutorizado(chatId) {
  const { chatIds } = leerConfig();
  return chatIds.includes(String(chatId));
}

// Fecha (Date o string) → 'YYYY-MM-DD'
function fecha(v) {
  return String(v).slice(0, 10);
}

// Llamada genérica a la API de Telegram. Nunca lanza.
async function llamarApi(metodo, cuerpo) {
  const { token } = leerConfig();
  if (!token) return null;
  if (typeof fetch !== 'function') {
    console.error('✖  Telegram: este Node no tiene fetch global (se requiere Node 18+).');
    return null;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      console.error(`✖  Telegram ${metodo}: HTTP ${res.status} ${detalle.slice(0, 200)}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`✖  Telegram ${metodo}: error de red:`, err.message);
    return null;
  }
}

// Envía un texto a UN chat concreto.
async function enviarMensajeA(chatId, texto) {
  const resultado = await llamarApi('sendMessage', {
    chat_id: chatId,
    text: texto,
    disable_web_page_preview: true,
  });
  if (resultado) console.log(`✔  Telegram: mensaje enviado a ${chatId}`);
  return resultado;
}

// Muestra "escribiendo…" en el chat mientras se procesa una respuesta.
async function mostrarEscribiendo(chatId) {
  return llamarApi('sendChatAction', { chat_id: chatId, action: 'typing' });
}

// Envía un texto a TODOS los chats configurados. Nunca lanza.
async function enviarMensaje(texto) {
  const { chatIds, habilitado } = leerConfig();

  if (!habilitado) {
    console.log('ℹ  Telegram no configurado (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_IDS). No se envía.');
    return;
  }
  await Promise.all(chatIds.map(chatId => enviarMensajeA(chatId, texto)));
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

module.exports = {
  enviarMensaje,
  enviarMensajeA,
  mostrarEscribiendo,
  notificarEventoReserva,
  esChatAutorizado,
  logEstadoInicial,
};
