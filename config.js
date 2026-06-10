/* =====================================================
   CoreDigital — עריכת תוכן בקובץ אחד
   החלף קישורי תמונות / טקסטים בלבד.
   ===================================================== */

window.CD_CONFIG = {
  // תמונה שמופיעה בתוך הטלפון הצף בהירו (אפשר screenshot של אפליקציה)
  heroPhoneImage:
    "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80",

  // טלפון של וואטסאפ (פורמט בינלאומי בלי + ובלי 0 בהתחלה)
  whatsapp: "972505120820",

  // ============== תיק עבודות ==============
  // type: "dual"  = תצוגת מחשב + טלפון
  // type: "phone" = תצוגת אפליקציה — טלפון בלבד
  portfolio: [
    {
      type: "dual",
      title: "Gino Vino — בוטיק יין",
      subtitle: "אתר תדמית + הזמנות אונליין · 2026",
      tags: ["Next.js", "Shopify", "GSAP"],
      desktopImage:
        "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1600&q=80",
      mobileImage:
        "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=800&q=80",
      url: "#",
    },
    {
      type: "dual",
      title: "Tchelet Engineering",
      subtitle: "אתר חברת הנדסה · ב2 שפות",
      tags: ["WordPress", "SEO", "RTL"],
      desktopImage:
        "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=1600&q=80",
      mobileImage:
        "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=800&q=80",
      url: "#",
    },
    {
      type: "phone",
      title: "FitFlow — אפליקציית כושר",
      subtitle: "אפליקציית מובייל · React Native · iOS + Android",
      tags: ["React Native", "Firebase", "iOS 18"],
      mobileImage:
        "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=900&q=80",
      url: "#",
    },
    {
      type: "dual",
      title: "Aria Villas — נופש יוקרה",
      subtitle: "אתר בוטיק + מערכת הזמנות",
      tags: ["Next.js", "Stripe", "i18n"],
      desktopImage:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1600&q=80",
      mobileImage:
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
      url: "#",
    },
    {
      type: "phone",
      title: "MindSpace — מדיטציה",
      subtitle: "אפליקציית בריאות נפשית · מובייל בלבד",
      tags: ["React Native", "Audio Engine"],
      mobileImage:
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=900&q=80",
      url: "#",
    },
  ],
};