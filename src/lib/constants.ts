import type { Category } from "@prisma/client";

export const BUSINESS_TZ = "Asia/Jerusalem";

export const CATEGORIES: { id: Category; label: string; short: string }[] = [
  { id: "BARBER", label: "מספרות וברברים", short: "ברבר" },
  { id: "HAIR_SALON", label: "מספרות נשים", short: "מספרה" },
  { id: "HAIRSTYLIST", label: "מעצבי שיער", short: "עיצוב שיער" },
  { id: "BLOWOUT", label: "פן ועיצוב", short: "פן" },
  { id: "NAILS", label: "ציפורניים", short: "ציפורניים" },
  { id: "MAKEUP", label: "איפור", short: "איפור" },
  { id: "BROWS_LASHES", label: "גבות וריסים", short: "גבות וריסים" },
];

export const CATEGORY_LABEL: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.short]),
) as Record<Category, string>;

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [Category, ...Category[]];

/**
 * City centroids used only when a customer picks a city manually.
 * Distances computed from them are labelled as approximate in the UI.
 */
export const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: "תל אביב-יפו", lat: 32.0853, lng: 34.7818 },
  { name: "ירושלים", lat: 31.7683, lng: 35.2137 },
  { name: "חיפה", lat: 32.794, lng: 34.9896 },
  { name: "רמת גן", lat: 32.0684, lng: 34.8248 },
  { name: "גבעתיים", lat: 32.0722, lng: 34.8089 },
  { name: "הרצליה", lat: 32.1624, lng: 34.8447 },
  { name: "רעננה", lat: 32.1848, lng: 34.8713 },
  { name: "פתח תקווה", lat: 32.0871, lng: 34.8875 },
  { name: "ראשון לציון", lat: 31.973, lng: 34.7925 },
  { name: "חולון", lat: 32.0158, lng: 34.7874 },
  { name: "נתניה", lat: 32.3215, lng: 34.8532 },
  { name: "באר שבע", lat: 31.252, lng: 34.7915 },
  { name: "אשדוד", lat: 31.8044, lng: 34.6553 },
  { name: "מודיעין", lat: 31.8969, lng: 35.0104 },
  { name: "כפר סבא", lat: 32.1782, lng: 34.9076 },
];

export const WEEKDAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const WEEKDAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export const REPORT_REASONS = [
  "תוכן לא הולם",
  "הטעיה או מחיר שגוי",
  "שימוש בתמונה ללא רשות",
  "ספאם",
  "אחר",
];

export const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "בקשה ממתינה לעסק",
  PROPOSED: "הצעה ממתינה לאישורך",
  CONFIRMED: "תור מאושר",
  COMPLETED: "הושלם",
  CANCELLED: "בוטל",
  DECLINED: "נדחה",
  NO_SHOW: "לא הגיע/ה",
};

export const LIMITS = {
  videoBytes: 80 * 1024 * 1024,
  imageBytes: 8 * 1024 * 1024,
  videoMaxSeconds: 90,
};

export const EVENT_LABEL: Record<string, string> = {
  created: "התור נקבע",
  requested: "נשלחה בקשה לעסק",
  proposed: "העסק שלח הצעה",
  accepted: "ההצעה אושרה — התור מאושר",
  rescheduled: "המועד שונה",
  cancelled: "התור בוטל",
  declined: "הבקשה נדחתה",
  completed: "הטיפול הושלם",
  no_show: "סומן כאי־הגעה",
  created_manual: "נקבע ידנית ע״י העסק",
};
