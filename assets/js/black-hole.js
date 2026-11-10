// Black Hole · ASCII code art by JIN2 (@jin_22ee), 2026.
// Source: https://github.com/JIN2-ASCII/-JIN2-ASCII/tree/main/BLACK-HOLE
// Ported from Python/NumPy/pygame to a browser canvas for this personal, non-commercial portfolio,
// as JIN2's license allows for personal projects. Credit to @jin_22ee is shown next to it on the page.
(() => {
  const wrap = document.querySelector('.blackhole');
  if (!wrap) return;
  const art = wrap.querySelector('.bh-art'), glow = wrap.querySelector('.bh-glow');
  const ctx = art.getContext('2d'), gctx = glow.getContext('2d');
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const TAU = Math.PI * 2;
  const POOLS = ['1il!;:', 'rtfjcvxz=+', 'aeoun0{}[]<>', '08B$#&%Q']; // dark -> bright
  const FILL = POOLS.map((p) => Array.from({ length: 12 }, (_, k) => p[k % p.length]));
  //                deep red        red             orange          amber           white hot        star             dust
  const COLORS = [[190, 38, 12], [242, 78, 20], [255, 124, 34], [255, 172, 78], [255, 222, 168], [220, 228, 255], [130, 72, 48]];
  const [DEEP, RED, ORANGE, AMBER, HOT, STAR, DUST] = [0, 1, 2, 3, 4, 5, 6];
  const R0 = 0.11, TILT = (17 * Math.PI) / 180, INC = 0.12, R_IN = 1.55 * R0, R_OUT = 5.4 * R0, FLASH = 7.8;
  const cosT = Math.cos(TILT), sinT = Math.sin(TILT);
  const CW = 7, CH = 11, FONT = '12px "JetBrains Mono", Consolas, monospace';
  const PULSES = [[1.8, 0, 0.95], [2.4, 2.1, 0.8], [3.2, 4.2, 0.65]].map(([r, s, v]) => [Math.log(r), s, v]);

  const smooth = (x) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };
  const clip01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const wrapPi = (x) => ((((x + Math.PI) % TAU) + TAU) % TAU) - Math.PI; // Python-style modulo
  const spin = (t) => { const s = Math.max(t - FLASH, 0); return 0.06 * t + 0.28 * (s - 0.8 * (1 - Math.exp(-s / 0.8))); };
  const ripple = (a, b, t) => Math.sin(a + 0.9 * Math.sin(b + 1.3 * t)) * 0.5 + Math.sin(2.3 * a - b + 0.7 * t) * 0.3 + Math.sin(4.1 * a + 1.7 * b - 1.1 * t) * 0.2;

  // thin rings of gas on circular orbits; the inner ones turn faster. After the flash, sparks ride the orbits.
  function gas(phi, rho, t, w) {
    const phase = phi - Math.pow(rho / R_IN, -1.5) * w;
    const lr = Math.log(rho / R0);
    const a = 46 * lr + 0.9 * Math.sin(phase + 3 * lr);
    let streak = 0.55 + 0.3 * Math.sin(a) + 0.15 * Math.sin(2.3 * a + 2 * phase) + 0.12 * Math.sin(3 * phase - 7 * lr + 0.3 * t);
    const f = smooth(t - FLASH);
    if (f > 0) {
      let pulses = 0;
      for (const [lrr, start, speed] of PULSES) {
        const q = (lr - lrr) / 0.07;
        if (q * q > 25) continue; // exp(-25) ~ 0
        const d = wrapPi(phi - start - speed * t);
        pulses += (d > 0 ? Math.exp(-((d / 0.18) ** 2)) : Math.exp(d / 0.9)) * Math.exp(-q * q);
      }
      streak += 0.9 * f * pulses;
    }
    return streak;
  }

  function tangentLetter(dx, dy) {
    const s = ((((Math.atan2(-dy, dx) * 180) / Math.PI) % 180) + 180) % 180;
    if (s < 22.5 || s >= 157.5) return '-';
    if (s < 67.5) return '/';
    if (s < 112.5) return '|';
    return '\\';
  }

  // ---- grid and glyph atlas ----
  let cols = 0, rows = 0, aspect = 1, dpr = 1, GX, GY, RND, HSH, atlas, atlasIndex;
  function seeded(seed) { return () => { seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }

  function buildAtlas() {
    const chars = [...new Set(' .,:~+*^01|/\\-_#()x' + POOLS.join(''))];
    atlasIndex = new Map(chars.map((c, i) => [c, i]));
    atlas = document.createElement('canvas');
    atlas.width = chars.length * CW * dpr; atlas.height = COLORS.length * CH * dpr;
    const a = atlas.getContext('2d');
    a.scale(dpr, dpr); a.font = FONT; a.textAlign = 'center'; a.textBaseline = 'middle';
    COLORS.forEach(([r, g, b], ti) => { a.fillStyle = `rgb(${r},${g},${b})`; chars.forEach((c, ci) => a.fillText(c, ci * CW + CW / 2, ti * CH + CH / 2 + 0.5)); });
  }

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    cols = Math.max(1, Math.floor(w / CW)); rows = Math.max(1, Math.floor(h / CH));
    aspect = (cols * CW) / (rows * CH);
    art.width = cols * CW * dpr; art.height = rows * CH * dpr;
    glow.width = Math.ceil(art.width / 4); glow.height = Math.ceil(art.height / 4);
    const n = cols * rows, rand = seeded(7);
    GX = new Float32Array(n); GY = new Float32Array(n); RND = new Float32Array(n); HSH = new Uint8Array(n);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      GX[k] = ((i + 0.5) / cols - 0.5) * aspect; GY[k] = (j + 0.5) / rows - 0.5;
      RND[k] = rand(); HSH[k] = Math.floor(rand() * 12);
    }
    buildAtlas();
  }

  // ---- one frame: every cell asks "how hot is the gas here?" ----
  function draw(t, trail) {
    const cam = smooth(smooth((t - FLASH + 0.3) / 2.6)); // on the flash: move in and look down from above
    const zoom = 1 + 0.28 * cam, inc = INC + 0.09 * cam;
    const w = spin(t), flash = Math.exp(-(((t - FLASH) / 0.22) ** 2));
    const ringK = smooth((t - 0.3) / 2.2), diskOn = smooth((t - 5.0) / 2.8);
    const auraK = smooth((t - 2.2) / 1.8) * (1 - 0.65 * diskOn);
    const diskFade = smooth((t - 5.0) / 0.8) * (0.55 + 0.45 * smooth((t - FLASH + 0.3) / 0.4));
    const span = R0 + diskOn * (R_OUT * 1.1 - R0), haloK = smooth((t - 5.0) / 2.2);
    const ringBoost = 0.9 + 0.3 * smooth((t - 5) / 2), dustLum = 0.3 * smooth((t - 4.0) / 3.0);
    const front = R0 + (t - FLASH) * 0.55, shockK = t > FLASH ? Math.exp(-(t - FLASH) / 0.5) * 0.9 : 0;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = trail ? 'rgba(0,0,0,0.6)' : '#000'; // previous frame fades to 40%
    ctx.fillRect(0, 0, art.width, art.height);
    ctx.globalCompositeOperation = 'lighten';

    const cw = CW * dpr, ch = CH * dpr;
    for (let k = 0, n = cols * rows; k < n; k++) {
      const X = GX[k] / zoom, Y = (GY[k] + 0.02 * cam) / zoom;
      const r = Math.hypot(X, Y), ang = Math.atan2(Y, X), rnd = RND[k];

      // 1. the circle draws itself
      const around = ((((ang + Math.PI / 2) % TAU) + TAU) % TAU) / TAU;
      const ring = Math.exp(-(((r - 1.02 * R0) / (0.045 * R0)) ** 2)) * smooth((ringK * 1.08 - around) / 0.08);

      // 2. a soft glow breathing around it, settling into the disk's own rings
      let aura = 0;
      if (auraK > 0 && r < R0 + 0.3) {
        let puff = diskOn < 1 ? 0.5 + 0.5 * ripple(2 * ang, 5 * r - 0.45 * t, 0.35 * t) : 0;
        if (diskOn > 0) puff = puff * (1 - diskOn) + gas(ang - TILT, R_IN + Math.max(r - R0, 0) * 2.6, t, w) * diskOn;
        const reach = 0.32 * R0 * (0.7 + 0.6 * puff);
        aura = auraK * Math.exp(-((Math.max(r - R0, 0) / reach) ** 1.6)) * (0.6 + 0.4 * puff);
      }

      // 3. the tilted disk, seen almost edge on
      const u = X * cosT + Y * sinT, v = -X * sinT + Y * cosT;
      const rho = Math.max(Math.hypot(u, v / inc), 1e-6), phi = Math.atan2(v / inc, u);
      const phase = phi - Math.pow(rho / R_IN, -1.5) * w, lr = Math.log(rho / R0);
      let disk = 0;
      if (diskFade > 0) {
        const edge = smooth((rho - R_IN) / (0.25 * R0)) * smooth((R_OUT - rho) / (2.2 * R0));
        if (edge > 0) {
          disk = 1.5 * edge * gas(phi, rho, t, w) * (R_IN / rho) * (1 - (0.25 * u) / rho); // near side brighter
          disk *= diskFade * smooth((span - Math.abs(u)) / (0.6 * R0));
        }
      }

      // 4. the far side of the disk, bent up and over the shadow
      let halo = 0;
      if (haloK > 0) {
        const da = ang - TILT, top = 0.5 - 0.5 * Math.sin(da), side = Math.abs(Math.cos(da)) ** 10;
        const band = Math.exp(-((Math.max(r - 1.1 * R0, 0) / (0.2 * R0 + 0.24 * R0 * top + 0.45 * R0 * side)) ** 2)) * Math.exp(-((Math.min(r - 1.1 * R0, 0) / (0.2 * R0)) ** 2));
        if (band > 1e-3) {
          const hr = (1 - side) * (R_IN + Math.max(r - R0, 0) * 2.6) + side * Math.max(r, R_IN);
          halo = haloK * 1.2 * band * gas(da, hr, t, w) * (0.5 + 0.8 * top) * (1 - 0.25 * Math.cos(da));
        }
      }

      const shock = shockK ? Math.exp(-(((r - front) / 0.02) ** 2)) * shockK : 0;
      // screen blend so glow, halo and disk melt into each other
      let soft = 1 - (1 - clip01(aura * 0.55)) * (1 - clip01(halo)) * (1 - clip01(disk));
      soft = Math.max(soft, disk, halo);
      let heat = Math.max(ring * ringBoost, soft, shock) * (1 + 1.4 * flash);

      const inside = r < R0 * 0.97;
      if (inside) heat = v > 0 && disk > 0.2 ? disk : 0; // the shadow hides what is behind it

      let c, tag, lum;
      if (heat > 0.07) {
        const level = Math.min(3, Math.max(0, Math.trunc(heat * 3.6)));
        c = FILL[level][(((HSH[k] + Math.trunc(phase * 2 + lr * 6)) % 12) + 12) % 12];
        if (ring > aura * 0.8 && ring > disk && ring > halo && ring > 0.25) c = tangentLetter(-Math.sin(ang), Math.cos(ang));
        tag = heat < 0.1 ? DEEP : heat < 0.2 ? RED : heat < 0.45 ? ORANGE : heat < 0.75 ? AMBER : HOT;
        lum = Math.min(1.3, 0.42 + 0.85 * heat) * (0.35 + 0.65 * smooth((heat - 0.07) / 0.15));
      } else if (!inside && rnd < 0.0025) { // a few stars
        c = rnd < 0.0005 ? '+' : rnd < 0.0012 ? '*' : '.'; tag = STAR; lum = 0.75 + 0.2 * Math.sin(0.8 * t + rnd * 9000);
      } else if (!inside && t > 4.0) { // and some dust along the disk's lane
        const lane = Math.exp(-(((-X * sinT + Y * cosT - 0.02) / 0.09) ** 2));
        if (rnd > 1 - 0.035 * lane) { c = rnd > 1 - 0.01 * lane ? ':' : ','; tag = DUST; lum = dustLum; } else continue;
      } else continue;

      ctx.globalAlpha = Math.min(1, lum);
      const i = k % cols, j = (k - i) / cols;
      ctx.drawImage(atlas, atlasIndex.get(c) * cw, tag * ch, cw, ch, i * cw, j * ch, cw, ch);
    }
    gctx.clearRect(0, 0, glow.width, glow.height);
    gctx.drawImage(art, 0, 0, glow.width, glow.height);
  }

  // ---- run ----
  let t0 = 0, last = 0, raf = 0, visible = true;
  function loop(now) {
    raf = 0;
    if (!visible) return;
    raf = requestAnimationFrame(loop);
    if (!(root.classList.contains('ready') || root.classList.contains('no-motion'))) return; // wait for the intro curtain
    if (!t0) t0 = now;
    if (now - last < 1000 / 30) return; // 30 fps like the original
    last = now;
    draw((now - t0) / 1000, true);
  }

  document.fonts.ready.then(() => {
    resize();
    if (reduce) { draw(14, false); addEventListener('resize', () => { resize(); draw(14, false); }); return; }
    addEventListener('resize', resize);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(wrap);
  });
})();
