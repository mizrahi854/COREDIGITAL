/* =====================================================
   CoreDigital — script.js ULTRA v3
   Mobile-first · GSAP · Splash · WhatsApp form
   ===================================================== */
(function () {
  "use strict";

  /* ─── SPLASH ─── */
  const splash    = document.getElementById("splash");
  const splashBar = document.getElementById("splashBar");
  const splashPct = document.getElementById("splashPct");
  const codeEl    = document.getElementById("splashCode");

  const lines = [
    "const site = new CoreDigital();",
    "site.build({ html: true, css: true, js: true });",
    "site.animate({ gsap: true, scroll: 'scrub' });",
    "site.deploy({ speed: '<1s', lighthouse: 98 });",
    "// ✦ building your digital future ✦",
    "performance.mark('FCP'); // 0.6s ✓",
    "seo.score = 100; mobile.first = true;",
    "whatsapp.connect('972505120820');",
    "reality.launch(); // 🚀",
    "// HTML · CSS · JS · Liquid Glass",
    "clients.forEach(c => c.revenue *= 1.42);",
    "site.clients = 40; site.rating = 5.0;",
  ];
  if (codeEl) {
    let t = "";
    lines.forEach(l => t += l + "\n");
    codeEl.textContent = (t + "\n").repeat(14);
  }

  let pct = 0;
  const tick = () => {
    pct = Math.min(100, pct + (pct < 70 ? Math.random() * 9 + 4 : Math.random() * 4 + 1));
    if (splashBar) splashBar.style.width = pct + "%";
    if (splashPct) splashPct.textContent = Math.floor(pct) + "%";
    if (pct < 100) setTimeout(tick, pct < 70 ? 75 : 130);
    else setTimeout(endSplash, 280);
  };
  setTimeout(tick, 350);

  function endSplash() {
    if (!splash) return;
    splash.classList.add("done");
    splash.addEventListener("animationend", () => {
      splash.style.display = "none";
      startHero();
    }, { once: true });
  }

  /* ─── YEAR ─── */
  const yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ─── CURSOR (desktop only) ─── */
  const cg = document.getElementById("cursorGlow");
  const cd = document.getElementById("cursorDot");
  const isDesktop = window.matchMedia("(hover:hover) and (pointer:fine)").matches;

  if (isDesktop && cg && cd) {
    let mx = innerWidth/2, my = innerHeight/2;
    let gx = mx, gy = my, dx = mx, dy = my;
    addEventListener("mousemove", e => { mx = e.clientX; my = e.clientY; });
    document.querySelectorAll("a,button,.service,.price").forEach(el => {
      el.addEventListener("mouseenter", () => { cd.style.width="22px"; cd.style.height="22px"; cd.style.opacity=".35"; });
      el.addEventListener("mouseleave", () => { cd.style.width="8px"; cd.style.height="8px"; cd.style.opacity="1"; });
    });
    (function loop() {
      gx += (mx-gx)*.08; gy += (my-gy)*.08;
      dx += (mx-dx)*.32; dy += (my-dy)*.32;
      cg.style.transform = `translate(${gx}px,${gy}px) translate(-50%,-50%)`;
      cd.style.transform = `translate(${dx}px,${dy}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ─── MOBILE MENU ─── */
  const toggle  = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");
  const overlay  = document.getElementById("mobileOverlay");

  function openMenu() {
    navLinks.classList.add("active");
    toggle.classList.add("open");
    toggle.setAttribute("aria-expanded","true");
    overlay.classList.add("visible");
    document.body.style.overflow = "hidden";
  }
  function closeMenu() {
    navLinks.classList.remove("active");
    toggle.classList.remove("open");
    toggle.setAttribute("aria-expanded","false");
    overlay.classList.remove("visible");
    document.body.style.overflow = "";
  }
  if (toggle) toggle.addEventListener("click", () =>
    navLinks.classList.contains("active") ? closeMenu() : openMenu()
  );
  if (overlay) overlay.addEventListener("click", closeMenu);
  document.querySelectorAll(".nav-link").forEach(a => a.addEventListener("click", closeMenu));

  /* ─── NAV HIDE/SHOW ON SCROLL ─── */
  const nav = document.getElementById("nav");
  let lastY = 0;
  addEventListener("scroll", () => {
    const y = scrollY;
    if (nav) {
      if (y > lastY + 10 && y > 180) nav.style.transform = "translateX(-50%) translateY(-120%)";
      else if (y < lastY - 6)       nav.style.transform = "translateX(-50%) translateY(0)";
    }
    lastY = y;
  }, { passive: true });

  /* ─── CONTACT FORM → WHATSAPP ─── */
  const form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const name  = (document.getElementById("cf-name")?.value  || "").trim();
      const phone = (document.getElementById("cf-phone")?.value || "").trim();
      const email = (document.getElementById("cf-email")?.value || "").trim();
      const msg   = (document.getElementById("cf-msg")?.value   || "").trim();
      if (!name || !phone) {
        // shake the empty field
        const empty = !name
          ? document.getElementById("cf-name")
          : document.getElementById("cf-phone");
        if (empty) {
          empty.style.borderColor = "rgba(255,95,100,.7)";
          empty.style.animation = "shake .4s ease";
          setTimeout(() => { empty.style.animation=""; empty.style.borderColor=""; }, 800);
        }
        return;
      }
      const text = `שלום CoreDigital! 👋\n\nשם: ${name}\nטלפון: ${phone}${email ? "\nאימייל: "+email : ""}${msg ? "\n\n"+msg : ""}`;
      window.open("https://wa.me/972505120820?text=" + encodeURIComponent(text), "_blank");
    });
  }

  /* shake keyframe */
  if (!document.querySelector("#shakeStyle")) {
    const st = document.createElement("style");
    st.id = "shakeStyle";
    st.textContent = "@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}";
    document.head.appendChild(st);
  }

  /* ─── INTERSECTION OBSERVER — project rows ─── */
  const ioRow = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("visible"); ioRow.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll(".project-row").forEach(r => ioRow.observe(r));

  /* reveal-fade */
  const ioFade = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in-view"); ioFade.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll(".reveal-fade").forEach(el => ioFade.observe(el));

  /* ─── SMOOTH ANCHOR ─── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", e => {
      const t = document.querySelector(a.getAttribute("href"));
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: "smooth", block: "start" });
      // extra offset for nav
      setTimeout(() => scrollBy(0, -80), 100);
    });
  });

  /* ─── GSAP ─── */
  function startHero() {
    if (!window.gsap) { initFallback(); return; }
    gsap.registerPlugin(ScrollTrigger);

    /* hero title */
    gsap.from(".reveal-line > span, .reveal-line > em", {
      yPercent: 115, duration: 1.15, ease: "expo.out", stagger: 0.12, delay: 0.05,
    });
    gsap.from([".hero-badge",".hero-sub",".hero-cta",".hero-stats"], {
      opacity: 0, y: 38, duration: 1, ease: "expo.out", stagger: 0.1, delay: 0.3,
    });

    /* hero phone float + orbits */
    gsap.to("#heroPhone", { y:-20, rotate:-5, duration:4.5, ease:"sine.inOut", yoyo:true, repeat:-1 });
    gsap.to(".orbit-1", { rotate:360,  duration:28, ease:"none", repeat:-1, transformOrigin:"50% 50%" });
    gsap.to(".orbit-2", { rotate:-360, duration:38, ease:"none", repeat:-1, transformOrigin:"50% 50%" });
    gsap.to(".orbit-3", { rotate:360,  duration:50, ease:"none", repeat:-1, transformOrigin:"50% 50%" });

    /* hero parallax out */
    gsap.to(".hero-scene", {
      scrollTrigger:{ trigger:".hero", start:"top top", end:"bottom top", scrub:1.2 },
      scale:.6, opacity:.15, y:-130,
    });
    gsap.to(".hero-bg-text span", {
      scrollTrigger:{ trigger:".hero", start:"top top", end:"bottom top", scrub:1 },
      xPercent:-22,
    });

    /* big line word fill */
    const words = gsap.utils.toArray(".big-line .word");
    if (words.length) {
      ScrollTrigger.create({
        trigger:".big-line-section", start:"top 78%", end:"bottom 32%", scrub:1,
        onUpdate(s) {
          const idx = Math.floor(s.progress * (words.length + 1));
          words.forEach((w,i) => w.classList.toggle("active", i < idx));
        },
      });
    }

    /* marquee accelerate on scroll */
    const mt = document.querySelector(".marquee-track");
    if (mt) {
      ScrollTrigger.create({
        trigger:".marquee", start:"top 90%", end:"bottom 10%",
        onEnter:()=>mt.style.animationDuration="14s",
        onLeave:()=>mt.style.animationDuration="36s",
        onEnterBack:()=>mt.style.animationDuration="14s",
        onLeaveBack:()=>mt.style.animationDuration="36s",
      });
    }

    /* section heads */
    gsap.utils.toArray(".section-head").forEach(el => {
      gsap.from(el.children, {
        scrollTrigger:{ trigger:el, start:"top 88%" },
        y:50, opacity:0, duration:1, ease:"expo.out", stagger:.1,
      });
    });

    /* service cards */
    gsap.from(".services-grid > *", {
      scrollTrigger:{ trigger:".services-grid", start:"top 82%" },
      y:55, opacity:0, duration:.9, ease:"expo.out", stagger:.07,
    });

    /* process steps */
    gsap.from(".process-grid > *", {
      scrollTrigger:{ trigger:".process-grid", start:"top 82%" },
      y:45, opacity:0, scale:.96, duration:.8, ease:"expo.out", stagger:.1,
    });

    /* pricing */
    gsap.from(".price", {
      scrollTrigger:{ trigger:".pricing-grid", start:"top 82%" },
      y:65, opacity:0, duration:.9, ease:"expo.out", stagger:.09,
    });

    /* testimonials */
    gsap.from(".testi", {
      scrollTrigger:{ trigger:".testi-grid", start:"top 85%" },
      y:45, opacity:0, duration:.8, ease:"expo.out", stagger:.1,
    });

    /* faq */
    gsap.from(".faq", {
      scrollTrigger:{ trigger:".faq-list", start:"top 85%" },
      y:28, opacity:0, duration:.7, ease:"expo.out", stagger:.06,
    });

    /* contact */
    gsap.from(".contact-card", {
      scrollTrigger:{ trigger:".contact-card", start:"top 85%" },
      y:55, opacity:0, scale:.97, duration:1.1, ease:"expo.out",
    });

    /* ── PROJECT ROWS — EPIC entrance + parallax ── */
    gsap.utils.toArray(".project-row").forEach(row => {
      const isRev  = row.classList.contains("project-row--reverse");
      const isApp  = row.classList.contains("project-row--app");
      const desk   = row.querySelector(".device-desktop");
      const phone  = row.querySelector(".device-phone,.device-phone-large");
      const info   = row.querySelector(".project-info");

      const tl = gsap.timeline({
        scrollTrigger:{ trigger:row, start:"top 87%", once:true }
      });

      if (desk)  tl.from(desk,  { y:70, opacity:0, scale:.95, duration:1.1, ease:"expo.out" }, 0);
      if (phone && !isApp) {
        tl.from(phone, { y:130, opacity:0, rotate: isRev ? 14 : -14, duration:1.35, ease:"expo.out" }, 0.08);
      }
      if (phone && isApp) {
        tl.from(phone, { y:100, opacity:0, scale:.88, duration:1.3, ease:"expo.out" }, 0.05);
      }
      if (info) tl.from(info.children, { y:40, opacity:0, stagger:.09, duration:.9, ease:"expo.out" }, 0.18);

      /* parallax */
      if (phone) gsap.to(phone, {
        scrollTrigger:{ trigger:row, start:"top bottom", end:"bottom top", scrub:1.3 }, y:-45,
      });
      if (desk) gsap.to(desk, {
        scrollTrigger:{ trigger:row, start:"top bottom", end:"bottom top", scrub:1.9 }, y:-18,
      });

      /* glow burst on enter */
      ScrollTrigger.create({
        trigger:row, start:"top 72%", once:true,
        onEnter:() => gsap.fromTo(row,
          { boxShadow:"0 40px 100px -30px rgba(0,0,0,.7),0 0 80px rgba(124,92,252,.05)" },
          { boxShadow:"0 40px 100px -30px rgba(0,0,0,.7),0 0 120px rgba(124,92,252,.28)", duration:.9, yoyo:true, repeat:1 }
        ),
      });
    });

    /* 3D tilt — desktop only */
    if (isDesktop) {
      document.querySelectorAll(".project-row").forEach(row => {
        const desk  = row.querySelector(".device-desktop");
        const phone = row.querySelector(".device-phone,.device-phone-large");
        row.addEventListener("mousemove", e => {
          const r = row.getBoundingClientRect();
          const x = (e.clientX - r.left)/r.width  - .5;
          const y = (e.clientY - r.top )/r.height - .5;
          if (desk)  gsap.to(desk,  { rotateY:x*-10, rotateX:y*5,  duration:.7, ease:"power3.out" });
          if (phone) gsap.to(phone, { rotateY:x*13,  rotateX:y*-6, duration:.7, ease:"power3.out" });
        });
        row.addEventListener("mouseleave", () => {
          if (desk)  gsap.to(desk,  { rotateY:0, rotateX:0, duration:1, ease:"power3.out" });
          if (phone) gsap.to(phone, { rotateY:0, rotateX:0, duration:1, ease:"power3.out" });
        });
      });

      /* service tilt */
      document.querySelectorAll(".service").forEach(card => {
        card.addEventListener("mousemove", e => {
          const r = card.getBoundingClientRect();
          const x = (e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5;
          gsap.to(card, { rotateY:x*12, rotateX:y*-8, duration:.5, ease:"power3.out", scale:1.04 });
        });
        card.addEventListener("mouseleave", () =>
          gsap.to(card, { rotateY:0, rotateX:0, duration:.7, ease:"power3.out", scale:1 })
        );
      });
    }
  }

  /* fallback if GSAP not loaded */
  function initFallback() {
    document.querySelectorAll(".reveal-line>span,.reveal-line>em").forEach(el => {
      el.style.opacity="1"; el.style.transform="translateY(0)";
    });
  }

  /* window load fallback */
  addEventListener("load", () => {
    if (!splash || splash.style.display === "none") startHero();
    // native lazy load fallback
    document.querySelectorAll("img[loading='lazy']").forEach(img => {
      if (!img.src && img.dataset.src) img.src = img.dataset.src;
    });
  });

  /* reduced motion */
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) {
    if (splash) splash.style.display = "none";
    document.documentElement.style.setProperty("--anim-duration","0s");
    startHero = initFallback;
  }

})();
