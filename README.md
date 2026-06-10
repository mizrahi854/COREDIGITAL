# CoreDigital — Liquid Glass Site

## הפעלה ב-VS Code
1. פתח את התיקייה ב-VS Code.
2. התקן את התוסף **Live Server**.
3. לחץ ימני על `index.html` → **Open with Live Server**.

## עריכת תוכן
כל התוכן והתמונות נמצאים ב-`config.js`:

- **`heroPhoneImage`** — תמונה בתוך הטלפון הצף בהירו.
- **`whatsapp`** — מספר וואטסאפ (פורמט בינלאומי, ללא + וללא 0 התחלתי).
- **`portfolio`** — תיק עבודות. כל פריט:
  - `type: "dual"` — תצוגת מחשב + טלפון.
  - `type: "phone"` — אפליקציה: טלפון בלבד.
  - `desktopImage` / `mobileImage` — קישורי תמונות (אפשר Unsplash, אפשר תמונות שלך).
  - `tags`, `url`, `title`, `subtitle` — לפי הצורך.

## טכנולוגיות
- HTML / CSS / Vanilla JS
- GSAP + ScrollTrigger
- גופנים: Heebo (גוף) + Syne (כותרות)
- עיצוב Liquid Glass + glassmorphism
- RTL מלא, Mobile First, אנימציות scroll-driven

## פריסה לאוויר
פשוט העלה את התיקייה ל-Netlify / Vercel / GitHub Pages — אין צורך ב-build.
