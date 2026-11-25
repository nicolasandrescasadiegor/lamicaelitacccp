/* =========================================================
   Casa La Micaelita — main.js
   Índice:
   0. Utilidades y preferencias
   1. Scroll suave (Lenis + ScrollTrigger)
   2. Header y menú
   3. Hero: escenas, autoplay, teclado, rueda, swipe
   4. Modo presentación (BroadcastChannel) y pantalla completa
   5. Revelados al hacer scroll
   6. Cifras que cuentan
   7. Marquee que responde al scroll
   8. Tres gestos: scroll horizontal fijado
   9. Planos: vista previa y visor con zoom
   10. Recorrido: video que se expande
   11. Materiales: parallax
   12. Cursor personalizado
   ========================================================= */
(() => {
  'use strict';

  /* ---------- 0. Utilidades y preferencias ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const pad = n => String(n).padStart(2, '0');
  const root = document.documentElement;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  // Si el CDN no carga (sin internet), la página sigue funcionando sin animaciones de scroll.
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);
  root.classList.toggle('has-gsap', hasGSAP);

  /* ---------- 1. Scroll suave (Lenis + ScrollTrigger) ---------- */
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    if (hasGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(time => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = time => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const currentScroll = () => (lenis ? lenis.animatedScroll : window.scrollY);

  function scrollToTarget(target) {
    if (lenis) { lenis.scrollTo(target, { duration: 1.4 }); return; }
    const behavior = reduceMotion ? 'auto' : 'smooth';
    if (typeof target === 'number') window.scrollTo({ top: target, behavior });
    else target.scrollIntoView({ behavior });
  }

  // Enlaces internos (#seccion) con scroll suave
  $$('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const id = link.getAttribute('href');
      if (id.length < 2) return;
      const target = document.getElementById(id.slice(1));
      if (!target) return;
      event.preventDefault();
      closeMenu();
      scrollToTarget(id === '#inicio' ? 0 : target);
      // Mueve el foco a la sección para quien navega con teclado
      if (target.hasAttribute('tabindex')) target.focus({ preventScroll: true });
    });
  });
  $('[data-to-top]')?.addEventListener('click', () => scrollToTarget(0));

  /* ---------- 2. Header y menú ---------- */
  const header = $('[data-header]');
  const menuToggle = $('.header__toggle', header);
  const hero = $('.hero');

  // Header transparente sobre el hero; con fondo al pasar
  new IntersectionObserver(([entry]) => {
    header.classList.toggle('is-solid', !entry.isIntersecting);
  }, { rootMargin: '-72px 0px 0px 0px' }).observe(hero);

  function closeMenu() {
    if (!header.classList.contains('is-open')) return;
    header.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Abrir menú');
    lenis?.start();
  }
  menuToggle.addEventListener('click', () => {
    const open = !header.classList.contains('is-open');
    header.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    if (open) lenis?.stop(); else lenis?.start();
  });

  // Marca en el menú la sección visible
  const navLinks = $$('.header__nav a:not(.header__cta)');
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(a => a.toggleAttribute('aria-current', a.hash === '#' + entry.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach(a => { const s = document.getElementById(a.hash.slice(1)); if (s) sectionObserver.observe(s); });

  /* ---------- 3. Hero: escenas ---------- */
  const scenes = $$('.scene', hero);
  const total = scenes.length;
  const AUTOPLAY_MS = 7000;   // duración de cada escena en autoplay
  const RESUME_MS = 12000;    // tras interactuar, el autoplay espera esto antes de seguir
  let current = 0;
  let autoplay = !reduceMotion;  // con movimiento reducido no avanza solo
  let heldUntil = 0;             // momento en que se reanuda el autoplay
  let elapsed = 0;
  let heroVisible = true;

  const progressBar = $('[data-progress]', hero);
  const currentLabel = $('[data-current]', hero);
  const liveRegion = $('[data-live]', hero);
  const pauseBtn = $('[data-pause]', hero);
  $('[data-total]', hero).textContent = pad(total);

  // Miniaturas generadas a partir de cada escena
  const thumbsWrap = $('[data-thumbs]', hero);
  const thumbs = scenes.map((scene, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.setAttribute('aria-label', `Ir a la escena ${pad(i + 1)}: ${scene.dataset.title}`);
    b.innerHTML = `<img src="${scene.dataset.thumb}" alt="" loading="lazy" decoding="async">`;
    b.addEventListener('click', () => { go(i, { announce: true }); hold(); });
    thumbsWrap.append(b);
    return b;
  });

  function go(index, { announce = false } = {}) {
    const next = (index + total) % total;
    if (next === current) return;
    const prev = scenes[current];
    const el = scenes[next];

    // La escena que sale se queda debajo mientras la nueva aparece (crossfade)
    prev.classList.remove('is-active');
    prev.classList.add('is-leaving');
    prev.setAttribute('aria-hidden', 'true');
    clearTimeout(prev._leaveTimer);
    prev._leaveTimer = setTimeout(() => prev.classList.remove('is-leaving'), 1250);

    // Reinicia el Ken Burns de la escena que entra
    clearTimeout(el._leaveTimer);
    el.classList.remove('is-leaving');
    const img = $('img', el);
    img.style.animation = 'none';
    void img.offsetWidth;
    img.style.animation = '';
    el.classList.add('is-active');
    el.removeAttribute('aria-hidden');

    current = next;
    elapsed = 0;
    updateHeroUI();
    if (announce) liveRegion.textContent = `Escena ${current + 1} de ${total}: ${el.dataset.title}`;
    broadcastState();
  }

  function updateHeroUI() {
    currentLabel.textContent = pad(current + 1);
    thumbs.forEach((t, i) => t.setAttribute('aria-current', String(i === current)));
    // Mantiene visible la miniatura activa en móvil (tira con scroll)
    const t = thumbs[current];
    if (thumbsWrap.scrollWidth > thumbsWrap.clientWidth) {
      thumbsWrap.scrollTo({ left: t.offsetLeft - thumbsWrap.clientWidth / 2 + t.clientWidth / 2, behavior: 'smooth' });
    }
  }

  // Pausa el autoplay un rato después de cada interacción
  function hold() { heldUntil = performance.now() + RESUME_MS; elapsed = 0; }

  function setAutoplay(on) {
    autoplay = on;
    elapsed = 0;
    heldUntil = 0;
    pauseBtn.setAttribute('aria-pressed', String(!on));
    pauseBtn.setAttribute('aria-label', on ? 'Pausar el pase automático' : 'Reanudar el pase automático');
    broadcastState();
  }
  pauseBtn.addEventListener('click', () => setAutoplay(!autoplay));
  if (!autoplay) setAutoplay(false);

  // Bucle de autoplay + barra de progreso
  let lastTime = performance.now();
  function tick(now) {
    const dt = now - lastTime;
    lastTime = now;
    const running = autoplay && heroVisible && !document.hidden && now > heldUntil;
    if (running) {
      elapsed += dt;
      if (elapsed >= AUTOPLAY_MS) go(current + 1);
    }
    progressBar.style.transform = `scaleX(${Math.min(1, elapsed / AUTOPLAY_MS)})`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; }, { threshold: .35 }).observe(hero);

  // Flechas en pantalla
  $('[data-prev]', hero).addEventListener('click', () => { go(current - 1, { announce: true }); hold(); });
  $('[data-next]', hero).addEventListener('click', () => { go(current + 1, { announce: true }); hold(); });

  // Teclado: ← → cambian de escena cuando el hero está a la vista; F = pantalla completa
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (event.key === 'f' || event.key === 'F') { toggleFullscreen(); return; }
    const heroInView = currentScroll() < hero.offsetHeight * .5;
    if (!heroInView) return;
    if (event.key === 'ArrowRight') { go(current + 1, { announce: true }); hold(); event.preventDefault(); }
    if (event.key === 'ArrowLeft') { go(current - 1, { announce: true }); hold(); event.preventDefault(); }
  });

  // Rueda del mouse: cambia de escena (con debounce). En la última escena hacia abajo
  // (o la primera hacia arriba) deja pasar el scroll normal de la página.
  let wheelLock = 0;
  let wheelAcc = 0;
  let wheelLast = 0;
  hero.addEventListener('wheel', event => {
    if (currentScroll() > 4) return;                 // solo con el hero completo en pantalla
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const dir = Math.sign(delta);
    if (!dir) return;
    const now = performance.now();
    const atEdge = (dir > 0 && current === total - 1) || (dir < 0 && current === 0);
    if (now < wheelLock) { event.preventDefault(); event.stopPropagation(); return; }
    if (atEdge) return;                              // deja bajar a la siguiente sección
    event.preventDefault();
    event.stopPropagation();                         // evita que Lenis desplace la página
    if (now - wheelLast > 220) wheelAcc = 0;          // gesto nuevo
    wheelLast = now;
    wheelAcc += delta;
    if (Math.abs(wheelAcc) >= 40) {
      go(current + dir, { announce: true });
      hold();
      wheelAcc = 0;
      wheelLock = now + 950;                         // debounce: una escena por gesto
    }
  }, { passive: false });

  // Swipe horizontal en pantallas táctiles (el vertical sigue desplazando la página)
  let touchX = 0, touchY = 0;
  hero.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }, { passive: true });
  hero.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      go(current + (dx < 0 ? 1 : -1), { announce: true });
      hold();
    }
  }, { passive: true });

  /* ---------- 4. Modo presentación y pantalla completa ---------- */
  // remote.html y esta página se hablan por BroadcastChannel (mismo navegador, misma computadora).
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('micaelita-presentacion') : null;

  function broadcastState() {
    if (!channel) return;
    channel.postMessage({
      type: 'state',
      index: current,
      total,
      autoplay,
      scenes: scenes.map(s => ({ label: s.dataset.label, title: s.dataset.title, thumb: s.dataset.thumb }))
    });
  }

  function bringHeroIntoView() {
    if (currentScroll() > 4) scrollToTarget(0);
  }

  if (channel) {
    channel.addEventListener('message', ({ data }) => {
      if (!data || typeof data !== 'object') return;
      switch (data.type) {
        case 'hello':
          // Cuando se conecta el control remoto, el presentador toma el mando: se pausa el autoplay
          if (data.takeControl && autoplay) setAutoplay(false); else broadcastState();
          break;
        case 'go':
          if (Number.isInteger(data.index)) { bringHeroIntoView(); go(data.index); hold(); }
          break;
        case 'next': bringHeroIntoView(); go(current + 1); hold(); break;
        case 'prev': bringHeroIntoView(); go(current - 1); hold(); break;
        case 'autoplay': setAutoplay(!!data.value); break;
      }
    });
    addEventListener('pagehide', () => channel.postMessage({ type: 'bye' }));
    broadcastState();
  }

  function toggleFullscreen() {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else root.requestFullscreen().catch(() => {});
  }

  /* ---------- 5. Revelados al hacer scroll ---------- */
  if (hasGSAP) {
    // Textos por líneas (máscara de abajo hacia arriba)
    $$('[data-reveal="lines"]').forEach(el => {
      const lines = $$('.mask > *', el);
      if (reduceMotion) {
        gsap.from(lines, { opacity: 0, duration: .8, stagger: .1, scrollTrigger: { trigger: el, start: 'top 85%' } });
      } else {
        gsap.from(lines, { yPercent: 108, duration: 1.2, ease: 'expo.out', stagger: .12, scrollTrigger: { trigger: el, start: 'top 85%' } });
      }
    });

    // Elementos que aparecen con un fundido y un leve desplazamiento
    $$('[data-reveal="fade"]').forEach(el => {
      gsap.from(el, {
        opacity: 0, y: reduceMotion ? 0 : 28, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' }
      });
    });

  }

  // Imágenes con máscara (clip-path) de abajo hacia arriba.
  // En la fila horizontal se disparan con el avance horizontal (ver sección 8).
  function revealMedia(media, extraTrigger = {}) {
    if (reduceMotion) {
      return gsap.from(media, { opacity: 0, duration: 1, scrollTrigger: { trigger: media, start: 'top 85%', ...extraTrigger } });
    }
    return gsap.fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.out',
      scrollTrigger: { trigger: media, start: 'top 85%', ...extraTrigger }
    });
  }

  /* ---------- 6. Cifras que cuentan desde 0 ---------- */
  $$('[data-count]').forEach(el => {
    const end = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const format = v => v.toFixed(decimals);
    if (!hasGSAP || reduceMotion) { el.textContent = format(end); return; }
    const counter = { value: 0 };
    el.textContent = format(0);
    gsap.to(counter, {
      value: end, duration: 2.2, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      onUpdate: () => { el.textContent = format(counter.value); }
    });
  });

  /* ---------- 7. Marquee que responde al scroll ---------- */
  const marquee = $('[data-marquee]');
  if (marquee && !reduceMotion) {
    const group = marquee.firstElementChild;
    let x = 0, dir = -1, lastY = window.scrollY, lastT = performance.now();
    const BASE = 60; // px por segundo
    const loop = now => {
      const dt = Math.min(64, now - lastT) / 1000;
      lastT = now;
      // Velocidad de scroll: de Lenis si está, si no por diferencia de posición
      const y = window.scrollY;
      const v = lenis ? lenis.velocity : (y - lastY) / Math.max(dt, .001) / 60;
      lastY = y;
      if (Math.abs(v) > .3) dir = v > 0 ? -1 : 1;   // cambia de sentido según el scroll
      const speed = BASE + Math.min(Math.abs(v) * 45, 900);
      x += dir * speed * dt;
      const w = group.offsetWidth;
      if (x <= -w) x += w;
      if (x > 0) x -= w;
      marquee.style.transform = `translate3d(${x}px,0,0)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- 8. Tres gestos: scroll horizontal fijado ---------- */
  const gestures = $('.gestures');
  if (hasGSAP && gestures) {
    const mm = gsap.matchMedia();
    mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
      gestures.classList.add('is-horizontal');
      const track = $('.gestures__track', gestures);
      const distance = () => track.scrollWidth - window.innerWidth;
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: gestures,
          start: 'top top',
          end: () => '+=' + distance(),
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true
        }
      });
      // Parallax interno de cada imagen mientras pasa la fila horizontal
      $$('.gesture__media:not(.gesture__media--diagram) img', track).forEach(img => {
        gsap.fromTo(img, { xPercent: -6 }, {
          xPercent: 6, ease: 'none',
          scrollTrigger: { trigger: img.closest('.gesture'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true }
        });
      });
      // Revelado de cada imagen cuando entra por la derecha
      $$('.gesture__media', track).forEach(media => revealMedia(media, { containerAnimation: tween, start: 'left 85%' }));
      return () => gestures.classList.remove('is-horizontal');
    });
    // Móvil o movimiento reducido: sección vertical con revelados normales
    mm.add('(max-width: 900px), (prefers-reduced-motion: reduce)', () => {
      $$('.gesture__media', gestures).forEach(media => revealMedia(media));
    });
  }

  /* ---------- 9. Planos: vista previa y visor ---------- */
  const planRows = $$('.plan-row');
  const preview = $('[data-plan-preview]');
  const previewImg = $('img', preview);

  // Vista previa que sigue al mouse (solo con puntero fino)
  if (finePointer && preview) {
    const list = $('[data-plans]');
    let moveX, moveY;
    if (hasGSAP && !reduceMotion) {
      moveX = gsap.quickTo(preview, 'x', { duration: .6, ease: 'power3.out' });
      moveY = gsap.quickTo(preview, 'y', { duration: .6, ease: 'power3.out' });
    } else {
      moveX = v => { preview.style.left = v + 'px'; };
      moveY = v => { preview.style.top = v + 'px'; };
    }
    const show = on => {
      if (hasGSAP) gsap.to(preview, { autoAlpha: on ? 1 : 0, scale: on ? 1 : .92, duration: .45, ease: 'power3.out' });
      else preview.style.visibility = on ? 'visible' : 'hidden', preview.style.opacity = on ? 1 : 0;
    };
    list.addEventListener('mousemove', e => {
      // La vista previa se coloca a la derecha del cursor, sin salirse de la pantalla
      const w = preview.offsetWidth, h = preview.offsetHeight;
      const x = Math.min(e.clientX + 28, window.innerWidth - w - 16);
      const y = Math.min(Math.max(e.clientY - h / 2, 16), window.innerHeight - h - 16);
      moveX(x); moveY(y);
    });
    planRows.forEach(row => row.addEventListener('mouseenter', () => {
      if (previewImg.getAttribute('src') !== row.dataset.thumb) previewImg.src = row.dataset.thumb;
      show(true);
    }));
    list.addEventListener('mouseleave', () => show(false));
    // Precarga las vistas previas para que el cambio sea inmediato
    planRows.forEach(r => { const i = new Image(); i.src = r.dataset.thumb; });
  }

  // Visor a pantalla completa con zoom y arrastre
  const viewer = $('[data-viewer]');
  const stage = $('[data-viewer-stage]', viewer);
  const vImg = $('[data-viewer-img]', viewer);
  const vTitle = $('[data-viewer-title]', viewer);
  let planIndex = 0, opener = null;
  const view = { s: 1, x: 0, y: 0 };
  const MIN = 1, MAX = 6;

  const applyView = () => { vImg.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`; };
  const resetView = () => { view.s = 1; view.x = 0; view.y = 0; applyView(); };

  // Zoom manteniendo fijo el punto bajo el cursor (cx, cy relativos al centro del visor)
  function zoomAt(newScale, cx = 0, cy = 0) {
    const s = Math.min(MAX, Math.max(MIN, newScale));
    view.x = cx - (cx - view.x) * (s / view.s);
    view.y = cy - (cy - view.y) * (s / view.s);
    view.s = s;
    if (s === 1) { view.x = 0; view.y = 0; }
    clampView();
    applyView();
  }
  // Evita que el plano se escape del todo de la pantalla
  function clampView() {
    const r = stage.getBoundingClientRect();
    const limX = (r.width * (view.s - 1)) / 2 + r.width * .25;
    const limY = (r.height * (view.s - 1)) / 2 + r.height * .25;
    view.x = Math.max(-limX, Math.min(limX, view.x));
    view.y = Math.max(-limY, Math.min(limY, view.y));
  }
  const fromCenter = (clientX, clientY) => {
    const r = stage.getBoundingClientRect();
    return [clientX - r.left - r.width / 2, clientY - r.top - r.height / 2];
  };

  function openPlan(index) {
    planIndex = (index + planRows.length) % planRows.length;
    const row = planRows[planIndex];
    vTitle.textContent = `${row.dataset.title} · ${planIndex + 1} / ${planRows.length}`;
    vImg.alt = row.dataset.title;
    vImg.src = row.dataset.thumb;           // muestra la versión ligera mientras carga la grande
    const full = new Image();
    full.onload = () => { if (planRows[planIndex] === row) vImg.src = row.dataset.plan; };
    full.src = row.dataset.plan;
    resetView();
  }

  planRows.forEach((row, i) => row.addEventListener('click', () => {
    opener = row;
    openPlan(i);
    viewer.showModal();
    lenis?.stop();
    cursor?.classList.remove('is-visible');
  }));
  viewer.addEventListener('close', () => { lenis?.start(); opener?.focus({ preventScroll: true }); });
  $('[data-viewer-prev]', viewer).addEventListener('click', () => openPlan(planIndex - 1));
  $('[data-viewer-next]', viewer).addEventListener('click', () => openPlan(planIndex + 1));
  $$('[data-zoom]', viewer).forEach(b => b.addEventListener('click', () => {
    const z = b.dataset.zoom;
    if (z === 'reset') resetView(); else zoomAt(view.s * (z === 'in' ? 1.5 : 1 / 1.5));
  }));
  viewer.addEventListener('keydown', e => {
    if (e.key === '+' || e.key === '=') zoomAt(view.s * 1.5);
    else if (e.key === '-') zoomAt(view.s / 1.5);
    else if (e.key === '0') resetView();
    else if (e.key === 'ArrowRight') openPlan(planIndex + 1);
    else if (e.key === 'ArrowLeft') openPlan(planIndex - 1);
  });

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const [cx, cy] = fromCenter(e.clientX, e.clientY);
    zoomAt(view.s * Math.exp(-e.deltaY * .0015), cx, cy);
  }, { passive: false });
  stage.addEventListener('dblclick', e => {
    const [cx, cy] = fromCenter(e.clientX, e.clientY);
    zoomAt(view.s > 1.2 ? 1 : 2.5, cx, cy);
  });

  // Arrastre con un dedo/mouse y pellizco con dos dedos
  const pointers = new Map();
  let pinchStart = null;
  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stage.classList.add('is-dragging');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.s };
    }
  });
  stage.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      const [cx, cy] = fromCenter((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomAt(pinchStart.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.dist, cx, cy);
    } else if (pointers.size === 1) {
      view.x += e.clientX - prev.x;
      view.y += e.clientY - prev.y;
      clampView();
      applyView();
    }
  });
  const endPointer = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (!pointers.size) stage.classList.remove('is-dragging');
  };
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  /* ---------- 10. Recorrido: video que se expande ---------- */
  const tourFrame = $('[data-tour-frame]');
  if (tourFrame) {
    const video = $('video', tourFrame);
    const source = $('source', video);
    const playBtn = $('[data-tour-play]', tourFrame);
    const missing = $('[data-tour-missing]', tourFrame);

    // Si todavía no existe assets/recorrido.mp4, se muestra el marcador [DATO]
    const markMissing = () => { tourFrame.classList.add('is-missing'); missing.hidden = false; playBtn.disabled = true; };
    source.addEventListener('error', markMissing);
    video.addEventListener('error', markMissing);
    // El error pudo ocurrir antes de que cargara este script: se comprueba también ahora
    if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) markMissing();

    playBtn.addEventListener('click', () => { video.controls = true; video.play().catch(markMissing); });
    video.addEventListener('play', () => tourFrame.classList.add('is-playing'));
    video.addEventListener('pause', () => tourFrame.classList.remove('is-playing'));
    video.addEventListener('ended', () => tourFrame.classList.remove('is-playing'));

    // De tarjeta a pantalla completa con el scroll (solo transform)
    if (hasGSAP && !reduceMotion) {
      gsap.fromTo(tourFrame, { scale: () => (window.innerWidth < 700 ? .86 : .6), borderRadius: 18 }, {
        scale: 1, borderRadius: 0, ease: 'none',
        scrollTrigger: { trigger: '[data-tour]', start: 'top top', end: '+=90%', pin: true, scrub: 1, invalidateOnRefresh: true }
      });
    }
  }

  /* ---------- 11. Materiales: parallax suave ---------- */
  const parallaxImg = $('[data-parallax]');
  if (hasGSAP && parallaxImg && !reduceMotion) {
    gsap.fromTo(parallaxImg, { yPercent: -7 }, {
      yPercent: 7, ease: 'none',
      scrollTrigger: { trigger: '.materials', start: 'top bottom', end: 'bottom top', scrub: true }
    });
  }

  /* ---------- 12. Cursor personalizado (solo escritorio) ---------- */
  let cursor = null;
  if (finePointer) {
    cursor = document.createElement('div');
    cursor.className = 'cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<span></span>';
    document.body.append(cursor);
    root.classList.add('has-cursor');
    const label = $('span', cursor);
    let cx, cy;
    if (hasGSAP && !reduceMotion) {
      cx = gsap.quickTo(cursor, 'x', { duration: .35, ease: 'power3.out' });
      cy = gsap.quickTo(cursor, 'y', { duration: .35, ease: 'power3.out' });
    } else {
      cx = v => { cursor.style.left = v + 'px'; };
      cy = v => { cursor.style.top = v + 'px'; };
    }
    addEventListener('mousemove', e => {
      cx(e.clientX); cy(e.clientY);
      if (!viewer.open) cursor.classList.add('is-visible');
    });
    document.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
    document.addEventListener('mouseover', e => {
      const withLabel = e.target.closest('[data-cursor]');
      const link = e.target.closest('a, button, .thumb');
      cursor.classList.toggle('is-label', !!withLabel);
      cursor.classList.toggle('is-link', !withLabel && !!link);
      label.textContent = withLabel ? withLabel.dataset.cursor : '';
    });
  }

  // Recalcula las posiciones cuando cargan las fuentes e imágenes
  if (hasGSAP) {
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    addEventListener('load', () => ScrollTrigger.refresh());
  }
})();
