require('dotenv').config();
const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');

// ---------- Настройки (берутся из переменных окружения Render) ----------
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const OLLAMA_URL = (process.env.OLLAMA_URL || 'https://ollama.com').replace(/\/+$/, '');
const OLLAMA_API_KEY = (process.env.OLLAMA_API_KEY || '').trim().replace(/^["']|["']$/g, '');
const MODEL = (process.env.MODEL || 'gpt-oss:20b').trim();
const TIMEOUT_MS = 90 * 1000;
const IS_CLOUD = !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(OLLAMA_URL);

const SYSTEM_PROMPT =
  'Ты Atlas Intelligence (AtlasAI) — дружелюбный и точный ИИ-ассистент. ' +
  'Отвечай на том языке, на котором пишет пользователь: русском, казахском или английском. ' +
  'Если язык непонятен, отвечай по-русски. ' +
  'Код оформляй блоками ``` с названием языка. Для выделения используй **жирный**, ' +
  'не используй заголовки с # и таблицы.';

if (IS_CLOUD && !OLLAMA_API_KEY) {
  console.error('ВНИМАНИЕ: не задан OLLAMA_API_KEY. Добавьте его в Render → Environment.');
}

const app = express();
app.set('trust proxy', 1); // Render стоит за прокси: нужно для лимита запросов
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  message: { error: 'Слишком много запросов. Подождите минуту.' }
}));

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (OLLAMA_API_KEY) headers['Authorization'] = 'Bearer ' + OLLAMA_API_KEY;
  return headers;
}

// Понятное объяснение причины ошибки
function explain(status, detail) {
  if (status === 401 || status === 403) return 'Ollama не принял ключ (код ' + status + '). Проверьте OLLAMA_API_KEY в Render.';
  if (status === 404) return 'Модель «' + MODEL + '» не найдена в Ollama Cloud (код 404). Откройте /api/health и выберите модель из списка.';
  if (status === 429) return 'Достигнут лимит бесплатного тарифа Ollama (код 429). Подождите или выберите другую модель.';
  if (status >= 500) return 'Сервер Ollama временно недоступен (код ' + status + '). Попробуйте позже.';
  return 'Ollama вернул ошибку ' + status + (detail ? ': ' + detail : '');
}

// ---------- Чат ----------
app.post('/api/chat', async (req, res) => {
  if (IS_CLOUD && !OLLAMA_API_KEY) {
    return res.status(500).json({ error: 'На сервере не задан OLLAMA_API_KEY.' });
  }

  const raw = Array.isArray(req.body.messages) ? req.body.messages : [];
  const messages = raw
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-20);
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length) return res.status(400).json({ error: 'Пустой запрос.' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(OLLAMA_URL + '/api/chat', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        stream: false
      }),
      signal: controller.signal
    });

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 300);
      console.error('Ollama ответил ' + upstream.status + ':', detail);
      return res.status(502).json({ error: explain(upstream.status, detail) });
    }

    const data = await upstream.json();
    const text = data && data.message && data.message.content ? data.message.content.trim() : '';
    if (!text) {
      console.error('Пустой ответ модели:', JSON.stringify(data).slice(0, 300));
      return res.status(502).json({ error: 'Модель вернула пустой ответ. Попробуйте ещё раз или смените модель.' });
    }
    res.json({ text });
  } catch (err) {
    const code = err.name === 'AbortError' ? 'timeout' : (err.cause && err.cause.code) || err.message;
    console.error('Не удалось связаться с Ollama:', code);
    const msg = err.name === 'AbortError'
      ? 'Ollama не ответил за ' + TIMEOUT_MS / 1000 + ' секунд. Попробуйте ещё раз.'
      : 'Нет связи с Ollama (' + code + '). Проверьте OLLAMA_URL.';
    res.status(502).json({ error: msg });
  } finally {
    clearTimeout(timer);
  }
});

// ---------- Диагностика: откройте /api/health в браузере ----------
app.get('/api/health', async (req, res) => {
  const info = { server: 'ok', ollamaUrl: OLLAMA_URL, model: MODEL, keySet: Boolean(OLLAMA_API_KEY) };
  try {
    const r = await fetch(OLLAMA_URL + '/api/tags', { headers: authHeaders(), signal: AbortSignal.timeout(15000) });
    info.ollamaStatus = r.status;
    if (r.ok) {
      const d = await r.json();
      const names = (d.models || []).map((m) => m.name || m.model);
      info.modelAvailable = names.includes(MODEL);
      info.models = names.slice(0, 40);
    } else {
      info.detail = (await r.text()).slice(0, 200);
    }
  } catch (err) {
    info.error = (err.cause && err.cause.code) || err.message;
  }
  res.json(info);
});

app.listen(PORT, HOST, () => {
  console.log('Atlas Intelligence запущен на ' + HOST + ':' + PORT);
  console.log('Ollama: ' + OLLAMA_URL + ' | модель: ' + MODEL + ' | ключ задан: ' + Boolean(OLLAMA_API_KEY));
});
