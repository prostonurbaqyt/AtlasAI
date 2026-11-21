(() => {
  const $ = (s) => document.querySelector(s);
  const app = $('.app'), list = $('#chat-list'), chat = $('#chat'), msgs = $('#messages'), welcome = $('#welcome');
  const form = $('#chat-form'), input = $('#message-input'), sendBtn = $('#send-btn'), down = $('#scroll-down');
  const KEY = 'atlas-ai-chats';
  const ico = (n) => `<svg><use href="#i-${n}"/></svg>`;

  let chats = [], activeId = null, busy = false;
  try { chats = JSON.parse(localStorage.getItem(KEY)) || []; } catch { chats = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(chats)); } catch {} };
  const active = () => chats.find((c) => c.id === activeId);

  /* ---------- форматирование текста ---------- */
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function format(text) {
    const parts = text.split(/```(\w*)\n?([\s\S]*?)```/g);
    let html = '';
    for (let i = 0; i < parts.length; i += 3) {
      html += esc(parts[i]).split(/\n{2,}/).filter(Boolean).map((p) =>
        '<p>' + p.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</p>').join('');
      if (i + 2 < parts.length) {
        html += `<pre><div class="pre__bar"><span>${esc(parts[i + 1] || 'code')}</span><button class="tool" data-copy="code">${ico('copy')}Копировать</button></div><code>${esc(parts[i + 2].trim())}</code></pre>`;
      }
    }
    return html;
  }

  /* ---------- отрисовка ---------- */
  function groupOf(t) {
    const d = (Date.now() - t) / 864e5;
    return d < 1 ? 'Сегодня' : d < 7 ? 'За 7 дней' : 'Ранее';
  }
  function renderList() {
    const q = $('#search').value.trim().toLowerCase();
    const items = chats.filter((c) => c.title.toLowerCase().includes(q)).sort((a, b) => b.t - a.t);
    if (!items.length) { list.innerHTML = `<li class="empty">${q ? 'Ничего не найдено' : 'Пока нет чатов'}</li>`; return; }
    let last = '', html = '';
    items.forEach((c) => {
      const g = groupOf(c.t);
      if (g !== last) { html += `<li class="group">${g}</li>`; last = g; }
      html += `<li class="item${c.id === activeId ? ' active' : ''}" data-id="${c.id}">${ico('chat')}<span>${esc(c.title)}</span><button class="del" data-del="${c.id}" aria-label="Удалить чат">${ico('trash')}</button></li>`;
    });
    list.innerHTML = html;
  }
  function msgHTML(m) {
    const bot = m.role === 'assistant';
    return `<div class="msg msg--${bot ? 'ai' : 'user'}"><div class="msg__ava">${ico('logo')}</div><div class="msg__body"><div class="msg__text">${bot ? format(m.text) : esc(m.text).replace(/\n/g, '<br>')}</div>${bot ? `<div class="msg__tools"><button class="tool" data-copy="msg">${ico('copy')}Копировать</button></div>` : ''}</div></div>`;
  }
  function renderChat() {
    const c = active();
    welcome.classList.toggle('hide', !!(c && c.msgs.length));
    msgs.innerHTML = c ? c.msgs.map(msgHTML).join('') : '';
    toBottom(false);
  }
  const toBottom = (smooth = true) => chat.scrollTo({ top: chat.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });

  /* ---------- чаты ---------- */
  function newChat() {
    const empty = chats.find((c) => !c.msgs.length);
    if (empty) { activeId = empty.id; }
    else { const c = { id: 'c' + Date.now(), title: 'Новый чат', msgs: [], t: Date.now() }; chats.push(c); activeId = c.id; }
    renderList(); renderChat(); closeMenu(); input.focus();
  }
  function removeChat(id) {
    chats = chats.filter((c) => c.id !== id); save();
    if (activeId === id) { activeId = chats.length ? chats.sort((a, b) => b.t - a.t)[0].id : null; if (!activeId) return newChat(); }
    renderList(); renderChat();
  }

  /* ---------- ответы (демо: замените на вызов вашего API) ---------- */
  function demoReply(q) {
    const s = q.toLowerCase();
    if (/(js|javascript|код|функци|массив)/.test(s))
      return 'Вот короткое решение — `Set` хранит только уникальные значения:\n\n```javascript\nconst unique = (arr) => [...new Set(arr)];\n\nconsole.log(unique([1, 2, 2, 3, 3, 3]));\n// [1, 2, 3]\n```\n\nДля массива объектов используйте **Map** с ключом, например `id`.';
    if (/(план|собеседован|неделю|дн)/.test(s))
      return '**План на 7 дней**\n\n**День 1–2.** Повторите базу и разберите своё резюме.\n\n**День 3–4.** Решайте практические задачи и тренируйте ответы вслух.\n\n**День 5.** Изучите компанию и подготовьте вопросы к интервьюеру.\n\n**День 6.** Пробное собеседование с другом.\n\n**День 7.** Отдых и лёгкое повторение. Сон важнее новой теории.';
    if (/(нейросет|объясни|как работает)/.test(s))
      return 'Нейросеть — это набор простых вычислительных «нейронов», связанных между собой.\n\nОна получает данные, пропускает их через слои и выдаёт результат. Сначала ответы случайны, но после тысяч примеров сеть **подстраивает веса связей** и начинает ошибаться реже.\n\nПредставьте ученика, который решает много задач и каждый раз сверяется с ответом.';
    if (/(назван|идеи|придумай)/.test(s))
      return '**Идеи названий:**\n\n1. Дыхание\n2. Тихий день\n3. Штиль\n4. Моментум\n5. Сфера покоя\n6. Нирвана Go\n7. Поток\n8. Пауза\n9. Лотос\n10. Эхо\n\nМогу сузить список под вашу аудиторию.';
    return 'Это демо-ответ Atlas AI. Интерфейс уже готов: чаты, история, поиск и копирование.\n\nЧтобы подключить настоящую модель, замените функцию `reply()` в `script.js` на запрос к вашему API.';
  }

  /* ---------- запрос к серверу Atlas AI ---------- */
  async function reply() {
    const history = active().msgs.map(({ role, text }) => ({ role, content: text }));
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
      return data.text;
    } catch (err) {
      return 'Не удалось получить ответ: ' + err.message;
    }
  }

  async function send(text) {
    if (busy || !text.trim()) return;
    if (!active()) newChat();
    const c = active();
    c.msgs.push({ role: 'user', text }); c.t = Date.now();
    if (c.msgs.length === 1) c.title = text.length > 34 ? text.slice(0, 34) + '…' : text;
    welcome.classList.add('hide');
    msgs.insertAdjacentHTML('beforeend', msgHTML({ role: 'user', text }));
    msgs.insertAdjacentHTML('beforeend', `<div class="msg msg--ai"><div class="msg__ava">${ico('logo')}</div><div class="msg__body"><div class="msg__text"><span class="typing"><i></i><i></i><i></i></span></div></div></div>`);
    const bubble = msgs.lastElementChild.querySelector('.msg__text');
    input.value = ''; resize(); busy = true; renderList(); toBottom();

    const full = await reply();
    for (let i = 0; i < full.length; i += 3) {
      bubble.innerHTML = format(full.slice(0, i + 3));
      if (i % 30 === 0 && nearBottom()) toBottom(false);
      await new Promise((r) => setTimeout(r, 14));
    }
    bubble.innerHTML = format(full);
    bubble.parentElement.insertAdjacentHTML('beforeend', `<div class="msg__tools"><button class="tool" data-copy="msg">${ico('copy')}Копировать</button></div>`);
    c.msgs.push({ role: 'assistant', text: full }); save();
    busy = false; sync(); if (nearBottom()) toBottom();
  }

  /* ---------- интерфейс ---------- */
  const nearBottom = () => chat.scrollHeight - chat.scrollTop - chat.clientHeight < 160;
  function resize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 180) + 'px'; sync(); }
  const sync = () => { sendBtn.disabled = busy || !input.value.trim(); };
  const closeMenu = () => app.classList.remove('open');

  input.addEventListener('input', resize);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
  chat.addEventListener('scroll', () => { down.hidden = nearBottom(); });
  down.addEventListener('click', () => toBottom());

  $('#new-chat').addEventListener('click', newChat);
  $('#open-sidebar').addEventListener('click', () => app.classList.add('open'));
  $('#close-sidebar').addEventListener('click', closeMenu);
  $('#overlay').addEventListener('click', closeMenu);
  $('#search').addEventListener('input', renderList);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  $('#clear-all').addEventListener('click', () => {
    if (chats.length && confirm('Удалить всю историю чатов?')) { chats = []; activeId = null; save(); newChat(); }
  });

  $('#suggestions, .cards').addEventListener('click', (e) => {
    const b = e.target.closest('[data-prompt]'); if (b) send(b.dataset.prompt);
  });
  list.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) return removeChat(del.dataset.del);
    const it = e.target.closest('.item');
    if (it) { activeId = it.dataset.id; renderList(); renderChat(); closeMenu(); }
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const el = b.dataset.copy === 'code' ? b.closest('pre').querySelector('code') : b.closest('.msg__body').querySelector('.msg__text');
    try { await navigator.clipboard.writeText(el.innerText); } catch {}
    const old = b.innerHTML; b.innerHTML = ico('check') + 'Готово';
    setTimeout(() => (b.innerHTML = old), 1400);
  });

  if (!chats.length) newChat();
  else { activeId = chats.sort((a, b) => b.t - a.t)[0].id; renderList(); renderChat(); }
  sync();
})();

/* Эффект подсветки карточек за курсором */
(() => {
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest && e.target.closest('.card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', e.clientX - r.left + 'px');
    card.style.setProperty('--my', e.clientY - r.top + 'px');
  });
})();

/* 3D-наклон карточек и параллакс шаров за курсором */
(() => {
  const root = document.documentElement;
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    root.style.setProperty('--px', (e.clientX / innerWidth - 0.5).toFixed(3));
    root.style.setProperty('--py', (e.clientY / innerHeight - 0.5).toFixed(3));
    const card = e.target.closest && e.target.closest('.card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty('--ry', (x * 16).toFixed(1) + 'deg');
    card.style.setProperty('--rx', (-y * 16).toFixed(1) + 'deg');
  });
  document.addEventListener('pointerout', (e) => {
    const card = e.target.closest && e.target.closest('.card');
    if (card && !card.contains(e.relatedTarget)) {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    }
  });
})();