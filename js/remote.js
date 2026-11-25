/* =========================================================
   Casa La Micaelita — remote.js
   Control remoto del modo presentación.
   Habla con index.html por BroadcastChannel:
     - envía: hello, next, prev, go {index}, autoplay {value}
     - recibe: state {index, total, autoplay, scenes}, bye
   ========================================================= */
(() => {
  'use strict';
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const pad = n => String(n).padStart(2, '0');

  const statusEl = $('[data-status]');
  const waiting = $('[data-waiting]');
  const panel = $('[data-panel]');
  const thumbsWrap = $('[data-thumbs]');
  const autoplayBtn = $('[data-autoplay]');

  if (!('BroadcastChannel' in window)) {
    statusEl.textContent = 'Este navegador no permite el modo presentación';
    return;
  }

  const channel = new BroadcastChannel('micaelita-presentacion');
  let state = null;
  let lastSeen = 0;
  let firstContact = true;
  const send = msg => channel.postMessage(msg);

  // ---------- Recibir el estado de la presentación ----------
  channel.addEventListener('message', ({ data }) => {
    if (!data || typeof data !== 'object') return;
    if (data.type === 'bye') { setConnected(false); return; }
    if (data.type !== 'state' || !Array.isArray(data.scenes)) return;
    lastSeen = Date.now();
    const needsThumbs = !state || state.total !== data.total;
    state = data;
    setConnected(true);
    if (needsThumbs) buildThumbs();
    render();
  });

  function setConnected(on) {
    statusEl.textContent = on ? 'Conectado a la presentación' : 'Buscando la presentación…';
    statusEl.classList.toggle('is-on', on);
    waiting.hidden = on;
    panel.hidden = !on;
    if (!on) { state = null; firstContact = true; }
  }

  // ---------- Dibujar el panel ----------
  function buildThumbs() {
    thumbsWrap.textContent = '';
    state.scenes.forEach((scene, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'remote__thumb';
      b.setAttribute('aria-label', `Mostrar ${scene.label}`);
      const img = document.createElement('img');
      img.src = scene.thumb; img.alt = ''; img.loading = 'lazy';
      const span = document.createElement('span');
      span.className = 'label';
      span.textContent = scene.label;
      b.append(img, span);
      b.addEventListener('click', () => send({ type: 'go', index: i }));
      thumbsWrap.append(b);
    });
  }

  function render() {
    const { index, total, scenes, autoplay } = state;
    const now = scenes[index];
    const next = scenes[(index + 1) % total];
    $('[data-now-count]').textContent = `${pad(index + 1)} / ${pad(total)}`;
    $('[data-now-title]').textContent = now.title;
    $('[data-now-img]').src = now.thumb.replace('-400', '-800');
    $('[data-next-img]').src = next.thumb;
    $('[data-next-title]').textContent = next.label;
    document.title = `${pad(index + 1)} / ${pad(total)} — ${now.title} · Control remoto`;
    [...thumbsWrap.children].forEach((t, i) => t.setAttribute('aria-current', String(i === index)));
    autoplayBtn.setAttribute('aria-pressed', String(autoplay));
    autoplayBtn.textContent = `Autoplay: ${autoplay ? 'encendido' : 'apagado'}`;
  }

  // ---------- Enviar órdenes ----------
  document.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => send({ type: b.dataset.cmd })));
  autoplayBtn.addEventListener('click', () => state && send({ type: 'autoplay', value: !state.autoplay }));
  $('[data-open]').addEventListener('click', () => window.open('index.html', 'micaelita-proyector'));

  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || !state) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { send({ type: 'next' }); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { send({ type: 'prev' }); e.preventDefault(); }
  });

  // ---------- Buscar la presentación ----------
  // Al conectar por primera vez, el control toma el mando (pausa el autoplay).
  function hello() {
    send({ type: 'hello', takeControl: firstContact });
    if (state) firstContact = false;
  }
  hello();
  setInterval(() => {
    if (!state || Date.now() - lastSeen > 6000) {
      if (state) setConnected(false);
      hello();
    }
  }, 2000);
  // Mantiene viva la conexión pidiendo el estado de vez en cuando
  setInterval(() => { if (state) send({ type: 'hello' }); }, 4000);
})();
