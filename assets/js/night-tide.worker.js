// Night Tide · ASCII code art by JIN2 (@jin_22ee), 2026.
// Source: https://github.com/JIN2-ASCII/-JIN2-ASCII/tree/main/NIGHT-TIDE
// Ported from Python/NumPy/pygame to a browser canvas for this personal, non-commercial portfolio,
// as JIN2's license allows for personal projects. Credited in the page footer.
// Runs in a Web Worker so the sea's maths never blocks the page; night-tide.js hands it the loader's two canvases.
(() => {
  let art, glow, ctx, gctx, boxW = 0, boxH = 0;

  const POOLS = ['1il!;:', 'rtfjcvxz=+', 'aeoun0{}[]<>', '08B$#&%Q']; // dark -> bright
  const FILL = POOLS.map((p) => Array.from({ length: 12 }, (_, k) => p[k % p.length]));
  const COLORS = [[20, 34, 64], [28, 50, 92], [40, 72, 122], [62, 100, 152], [98, 136, 182], [146, 176, 210],
    [196, 206, 218], [236, 238, 240], [222, 230, 240], [86, 84, 98], [170, 180, 205]];
  const SILVER = 6, GLINT = 7, FOAM = 8, SAND = 9, STAR = 10;
  const CW = 6, CH = 9, FONT = '10px ui-monospace, Consolas, Menlo, monospace'; // system mono: no wait for web fonts
  const HORIZON = -0.28, EYE = 0.3, LOOP = 20;
  // (amplitude, wavelength, direction)
  const SWELLS = [[0.045, 1.70, -0.05], [0.032, 1.10, 0.30], [0.030, 0.65, 0.10], [0.020, 0.43, -0.45], [0.014, 0.28, 0.60], [0.009, 0.18, -0.20],
    [0.007, 0.115, 1.00], [0.005, 0.075, -0.85], [0.0028, 0.048, 0.45], [0.0018, 0.032, -0.70]].map(([amp, lam, ang]) => {
    const k = (2 * Math.PI) / lam;
    const w = (2 * Math.PI * Math.max(1, Math.round((LOOP * Math.sqrt(9.8 * k)) / 8 / (2 * Math.PI)))) / LOOP;
    return { amp, lam, k, w, dx: Math.sin(ang), dz: -Math.cos(ang) };
  });
  const SHORE = 0.47, Z_FAR = 2.4, Z_BREAK = 0.78, T_SWELL = 4.0, T_BORE = 2.0, T_SWASH = 3.0, PERIOD = 2.5, RISE = 0.09;

  const smooth = (x) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const noise = (x, y, s) => (Math.sin(7.1 * x + 3.3 * Math.sin(5.3 * y + s) + s) + Math.sin(11.3 * y - 4.7 * x + 2 * s) + 0.6 * Math.sin(17 * x + 13 * y - s)) / 2.6;
  function lace(xw, z, seed, age) { // torn foam, more holes with age
    const warp = noise(4 * xw, 15 * z, seed + 7);
    const n = noise(9 * xw + 1.5 * warp, 60 * z + 3 * warp, seed) + 0.5 * noise(23 * xw, 140 * z + warp, seed + 1);
    return smooth((n / 1.5 + 0.55 - 0.7 * age) / 0.3);
  }
  function seeded(seed) { return () => { seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
  const uni = (r, a, b) => a + (b - a) * r();
  // eight breakers, each with its own size, angle, bend and timing (the original cycles n % 8 too)
  const WAVES = Array.from({ length: 8 }, (_, i) => {
    const r = seeded(100 + i);
    const size = uni(r, 0.5, 1.15), angle = uni(r, -0.9, 0.9), bend = uni(r, -1.2, 1.2), late = uni(r, -0.5, 0.5);
    const zb = Z_BREAK + ((1.15 - Z_BREAK) * (1.15 - size)) / 0.65 + uni(r, -0.05, 0.05);
    return { size, angle, bend, late, zb, rise: RISE * size, ts: (T_SWELL * (Z_FAR - zb)) / (Z_FAR - Z_BREAK), tb: (T_BORE * (zb - SHORE)) / (Z_BREAK - SHORE) ** 0.6, seed: i * 2.39 };
  });

  // ---- grid ----
  // ~18k letters a frame: drawn straight into one pixel buffer (one drawImage per letter was ~90 ms a frame)
  let cols, rows, aspect, cw, row, RND, HSH, ROWY, ROWZ, KEEP, colX, MASK, img, px8, px32, WPX;
  const SIN = new Float64Array(SWELLS.length), COS = new Float64Array(SWELLS.length), DSIN = new Float64Array(SWELLS.length), DCOS = new Float64Array(SWELLS.length);
  function resize() {
    cols = Math.max(1, Math.floor(boxW / CW)); rows = Math.max(1, Math.floor(boxH / CH));
    aspect = (cols * CW) / (rows * CH); cw = aspect / cols; row = 1 / rows;
    art.width = WPX = cols * CW; art.height = rows * CH;
    glow.width = Math.ceil(art.width / 4); glow.height = Math.ceil(art.height / 4);
    img = ctx.createImageData(art.width, art.height); px8 = img.data; px32 = new Uint32Array(px8.buffer); px32.fill(0xff000000);
    const rand = seeded(9), n = cols * rows;
    RND = new Float32Array(n); HSH = new Uint8Array(n);
    for (let k = 0; k < n; k++) { RND[k] = rand(); HSH[k] = Math.floor(rand() * 12); }
    colX = Float32Array.from({ length: cols }, (_, i) => ((i + 0.5) / cols - 0.5) * aspect);
    ROWY = Float32Array.from({ length: rows }, (_, j) => (j + 0.5) / rows - 0.5);
    ROWZ = ROWY.map((y) => EYE / Math.max(y - HORIZON, 1e-3));
    // waves too small to see at a row's distance fade out (depends on row only)
    KEEP = SWELLS.map((s) => ROWZ.map((z) => { const foot = s.k * Math.hypot(s.dx * cw * z, (s.dz * row * z * z) / EYE); return Math.exp(-((foot / 1.4) ** 2)); }));
    // one coverage mask (0-255 per pixel) per letter
    const chars = [...new Set(' .,:~+*^01|/\\-_#()x' + POOLS.join(''))];
    const atlas = new OffscreenCanvas(chars.length * CW, CH);
    const a = atlas.getContext('2d', { willReadFrequently: true });
    a.fillStyle = '#000'; a.fillRect(0, 0, atlas.width, CH);
    a.font = FONT; a.textAlign = 'center'; a.textBaseline = 'middle'; a.fillStyle = '#fff';
    chars.forEach((c, ci) => a.fillText(c, ci * CW + CW / 2, CH / 2 + 0.5));
    const data = a.getImageData(0, 0, atlas.width, CH).data;
    MASK = new Map(chars.map((c, ci) => {
      const m = new Uint8Array(CW * CH);
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) m[y * CW + x] = data[(y * atlas.width + ci * CW + x) * 4];
      return [c, m];
    }));
  }

  // letter `c` at cell (i, j), max-blended over what is there (like the original's BLEND_MAX)
  function plot(c, i, j, tag, lum) {
    const m = MASK.get(c), col = COLORS[tag], l = Math.min(1, lum) / 255;
    const r = col[0] * l, g = col[1] * l, b = col[2] * l;
    for (let y = 0; y < CH; y++) {
      let o = ((j * CH + y) * WPX + i * CW) * 4;
      for (let x = 0, mo = y * CW; x < CW; x++, o += 4) {
        const v = m[mo + x];
        if (!v) continue;
        const R = r * v, G = g * v, B = b * v;
        if (R > px8[o]) px8[o] = R;
        if (G > px8[o + 1]) px8[o + 1] = G;
        if (B > px8[o + 2]) px8[o + 2] = B;
      }
    }
  }

  // ---- one frame: "what part of the sea am I looking at, and how much light does it catch?" ----
  function draw(t) {
    // breakers alive now, with their per-column timing worked out once per frame
    const live = [];
    for (let n = Math.floor((t - 12) / PERIOD); n <= Math.floor(t / PERIOD); n++) {
      const W = WAVES[((n % 8) + 8) % 8];
      const A = new Float32Array(cols), BRK = new Float32Array(cols), LUMPS = new Float32Array(cols);
      let any = false;
      for (let i = 0; i < cols; i++) {
        const X = colX[i];
        const peel = W.angle * X + W.bend * X * X + 0.15 * Math.sin(2.0 * X + W.seed) + 0.06 * Math.sin(5.3 * X - W.seed);
        A[i] = t - n * PERIOD - W.late + peel;
        if (A[i] >= 0) any = true;
        BRK[i] = Math.max(0.35, (0.35 + 0.65 * W.size) * smooth((noise(1.7 * X + W.seed, W.seed, n % 8) + 0.45 * W.size + 0.2) / 0.9));
        LUMPS[i] = 0.55 + 0.45 * Math.abs(Math.sin(31 * X + 2.1 * noise(5 * X, 0.4 * t, n) + 1.5 * t));
      }
      if (any) live.push({ W, n, A, BRK, LUMPS });
    }

    for (let p = 0; p < px32.length; p++) px32[p] = ((px32[p] >>> 1) & 0x7f7f7f7f) | 0xff000000; // previous frame fades to half

    const NS = SWELLS.length;
    for (let j = 0; j < rows; j++) {
      const Y = ROWY[j], z = ROWZ[j], below = Y > HORIZON + 0.5 * row;
      const water = below && z >= SHORE, beach = below && z < SHORE;
      const dim = 0.45 + 0.55 * smooth((Y - HORIZON) / 0.2), far = 1 - smooth((Y - HORIZON) / 0.25);
      // along a row a swell's phase grows by the same step each column: rotate sin/cos instead of calling them per cell
      if (below) for (let s = 0; s < NS; s++) {
        const S = SWELLS[s], ph0 = S.k * (S.dx * colX[0] * z + S.dz * z) - S.w * t + 3.7 * S.lam, d = S.k * S.dx * cw * z;
        SIN[s] = Math.sin(ph0); COS[s] = Math.cos(ph0); DSIN[s] = Math.sin(d); DCOS[s] = Math.cos(d);
      }
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i, X = colX[i], xw = X * z, rnd = RND[k];
        let c = null, tag = 0, lum = 0;
        if (!below) { // stars
          if (rnd < 0.003 && Y < HORIZON - 0.04) { c = rnd < 0.0008 ? '+' : '.'; tag = STAR; lum = 0.4 + 0.3 * Math.sin(0.9 * t + rnd * 7000); }
        } else {
          // Gerstner swells, slopes only
          let sx = 0, sz = 0, hgt = 0;
          for (let s = 0; s < NS; s++) {
            const S = SWELLS[s], keep = KEEP[s][j], sp = SIN[s], cp0 = COS[s];
            SIN[s] = sp * DCOS[s] + cp0 * DSIN[s]; COS[s] = cp0 * DCOS[s] - sp * DSIN[s];
            if (keep < 1e-4) continue;
            const steep = S.amp * S.k * keep, cp = cp0 / (1 - 0.5 * steep * sp);
            sx += steep * S.dx * cp; sz += steep * S.dz * cp; hgt += S.amp * sp * keep;
          }

          // breakers
          let foam = 0, face = 0, lip = 0, spray = false, film = 0, wet = 0;
          for (let q = 0; q < live.length; q++) {
            const L = live[q], a = L.A[i];
            if (a < 0) continue;
            const W = L.W, n = L.n, zb = W.zb, ts = W.ts, tb = W.tb, rise = W.rise, seed = W.seed, size = W.size;
            let front, reach = 0;
            if (a < ts) front = Z_FAR - ((Z_FAR - zb) * a) / ts;
            else if (a < ts + tb) { const b = a - ts; front = zb - (zb - SHORE) * (1 - (1 - b / tb) ** 2); }
            else { reach = 0.09 + 0.025 * Math.sin(2.3 * xw + seed); const u = clamp((a - ts - tb) / T_SWASH, 0, 1); front = SHORE - reach * 4 * u * (1 - u); }
            const yf = HORIZON + EYE / front, since = a - ts, g = clamp(a / ts, 0, 1) ** 2;

            // swell bump: steep front, long back
            const tall = rise * g * (1 - smooth(since / 0.5));
            if (water && tall > 0) {
              const d = z - front, wd = d < 0 ? 0.05 : 0.16, bump = tall * Math.exp(-((d / wd) ** 2));
              sz += bump * ((-2 * d) / wd ** 2); hgt += bump;
            }
            // wave face and lip
            const hs = tall / front;
            if (since < 0.5) {
              if (Y < yf && Y > yf - hs) face = Math.max(face, 0.25 + (0.5 * (yf - Y)) / Math.max(hs, 1e-4));
              lip = Math.max(lip, Math.exp(-(((Y - (yf - hs)) / (0.8 * row)) ** 2)) * g);
            }
            // break
            const peak = rise / zb, lumps = L.LUMPS[i], brk = L.BRK[i];
            let wf = 0, boil = NaN; // boiling white water, worked out only for cells inside the break
            if (since > 0 && since < 1.4) {
              const burst = Math.sin(Math.PI * clamp(since / 1.3, 0, 1)), hc = (peak * (0.2 + 0.4 * burst) * lumps * zb) / front;
              if (Y < yf && Y > yf - hc) {
                boil = noise(19 * X + 0.4 * t, 23 * Y - 1.2 * t, n) + 0.5 * noise(41 * X, 47 * Y + 2 * t, n + 2);
                const depth = clamp((Y - (yf - hc)) / Math.max(hc, 1e-4), 0, 1);
                wf = Math.max(wf, (1.0 - 0.35 * depth) * smooth((boil + 1.2 - 0.5 * depth) / 0.4));
              }
              const top = (peak * 1.8 * zb) / front;
              if (brk > 0.5 && since > 0.1 && since < 1.3 && Y < yf - hc && Y > yf - top * burst && rnd > 0.75 + (0.25 * (yf - Y)) / (top + 1e-3)) spray = true;
            }
            // white water roller and trailing foam
            const roll = Math.max(since, 0);
            if (since > 0.8 && since < tb) {
              const hr = (0.5 * peak * (1 - 0.75 * smooth(roll / tb)) * lumps * zb) / front;
              if (Y < yf && Y > yf - hr) {
                if (boil !== boil) boil = noise(19 * X + 0.4 * t, 23 * Y - 1.2 * t, n) + 0.5 * noise(41 * X, 47 * Y + 2 * t, n + 2);
                const rd = clamp((Y - (yf - hr)) / Math.max(hr, 1e-4), 0, 1);
                wf = Math.max(wf, (0.95 - 0.4 * rd) * smooth((boil + 0.8 - 0.5 * rd) / 0.4));
              }
            }
            const behind = z - front, band = 0.04 + 0.15 * smooth(roll / 1.5);
            if (water && behind > -0.005 && behind < band && since > 0.3 && since < tb + 0.3) {
              const fade = (1 - clamp(behind / band, 0, 1)) ** 1.6, edge = Math.exp(-((behind / 0.012) ** 2));
              wf = Math.max(wf, (0.35 + 0.65 * fade) * lace(xw, z, seed, roll / 3.5) + 0.9 * edge);
            }
            if (water && behind > band && z < zb + 0.3 && since > 0.5) {
              const v = 0.6 * Math.exp(-roll / 2.2) * smooth((noise(3 * xw + seed, 12 * z, seed + 5) - 0.1) / 0.3);
              if (v > 0.01) wf = Math.max(wf, v * lace(xw, z, seed + 3, 0.1));
            }
            // foam joins up sideways as it comes in
            if (wf > 0) foam = Math.max(foam, wf * Math.max(brk, smooth((roll - 0.1) / (0.35 * tb)) * (0.85 + 0.15 * size)));
            // swash on the sand
            if (beach && since > tb) {
              if (!reach) reach = 0.09 + 0.025 * Math.sin(2.3 * xw + seed);
              const u = clamp((since - tb) / T_SWASH, 0, 1), sw = u < 1;
              const scallop = 0.008 * Math.sin(31 * xw + seed) + 0.004 * Math.sin(73 * xw - 2 * seed);
              const rim = sw ? Math.exp(-(((z - front - scallop) / 0.008) ** 2)) : 0;
              const left = u > 0.5 ? Math.exp(-(((z - SHORE + reach - scallop) / 0.007) ** 2)) * Math.exp(-Math.max(since - tb - 0.5 * T_SWASH, 0) / 1.6) : 0;
              const s = rim * (1 - 0.4 * u) + 0.6 * left;
              if (s > 0.01) foam = Math.max(foam, s * lace(xw, z * 2, seed + 1, 0.5 * u + 0.15));
              if (z > front && sw) film = 1;
              if (z > SHORE - reach) wet = Math.max(wet, Math.exp(-Math.max(since - tb - T_SWASH, 0) / 2.5));
            }
          }

          // light: the water mirrors the night sky, more so at low angles (Fresnel)
          let nx = -sx, ny = 1, nz = -sz; const nl = Math.sqrt(nx * nx + 1 + nz * nz); nx /= nl; ny /= nl; nz /= nl;
          let vx = xw, vy = -EYE, vz = z; const vl = Math.sqrt(vx * vx + vy * vy + vz * vz); vx /= vl; vy /= vl; vz /= vl;
          const vn = vx * nx + vy * ny + vz * nz, ry = vy - 2 * vn * ny;
          const facing = clamp(-vn, 0, 1), fresnel = 0.03 + 0.97 * (1 - facing) ** 5;
          const sky = 0.35 + 0.65 * (1 - clamp(ry, 0, 1)) ** 2;
          let gl = 0.06 + fresnel * sky * 0.75 * dim + 0.08 * smooth(hgt / 0.06 + 0.5);
          gl = gl * (1 - 0.55 * far) + far * 0.42 * smooth((-sz + 0.01) / 0.05);
          lum = clamp(gl * 1.2 + 0.07 * Math.sin(rnd * 977 + t * (2.5 + 4 * rnd)), 0, 1);
          if (face > 0) lum = 0.12 + 0.3 * face;
          lum *= 1 - 0.75 * smooth(foam / 0.35);
          lum *= smooth((lum - 0.06) / 0.22);
          const show = (water || face > 0) && lum > 0.03;
          if (show) {
            c = lum > 0.8 && rnd < 0.4 ? '~' : FILL[clamp(Math.trunc(lum * 3.6), 0, 3)][(((HSH[k] + Math.trunc(0.6 * t + (3 * hgt) / 0.05)) % 12) + 12) % 12];
            tag = clamp(Math.trunc(lum * 6), 0, 5);
          } else lum = 0;
          // glitter on lit crests
          if (water && foam < 0.3) {
            const spec = smooth((lum - 0.2) / 0.25) * smooth((Math.sin(rnd * 431 + t * (3 + 7 * rnd) + 40 * hgt) - 0.68) / 0.15);
            if (spec > 0.2) { c = spec > 0.7 ? (rnd < 0.5 ? '*' : '+') : rnd < 0.5 ? '^' : '.'; lum = Math.min(0.5 + 0.7 * spec, 1.15); tag = spec > 0.55 ? GLINT : SILVER; }
          }
          // whitecaps far out
          if (water && z > Z_BREAK + 0.3 && foam < 0.1 && rnd < 0.8) {
            const hn = smooth((hgt / 0.05 - 0.5) / 0.3);
            if (hn > 0.4) {
              const churn = noise(2.2 * xw + 0.35 * t, 7 * z - 0.9 * t, 4) + 0.5 * Math.sin(1.7 * t + 9 * noise(xw, 3 * z, 8));
              if (hn * smooth((churn - 0.35) / 0.3) > 0.4) { c = FILL[1 + Math.trunc(rnd * 2)][(HSH[k] + Math.trunc(3 * t)) % 12]; lum = 0.45 + 0.4 * dim; tag = FOAM; }
            }
          }
          if (lip > 0.4 && foam < 0.3) { c = '~'; lum = 0.4 + 0.45 * lip; tag = 4; }
          const fo = foam > 0.4 + 0.2 * rnd;
          if (fo) { c = FILL[clamp(Math.trunc(3.2 * foam - 0.2), 1, 3)][(HSH[k] + Math.trunc(2 * t)) % 12]; lum = Math.min(0.6 + 0.55 * foam, 1.15); tag = FOAM; }
          else if (spray) { c = rnd > 0.8 ? '*' : '.'; lum = 0.8; tag = FOAM; }
          // sand
          if (beach && !fo) {
            if (film > 0.5 && rnd < 0.4) { c = '-'; lum = 0.32; tag = 2; }
            else if (rnd < 0.08 + 0.15 * wet) { c = rnd < 0.03 ? ':' : ','; lum = 0.2 + 0.2 * wet; tag = SAND; }
          }
        }
        if (c && c !== ' ' && lum > 0) plot(c, i, j, tag, lum);
      }
    }
    ctx.putImageData(img, 0, 0);
    gctx.clearRect(0, 0, glow.width, glow.height);
    gctx.drawImage(art, 0, 0, glow.width, glow.height);
  }

  // ---- run until night-tide.js terminates the worker ----
  const T0 = 8; // start mid-sea, with breakers already rolling in
  let start = 0, timer = 0;
  function loop() {
    const now = performance.now();
    if (!start) start = now;
    draw(T0 + (now - start) / 1000);
    timer = setTimeout(loop, Math.max(0, 1000 / 30 - (performance.now() - now))); // 30 fps like the original
  }
  self.onmessage = ({ data }) => {
    if (data.art) { art = data.art; glow = data.glow; ctx = art.getContext('2d'); gctx = glow.getContext('2d'); }
    boxW = data.w; boxH = data.h;
    resize();
    if (!timer) loop();
  };
})();
