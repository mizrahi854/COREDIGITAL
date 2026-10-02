import { MapPin, Monitor, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { blockBusiness, blockUser, updateProfile } from "../store/actions";
import { DEFAULT_SETTINGS, setSettings, toast, useApp, useMe } from "../store/app";
import { requestGeo } from "../ui/hooks";
import { Avatar, Button, DemoLabel, Segmented, Select, Toggle } from "../ui/kit";
import { Page, TopBar } from "../ui/shell";

function Group({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-sm font-bold text-muted">{title}</h2>
      <div className="divide-y divide-line rounded-2xl border border-line px-4">{children}</div>
      {note && <p className="mt-2 px-1 text-xs leading-relaxed text-muted">{note}</p>}
    </section>
  );
}

function Range({ id, label, value, onChange, min = 0, max = 100, hint }: { id: string; label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; hint?: string }) {
  return (
    <div className="py-3">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <span className="num text-sm text-muted">{value}%</span>
      </div>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-[var(--ink)]" />
    </div>
  );
}

export function SettingsScreen() {
  const s = useApp((x) => x.settings);
  const db = useApp((x) => x.db);
  const geoStatus = useApp((x) => x.geoStatus);
  const me = useMe();
  const blockedBiz = me ? me.blockedBusinessIds.map((id) => db.businesses.find((b) => b.id === id)).filter(Boolean) : [];
  const blockedUsers = me ? me.blockedUserIds.map((id) => db.users.find((u) => u.id === id)).filter(Boolean) : [];

  return (
    <>
      <TopBar title="הגדרות" back />
      <Page className="max-w-xl">
        <Group title="מראה">
          <div className="py-3">
            <div className="mb-2 font-medium">ערכת צבעים</div>
            <Segmented
              label="ערכת צבעים"
              value={s.theme}
              onChange={(theme) => setSettings({ theme })}
              options={[
                { value: "light", label: "בהיר", icon: <Sun className="size-4" aria-hidden /> },
                { value: "dark", label: "כהה", icon: <Moon className="size-4" aria-hidden /> },
                { value: "system", label: "מערכת", icon: <Monitor className="size-4" aria-hidden /> },
              ]}
            />
          </div>
          <Range id="st-glass" label="עוצמת זכוכית" hint="טשטוש ושקיפות של הסרגלים והכרטיסים הצפים" value={s.glass} onChange={(glass) => setSettings({ glass })} />
          <Toggle id="st-transp" label="הפחתת שקיפות" description="משטחים אטומים במקום זכוכית — קריאות מרבית" checked={s.reducedTransparency} onChange={(reducedTransparency) => setSettings({ reducedTransparency })} />
          <div className="py-3">
            <label htmlFor="st-text" className="mb-2 block font-medium">
              גודל טקסט
            </label>
            <Select id="st-text" value={s.textScale} onChange={(e) => setSettings({ textScale: Number(e.target.value) as 100 | 112 | 125 })}>
              <option value={100}>רגיל</option>
              <option value={112}>גדול</option>
              <option value={125}>גדול מאוד</option>
            </Select>
          </div>
        </Group>

        <Group title="תנועה ומדיה" note="עמעום המדיה משפיע רק על תמונות וסרטונים בתוך Beautigo — לא על בהירות המסך של המכשיר.">
          <div className="py-3">
            <div className="mb-2 font-medium">הפחתת תנועה</div>
            <Segmented
              label="הפחתת תנועה"
              value={s.reducedMotion}
              onChange={(reducedMotion) => setSettings({ reducedMotion })}
              options={[
                { value: "system", label: "לפי המערכת" },
                { value: "reduce", label: "מופחתת" },
                { value: "allow", label: "רגילה" },
              ]}
            />
          </div>
          <Toggle id="st-auto" label="ניגון אוטומטי" description="סרטונים מתחילים לנגן כשהם על המסך" checked={s.autoplay} onChange={(autoplay) => setSettings({ autoplay })} />
          <Toggle id="st-cap" label="כתוביות" description="מציג כתוביות על רילס כשיש" checked={s.captions} onChange={(captions) => setSettings({ captions })} />
          <Toggle id="st-data" label="חיסכון בנתונים" description="לא טוען סרטונים מראש; מנגן רק בלחיצה" checked={s.dataSaver} onChange={(dataSaver) => setSettings({ dataSaver })} />
          <Range id="st-dim" label="עמעום מדיה" max={60} value={s.mediaDim} onChange={(mediaDim) => setSettings({ mediaDim })} />
        </Group>

        <Group title="מיקום" note="המיקום משמש רק לסינון ״קרוב אליי״ ולמרחק, ונשאר במכשיר. בלי הרשאה — בוחרים עיר.">
          <div className="flex min-h-14 items-center justify-between gap-3 py-2">
            <div>
              <div className="font-medium">עיר ברירת מחדל</div>
              <div className="text-sm text-muted">ל״קרוב אליי״ כשאין מיקום</div>
            </div>
            <Select aria-label="עיר ברירת מחדל" className="w-40" value={s.cityId ?? ""} onChange={(e) => setSettings({ cityId: e.target.value || null })}>
              {db.cities
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </div>
          <div className="flex min-h-14 items-center justify-between gap-3 py-2">
            <div>
              <div className="font-medium">מיקום מדויק</div>
              <div className="text-sm text-muted">{geoStatus === "granted" ? "מאושר בהפעלה הנוכחית" : geoStatus === "denied" ? "נדחה — אפשר לשנות בהגדרות הדפדפן" : geoStatus === "unsupported" ? "לא נתמך בדפדפן" : "לא בשימוש"}</div>
            </div>
            <Button size="sm" variant="secondary" disabled={geoStatus === "granted" || geoStatus === "pending" || geoStatus === "unsupported"} onClick={() => requestGeo()}>
              <MapPin className="size-4" aria-hidden /> בקשת מיקום
            </Button>
          </div>
        </Group>

        <Group title="התראות באפליקציה" note="בדמו אין שליחת SMS, אימייל או פוש — ההתראות מוצגות רק בתוך Beautigo.">
          {(
            [
              ["appointments", "תורים", "אישורים, שינויים, תזכורות"],
              ["messages", "הודעות", "הודעות חדשות בשיחות"],
              ["social", "קהילה", "פוסטים חדשים של עסקים שבמעקב, תגובות"],
              ["business", "עסק", "ביקורות ופעילות בעסק שלך"],
            ] as const
          ).map(([k, label, desc]) => (
            <Toggle key={k} id={`st-n-${k}`} label={label} description={desc} checked={s.notify[k]} onChange={(v) => setSettings({ notify: { ...s.notify, [k]: v } })} />
          ))}
        </Group>

        {me && (
          <Group title="פרטיות">
            <Toggle id="st-p-saves" label="שמורים פרטיים" description="רק את/ה רואה מה שמרת" checked={me.privacy.privateSaves} onChange={(v) => updateProfile({ privacy: { ...me.privacy, privateSaves: v } })} />
            <Toggle id="st-p-follow" label="הצגת עסקים במעקב בפרופיל" checked={me.privacy.showFollowing} onChange={(v) => updateProfile({ privacy: { ...me.privacy, showFollowing: v } })} />
            <Toggle id="st-p-msg" label="עסקים יכולים לפתוח איתי שיחה" description="עסקים שהזמנת אצלם תמיד יכולים לענות" checked={me.privacy.allowMessagesFromBusinesses} onChange={(v) => updateProfile({ privacy: { ...me.privacy, allowMessagesFromBusinesses: v } })} />
          </Group>
        )}

        {me && (
          <Group title="חשבונות חסומים">
            {blockedBiz.length + blockedUsers.length === 0 && <p className="py-4 text-sm text-muted">לא חסמת אף אחד.</p>}
            {blockedBiz.map((b) => (
              <div key={b!.id} className="flex items-center gap-3 py-3">
                <Avatar src={b!.avatar} name={b!.name} size={36} />
                <span className="flex-1 font-medium">{b!.name}</span>
                <Button size="sm" variant="secondary" onClick={() => blockBusiness(b!.id, false) !== undefined && toast("ok", "החסימה בוטלה")}>
                  ביטול חסימה
                </Button>
              </div>
            ))}
            {blockedUsers.map((u) => (
              <div key={u!.id} className="flex items-center gap-3 py-3">
                <Avatar name={u!.name} size={36} />
                <span className="flex-1 font-medium">{u!.name}</span>
                <Button size="sm" variant="secondary" onClick={() => blockUser(u!.id, false) !== undefined && toast("ok", "החסימה בוטלה")}>
                  ביטול חסימה
                </Button>
              </div>
            ))}
          </Group>
        )}

        <div className="mt-8 flex flex-col items-center gap-2">
          <Button variant="ghost" onClick={() => (setSettings(DEFAULT_SETTINGS), toast("ok", "ההגדרות אופסו"))}>
            איפוס הגדרות תצוגה
          </Button>
          <DemoLabel>Beautigo · גרסת דמו מקומית</DemoLabel>
        </div>
      </Page>
    </>
  );
}
