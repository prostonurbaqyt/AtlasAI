
const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();

const PORT = 3000;
const OLLAMA_URL = 'http://127.0.0.1:11434';
const MODEL = 'qwen2.5:7b';

const SYSTEM_PROMPT = `
Ты Atlas Intelligence — современный ИИ-помощник.

ГЛАВНОЕ ПРАВИЛО — ЯЗЫК:
1. Всегда отвечай на том же языке, на котором пишет пользователь.
2. Русский вопрос — ответ полностью на русском.
3. Казахский вопрос — ответ полностью на казахском.
4. Английский вопрос — ответ полностью на английском.
5. Никогда не смешивай языки без просьбы пользователя.
6. Не вставляй случайные приветствия на других языках.
7. Если пользователь пишет на смешанном языке, используй язык, преобладающий в сообщении.
8. Не переключай язык посреди ответа.

СТИЛЬ ОБЩЕНИЯ:
- Разговаривай естественно и дружелюбно.
- Не используй шаблонные приветствия в каждом сообщении.
- Отвечай прямо на вопрос.
- Не повторяй вопрос пользователя.
- Объясняй сложные вещи простыми словами.
- Не придумывай факты.
- Если не знаешь ответа, честно скажи об этом.
- Код оформляй в Markdown-блоках.
- Не делай ответы длиннее, чем необходимо.

Ты — Atlas Intelligence. Всегда сохраняй свою идентичность.
`;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  message: {
    error: 'Слишком много запросов. Подождите минуту.'
  }
}));

app.post('/api/chat', async (req, res) => {
  try {
    const rawMessages = Array.isArray(req.body?.messages)
      ? req.body.messages
      : [];

    const messages = rawMessages
      .filter(message =>
        message &&
        ['user', 'assistant'].includes(message.role) &&
        typeof message.content === 'string' &&
        message.content.trim()
      )
      .slice(-20)
      .map(message => ({
        role: message.role,
        content: message.content.slice(0, 4000)
      }));

    while (messages.length && messages[0].role !== 'user') {
      messages.shift();
    }

    if (!messages.length) {
      return res.status(400).json({
        error: 'Пустой запрос.'
      });
    }

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        options: {
          temperature: 0.5
        },
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          ...messages
        ]
      })
    });

    if (!response.ok) {
      throw new Error('Ollama error: ' + response.status);
    }

    const data = await response.json();

    return res.json({
      text: data.message?.content || 'Модель не вернула ответ.'
    });

  } catch (error) {
    console.error('Ошибка Atlas:', error.message);

    return res.status(500).json({
      error: 'Не удалось получить ответ от Atlas. Проверьте Ollama.'
    });
  }
});

app.listen(PORT, () => {
  console.log(
    'Atlas Intelligence запущен: http://localhost:' + PORT
  );
});

