/* OGI // octgiristya — motion layer
   1) scroll engine: parallax, progress, split headings, marquee velocity, timeline fill
   2) custom reticle cursor + canvas trail
   3) magnetic attraction + spring release on every interactive object
   Vanilla JS. Respects prefers-reduced-motion and touch devices. */
(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ───────────── split section headings into chars ───────────── */
  $$(".sec-head h2, .contact-h, .classified h2").forEach((h) => {
    const words = h.textContent.trim().split(/\s+/);
    h.textContent = "";
    h.classList.add("split");
    let i = 0;
    words.forEach((w, wi) => {
      const ww = document.createElement("span"); ww.className = "w";
      [...w].forEach((ch) => {
        const c = document.createElement("span"); c.className = "ch"; c.textContent = ch;
        c.style.setProperty("--i", i++); ww.appendChild(c);
      });
      h.appendChild(ww);
      if (wi < words.length - 1) h.appendChild(document.createTextNode(" "));
    });
  });
  // headings not inside a [data-reveal] get their own observer
  if ("IntersectionObserver" in window) {
    const ho = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-split-in"); ho.unobserve(e.target); }
    }), { threshold: 0.4 });
    $$(".split").forEach((h) => (reduce ? h.classList.add("is-split-in") : ho.observe(h)));
  }

  /* ───────────── marquee: duplicate for seamless loop ───────────── */
  const marquees = $$("[data-marquee]").map((track) => {
    const html = track.innerHTML; track.innerHTML = html + html + html + html;
    return { track, x: 0, dir: +(track.dataset.dir || 1) };
  });

  /* ───────────── scroll engine ───────────── */
  const prog = $("[data-prog]");
  const heroBg = $(".hero-bg");
  const heroGrid = $(".hero-grid");
  const heroId = $(".hero-id");
  const heroLinks = $(".hero .links");
  const heroStats = $(".hero .stats");
  const timeline = $(".timeline");
  const contactH = $(".contact-h");
  const parallaxEls = $$(".card-idx, .stamp, .briefing .lead").map((el, i) => ({ el, speed: el.classList.contains("card-idx") ? -0.12 : el.classList.contains("stamp") ? 0.18 : 0.06 }));
  let sy = scrollY, lastSy = sy, vel = 0;

  const indIdx = $("[data-ind-idx]"), indName = $("[data-ind-name]");
  const secs = $$("[data-sec]");
  if (indIdx && "IntersectionObserver" in window) {
    const so = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const i = secs.indexOf(e.target);
      indIdx.textContent = String(i).padStart(2, "0");
      indName.textContent = e.target.dataset.sec;
    }), { rootMargin: "-48% 0px -48% 0px" });
    secs.forEach((s) => so.observe(s));
  }

  function scrollFrame() {
    sy = scrollY;
    const delta = sy - lastSy; lastSy = sy;
    vel = lerp(vel, delta, 0.12);
    const docH = document.documentElement.scrollHeight - innerHeight;
    if (prog) prog.style.transform = `scaleX(${docH > 0 ? sy / docH : 0})`;

    if (!reduce) {
      const vh = innerHeight;
      if (sy < vh * 1.4) {
        const k = sy / vh;
        if (heroBg) heroBg.style.transform = `translate3d(0, ${sy * 0.38}px, 0) scale(${1.06 + k * 0.1})`;
        if (heroBg) heroBg.style.filter = `saturate(1.05) brightness(${0.62 - k * 0.3})`;
        if (heroGrid) heroGrid.style.transform = `translate3d(0, ${sy * 0.18}px, 0)`;
        if (heroId) { heroId.style.translate = `0 ${sy * -0.12}px`; heroId.style.opacity = String(clamp(1 - k * 0.9, 0, 1)); }
        if (heroLinks) heroLinks.style.translate = `0 ${sy * -0.22}px`;
        if (heroStats) heroStats.style.translate = `0 ${sy * -0.08}px`;
      }
      parallaxEls.forEach(({ el, speed }) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const off = (r.top + r.height / 2 - vh / 2) * speed;
        el.style.translate = `0 ${off.toFixed(1)}px`;
      });
      if (timeline) {
        const r = timeline.getBoundingClientRect();
        const p = clamp((vh * 0.7 - r.top) / r.height, 0, 1);
        timeline.style.setProperty("--fill", p.toFixed(3));
      }
      if (contactH) {
        const r = contactH.getBoundingClientRect();
        const p = clamp(1 - (r.top - vh * 0.25) / (vh * 0.75), 0, 1);
        contactH.style.setProperty("--cp", p.toFixed(3));
      }
    }
    // marquees: constant drift + scroll velocity boost & skew
    marquees.forEach((m) => {
      const speed = reduce ? 0 : (0.6 + Math.abs(vel) * 0.35) * m.dir * (vel < 0 ? -1 : 1);
      m.x -= speed;
      const w = m.track.scrollWidth / 4;
      if (w) { if (m.x <= -w) m.x += w; if (m.x > 0) m.x -= w; }
      m.track.style.transform = `translate3d(${m.x}px,0,0) skewX(${clamp(-vel * 0.6, -14, 14)}deg)`;
    });
  }

  /* ───────────── cursor + magnetic ───────────── */
  const cursor = $("[data-cursor]");
  const label = $("[data-cursor-label]");
  const canvas = $("[data-trail]");
  const enableCursor = fine && !reduce && cursor && canvas;

  // magnetic targets: selector → [strength, label, tilt, radius]
  const CONFIG = [
    [".link--primary", 0.22, "EXECUTE", false, 60],
    [".link", 0.18, "OPEN", false, 50],
    [".btn", 0.35, "OPEN", false, 70],
    [".nav a, .brand, .term-btn", 0.4, "", false, 40],
    [".chips li", 0.45, "", false, 30],
    [".stats li", 0.2, "", false, 40],
    [".card", 0.05, "SCAN", true, 0],
    [".op", 0.05, "INSPECT", true, 0],
    [".panel", 0.025, "", true, 20],
    [".timeline li", 0.04, "", false, 20],
    [".awards li, .edu li", 0.08, "", false, 10],
    [".pub", 0.12, "READ", false, 30],
    [".video-shell", 0.08, "PLAY", true, 40],
    [".avatar", 0.25, "TARGET", false, 70],
    [".status, .scroll-cue, .foot a", 0.3, "", false, 30],
    [".classified-inner", 0.02, "CLASSIFIED", true, 10],
  ];
  const mags = [];
  const seen = new Set();
  CONFIG.forEach(([sel, strength, lab, tilt, radius]) => {
    $$(sel).forEach((el) => {
      if (seen.has(el)) return; seen.add(el);
      el.classList.add("is-mag");
      mags.push({ el, strength, lab, tilt, radius, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, rx: 0, ry: 0, trx: 0, try: 0, hover: false, rect: null });
    });
  });

  const mouse = { x: innerWidth / 2, y: innerHeight / 2, px: 0, py: 0, down: false, seen: false };
  let ring = { x: mouse.x, y: mouse.y, w: 38, h: 38 };
  let lock = null; // magnetic target currently locked

  function measure() { mags.forEach((m) => { m.rect = m.el.getBoundingClientRect(); }); }

  if (enableCursor || (!reduce && fine)) {
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.seen = true;
      trailPush(e.clientX, e.clientY);
    }, { passive: true });
    addEventListener("pointerdown", () => { mouse.down = true; cursor && cursor.classList.add("is-down"); burst(mouse.x, mouse.y); });
    addEventListener("pointerup", () => { mouse.down = false; cursor && cursor.classList.remove("is-down"); });
    document.addEventListener("mouseleave", () => cursor && cursor.classList.add("is-hidden"));
    document.addEventListener("mouseenter", () => cursor && cursor.classList.remove("is-hidden"));
  }
  if (enableCursor) document.documentElement.classList.add("has-cursor");

  /* magnetic physics: attraction within (size/2 + radius), spring back on release */
  const K = 0.16, DAMP = 0.72; // spring stiffness & damping → elastic overshoot on leave
  function magFrame() {
    let best = null, bestD = Infinity;
    for (const m of mags) {
      const r = m.el.getBoundingClientRect(); m.rect = r;
      if (r.bottom < -100 || r.top > innerHeight + 100) { m.tx = m.ty = m.trx = m.try = 0; }
      else {
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = mouse.x - cx, dy = mouse.y - cy;
        const inside = mouse.x >= r.left && mouse.x <= r.right && mouse.y >= r.top && mouse.y <= r.bottom;
        const reachX = r.width / 2 + m.radius, reachY = r.height / 2 + m.radius;
        const nx = dx / reachX, ny = dy / reachY;
        const near = mouse.seen && Math.abs(nx) < 1 && Math.abs(ny) < 1;
        if (near) {
          const fall = 1 - Math.max(Math.abs(nx), Math.abs(ny)) * (inside ? 0 : 0.6);
          const cap = Math.min(28, Math.max(10, Math.min(r.width, r.height) * 0.35));
          m.tx = clamp(dx * m.strength * fall, -cap, cap);
          m.ty = clamp(dy * m.strength * fall, -cap, cap);
          if (m.tilt && inside) { m.trx = clamp(-ny * 7, -7, 7); m.try = clamp(nx * 7, -7, 7); }
          else { m.trx = m.try = 0; }
        } else { m.tx = m.ty = m.trx = m.try = 0; }
        if (inside && m.lab !== undefined) {
          const area = r.width * r.height;
          if (area < bestD) { bestD = area; best = m; } // smallest element under cursor wins
        }
        if (inside !== m.hover) { m.hover = inside; m.el.classList.toggle("is-hot", inside); }
      }
      // spring integration
      m.vx = (m.vx + (m.tx - m.x) * K) * DAMP; m.x += m.vx;
      m.vy = (m.vy + (m.ty - m.y) * K) * DAMP; m.y += m.vy;
      m.rx = lerp(m.rx, m.trx, 0.12); m.ry = lerp(m.ry, m.try, 0.12);
      if (Math.abs(m.x) < 0.05 && Math.abs(m.y) < 0.05 && !m.tx && !m.ty) { m.x = m.y = 0; }
      m.el.style.translate = (m.x || m.y) ? `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px` : "";
      if (m.tilt) {
        const ang = Math.hypot(m.rx, m.ry);
        m.el.style.rotate = ang > 0.05 ? `${m.rx.toFixed(3)} ${m.ry.toFixed(3)} 0 ${ang.toFixed(2)}deg` : "";
      }
    }
    lock = best;
  }

  /* reticle */
  function cursorFrame() {
    if (!enableCursor) return;
    const dot = cursor.firstElementChild;
    dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
    let tx = mouse.x, ty = mouse.y, tw = 38, th = 38;
    if (lock) {
      const r = lock.el.getBoundingClientRect(), pad = 8;
      tx = r.left + r.width / 2; ty = r.top + r.height / 2;
      tw = r.width + pad * 2; th = r.height + pad * 2;
      // big blocks: don't wrap whole block, keep a medium reticle that follows mouse
      if (r.width * r.height > 160000) { tx = mouse.x; ty = mouse.y; tw = 64; th = 64; }
    }
    const t = lock ? 0.22 : 0.18;
    ring.x = lerp(ring.x, tx, t); ring.y = lerp(ring.y, ty, t);
    ring.w = lerp(ring.w, tw, 0.2); ring.h = lerp(ring.h, th, 0.2);
    const rEl = dot.nextElementSibling;
    rEl.style.transform = `translate3d(${ring.x - ring.w / 2}px, ${ring.y - ring.h / 2}px, 0)`;
    rEl.style.width = `${ring.w}px`; rEl.style.height = `${ring.h}px`;
    cursor.classList.toggle("is-lock", !!lock);
    const want = lock && lock.lab ? lock.lab : "";
    if (label.textContent !== want) label.textContent = want;
    // native-cursor zones (text inputs)
    const el = document.elementFromPoint(mouse.x, mouse.y);
    cursor.classList.toggle("is-native", !!(el && el.closest("input, textarea, .term")));
  }

  /* ───────────── canvas trail ───────────── */
  const ctx = enableCursor ? canvas.getContext("2d") : null;
  const pts = []; const glyphs = [];
  const GL = "01ABCDEF#$%&<>/\\{}[]";
  let dpr = 1;
  function sizeCanvas() {
    if (!ctx) return;
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function trailPush(x, y) {
    if (!ctx) return;
    const now = performance.now();
    pts.push({ x, y, t: now });
    const last = pts[pts.length - 2];
    if (last) {
      const sp = Math.hypot(x - last.x, y - last.y);
      if (sp > 18 && Math.random() < 0.35) {
        glyphs.push({ x, y, vx: (Math.random() - 0.5) * 0.6, vy: -0.3 - Math.random() * 0.6, t: now, ch: GL[(Math.random() * GL.length) | 0] });
      }
    }
    if (pts.length > 80) pts.shift();
    if (glyphs.length > 60) glyphs.shift();
  }
  function burst(x, y) {
    if (!ctx) return;
    const now = performance.now();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      glyphs.push({ x, y, vx: Math.cos(a) * 1.8, vy: Math.sin(a) * 1.8, t: now, ch: GL[(Math.random() * GL.length) | 0] });
    }
  }
  function trailFrame() {
    if (!ctx) return;
    const now = performance.now(), LIFE = 420;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    while (pts.length && now - pts[0].t > LIFE) pts.shift();
    if (pts.length > 1) {
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(225,6,0,.9)"; ctx.shadowBlur = 12;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const life = 1 - (now - b.t) / LIFE;
        ctx.strokeStyle = `rgba(225,6,0,${(life * 0.85).toFixed(3)})`;
        ctx.lineWidth = 0.6 + life * 2.6;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    ctx.font = "500 11px JBMono, monospace";
    for (let i = glyphs.length - 1; i >= 0; i--) {
      const g = glyphs[i], age = now - g.t, life = 1 - age / 900;
      if (life <= 0) { glyphs.splice(i, 1); continue; }
      g.x += g.vx; g.y += g.vy; g.vx *= 0.96; g.vy *= 0.96;
      ctx.fillStyle = `rgba(${life > 0.6 ? "255,255,255" : "225,6,0"},${(life * 0.8).toFixed(3)})`;
      ctx.fillText(g.ch, g.x + 8, g.y - 8);
    }
  }

  /* ───────────── main loop ───────────── */
  sizeCanvas(); measure();
  addEventListener("resize", () => { sizeCanvas(); measure(); }, { passive: true });
  function loop() {
    scrollFrame();
    if (fine && !reduce) magFrame();
    cursorFrame();
    trailFrame();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
