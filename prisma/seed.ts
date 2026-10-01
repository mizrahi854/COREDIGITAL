/**
 * Demo seed. RESETS ALL DATA in the configured database.
 * All businesses, people, reviews and media are fictional and flagged as demo/sample.
 *
 *   npm run db:seed
 */
import { PrismaClient, type Category, type ServiceMode } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DateTime } from "luxon";
import fs from "node:fs";
import path from "node:path";
import { getSlots } from "../src/server/availability";

const prisma = new PrismaClient();
const TZ = "Asia/Jerusalem";
const SAMPLE = path.resolve("sample-media");
export const DEMO_PASSWORD = "buber1234";

if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to seed (wipes data) with NODE_ENV=production. Pass --force if you really mean it.");
  process.exit(1);
}

type SvcDef = { name: string; cat: Category; price: number; dur: number; buf?: number; mode?: ServiceMode; tags?: string[]; desc?: string };
type BizDef = {
  key: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  categories: Category[];
  city: string;
  address: string;
  lat: number;
  lng: number;
  cover: string;
  square: string;
  owner: { email: string; name: string };
  staff: { name: string; title: string; email?: string }[];
  services: SvcDef[];
  friday?: [number, number] | null;
  reels: { video: string; svc: number; staff?: number; caption: string; tags: string[]; daysAgo: number }[];
};

const BUSINESSES: BizDef[] = [
  {
    key: "almond",
    slug: "almond-nail-studio",
    name: "אלמנד סטודיו",
    tagline: "ציפורניים נקיות, מדויקות ועמידות",
    description:
      "סטודיו בוטיק לציפורניים עם דגש על היגיינה, ג׳ל עמיד ועיצובים עדינים. עובדות בתיאום מראש בלבד, עם זמן הכנה בין לקוחה ללקוחה.",
    categories: ["NAILS"],
    city: "תל אביב-יפו",
    address: "רחוב הדקל 8",
    lat: 32.0809,
    lng: 34.7806,
    cover: "cover-nails",
    square: "square-nails",
    owner: { email: "owner@buber.dev", name: "נועה אלון" },
    staff: [
      { name: "נועה אלון", title: "בעלת הסטודיו", email: "owner@buber.dev" },
      { name: "שירן דוד", title: "מניקוריסטית", email: "staff@buber.dev" },
    ],
    services: [
      { name: "מניקור ג׳ל", cat: "NAILS", price: 150, dur: 60, buf: 10, tags: ["ג׳ל", "נוד"], desc: "הסרה, טיפוח קוטיקולה ומריחת ג׳ל בגוון לבחירה." },
      { name: "מניקור צרפתי", cat: "NAILS", price: 180, dur: 75, buf: 10, tags: ["צרפתי", "קלאסי"] },
      { name: "בניית ציפורניים", cat: "NAILS", price: 280, dur: 105, buf: 15, tags: ["בנייה", "אלמנד"] },
      { name: "עיצוב בהתאמה אישית", cat: "NAILS", price: 200, dur: 120, buf: 15, mode: "CONSULTATION", tags: ["עיצוב", "כרום"], desc: "שלחו השראה — נחזור עם מחיר ומועד מדויקים לפי מורכבות העיצוב." },
    ],
    reels: [
      { video: "nails-nude", svc: 0, staff: 0, caption: "גוון נוד חלבי לשגרה — מניקור ג׳ל עמיד לשלושה שבועות", tags: ["נוד", "ג׳ל", "מינימליסטי"], daysAgo: 0.3 },
      { video: "nails-burgundy", svc: 0, staff: 1, caption: "בורגונדי עמוק לסתיו 🍷", tags: ["בורגונדי", "סתיו", "ג׳ל"], daysAgo: 1.5 },
      { video: "nails-chrome", svc: 3, staff: 0, caption: "כרום פנינה על בנייה באלמנד — עיצוב בהתאמה אישית", tags: ["כרום", "אלמנד", "עיצוב"], daysAgo: 3 },
      { video: "nails-french", svc: 1, staff: 1, caption: "פרנץ׳ דק ונקי, הקלאסיקה שלא נגמרת", tags: ["צרפתי", "קלאסי"], daysAgo: 6 },
    ],
  },
  {
    key: "blond",
    slug: "blond-and-brown",
    name: "בלונד אנד בראון",
    tagline: "צבע, תספורת וגוונים טבעיים",
    description: "סלון שיער לנשים שמתמחה בבלייאז׳ טבעי, צבע עדין ותספורות שקל לסדר בבית.",
    categories: ["HAIR_SALON", "HAIRSTYLIST"],
    city: "רמת גן",
    address: "רחוב התאנה 21",
    lat: 32.0823,
    lng: 34.8136,
    cover: "cover-hair",
    square: "square-hair",
    owner: { email: "owner-blond@buber.dev", name: "מאיה רז" },
    staff: [
      { name: "מאיה רז", title: "מעצבת שיער ובעלים", email: "owner-blond@buber.dev" },
      { name: "רון שגיא", title: "קולוריסט" },
      { name: "טל ברק", title: "מעצבת שיער" },
    ],
    services: [
      { name: "תספורת נשים", cat: "HAIR_SALON", price: 220, dur: 60, buf: 10, tags: ["תספורת", "שכבות"] },
      { name: "צבע שורשים", cat: "HAIR_SALON", price: 280, dur: 90, buf: 15, tags: ["צבע"] },
      { name: "בלייאז׳", cat: "HAIRSTYLIST", price: 850, dur: 180, buf: 15, mode: "CONSULTATION", tags: ["בלייאז׳", "גוונים", "דבש"], desc: "המחיר הסופי נקבע לפי אורך ועובי השיער. שלחו תמונה ונחזור עם הצעה." },
      { name: "פן", cat: "BLOWOUT", price: 120, dur: 40, buf: 5, tags: ["פן"] },
    ],
    reels: [
      { video: "hair-honey", svc: 2, staff: 1, caption: "בלייאז׳ דבש רך — מעבר בלי קו", tags: ["בלייאז׳", "דבש", "גוונים"], daysAgo: 0.8 },
      { video: "hair-copper", svc: 1, staff: 1, caption: "נחושת חמה לחורף", tags: ["נחושת", "צבע"], daysAgo: 2.5 },
      { video: "hair-ash", svc: 0, staff: 2, caption: "שכבות אוורריות על בלונד אפרפר", tags: ["שכבות", "בלונד"], daysAgo: 5 },
    ],
  },
  {
    key: "barber",
    slug: "city-barber",
    name: "הברבר של השכונה",
    tagline: "פייד חד, זקן מסודר",
    description: "ברברשופ שכונתי. פייד, עיצוב זקן ותספורות ילדים. מגיעים בזמן — יוצאים מסודרים.",
    categories: ["BARBER"],
    city: "תל אביב-יפו",
    address: "רחוב השקמה 3",
    lat: 32.0634,
    lng: 34.7722,
    cover: "cover-barber",
    square: "square-barber",
    owner: { email: "owner-barber@buber.dev", name: "אבי מזרחי" },
    staff: [
      { name: "אבי מזרחי", title: "ברבר ובעלים", email: "owner-barber@buber.dev" },
      { name: "יוסי חדד", title: "ברבר" },
    ],
    friday: [8 * 60, 15 * 60],
    services: [
      { name: "תספורת גברים", cat: "BARBER", price: 90, dur: 30, buf: 5, tags: ["תספורת"] },
      { name: "פייד + זקן", cat: "BARBER", price: 130, dur: 45, buf: 5, tags: ["פייד", "זקן"] },
      { name: "עיצוב זקן", cat: "BARBER", price: 60, dur: 20, buf: 5, tags: ["זקן"] },
      { name: "תספורת ילדים", cat: "BARBER", price: 70, dur: 30, buf: 5, tags: ["ילדים"] },
    ],
    reels: [
      { video: "fade-dark", svc: 1, staff: 0, caption: "סקין פייד עם ליין־אפ חד", tags: ["פייד", "ליין־אפ"], daysAgo: 0.5 },
      { video: "fade-light", svc: 0, staff: 1, caption: "מעבר רך לשגרה", tags: ["פייד", "קלאסי"], daysAgo: 4 },
    ],
  },
  {
    key: "gloss",
    slug: "gloss-bar",
    name: "גלוס בר",
    tagline: "פן, גלים וצמות",
    description: "בר פן ועיצוב שיער לאירועים וליום־יום. פן חלק, גלים רכים, צמות ותסרוקות ערב.",
    categories: ["BLOWOUT", "HAIRSTYLIST"],
    city: "הרצליה",
    address: "רחוב הזית 5",
    lat: 32.1656,
    lng: 34.8432,
    cover: "cover-blowout",
    square: "square-blowout",
    owner: { email: "owner-gloss@buber.dev", name: "ליאת כץ" },
    staff: [
      { name: "ליאת כץ", title: "מעצבת שיער", email: "owner-gloss@buber.dev" },
      { name: "עדי פרץ", title: "מעצבת פן" },
    ],
    services: [
      { name: "פן חלק", cat: "BLOWOUT", price: 110, dur: 40, buf: 5, tags: ["פן", "חלק"] },
      { name: "פן גלי", cat: "BLOWOUT", price: 140, dur: 50, buf: 5, tags: ["גלים", "פן"] },
      { name: "צמות", cat: "HAIRSTYLIST", price: 120, dur: 45, buf: 5, tags: ["צמות"] },
      { name: "תסרוקת ערב", cat: "HAIRSTYLIST", price: 250, dur: 60, buf: 10, tags: ["ערב", "אירוע"] },
    ],
    reels: [
      { video: "blowout-honey", svc: 1, staff: 0, caption: "גלים רכים עם נפח מהשורש", tags: ["גלים", "נפח"], daysAgo: 1 },
      { video: "blowout-espresso", svc: 0, staff: 1, caption: "פן חלק ומבריק על שיער כהה", tags: ["פן", "ברק"], daysAgo: 3.5 },
      { video: "braid-honey", svc: 2, staff: 1, caption: "צמה הולנדית לאירוע", tags: ["צמות", "אירוע"], daysAgo: 2 },
      { video: "braid-ash", svc: 3, staff: 0, caption: "צמה רכה לערב", tags: ["צמות", "ערב"], daysAgo: 8 },
    ],
  },
  {
    key: "mira",
    slug: "mira-makeup",
    name: "סטודיו מירה לאיפור",
    tagline: "איפור ערב וכלות בגוונים חמים",
    description: "איפור מקצועי לאירועים, כלות ושיעורי איפור אישיים. עובדת עם גוונים חמים ומראה טבעי.",
    categories: ["MAKEUP"],
    city: "ירושלים",
    address: "רחוב הרימון 14",
    lat: 31.7767,
    lng: 35.2121,
    cover: "cover-makeup",
    square: "square-makeup",
    owner: { email: "owner-mira@buber.dev", name: "מירה לוי" },
    staff: [{ name: "מירה לוי", title: "מאפרת", email: "owner-mira@buber.dev" }],
    services: [
      { name: "איפור ערב", cat: "MAKEUP", price: 350, dur: 60, buf: 15, tags: ["ערב", "ברונזה"] },
      { name: "איפור כלה", cat: "MAKEUP", price: 1400, dur: 120, buf: 30, mode: "CONSULTATION", tags: ["כלה"], desc: "כולל פגישת היכרות. המחיר הסופי נקבע לפי מיקום ושעת האירוע." },
      { name: "שיעור איפור אישי", cat: "MAKEUP", price: 400, dur: 90, buf: 15, tags: ["שיעור"] },
    ],
    reels: [
      { video: "makeup-rose", svc: 0, caption: "פלטת ורוד־עתיק לערב", tags: ["ורוד", "ערב"], daysAgo: 1.2 },
      { video: "makeup-bronze", svc: 1, caption: "ברונזה חמה לכלה", tags: ["כלה", "ברונזה"], daysAgo: 7 },
    ],
  },
  {
    key: "lash",
    slug: "lash-lab",
    name: "לאש לאב",
    tagline: "הרמת ריסים וגבות טבעיות",
    description: "סטודיו לגבות וריסים בחיפה. הרמת ריסים, למינציה לגבות ועיצוב גבות בשיטה עדינה.",
    categories: ["BROWS_LASHES"],
    city: "חיפה",
    address: "רחוב האלון 9",
    lat: 32.8064,
    lng: 34.9886,
    cover: "cover-lashes",
    square: "square-lashes",
    owner: { email: "owner-lash@buber.dev", name: "רונית שמש" },
    staff: [{ name: "רונית שמש", title: "מומחית גבות וריסים", email: "owner-lash@buber.dev" }],
    services: [
      { name: "הרמת ריסים", cat: "BROWS_LASHES", price: 220, dur: 60, buf: 10, tags: ["ריסים", "הרמה"] },
      { name: "עיצוב גבות", cat: "BROWS_LASHES", price: 80, dur: 30, buf: 5, tags: ["גבות"] },
      { name: "למינציה לגבות", cat: "BROWS_LASHES", price: 200, dur: 45, buf: 10, tags: ["גבות", "למינציה"] },
    ],
    reels: [
      { video: "lashes-soft", svc: 0, caption: "הרמת ריסים — מראה פתוח בלי מסקרה", tags: ["ריסים", "טבעי"], daysAgo: 2.2 },
      { video: "lashes-deep", svc: 2, caption: "למינציה לגבות מלאות", tags: ["גבות", "למינציה"], daysAgo: 9 },
    ],
  },
];

/** Demo media is served read-only from sample-media/ via the "sample/" key prefix. */
function sample(file: string) {
  if (!fs.existsSync(path.join(SAMPLE, file))) throw new Error(`missing sample-media/${file}`);
  return `sample/${file}`;
}

async function main() {
  if (!fs.existsSync(path.join(SAMPLE, "nails-nude.webm"))) {
    throw new Error("sample-media/ is missing. Run `npm run media:generate` first.");
  }
  console.log("Resetting database…");
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const mkUser = (email: string, name: string, extra: object = {}) =>
    prisma.user.upsert({ where: { email }, update: {}, create: { email, name, passwordHash, onboardedAt: new Date(), ...extra } });

  const admin = await mkUser("admin@buber.dev", "מנהלת מערכת", { isAdmin: true });
  const customer = await mkUser("customer@buber.dev", "דנה כהן", {
    city: "תל אביב-יפו",
    lat: 32.0853,
    lng: 34.7818,
    interests: ["NAILS", "HAIR_SALON", "BLOWOUT"],
    phone: "050-0000001",
  });
  const customer2 = await mkUser("customer2@buber.dev", "יואב לוי", {
    city: "רמת גן",
    interests: ["BARBER"],
  });

  const now = DateTime.now().setZone(TZ);
  const created: Record<string, { id: string; services: { id: string; priceAgorot: number; mode: ServiceMode }[]; staff: string[]; reels: string[] }> = {};

  for (const b of BUSINESSES) {
    const owner = await mkUser(b.owner.email, b.owner.name);
    const biz = await prisma.business.create({
      data: {
        slug: b.slug,
        name: b.name,
        tagline: b.tagline,
        description: b.description,
        categories: b.categories,
        city: b.city,
        address: b.address,
        lat: b.lat,
        lng: b.lng,
        phone: "03-0000000",
        status: "APPROVED",
        isDemo: true,
        cancellationHours: 24,
        cancellationPolicy: "ביטול או שינוי מועד ללא עלות עד 24 שעות לפני התור. ביטול מאוחר יותר — בתיאום עם העסק.",
        members: { create: { userId: owner.id, role: "OWNER" } },
        openingHours: {
          create: [
            ...[0, 1, 2, 3, 4].map((weekday) => ({ weekday, openMin: 9 * 60, closeMin: 19 * 60 })),
            ...(b.friday !== null ? [{ weekday: 5, openMin: (b.friday ?? [8 * 60, 14 * 60])[0], closeMin: (b.friday ?? [8 * 60, 14 * 60])[1] }] : []),
          ],
        },
      },
    });
    const coverPath = sample(`${b.cover}.jpg`);
    const avatarPath = sample(`${b.square}.jpg`);
    await prisma.business.update({ where: { id: biz.id }, data: { coverPath, avatarPath } });

    const staffIds: string[] = [];
    for (const [i, s] of b.staff.entries()) {
      let userId: string | null = null;
      if (s.email) {
        const u = await mkUser(s.email, s.name);
        userId = u.id;
        if (s.email !== b.owner.email) {
          await prisma.businessMember.create({ data: { businessId: biz.id, userId: u.id, role: "STAFF" } });
        }
      }
      const fri = b.friday === null ? null : (b.friday ?? [8 * 60, 14 * 60]);
      const st = await prisma.staffMember.create({
        data: {
          businessId: biz.id,
          userId,
          name: s.name,
          title: s.title,
          sortOrder: i,
          workingHours: {
            create: [
              ...[0, 1, 2, 3, 4].map((weekday) => ({ weekday, startMin: 9 * 60 + (i % 2) * 60, endMin: 18 * 60 + (i % 2) * 60 })),
              ...(fri ? [{ weekday: 5, startMin: fri[0], endMin: fri[1] }] : []),
            ],
          },
          breaks: { create: [0, 1, 2, 3, 4].map((weekday) => ({ weekday, startMin: 13 * 60 + i * 30, endMin: 13 * 60 + 30 + i * 30, label: "הפסקת צהריים" })) },
        },
      });
      staffIds.push(st.id);
    }

    const services = [];
    for (const [i, s] of b.services.entries()) {
      const svc = await prisma.service.create({
        data: {
          businessId: biz.id,
          name: s.name,
          description: s.desc ?? "",
          category: s.cat,
          styleTags: s.tags ?? [],
          mode: s.mode ?? "FIXED",
          priceAgorot: s.price * 100,
          durationMin: s.dur,
          bufferMin: s.buf ?? 0,
          sortOrder: i,
          staff: { create: staffIds.map((staffId) => ({ staffId })) },
        },
      });
      services.push(svc);
    }

    const reels: string[] = [];
    for (const r of b.reels) {
      const reel = await prisma.reel.create({
        data: {
          businessId: biz.id,
          serviceId: services[r.svc]?.id,
          staffId: r.staff != null ? staffIds[r.staff] : null,
          caption: r.caption,
          tags: r.tags,
          category: b.services[r.svc].cat,
          status: "PUBLISHED",
          isSample: true,
          rightsConfirmed: true,
          width: 540,
          height: 960,
          durationSec: 7,
          publishedAt: now.minus({ hours: r.daysAgo * 24 }).toJSDate(),
        },
      });
      await prisma.reel.update({
        where: { id: reel.id },
        data: {
          videoPath: sample(`${r.video}.mp4`),
          webmPath: sample(`${r.video}.webm`),
          thumbPath: sample(`${r.video}.jpg`),
        },
      });
      reels.push(reel.id);
    }

    // Portfolio: stills from the same sample art
    for (const [i, r] of b.reels.slice(0, 3).entries()) {
      await prisma.portfolioItem.create({
        data: { businessId: biz.id, imagePath: sample(`${r.video}.jpg`), caption: r.caption, isSample: true },
      });
    }
    created[b.key] = { id: biz.id, services, staff: staffIds, reels };
  }

  // A business waiting for admin review
  const pendingOwner = await mkUser("owner-pending@buber.dev", "גיל אורן");
  await prisma.business.create({
    data: {
      slug: "new-studio-pending",
      name: "סטודיו בהקמה",
      description: "עסק לדוגמה שממתין לבדיקת מנהל.",
      categories: ["HAIR_SALON"],
      city: "נתניה",
      address: "רחוב הגפן 2",
      isDemo: true,
      status: "PENDING_REVIEW",
      members: { create: { userId: pendingOwner.id, role: "OWNER" } },
    },
  });

  // ---- Social graph
  const A = created.almond, B = created.blond, C = created.barber, G = created.gloss;
  await prisma.follow.createMany({ data: [A, G].map((b) => ({ userId: customer.id, businessId: b.id })) });
  await prisma.follow.create({ data: { userId: customer2.id, businessId: C.id } });
  await prisma.like.createMany({ data: [A.reels[0], A.reels[2], B.reels[0], G.reels[0]].map((reelId) => ({ userId: customer.id, reelId })) });
  await prisma.savedReel.createMany({ data: [A.reels[2], B.reels[0], G.reels[2]].map((reelId) => ({ userId: customer.id, reelId })) });
  const col = await prisma.collection.create({ data: { userId: customer.id, name: "השראה לחתונה" } });
  await prisma.collectionItem.createMany({ data: [B.reels[0], G.reels[2]].map((reelId) => ({ collectionId: col.id, reelId })) });
  await prisma.savedBusiness.create({ data: { userId: customer.id, businessId: B.id } });

  // ---- Appointments
  const snapshot = async (bizKey: string, svcIdx: number) => {
    const svc = await prisma.service.findUniqueOrThrow({ where: { id: created[bizKey].services[svcIdx].id } });
    const biz = await prisma.business.findUniqueOrThrow({ where: { id: created[bizKey].id } });
    return {
      businessId: biz.id,
      serviceId: svc.id,
      serviceName: svc.name,
      priceAgorot: svc.priceAgorot,
      durationMin: svc.durationMin,
      bufferMin: svc.bufferMin,
      cancellationHours: biz.cancellationHours,
      cancellationPolicy: biz.cancellationPolicy,
    };
  };

  // Past completed appointments with sample reviews (reviews only exist for completed visits)
  const reviewTexts = [
    { r: 5, t: "יצאתי עם בדיוק מה שהראיתי בסרטון. מקצועית ונעימה." },
    { r: 5, t: "סטודיו נקי, עמדו בזמנים, הג׳ל מחזיק מעולה." },
    { r: 4, t: "תוצאה יפה, קצת המתנה בכניסה." },
  ];
  for (const [i, rv] of reviewTexts.entries()) {
    const s = await snapshot("almond", i % 2);
    const start = now.minus({ days: 10 + i * 6 }).set({ hour: 11, minute: 0, second: 0, millisecond: 0 });
    const end = start.plus({ minutes: s.durationMin });
    const a = await prisma.appointment.create({
      data: {
        ...s,
        customerId: i === 2 ? customer2.id : customer.id,
        staffId: A.staff[i % 2],
        status: "COMPLETED",
        startsAt: start.toJSDate(),
        endsAt: end.toJSDate(),
        blockEndsAt: end.plus({ minutes: s.bufferMin }).toJSDate(),
        priceIsFinal: true,
        completedAt: end.toJSDate(),
        source: i === 0 ? "REEL" : "PROFILE",
        sourceReelId: i === 0 ? A.reels[0] : null,
        payments: { create: { amountAgorot: s.priceAgorot, method: "at_business" } },
      },
    });
    await prisma.review.create({
      data: { appointmentId: a.id, businessId: A.id, customerId: a.customerId!, rating: rv.r, text: rv.t, isSample: true },
    });
  }

  // Future appointments placed into real free slots
  const book = async (bizKey: string, svcIdx: number, dayOffset: number, pick: number, extra: object) => {
    const s = await snapshot(bizKey, svcIdx);
    for (let d = dayOffset; d < dayOffset + 7; d++) {
      const date = now.plus({ days: d }).toISODate()!;
      const slots = await getSlots({ businessId: s.businessId, serviceId: s.serviceId, date });
      const slot = slots[Math.min(pick, slots.length - 1)];
      if (!slot) continue;
      const start = new Date(slot.start);
      const end = new Date(start.getTime() + s.durationMin * 60_000);
      return prisma.appointment.create({
        data: {
          ...s,
          staffId: slot.staffIds[0],
          startsAt: start,
          endsAt: end,
          blockEndsAt: new Date(end.getTime() + s.bufferMin * 60_000),
          priceIsFinal: true,
          status: "CONFIRMED",
          ...extra,
        },
      });
    }
    throw new Error("no slot for seed booking");
  };

  const up1 = await book("almond", 0, 3, 2, { customerId: customer.id, source: "REEL", sourceReelId: A.reels[1], notes: "אשמח לגוון קצת יותר כהה מהסרטון" });
  await prisma.appointmentInspiration.create({ data: { appointmentId: up1.id, reelId: A.reels[1] } });
  await prisma.appointmentEvent.create({ data: { appointmentId: up1.id, type: "created", actorId: customer.id } });
  await book("blond", 0, 5, 4, { customerId: customer.id, source: "PROFILE" });
  await book("almond", 1, 1, 0, { guestName: "רותם (טלפון)", guestPhone: "052-0000000", source: "MANUAL" });
  await book("almond", 2, 1, 6, { customerId: customer2.id, source: "SEARCH" });
  await book("almond", 0, 2, 3, { guestName: "הילה", source: "MANUAL" });
  await book("barber", 1, 1, 2, { customerId: customer2.id, source: "REEL", sourceReelId: C.reels[0] });

  // Consultation request waiting for the business
  {
    const s = await snapshot("almond", 3);
    const date = now.plus({ days: 6 }).toISODate()!;
    const slot = (await getSlots({ businessId: s.businessId, serviceId: s.serviceId, date }))[2];
    if (slot) {
      const start = new Date(slot.start);
      const end = new Date(start.getTime() + s.durationMin * 60_000);
      const req = await prisma.appointment.create({
        data: {
          ...s,
          customerId: customer.id,
          staffId: slot.staffIds[0],
          status: "REQUESTED",
          startsAt: start,
          endsAt: end,
          blockEndsAt: new Date(end.getTime() + s.bufferMin * 60_000),
          priceIsFinal: false,
          source: "REEL",
          sourceReelId: A.reels[2],
          notes: "כרום פנינה כמו בסרטון, אורך בינוני",
          idempotencyKey: "seed-request",
        },
      });
      await prisma.appointmentInspiration.create({ data: { appointmentId: req.id, reelId: A.reels[2] } });
    }
  }

  // ---- Analytics history (demo)
  const events: { type: "REEL_VIEW" | "PROFILE_VIEW" | "BOOKING_START"; businessId: string; reelId?: string; createdAt: Date }[] = [];
  for (const [key, b] of Object.entries(created)) {
    const base = key === "almond" ? 40 : 12;
    for (const [i, reelId] of b.reels.entries()) {
      for (let k = 0; k < base - i * 6; k++) {
        events.push({ type: "REEL_VIEW", businessId: b.id, reelId, createdAt: now.minus({ hours: k * 7 }).toJSDate() });
      }
      for (let k = 0; k < Math.max(1, (base - i * 6) / 8); k++) {
        events.push({ type: "BOOKING_START", businessId: b.id, reelId, createdAt: now.minus({ hours: k * 13 }).toJSDate() });
      }
    }
    for (let k = 0; k < base / 2; k++) events.push({ type: "PROFILE_VIEW", businessId: b.id, createdAt: now.minus({ hours: k * 11 }).toJSDate() });
  }
  await prisma.analyticsEvent.createMany({ data: events });

  // ---- A report for the admin queue
  await prisma.report.create({
    data: { reporterId: customer2.id, targetType: "REEL", targetId: B.reels[2], reason: "הטעיה או מחיר שגוי", details: "דיווח לדוגמה לבדיקת תור הדיווחים." },
  });

  console.log("Seed complete. Accounts (password: %s):", DEMO_PASSWORD);
  console.table([
    { role: "לקוח/ה", email: customer.email },
    { role: "לקוח/ה נוסף/ת", email: customer2.email },
    { role: "בעלת עסק (אלמנד)", email: "owner@buber.dev" },
    { role: "צוות (אלמנד)", email: "staff@buber.dev" },
    { role: "מנהל/ת מערכת", email: admin.email },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
