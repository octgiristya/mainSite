/* OGI // octgiristya — interactions (vanilla, no dependencies) */
(() => {
  "use strict";
  const root = document.documentElement;
  root.classList.remove("no-js");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ── topbar state ── */
  const bar = $("[data-topbar]");
  const onScroll = () => bar && bar.classList.toggle("is-scrolled", scrollY > 24);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ── HUD clock (session timer) ── */
  const clock = $("[data-clock]");
  if (clock) {
    const t0 = performance.now();
    const pad = (n) => String(n).padStart(2, "0");
    setInterval(() => {
      const s = Math.floor((performance.now() - t0) / 1000);
      clock.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
    }, 1000);
  }

  /* ── staggered reveal ── */
  const groups = new Map();
  $$("[data-reveal]").forEach((el) => {
    const p = el.parentElement;
    const i = groups.get(p) || 0; groups.set(p, i + 1);
    el.style.setProperty("--d", `${Math.min(i, 8) * 70}ms`);
  });
  if ("IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    $$("[data-reveal]").forEach((el) => io.observe(el));
  } else {
    $$("[data-reveal]").forEach((el) => el.classList.add("is-in"));
  }

  /* ── count-up stats ── */
  const counters = $$("[data-count]");
  if (counters.length && "IntersectionObserver" in window) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target, end = +el.dataset.count;
        co.unobserve(el);
        if (reduce) return;
        const dur = 1200, t0 = performance.now();
        const tick = (t) => {
          const k = Math.min(1, (t - t0) / dur), v = Math.round(end * (1 - Math.pow(1 - k, 3)));
          el.textContent = v; if (k < 1) requestAnimationFrame(tick);
        };
        el.textContent = "0"; requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => co.observe(el));
  }

  /* ── spotlight follow ── */
  $$("[data-spot]").forEach((el) => {
    el.addEventListener("pointermove", (ev) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${ev.clientX - r.left}px`);
      el.style.setProperty("--my", `${ev.clientY - r.top}px`);
    });
  });

  /* ── avatar tilt ── */
  const tilt = $("[data-tilt]");
  if (tilt && !reduce && matchMedia("(pointer:fine)").matches) {
    addEventListener("pointermove", (ev) => {
      const x = ev.clientX / innerWidth - 0.5, y = ev.clientY / innerHeight - 0.5;
      tilt.style.transform = `perspective(600px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
    }, { passive: true });
  }

  /* ── active nav section ── */
  const navLinks = $$(".nav a");
  if (navLinks.length && "IntersectionObserver" in window) {
    const map = new Map(navLinks.map((a) => [a.getAttribute("href").slice(1), a]));
    const so = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) => a.removeAttribute("aria-current"));
        const a = map.get(e.target.id); if (a) a.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) so.observe(s); });
  }

  /* ── typed whoami → nickname ── */
  const who = $("[data-type]");
  if (who && !reduce) {
    const full = who.textContent; who.textContent = "";
    let i = 0;
    const type = () => { who.textContent = full.slice(0, ++i); if (i < full.length) setTimeout(type, 90 + Math.random() * 60); };
    setTimeout(type, 500);
  }

  /* ═══════════════ TERMINAL ═══════════════ */
  const dlg = $("[data-term]");
  const out = $("[data-term-out]");
  const form = $("[data-term-form]");
  const input = $("[data-term-input]");
  const dataEl = $("#term-data");
  if (!dlg || !dataEl) return;
  const D = JSON.parse(dataEl.textContent);
  const history = []; let hi = 0;

  const line = (html = "", cls = "") => {
    const p = document.createElement("div");
    if (cls) p.className = cls;
    p.innerHTML = html; out.appendChild(p); out.scrollTop = out.scrollHeight;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const banner = () => {
    line(`<span class="t-red">  ___   ____ ___ </span>`);
    line(`<span class="t-red"> / _ \\ / ___|_ _|</span>   ${esc(D.name)}`);
    line(`<span class="t-red">| | | | |  _ | | </span>   ${esc(D.role)}`);
    line(`<span class="t-red">| |_| | |_| || | </span>   ${esc(D.tagline)}`);
    line(`<span class="t-red"> \\___/ \\____|___|</span>`);
    line("");
    line(`Type <b>help</b> to list commands.`);
  };

  const cmds = {
    help: () => [
      "available commands:",
      "  whoami      who is this",
      "  skills      core expertise",
      "  projects    selected operations",
      "  certs       credentials",
      "  socials     where to find me",
      "  contact     open a channel",
      "  clear       clear screen",
      "  exit        close terminal",
    ].forEach((l) => line(esc(l))),
    whoami: () => { line(`${esc(D.name)} (a.k.a. <b>${esc(D.nick)}</b>)`); line(esc(D.role)); line(`<span class="t-red">${esc(D.tagline)}</span>`); },
    skills: () => D.expertise.forEach((s, i) => line(`[${String(i + 1).padStart(2, "0")}] ${esc(s)}`)),
    projects: () => D.projects.forEach((s) => line(`→ ${esc(s)}`)),
    certs: () => line(D.certs.map(esc).join("  ·  ")),
    socials: () => D.links.forEach((l, i) => { if (i === 0) return; line(`${esc(l.padEnd(10, " "))} <a href="${esc(D.urls[i])}" target="_blank" rel="noopener noreferrer">${esc(D.urls[i])}</a>`); }),
    contact: () => { line(`opening secure channel...`); line(`<a href="${esc(D.urls[0])}" target="_blank" rel="noopener noreferrer">${esc(D.urls[0])}</a>`); },
    clear: () => { out.innerHTML = ""; },
    exit: () => dlg.close(),
    sudo: () => line(`<span class="t-red">guest is not in the sudoers file. This incident will be reported.</span>`),
    ls: () => line("about.txt  expertise/  operations/  field_log.md  contact.sh"),
    "cat": () => line("Nice try. Use: whoami, skills, projects"),
    hack: () => line(`<span class="t-red">ACCESS DENIED.</span> Think like an attacker — but act like a defender.`),
    "rm -rf /": () => line(`<span class="t-red">lol. no.</span>`),
  };

  const run = (raw) => {
    const cmd = raw.trim();
    line(`<span class="t-cmd">guest@octgiristya:~$ ${esc(cmd)}</span>`);
    if (!cmd) return;
    history.push(cmd); hi = history.length;
    const key = cmds[cmd] ? cmd : cmd.split(/\s+/)[0];
    if (cmds[key]) cmds[key](); else line(`command not found: ${esc(key)} — try <b>help</b>`);
  };

  let booted = false;
  const open = () => {
    if (dlg.open) return;
    dlg.showModal();
    if (!booted) { banner(); booted = true; }
    setTimeout(() => input.focus(), 30);
  };
  $$("[data-term-open]").forEach((b) => b.addEventListener("click", open));
  $("[data-term-close]").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  form.addEventListener("submit", (e) => { e.preventDefault(); run(input.value); input.value = ""; });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" && hi > 0) { hi--; input.value = history[hi]; e.preventDefault(); }
    if (e.key === "ArrowDown") { hi = Math.min(history.length, hi + 1); input.value = history[hi] || ""; e.preventDefault(); }
  });
  addEventListener("keydown", (e) => {
    const t = e.target;
    if (e.key === "`" && !(t instanceof HTMLInputElement) && !(t instanceof HTMLTextAreaElement)) { e.preventDefault(); dlg.open ? dlg.close() : open(); }
  });

  /* console calling card */
  console.log("%c OGI // octgiristya ", "background:#e10600;color:#fff;font:700 14px monospace;padding:4px 8px");
  console.log("%cLooking under the hood? Good instinct. Press ` for the terminal.", "color:#b7b7bc;font:12px monospace");
})();
