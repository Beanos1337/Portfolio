const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
let lenis = null; // smooth scroll, set in run(); the image viewer pauses it

// ---------- always on (no animation library needed) ----------
const clock = document.querySelector('.clock');
const tick = () => { clock.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' }).format(new Date()); };
tick(); setInterval(tick, 15000);

document.querySelectorAll('[data-copy]').forEach((btn) => {
  const label = btn.textContent;
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(btn.dataset.copy); btn.textContent = 'Copied ✓'; }
    catch { btn.textContent = btn.dataset.copy; } // no clipboard permission: show it so it can be selected
    setTimeout(() => { btn.textContent = label; }, 2000);
  });
});

dotField(document.querySelector('.hero-canvas'));
imageViewer();

const motion = !reduce && window.gsap && window.ScrollTrigger && !root.classList.contains('no-motion');
if (!motion) {
  root.classList.add('no-motion', 'ready');
} else {
  root.classList.add('motion');
  run();
}

// ---------- animations ----------
function run() {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  // Smooth scroll (skipped if Lenis failed to load: native scroll still works).
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.09 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target || !lenis) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: a.getAttribute('href') === '#top' ? 0 : -20, duration: 1.6 });
  }));

  // Split headings into masked chars/words.
  const splits = new Map();
  document.querySelectorAll('[data-split]').forEach((el) => splits.set(el, split(el, el.dataset.split)));

  // Loader: count to 100, lift the curtain, then the name rises in.
  const heroChars = [...document.querySelectorAll('.hero-name [data-split]')].flatMap((el) => splits.get(el));
  gsap.set(heroChars, { yPercent: 110 });
  const num = document.querySelector('.loader-num'), bar = document.querySelector('.loader-bar i');
  const count = { v: 0 };
  gsap.timeline()
    .to(count, { v: 100, duration: 1.6, ease: 'power2.inOut', onUpdate: () => { num.textContent = Math.round(count.v); bar.style.width = count.v + '%'; } })
    .to('.loader', { yPercent: -100, duration: 1, ease: 'expo.inOut' }, '+=.1')
    .call(() => { root.classList.add('ready'); lenis?.start(); }, null, '-=.5') // let people scroll as soon as the curtain lifts
    .to(heroChars, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.035 }, '-=.45')
    .to('[data-hero-fade]', { opacity: 1, duration: 1.2, stagger: 0.1 }, '-=1')
    .set('.loader', { display: 'none' });

  // Hero drifts up and fades as you scroll away.
  gsap.to('.hero-inner', { yPercent: -18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // Section and project headings rise word by word.
  splits.forEach((parts, el) => {
    if (el.closest('.hero-name')) return;
    gsap.from(parts, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  // Generic fade-up reveals.
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });

  // Statement: words light up as you scroll through it.
  const words = split(document.querySelector('[data-scrub-words]'), 'words', false);
  gsap.fromTo(words, { opacity: 0.12 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: '.statement', start: 'top 75%', end: 'bottom 60%', scrub: true } });

  // Screenshots: wipe in, settle from a zoom, then drift at their own speed.
  gsap.utils.toArray('.shot').forEach((shot) => {
    const img = shot.querySelector('img');
    gsap.timeline({ scrollTrigger: { trigger: shot, start: 'top 92%' } })
      .fromTo(shot, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut' })
      .from(img, { scale: 1.25, duration: 1.8, ease: 'expo.out' }, 0);
    const speed = +shot.dataset.speed || 0;
    if (speed && innerWidth > 640) gsap.to(shot, { yPercent: -speed, ease: 'none', scrollTrigger: { trigger: shot, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Big outlined project numbers slide sideways.
  gsap.utils.toArray('.project-index').forEach((el) => {
    gsap.fromTo(el, { xPercent: -30 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 40%', scrub: true } });
  });

  // Experience: the top rule draws across.
  gsap.to('.timeline-line', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.timeline', start: 'top 85%', end: 'top 35%', scrub: true } });

  // Marquee speeds up and reverses with scroll velocity.
  const track = document.querySelector('.marquee-track');
  const loop = gsap.to(track, { xPercent: -50, duration: 40, ease: 'none', repeat: -1 });
  let dir = 1;
  ScrollTrigger.create({
    onUpdate: (self) => {
      dir = self.direction;
      gsap.to(loop, { timeScale: dir * Math.min(6, 1 + Math.abs(self.getVelocity()) / 300), duration: 0.2, overwrite: true });
      gsap.to(loop, { timeScale: dir, duration: 1.2, delay: 0.2, ease: 'power2.out' });
    }
  });

  // Nav hides while scrolling down, comes back on the way up.
  const nav = document.querySelector('.nav');
  ScrollTrigger.create({ start: 120, onUpdate: (self) => nav.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 400) });

  // Magnetic links and buttons.
  if (finePointer) document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, .4)' });
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, .4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * 0.35);
      y((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => { x(0); y(0); });
  });

  // Custom cursor (mouse/trackpad only).
  if (finePointer) {
    root.classList.add('has-cursor');
    const cursor = document.querySelector('.cursor');
    const dot = cursor.querySelector('.cursor-dot'), ring = cursor.querySelector('.cursor-ring');
    const dx = gsap.quickTo(dot, 'x', { duration: 0.1 }), dy = gsap.quickTo(dot, 'y', { duration: 0.1 });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
    gsap.set([dot, ring], { x: -100, y: -100 });
    addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); });
    document.addEventListener('pointerover', (e) => cursor.classList.toggle('is-hover', !!e.target.closest('a, button, .shot, .viewer-img')));
    document.addEventListener('pointerleave', () => gsap.set([dot, ring], { x: -100, y: -100 }));
  }

  // Images change layout height as they load; keep trigger positions right.
  addEventListener('load', () => ScrollTrigger.refresh());
}

/** Click a screenshot: it lifts out of its frame and glides to the centre, the page blurs and stops scrolling. */
function imageViewer() {
  const overlay = document.createElement('div');
  overlay.className = 'viewer';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Enlarged image');
  overlay.innerHTML = '<button class="viewer-close mono" type="button">Close <span aria-hidden="true">✕</span></button>';
  document.body.append(overlay);
  const closeBtn = overlay.querySelector('button');
  let open = null;

  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
  function target(img) { // as big as fits: 90% wide, 86% tall, natural aspect
    const ratio = img.naturalWidth / img.naturalHeight || 1;
    let width = Math.min(innerWidth * 0.9, 1400), height = width / ratio;
    if (height > innerHeight * 0.86) { height = innerHeight * 0.86; width = height * ratio; }
    return { left: (innerWidth - width) / 2, top: (innerHeight - height) / 2, width, height };
  }
  function animate(el, to, ease, done) {
    if (window.gsap && !reduce) { window.gsap.to(el, { ...to, duration: 0.8, ease, overwrite: true, onComplete: done }); return; }
    for (const k in to) el.style[k] = typeof to[k] === 'number' ? to[k] + 'px' : to[k];
    done?.();
  }

  function show(fig) {
    if (open) return;
    const img = fig.querySelector('img');
    const clone = img.cloneNode();
    clone.className = 'viewer-img';
    clone.removeAttribute('loading');
    const from = rectOf(fig), radius = getComputedStyle(fig).borderRadius;
    Object.assign(clone.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px', borderRadius: radius });
    document.body.append(clone);
    clone.addEventListener('click', hide);
    fig.style.visibility = 'hidden'; // the socket stays empty while the image is out
    open = { fig, img, clone, radius, back: document.activeElement };
    lenis?.stop();
    root.classList.add('viewer-open');
    overlay.classList.add('is-open');
    closeBtn.focus({ preventScroll: true });
    animate(clone, { ...target(img), borderRadius: '12px' }, 'expo.out');
  }

  function hide() {
    if (!open) return;
    const { fig, clone, radius, back } = open;
    open = null;
    overlay.classList.remove('is-open');
    animate(clone, { ...rectOf(fig), borderRadius: radius }, 'expo.inOut', () => {
      fig.style.visibility = '';
      clone.remove();
      root.classList.remove('viewer-open');
      lenis?.start();
      back?.focus?.({ preventScroll: true });
    });
  }

  document.querySelectorAll('.shot').forEach((fig) => {
    fig.tabIndex = 0;
    fig.setAttribute('role', 'button');
    fig.setAttribute('aria-label', 'Enlarge image: ' + fig.querySelector('img').alt);
    fig.addEventListener('click', () => show(fig));
    fig.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(fig); } });
  });
  overlay.addEventListener('click', hide);
  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') hide();
    if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); } // the close button is the only stop inside the dialog
  });
  addEventListener('resize', () => { if (open) Object.assign(open.clone.style, Object.fromEntries(Object.entries(target(open.img)).map(([k, v]) => [k, v + 'px']))); });
}

/** Wrap each char/word of `el` in a clipping mask. Returns the inner spans to animate. */
function split(el, type, masked = true) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  const out = [];
  for (const part of type === 'chars' ? [...text] : text.split(/(\s+)/)) {
    if (!part.trim()) { el.append(part); continue; }
    const inner = document.createElement('span');
    inner.textContent = part;
    inner.setAttribute('aria-hidden', 'true');
    if (masked) {
      const outer = document.createElement('span');
      outer.className = 'mask';
      outer.append(inner);
      el.append(outer);
    } else el.append(inner);
    out.push(inner);
  }
  return out;
}

/** Hero background: a grid of dots that drifts in a slow wave and scatters away from the pointer. */
function dotField(canvas) {
  const ctx = canvas.getContext('2d');
  const GAP = 26, R = 150;
  let w = 0, h = 0, dots = [], visible = true, raf = 0;
  const mouse = { x: -1e4, y: -1e4 };

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = [];
    for (let y = GAP / 2; y < h; y += GAP) for (let x = GAP / 2; x < w; x += GAP) dots.push({ ox: x, oy: y, x, y, vx: 0, vy: 0 });
    if (reduce) draw(0);
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      if (!reduce) {
        const ddx = d.x - mouse.x, ddy = d.y - mouse.y, dist2 = ddx * ddx + ddy * ddy;
        if (dist2 < R * R) { const dist = Math.sqrt(dist2) || 1, f = (1 - dist / R) * 5; d.vx += (ddx / dist) * f; d.vy += (ddy / dist) * f; }
        const wave = Math.sin(t * 0.0012 + d.ox * 0.012 + d.oy * 0.008) * 3;
        d.vx = (d.vx + (d.ox - d.x) * 0.06) * 0.8;
        d.vy = (d.vy + (d.oy + wave - d.y) * 0.06) * 0.8;
        d.x += d.vx; d.y += d.vy;
      }
      const off = Math.min(1, Math.hypot(d.x - d.ox, d.y - d.oy) / 24);
      const s = 1.4 + off * 1.6;
      ctx.fillStyle = `rgba(255,255,255,${0.14 + off * 0.75})`;
      ctx.fillRect(d.x - s / 2, d.y - s / 2, s, s);
    }
  }

  function loop(t) { draw(t); raf = visible ? requestAnimationFrame(loop) : 0; }

  resize();
  addEventListener('resize', resize);
  if (reduce) return;
  addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  canvas.parentElement.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
  // Stop drawing while the hero is off screen.
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(canvas);
}
