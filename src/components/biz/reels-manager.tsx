"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bookmark, CalendarCheck, Eye, EyeOff, Film, Heart, Loader2, Trash2, Upload } from "lucide-react";
import type { Category } from "@prisma/client";
import { apiFetch } from "@/lib/client";
import { CATEGORIES, LIMITS } from "@/lib/constants";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from "../ui";
import { Sheet } from "../sheet";
import { useToast } from "../toast";

type Reel = {
  id: string;
  caption: string;
  tags: string[];
  status: "DRAFT" | "PROCESSING" | "PUBLISHED" | "FAILED";
  publishWhenReady: boolean;
  thumbUrl: string | null;
  failureReason: string | null;
  hiddenByAdmin: boolean;
  hiddenReason: string | null;
  isSample: boolean;
  serviceId: string | null;
  serviceName: string | null;
  likes: number;
  saves: number;
  bookings: number;
};

const STATUS: Record<Reel["status"], { label: string; tone: "neutral" | "warn" | "ok" | "bad" }> = {
  DRAFT: { label: "טיוטה", tone: "neutral" },
  PROCESSING: { label: "בעיבוד…", tone: "warn" },
  PUBLISHED: { label: "מפורסם", tone: "ok" },
  FAILED: { label: "העיבוד נכשל", tone: "bad" },
};

export function ReelsManager({
  reels,
  services,
  staff,
  defaultCategory,
}: {
  reels: Reel[];
  services: { id: string; name: string; category: Category }[];
  staff: { id: string; name: string }[];
  defaultCategory: Category;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ caption: "", tags: "", category: defaultCategory as string, serviceId: "", staffId: "", publish: true, rights: false });
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Poll while something is processing so the status updates without a reload.
  const processing = reels.some((r) => r.status === "PROCESSING");
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [processing, router]);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pick = (f: File | null) => {
    setError(null);
    if (!f) return;
    if (!["video/mp4", "video/quicktime", "video/webm"].includes(f.type)) return setError("העלו קובץ MP4, MOV או WEBM");
    if (f.size > LIMITS.videoBytes) return setError("הקובץ גדול מ־80MB");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const upload = () => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("caption", form.caption);
    fd.set("tags", form.tags);
    fd.set("category", form.category);
    fd.set("serviceId", form.serviceId);
    fd.set("staffId", form.staffId);
    fd.set("publish", String(form.publish));
    fd.set("rightsConfirmed", String(form.rights));
    setProgress(0);
    setError(null);
    // XHR for upload progress
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/biz/reels");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      let data: { message?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        toast({ kind: "ok", text: form.publish ? "הסרטון הועלה ומעובד. הוא יתפרסם אוטומטית כשהעיבוד יסתיים." : "הסרטון הועלה ומעובד. הוא יישמר כטיוטה." });
        setOpen(false);
        setFile(null);
        setPreview(null);
        setForm((f) => ({ ...f, caption: "", tags: "", rights: false }));
        router.refresh();
      } else {
        setError(data.message ?? "ההעלאה נכשלה");
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("ההעלאה נכשלה. בדקו את החיבור ונסו שוב.");
    };
    xhr.send(fd);
  };

  const patch = async (r: Reel, body: object, ok: string) => {
    setBusy(r.id);
    try {
      await apiFetch(`/api/biz/reels/${r.id}`, { method: "PATCH", body });
      toast({ kind: "ok", text: ok });
      router.refresh();
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const remove = async (r: Reel) => {
    if (!confirm("למחוק את הסרטון לצמיתות?")) return;
    setBusy(r.id);
    await apiFetch(`/api/biz/reels/${r.id}`, { method: "DELETE" }).catch((e) => toast({ kind: "error", text: e.message }));
    setBusy(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">רילס</h1>
          <p className="text-sm text-muted">כל רילס יכול להוביל לשירות — לקוחות קובעים ישר מהסרטון.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Upload className="size-4" aria-hidden /> העלאת רילס
        </Button>
      </div>

      {reels.length === 0 ? (
        <EmptyState icon={<Film className="size-6" />} title="עוד לא העלית רילס" text="סרטון קצר של עבודה אמיתית הוא הדרך הכי טובה להביא לקוחות חדשים." action={<Button onClick={() => setOpen(true)}>העלאת רילס ראשון</Button>} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {reels.map((r) => (
            <li key={r.id}>
              <Card className="overflow-hidden">
                <div className="relative aspect-[9/14] bg-sand">
                  {r.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-muted">
                      {r.status === "PROCESSING" ? <Loader2 className="size-8 animate-spin" aria-label="מעבד" /> : r.status === "FAILED" ? <AlertTriangle className="size-8 text-bad" aria-hidden /> : <Film className="size-8" aria-hidden />}
                    </div>
                  )}
                  <div className="absolute start-2 top-2 flex flex-col items-start gap-1">
                    <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                    {r.hiddenByAdmin && <Badge tone="bad">הוסתר ע״י BUBER</Badge>}
                    {r.isSample && <Badge tone="dark">לדוגמה</Badge>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 p-3">
                  <p className="line-clamp-2 min-h-10 text-sm">{r.caption || <span className="text-muted">ללא כיתוב</span>}</p>
                  {r.status === "FAILED" && <p className="text-xs text-bad">{r.failureReason}</p>}
                  {r.status === "PROCESSING" && <p className="text-xs text-muted">{r.publishWhenReady ? "יתפרסם אוטומטית בסיום" : "יישמר כטיוטה בסיום"}</p>}
                  {r.hiddenByAdmin && r.hiddenReason && <p className="text-xs text-bad">{r.hiddenReason}</p>}
                  <Select
                    aria-label="שירות מקושר"
                    className="h-10 text-sm"
                    value={r.serviceId ?? ""}
                    onChange={(e) => patch(r, { serviceId: e.target.value || null }, "השירות המקושר עודכן")}
                  >
                    <option value="">ללא שירות מקושר</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1"><Heart className="size-3.5" aria-hidden />{r.likes}</span>
                    <span className="flex items-center gap-1"><Bookmark className="size-3.5" aria-hidden />{r.saves}</span>
                    <span className="flex items-center gap-1"><CalendarCheck className="size-3.5" aria-hidden />{r.bookings} הזמנות</span>
                  </div>
                  <div className="flex gap-1">
                    {r.status === "DRAFT" && (
                      <Button size="sm" className="flex-1" loading={busy === r.id} onClick={() => patch(r, { publish: true }, "פורסם")}>
                        <Eye className="size-4" aria-hidden /> פרסום
                      </Button>
                    )}
                    {r.status === "PUBLISHED" && (
                      <Button size="sm" variant="secondary" className="flex-1" loading={busy === r.id} onClick={() => patch(r, { publish: false }, "הוסר מהפיד")}>
                        <EyeOff className="size-4" aria-hidden /> הסתרה
                      </Button>
                    )}
                    {r.status === "FAILED" && (
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => setOpen(true)}>
                        העלאה מחדש
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(r)} aria-label="מחיקה">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open} onClose={() => progress === null && setOpen(false)} title="העלאת רילס" className="md:max-w-xl">
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="relative grid aspect-[16/10] place-items-center overflow-hidden rounded-[var(--radius-card)] border-2 border-dashed border-line bg-paper text-muted hover:bg-sand/50"
          >
            {preview ? (
              <video src={preview} className="size-full object-contain" muted playsInline controls />
            ) : (
              <span className="flex flex-col items-center gap-2 text-sm">
                <Upload className="size-7" aria-hidden />
                בחירת סרטון אנכי (MP4/MOV/WEBM, עד 80MB, עד 90 שניות)
              </span>
            )}
          </button>
          <input ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} aria-label="קובץ וידאו" />
          <Field label="כיתוב" id="r-cap">
            <Textarea id="r-cap" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} maxLength={300} placeholder="מה רואים בסרטון? גוון, טכניקה, זמן טיפול…" />
          </Field>
          <Field label="תגיות" id="r-tags" hint="מופרדות ברווח או בפסיק">
            <Input id="r-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="#נוד #ג׳ל" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="קטגוריה" id="r-cat">
              <Select id="r-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="שירות מקושר" id="r-svc">
              <Select
                id="r-svc"
                value={form.serviceId}
                onChange={(e) => {
                  const s = services.find((x) => x.id === e.target.value);
                  setForm({ ...form, serviceId: e.target.value, category: s?.category ?? form.category });
                }}
              >
                <option value="">ללא</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="מי ביצע/ה (לא חובה)" id="r-staff">
            <Select id="r-staff" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
              <option value="">—</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 accent-[var(--color-ink)]" checked={form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} />
            לפרסם אוטומטית כשהעיבוד מסתיים (אחרת יישמר כטיוטה)
          </label>
          <label className="flex items-start gap-3 rounded-2xl bg-warn-soft p-3 text-sm text-ink">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--color-ink)]" checked={form.rights} onChange={(e) => setForm({ ...form, rights: e.target.checked })} />
            <span>
              אני מאשר/ת שיש לי זכויות שימוש בסרטון, ושכל אדם שמזוהה בו נתן הסכמה מפורשת לפרסום.
            </span>
          </label>
          {error && <p role="alert" className="rounded-2xl bg-bad-soft p-3 text-sm text-bad">{error}</p>}
          {progress !== null && (
            <div className="flex flex-col gap-1" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-sand">
                <div className="h-full bg-ink transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-muted">מעלה… {progress}%</span>
            </div>
          )}
          <Button size="lg" onClick={upload} disabled={!file || !form.rights || progress !== null} loading={progress !== null}>
            העלאה
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
