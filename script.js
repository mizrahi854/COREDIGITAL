/* =====================================================
   CoreDigital — script.js ULTIMATE v2
   Splash · GSAP ScrollTrigger · Mobile · Performance
   ===================================================== */
(function () {
  "use strict";

  /* ─────────────────────────────────────────────
     0. PERF — critical images preload
  ───────────────────────────────────────────── */
  const cfg = window.CD_CONFIG || {};
  if (cfg.heroPhoneImage) {
    const link = document.createElement("link");
    link.rel = "preload"; link.as = "image"; link.href = cfg.heroPhoneImage;
    document.head.appendChild(link);
  }

  /* ─────────────────────────────────────────────
     1. SPLASH SCREEN
  ───────────────────────────────────────────── */
  const splash    = document.getElementById("splash");
  const splashBar = document.getElementById("splashBar");
  const splashPct = document.getElementById("splashPct");
  const codeEl    = document.getElementById("splashCode");

  // Code rain lines
  const codeLines = [
    "const reality = new CoreDigital();",
    "reality.design({ style: 'liquid-glass', feel: 'insane' });",
    "await reality.animate({ gsap: true, scroll: 'scrub' });",
    "reality.deploy({ speed: '< 1s', lighthouse: 98 });",
    "// ✦ building your digital future ✦",
    "import { ScrollTrigger } from 'gsap/ScrollTrigger';",
    "gsap.registerPlugin(ScrollTrigger);",
    "const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });",
    "tl.from('.hero-title', { yPercent: 110, duration: 1.1 });",
    "reality.clients.forEach(c => c.revenue *= 1.42);",
    "ScrollTrigger.create({ trigger: '.work', scrub: true });",
    "const glass = new LiquidGlass({ blur: 24, opacity: .08 });",
    "performance.mark('FCP'); // 0.6s ✓",
    "seo.score = 100; lighthouse.score = 98;",
    "whatsapp.connect('972505120820');",
    "// Mobile First · RTL · GSAP · Shopify · Next.js",
    "reality.launch(); // 🚀",
  ];

  let codeHTML = "";
  codeLines.forEach(l => { codeHTML += l + "\n"; });
  if (codeEl) codeEl.textContent = (codeHTML + "\n").repeat(12);

  // Progress bar
  let pct = 0;
  const step = () => {
    const inc = pct < 70 ? (Math.random() * 8 + 4) : (Math.random() * 4 + 1);
    pct = Math.min(100, pct + inc);
    if (splashBar) splashBar.style.width = pct + "%";
    if (splashPct) splashPct.textContent = Math.floor(pct) + "%";
    if (pct < 100) {
      setTimeout(step, pct < 70 ? 80 : 140);
    } else {
      setTimeout(endSplash, 300);
    }
  };
  setTimeout(step, 400);

  function endSplash() {
    if (!splash) return;
    splash.classList.add("done");
    splash.addEventListener("animationend", () => {
      splash.style.display = "none";
      // Kick off hero anim after splash
      initHeroAnim();
    }, { once: true });
  }

  /* ─────────────────────────────────────────────
     2. YEAR
  ───────────────────────────────────────────── */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ─────────────────────────────────────────────
     3. WHATSAPP LINKS
  ───────────────────────────────────────────── */
  if (cfg.whatsapp) {
    document.querySelectorAll('a[href*="wa.me"]').forEach(a => {
      a.href = a.href.replace(/wa\.me\/\d+/, "wa.me/" + cfg.whatsapp);
    });
  }

  /* ─────────────────────────────────────────────
     4. HERO PHONE IMAGE
  ───────────────────────────────────────────── */
  const heroImg = document.getElementById("heroPhoneImg");
  if (heroImg && cfg.heroPhoneImage) heroImg.src = cfg.heroPhoneImage;

  /* ─────────────────────────────────────────────
     5. CURSOR GLOW (desktop only)
  ───────────────────────────────────────────── */
  const cursorGlow = document.getElementById("cursorGlow");
  const cursorDot  = document.getElementById("cursorDot");
  const isHover = window.matchMedia("(hover: hover)").matches;

  if (isHover && cursorGlow && cursorDot) {
    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let gx = mx, gy = my, dx = mx, dy = my;

    window.addEventListener("mousemove", e => { mx = e.clientX; my = e.clientY; });

    // Expand dot on clickable hover
    document.querySelectorAll("a, button, .service, .price, .faq summary").forEach(el => {
      el.addEventListener("mouseenter", () => {
        if (cursorDot) {
          cursorDot.style.width = "24px";
          cursorDot.style.height = "24px";
          cursorDot.style.opacity = ".4";
        }
      });
      el.addEventListener("mouseleave", () => {
        if (cursorDot) {
          cursorDot.style.width = "8px";
          cursorDot.style.height = "8px";
          cursorDot.style.opacity = "1";
        }
      });
    });

    (function loop() {
      // Glow — very lazy
      gx += (mx - gx) * 0.08;
      gy += (my - gy) * 0.08;
      cursorGlow.style.transform = `translate(${gx}px, ${gy}px) translate(-50%, -50%)`;

      // Dot — snappy
      dx += (mx - dx) * 0.35;
      dy += (my - dy) * 0.35;
      cursorDot.style.transform = `translate(${dx}px, ${dy}px) translate(-50%, -50%)`;

      requestAnimationFrame(loop);
    })();
  }

  /* ─────────────────────────────────────────────
     6. MOBILE MENU
  ───────────────────────────────────────────── */
  const menuToggle    = document.getElementById("menuToggle");
  const navLinks      = document.getElementById("navLinks");
  const mobileOverlay = document.getElementById("mobileOverlay");

  function openMenu() {
    navLinks.classList.add("active");
    menuToggle.classList.add("open");
    mobileOverlay.classList.add("visible");
    document.body.style.overflow = "hidden";
  }
  function closeMenu() {
    navLinks.classList.remove("active");
    menuToggle.classList.remove("open");
    mobileOverlay.classList.remove("visible");
    document.body.style.overflow = "";
  }

  if (menuToggle) menuToggle.addEventListener("click", () => {
    navLinks.classList.contains("active") ? closeMenu() : openMenu();
  });
  if (mobileOverlay) mobileOverlay.addEventListener("click", closeMenu);
  document.querySelectorAll(".nav-link").forEach(a => a.addEventListener("click", closeMenu));

  /* ─────────────────────────────────────────────
     7. INTERSECTION OBSERVER — fallback + project rows
  ───────────────────────────────────────────── */
  // reveal-fade
  const ioFade = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in-view"); ioFade.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal-fade").forEach(el => ioFade.observe(el));

  // project rows
  const ioProject = new IntersectionObserver(entries => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add("visible"), i * 80);
        ioProject.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll(".project-row").forEach(el => ioProject.observe(el));

  /* ─────────────────────────────────────────────
     8. NAV SHRINK ON SCROLL
  ───────────────────────────────────────────── */
  const nav = document.getElementById("nav");
  let lastY = 0;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if (nav) {
      nav.style.backdropFilter = y > 60 ? "blur(36px) saturate(180%)" : "blur(24px) saturate(140%)";
      nav.style.background = y > 60
        ? "linear-gradient(135deg, rgba(255,255,255,.12), rgba(255,255,255,.04))"
        : "var(--glass-bg)";
      // hide on fast scroll down, show on scroll up
      if (y > lastY + 8 && y > 200) {
        nav.style.transform = "translateX(-50%) translateY(-120%)";
      } else if (y < lastY - 4) {
        nav.style.transform = "translateX(-50%) translateY(0)";
      }
    }
    lastY = y;
  }, { passive: true });

  /* ─────────────────────────────────────────────
     9. GSAP — kicks off after splash
  ───────────────────────────────────────────── */
  function initHeroAnim() {
    if (!window.gsap) return;
    gsap.registerPlugin(ScrollTrigger);

    // ── Hero title line-by-line reveal ──
    gsap.from(".reveal-line > *", {
      yPercent: 115,
      duration: 1.15,
      ease: "expo.out",
      stagger: 0.13,
      delay: 0.05,
    });

    // ── Hero sub + cta + stats ──
    gsap.from([".hero-badge", ".hero-sub", ".hero-cta", ".hero-stats"], {
      opacity: 0, y: 40, duration: 1,
      ease: "expo.out", stagger: 0.1, delay: 0.35,
    });

    // ── Orbiting phone float ──
    gsap.to("#heroPhone", {
      y: -22, rotate: -5, duration: 4.5, ease: "sine.inOut", yoyo: true, repeat: -1,
    });
    gsap.to(".orbit-1", { rotate: 360, duration: 28, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
    gsap.to(".orbit-2", { rotate: -360, duration: 38, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
    gsap.to(".orbit-3", { rotate: 360, duration: 48, ease: "none", repeat: -1, transformOrigin: "50% 50%" });

    initScrollAnims();
  }

  function initScrollAnims() {
    if (!window.gsap) return;

    // ── Hero scroll parallax ──
    gsap.to(".hero-scene", {
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1.2 },
      scale: 0.65, opacity: 0.2, y: -120,
    });
    gsap.to(".hero-bg-text span", {
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 },
      xPercent: -25,
    });

    // ── Big-line word fill (scroll-driven, like video) ──
    const words = gsap.utils.toArray(".big-line .word");
    if (words.length) {
      ScrollTrigger.create({
        trigger: ".big-line-section",
        start: "top 75%",
        end: "bottom 35%",
        scrub: 1,
        onUpdate(self) {
          const idx = Math.floor(self.progress * (words.length + 1));
          words.forEach((w, i) => w.classList.toggle("active", i < idx));
        },
      });
    }

    // ── Marquee speed boost on scroll ──
    const marqueeTrack = document.querySelector(".marquee-track");
    if (marqueeTrack) {
      ScrollTrigger.create({
        trigger: ".marquee",
        start: "top 90%",
        end: "bottom 10%",
        onEnter: () => marqueeTrack.style.animationDuration = "18s",
        onLeave: () => marqueeTrack.style.animationDuration = "38s",
        onEnterBack: () => marqueeTrack.style.animationDuration = "18s",
        onLeaveBack: () => marqueeTrack.style.animationDuration = "38s",
      });
    }

    // ── Section heads ──
    gsap.utils.toArray(".section-head").forEach(el => {
      gsap.from(el.children, {
        scrollTrigger: { trigger: el, start: "top 88%" },
        y: 50, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.1,
      });
    });

    // ── Service cards — stagger in ──
    gsap.utils.toArray(".services-grid").forEach(grid => {
      gsap.from(grid.children, {
        scrollTrigger: { trigger: grid, start: "top 82%" },
        y: 60, opacity: 0, duration: 0.9, ease: "expo.out", stagger: 0.07,
      });
    });

    // ── Process steps ──
    gsap.utils.toArray(".process-grid").forEach(grid => {
      gsap.from(grid.children, {
        scrollTrigger: { trigger: grid, start: "top 82%" },
        y: 50, opacity: 0, scale: 0.96, duration: 0.8, ease: "expo.out", stagger: 0.1,
      });
    });

    // ── Pricing cards ──
    gsap.from(".price", {
      scrollTrigger: { trigger: ".pricing-grid", start: "top 82%" },
      y: 70, opacity: 0, duration: 0.9, ease: "expo.out", stagger: 0.09,
    });

    // ── Testimonials ──
    gsap.from(".testi", {
      scrollTrigger: { trigger: ".testi-grid", start: "top 85%" },
      y: 50, opacity: 0, duration: 0.8, ease: "expo.out", stagger: 0.1,
    });

    // ── FAQ ──
    gsap.from(".faq", {
      scrollTrigger: { trigger: ".faq-list", start: "top 85%" },
      y: 30, opacity: 0, duration: 0.7, ease: "expo.out", stagger: 0.06,
    });

    // ── Contact card ──
    gsap.from(".contact-card", {
      scrollTrigger: { trigger: ".contact-card", start: "top 85%" },
      y: 60, opacity: 0, scale: 0.97, duration: 1.1, ease: "expo.out",
    });

    // ── Project rows — EPIC phone jump + parallax ──
    gsap.utils.toArray(".project-row").forEach((row, i) => {
      const phone   = row.querySelector(".device-phone, .device-phone-large");
      const desktop = row.querySelector(".device-desktop");
      const info    = row.querySelector(".project-info");
      const isReverse = row.classList.contains("project-row--reverse");

      // Entrance: card slides up, phone flies in from below
      const tl = gsap.timeline({
        scrollTrigger: { trigger: row, start: "top 85%", once: true }
      });
      if (desktop) tl.from(desktop, { y: 60, opacity: 0, scale: .96, duration: 1.1, ease: "expo.out" }, 0);
      if (phone)   tl.from(phone,   { y: 120, opacity: 0, rotate: isReverse ? 12 : -12, duration: 1.3, ease: "expo.out" }, 0.1);
      if (info)    tl.from(info.children, { y: 40, opacity: 0, stagger: .08, duration: .9, ease: "expo.out" }, 0.2);

      // Parallax: phone and desktop drift at different speeds
      if (phone) {
        gsap.to(phone, {
          scrollTrigger: { trigger: row, start: "top bottom", end: "bottom top", scrub: 1.2 },
          y: -50,
        });
      }
      if (desktop) {
        gsap.to(desktop, {
          scrollTrigger: { trigger: row, start: "top bottom", end: "bottom top", scrub: 1.8 },
          y: -20,
        });
      }

      // Card glow pulse on scroll enter
      if (row) {
        ScrollTrigger.create({
          trigger: row, start: "top 70%", once: true,
          onEnter: () => {
            gsap.fromTo(row, { boxShadow: "0 40px 100px -30px rgba(0,0,0,.7), 0 0 80px rgba(139,111,255,.06)" },
              { boxShadow: "0 40px 100px -30px rgba(0,0,0,.7), 0 0 120px rgba(139,111,255,.25)", duration: .8, yoyo: true, repeat: 1 });
          }
        });
      }
    });

    // ── 3D tilt for desktop + phone devices ──
    if (isHover) {
      document.querySelectorAll(".project-row").forEach(row => {
        const desktop = row.querySelector(".device-desktop");
        const phone = row.querySelector(".device-phone, .device-phone-large");

        row.addEventListener("mousemove", e => {
          const r = row.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          if (desktop) gsap.to(desktop, { rotateY: x * -10, rotateX: y * 5, duration: 0.7, ease: "power3.out" });
          if (phone)   gsap.to(phone,   { rotateY: x * 14,  rotateX: y * -6, duration: 0.7, ease: "power3.out" });
        });
        row.addEventListener("mouseleave", () => {
          if (desktop) gsap.to(desktop, { rotateY: 0, rotateX: 0, duration: 1, ease: "power3.out" });
          if (phone)   gsap.to(phone,   { rotateY: 0, rotateX: 0, duration: 1, ease: "power3.out" });
        });
      });
    }

    // ── Service card tilt ──
    if (isHover) {
      document.querySelectorAll(".service").forEach(card => {
        card.style.transformStyle = "preserve-3d";
        card.addEventListener("mousemove", e => {
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          gsap.to(card, { rotateY: x * 12, rotateX: y * -8, duration: 0.5, ease: "power3.out", scale: 1.03 });
        });
        card.addEventListener("mouseleave", () => {
          gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.7, ease: "power3.out", scale: 1 });
        });
      });
    }

    // ── Kicker letter-by-letter reveal ──
    gsap.utils.toArray(".kicker").forEach(el => {
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: "top 90%" },
        opacity: 0, x: 20, duration: 0.7, ease: "expo.out",
      });
    });
  }

  /* ─────────────────────────────────────────────
     10. WINDOW LOAD — GSAP fallback if no splash
  ───────────────────────────────────────────── */
  window.addEventListener("load", () => {
    // if splash already dismissed or never existed
    if (!splash || splash.style.display === "none") {
      initHeroAnim();
    }
    // lazy-load all images
    document.querySelectorAll("img[loading='lazy']").forEach(img => {
      if (!img.src && img.dataset.src) img.src = img.dataset.src;
    });
  });

  /* ─────────────────────────────────────────────
     11. SMOOTH ANCHOR SCROLL
  ───────────────────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", e => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    });
  });

  /* ─────────────────────────────────────────────
     12. REDUCE MOTION RESPECT
  ───────────────────────────────────────────── */
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.style.setProperty("--anim-duration", "0s");
    if (splash) {
      splash.style.display = "none";
      initHeroAnim = () => {};
    }
  }

})();