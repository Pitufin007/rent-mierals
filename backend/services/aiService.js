// ══════════════════════════════════════════════════════════════════
// backend/services/aiService.js
//
// Cliente de IA del sistema. Es el único lugar del proyecto que habla
// con el modelo de lenguaje; el resto de la aplicación lo usa a través
// de la función `preguntar()`.
//
// Diseño:
//  - Soporta DOS proveedores para no quedar amarrado a uno solo
//    (los planes gratuitos cambian seguido):
//      * gemini   → Google AI Studio (free tier amplio)
//      * openai   → cualquier API compatible con OpenAI (Groq, OpenRouter…)
//    Se elige con la variable IA_PROVEEDOR.
//  - A prueba de fallos: NUNCA lanza. Si la IA falla o no está
//    configurada, devuelve null y la app sigue funcionando normal.
//  - Timeout: si el modelo demora demasiado, se aborta (no deja
//    peticiones colgadas).
//  - Lee las variables de entorno en cada llamada, para no depender del
//    orden en que se cargue dotenv.
//  - Sin dependencias nuevas: usa fetch nativo (Node 18+).
// ══════════════════════════════════════════════════════════════════

const TIMEOUT_MS = 25000;

function leerConfig() {
  const proveedor = (process.env.IA_PROVEEDOR || 'gemini').toLowerCase().trim();
  const apiKey = process.env.IA_API_KEY;
  // Se usa el alias "-latest" a propósito: apunta siempre a la versión
  // vigente de Gemini Flash, así el código no se rompe cuando Google
  // retira una versión concreta (que es justo lo que pasa seguido).
  const modelo = process.env.IA_MODELO || (proveedor === 'gemini' ? 'gemini-flash-latest' : 'llama-3.3-70b-versatile');
  const baseUrl = process.env.IA_BASE_URL || 'https://api.groq.com/openai/v1';
  return { proveedor, apiKey, modelo, baseUrl, habilitada: Boolean(apiKey) };
}

function estaHabilitada() {
  return leerConfig().habilitada;
}

// Ejecuta un fetch con límite de tiempo.
async function fetchConTimeout(url, opciones) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opciones, signal: control.signal });
  } finally {
    clearTimeout(temporizador);
  }
}

// ── Google Gemini ───────────────────────────────────────────────────
async function preguntarGemini({ apiKey, modelo, instruccion, mensajes, temperatura, maxTokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;

  // Gemini usa 'model' en lugar de 'assistant' para los turnos del bot.
  const contents = mensajes.map(m => ({
    role: m.rol === 'asistente' ? 'model' : 'user',
    parts: [{ text: m.texto }],
  }));

  const res = await fetchConTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: instruccion }] },
      contents,
      generationConfig: { temperature: temperatura, maxOutputTokens: maxTokens },
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status} ${detalle.slice(0, 300)}`);
  }

  const data = await res.json();
  const candidato = data?.candidates?.[0];
  const partes = candidato?.content?.parts || [];
  const texto = partes.map(p => p.text || '').join('').trim();

  // Si vino vacío, el motivo importa para poder corregirlo.
  if (!texto) {
    const motivo = candidato?.finishReason || data?.promptFeedback?.blockReason || 'desconocido';
    if (motivo === 'MAX_TOKENS') {
      console.error('✖  IA: el modelo agotó el presupuesto de tokens "pensando" y no alcanzó a');
      console.error('   escribir la respuesta. Sube maxTokens o baja el tamaño del contexto.');
    } else {
      console.error(`✖  IA: el modelo devolvió una respuesta vacía (motivo: ${motivo}).`);
    }
    return null;
  }

  return texto;
}

// ── APIs compatibles con OpenAI (Groq, OpenRouter, etc.) ────────────
async function preguntarOpenAICompatible({ apiKey, modelo, baseUrl, instruccion, mensajes, temperatura, maxTokens }) {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const messages = [
    { role: 'system', content: instruccion },
    ...mensajes.map(m => ({
      role: m.rol === 'asistente' ? 'assistant' : 'user',
      content: m.texto,
    })),
  ];

  const res = await fetchConTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelo, messages, temperature: temperatura, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`IA HTTP ${res.status} ${detalle.slice(0, 300)}`);
  }

  const data = await res.json();
  return (data?.choices?.[0]?.message?.content || '').trim() || null;
}

/**
 * Hace una consulta al modelo de lenguaje.
 *
 * @param {string} instruccion  Instrucción de sistema (define el rol y las reglas).
 * @param {Array}  mensajes     [{ rol: 'usuario'|'asistente', texto: '...' }]
 * @param {object} opciones     { temperatura, maxTokens }
 * @returns {Promise<string|null>} La respuesta, o null si falló / no está configurada.
 */
async function preguntar(instruccion, mensajes, opciones = {}) {
  const { proveedor, apiKey, modelo, baseUrl, habilitada } = leerConfig();

  if (!habilitada) {
    console.log('ℹ  IA no configurada (falta IA_API_KEY). No se consulta al modelo.');
    return null;
  }
  if (typeof fetch !== 'function') {
    console.error('✖  IA: este Node no tiene fetch global (se requiere Node 18+).');
    return null;
  }

  const temperatura = opciones.temperatura ?? 0.3;
  // Presupuesto amplio a propósito: los modelos actuales gastan parte de
  // estos tokens 'pensando' antes de responder, y si se quedan cortos
  // devuelven la respuesta vacía.
  const maxTokens = opciones.maxTokens ?? 2048;
  const lista = Array.isArray(mensajes) ? mensajes : [{ rol: 'usuario', texto: String(mensajes) }];

  try {
    const inicio = Date.now();
    const texto = proveedor === 'gemini'
      ? await preguntarGemini({ apiKey, modelo, instruccion, mensajes: lista, temperatura, maxTokens })
      : await preguntarOpenAICompatible({ apiKey, modelo, baseUrl, instruccion, mensajes: lista, temperatura, maxTokens });

    console.log(`✔  IA (${proveedor}/${modelo}) respondió en ${Date.now() - inicio} ms`);
    return texto;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`✖  IA: la consulta superó el tiempo límite (${TIMEOUT_MS} ms).`);
    } else {
      console.error('✖  IA:', err.message);
    }
    return null;
  }
}

// Diagnóstico al arrancar el servidor (clave enmascarada).
function logEstadoInicial() {
  const { proveedor, apiKey, modelo, habilitada } = leerConfig();
  if (habilitada) {
    const k = apiKey.slice(0, 4) + '…' + apiKey.slice(-4);
    console.log(`✔  IA ACTIVA — proveedor: ${proveedor}, modelo: ${modelo}, clave ${k}`);
  } else {
    console.log('ℹ  IA DESACTIVADA (falta IA_API_KEY en .env)');
  }
}

module.exports = { preguntar, estaHabilitada, logEstadoInicial };
