import { Check, Crosshair, Loader2 } from "lucide-react";
import { haversineKm } from "../domain/format";
import { setSettings, useApp } from "../store/app";
import { requestGeo } from "../ui/hooks";
import { Sheet } from "../ui/overlays";

/** Manual city choice never requires location permission. Location is used only after the user asks. */
export function CityPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick?: (cityId: string | null) => void }) {
  const allCities = useApp((s) => s.db.cities);
  const cities = allCities.filter((c) => c.active);
  const current = useApp((s) => s.settings.cityId);
  const geo = useApp((s) => s.geo);
  const geoStatus = useApp((s) => s.geoStatus);
  const pick = (id: string | null) => {
    if (onPick) onPick(id);
    else setSettings({ cityId: id });
    onClose();
  };
  const nearest = geo ? [...cities].sort((a, b) => haversineKm(geo, a) - haversineKm(geo, b))[0] : null;
  return (
    <Sheet open={open} onClose={onClose} title="בחירת עיר">
      <button
        type="button"
        onClick={() => requestGeo()}
        className="mb-3 flex h-14 w-full items-center gap-3 rounded-2xl bg-surface px-4 text-start font-semibold"
      >
        {geoStatus === "pending" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Crosshair className="size-5" aria-hidden />}
        שימוש במיקום הנוכחי
        <span className="ms-auto text-xs font-normal text-muted">
          {geoStatus === "denied" ? "אין הרשאה" : geoStatus === "granted" && nearest ? `הכי קרוב: ${nearest.name}` : "רק אחרי אישור שלך"}
        </span>
      </button>
      {geoStatus === "granted" && nearest && (
        <button type="button" onClick={() => pick(nearest.id)} className="mb-3 w-full rounded-2xl border border-ink px-4 py-3 text-start text-sm">
          לבחור את {nearest.name} לפי המיקום שלך
        </button>
      )}
      <ul role="listbox" aria-label="ערים" className="flex flex-col">
        {onPick && (
          <li>
            <button type="button" role="option" aria-selected={!current} onClick={() => pick(null)} className="flex h-12 w-full items-center justify-between rounded-xl px-3 text-start hover:bg-surface">
              כל הארץ {!current && <Check className="size-5" aria-hidden />}
            </button>
          </li>
        )}
        {cities.map((c) => (
          <li key={c.id}>
            <button type="button" role="option" aria-selected={current === c.id} onClick={() => pick(c.id)} className="flex h-12 w-full items-center justify-between rounded-xl px-3 text-start hover:bg-surface">
              {c.name}
              {current === c.id && <Check className="size-5" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
