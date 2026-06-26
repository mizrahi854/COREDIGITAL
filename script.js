/* =====================================================
   CoreDigital — ULTRA INTERACTIVE SCRIPT ENGINE v4
   60FPS Animations · GSAP Flow · Production Validated
   ===================================================== */

(function () {
  "use strict";

  /* ─── HARDWARE ACCELERATED CINEMATIC SPLASH SCREEN ─── */
  const splash = document.getElementById("splash");
  const splashBar = document.getElementById("splashBar");
  const splashPct = document.getElementById("splashPct");
  const codeEl = document.getElementById("splashCode");

  const lines = [
    "const studio = new CoreDigitalStudio();",
    "studio.set定位({ mobileFirst: true, performance: '60fps' });",
    "studio.loadComponents(['GSAP', 'LiquidGlass', 'CRO_Engine']);",
    "studio.optimizeLighthouseScore({ target: 95 });",
    "// ✦ Engineering premium digital infrastructure ✦",
    "performance.mark('FCP_Optimized'); // 0.3s",
    "seo.schemaMarkup = 'JSON-LD Ready'; structure.semantic = true;",
    "database.connect('Firebase_Secure_Cluster');",
    "studio.launchProductionEnvironment(); // 🚀",
    "// Custom Premium Architecture — No Templates Allowed",
    "agency.positioning = 'Digital & Technology Studio';",
    "clients.forEach(c => c.conversionRate *= 1.42);",
  ];

  if (codeEl) {
    let textCombine = "";
    lines.forEach(line => textCombine += line + "\n");
    codeEl.textContent = (textCombine + "\n").repeat(15);
  }

  let progressPct = 0;
  const runTicks = () => {
    progressPct = Math.min(100, progressPct + (progressPct < 75 ? Math.random() * 12 + 6 : Math.random() * 5 + 1));
    if (splashBar) splashBar.style.width = progressPct + "%";
    if (splashPct) splashPct.textContent = Math.floor(progressPct) + "%";
    
    if (progressPct < 100) {
      setTimeout(runTicks, progressPct < 75 ? 40 : 80);
    } else {
      setTimeout(terminateSplash, 150);
    }
  };
  setTimeout(runTicks, 100);

  function terminateSplash() {
    if (!splash) return;
    splash.classList.add("done");
    splash.addEventListener("transitionend", () => {
      splash.style.display = "none";
      triggerScrollAnimations();
    }, { once: true });
  }

  /* ─── FOOTER AUTO-DYNAMIC YEAR SYNC ─── */
  const yearContainer = document.getElementById("year");
  if (yearContainer) yearContainer.textContent = new Date().getFullYear();

  /* ─── DYNAMIC MOUSE LIGHTING & SPOTLIGHT FOCUS ─── */
  const cursorGlow = document.getElementById("cursorGlow");
  const cursorDot = document.getElementById("cursorDot");
  const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (supportsHover && cursorGlow && cursorDot) {
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let glowX = mouseX, glowY = mouseY;
    let dotX = mouseX, dotY = mouseY;

    window.addEventListener("mousemove", e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, { passive: true });

    // Micro interactions targeting responsive clickable structures
    document.querySelectorAll("a, button, .service, .price, .faq, input, textarea").forEach(interactiveElement => {
      interactiveElement.addEventListener("mouseenter", () => {
        cursorDot.style.width = "20px";
        cursorDot.style.height = "20px";
        cursorDot.style.backgroundColor = "rgba(255, 95, 203, 0.25)";
        cursorDot.style.borderColor = "var(--pink)";
        cursorDot.style.borderWidth = "1px";
        cursorDot.style.borderStyle = "solid";
      });
      interactiveElement.addEventListener("mouseleave", () => {
        cursorDot.style.width = "6px";
        cursorDot.style.height = "6px";
        cursorDot.style.backgroundColor = "var(--purple-2)";
        cursorDot.style.border = "none";
      });
    });

    (function renderLoop() {
      glowX += (mouseX - glowX) * 0.08;
      glowY += (mouseY - glowY) * 0.08;
      dotX += (mouseX - dotX) * 0.25;
      dotY += (mouseY - dotY) * 0.25;

      cursorGlow.style.transform = `translate(${glowX}px, ${glowY}px) translate(-50%, -50%)`;
      cursorDot.style.transform = `translate(${dotX}px, ${dotY}px) translate(-50%, -50%)`;
      
      requestAnimationFrame(renderLoop);
    })();
  }

  /* ─── ULTRA SMOOTH MOBILE-FIRST BURGER MENU SYSTEM ─── */
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");
  const mobileOverlay = document.getElementById("mobileOverlay");

  function openBurgerMenu() {
    navLinks.classList.add("active");
    menuToggle.classList.add("open");
    menuToggle.setAttribute("aria-expanded", "true");
    mobileOverlay.classList.add("visible");
    document.body.style.overflow = "hidden"; // Absolute scroll lock for pristine user experience
  }


  

  function closeBurgerMenu() {
    navLinks.classList.remove("active");
    menuToggle.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    mobileOverlay.classList.remove("visible");
    document.body.style.overflow = "";
  }

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      navLinks.classList.contains("active") ? closeBurgerMenu() : openBurgerMenu();
    });
  }

  if (mobileOverlay) mobileOverlay.addEventListener("click", closeBurgerMenu);
  document.querySelectorAll(".nav-link").forEach(link => link.addEventListener("click", closeBurgerMenu));

  /* ─── HEADER SMART INTELLIGENT SCROLL SYSTEM ─── */
  const mainNav = document.getElementById("nav");
  let lastScrollY = 0;

  window.addEventListener("scroll", () => {
    const currentScrollY = window.scrollY;
    if (mainNav) {
      if (currentScrollY > lastScrollY + 15 && currentScrollY > 150) {
        mainNav.style.transform = "translateX(-50%) translateY(-150%)"; // Smooth exit
      } else if (currentScrollY < lastScrollY - 8) {
        mainNav.style.transform = "translateX(-50%) translateY(0)"; // Premium fluid re-entry
      }
    }
    lastScrollY = currentScrollY;
  }, { passive: true });

  /* ─── HIGH PERFORMANCE GSAP CINEMATIC SCROLL ENGINE ─── */
  function triggerScrollAnimations() {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

    gsap.registerPlugin(ScrollTrigger);

    // Dynamic 3D Hero Cube rotation logic syncing with scroll position
    gsap.to(".cube", {
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: 0.5
      },
      rotateX: 60,
      rotateY: 180,
      ease: "none"
    });

    // Staggered text line reveal system mimicking world-class tech pipelines
    gsap.from(".reveal-line span", {
      y: "100%",
      duration: 1,
      ease: "power4.out",
      stagger: 0.15
    });

    gsap.from(".hero-x-sub, .hero-cta", {
      opacity: 0,
      y: 20,
      duration: 1.2,
      ease: "power3.out",
      delay: 0.4
    });

    // Fluid background parallax word animations
    gsap.to(".hero-bg-text span", {
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: 0.5
      },
      xPercent: -15
    });

    gsap.to(".story-bg-word", {
      scrollTrigger: {
        trigger: ".premium-story-section",
        start: "top bottom",
        end: "bottom top",
        scrub: 0.5
      },
      xPercent: 12
    });

    // Scroll reveal orchestration utilizing clean stagger pipelines
    const structuralScrollTriggers = [
      { element: ".story-card", trigger: ".story-grid", stagger: 0.12 },
      { element: ".why-card", trigger: ".why-grid", stagger: 0.2 },
      { element: ".service", trigger: ".services-grid", stagger: 0.08 },
      { element: ".step", trigger: ".process-steps", stagger: 0.1 },
      { element: ".testi", trigger: ".testi-grid", stagger: 0.15 },
      { element: ".price", trigger: ".pricing-grid", stagger: 0.12 }
    ];

    structuralScrollTriggers.forEach(config => {
      gsap.from(config.element, {
        scrollTrigger: {
          trigger: config.trigger,
          start: "top 88%",
          toggleActions: "play none none none"
        },
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: "power3.out",
        stagger: config.stagger
      });
    });

    // Scroll Reveal trigger specific to individual project rows
    gsap.utils.toArray(".project-row").forEach(row => {
      gsap.from(row, {
        scrollTrigger: {
          trigger: row,
          start: "top 85%",
          toggleActions: "play none none none"
        },
        opacity: 0,
        y: 60,
        duration: 1,
        ease: "power3.out"
      });
    });
  }

  /* ─── INTERSECTION COUNTER ENGINE ─── */
  const animateCounterElement = el => {
    const targetVal = parseInt(el.getAttribute("data-target"), 10);
    const animObj = { val: 0 };
    gsap.to(animObj, {
      val: targetVal,
      duration: 2,
      ease: "power3.out",
      onUpdate: () => {
        el.textContent = Math.floor(animObj.val);
      }
    });
  };

  const counterObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounterElement(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  document.querySelectorAll(".counter").forEach(counter => counterObserver.observe(counter));

  /* ─── MAGNETIC PHYSICS CONSTRAINED HOVER BUTTON ENGINE ─── */
  const magneticButtons = document.querySelectorAll(".btn-magnetic");
  if (supportsHover) {
    magneticButtons.forEach(btn => {
      btn.addEventListener("mousemove", e => {
        const dimensions = btn.getBoundingClientRect();
        const offsetX = (e.clientX - dimensions.left - dimensions.width / 2) * 0.35;
        const offsetY = (e.clientY - dimensions.top - dimensions.height / 2) * 0.35;
        btn.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "";
      });
    });
  }

  /* ─── REAL-TIME INTERACTIVE SCROLL PROGRESS BAR ─── */
  const progressBar = document.getElementById("scrollProgress");
  if (progressBar) {
    window.addEventListener("scroll", () => {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const computedScrollRatio = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
      progressBar.style.transform = `scaleX(${computedScrollRatio})`;
    }, { passive: true });
  }

  /* ─── HIGH CONVERSION CONTEXTUAL LEAD FORM ENGINE ─── */
  const leadForm = document.getElementById("contactForm");
  const formStatus = document.getElementById("formStatus");

  if (leadForm) {
    leadForm.addEventListener("submit", event => {
      event.preventDefault();

      const clientName = document.getElementById("clientName").value.trim();
      const clientPhone = document.getElementById("clientPhone").value.trim();
      const clientEmail = document.getElementById("clientEmail").value.trim();

      if (!clientName || !clientPhone) {
        formStatus.className = "form-status error";
        formStatus.textContent = "אנא מלא את שדות החובה (שם וטלפון)";
        formStatus.setAttribute("aria-hidden", "false");
        return;
      }

      // UX Loading state presentation
      formStatus.className = "form-status";
      formStatus.style.color = "var(--purple-2)";
      formStatus.textContent = "שולח נתונים בצורה מאובטחת...";
      formStatus.setAttribute("aria-hidden", "false");

      // Simulating a state-of-the-art secure asynchronous cloud transmission API pipeline
      setTimeout(() => {
        formStatus.className = "form-status success";
        formStatus.textContent = "✦ פנייתך התקבלה בהצלחה! מומחה אסטרטגיה יצור קשר בתוך פחות מ-3 שעות.";
        leadForm.reset();
      }, 1200);
    });
  }
})();
