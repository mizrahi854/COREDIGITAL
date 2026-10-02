import type { DB, ID, NotificationCategory } from "./types";
import { uid } from "./ids";

/** In-app notification only. No SMS, email or push is sent in the demo. */
export function notify(db: DB, userId: ID | undefined, category: NotificationCategory, title: string, body: string, link?: string) {
  if (!userId) return;
  db.notifications.unshift({ id: uid("ntf"), userId, category, title, body, link, createdAt: new Date().toISOString(), read: false });
}
