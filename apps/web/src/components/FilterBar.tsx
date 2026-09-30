import { Fragment } from "preact";
import { de } from "../i18n/de";
import { FILTERS } from "../lib/filters/registry";
import type { FilterState, Settings } from "../lib/filters/types";

type Props = { state: FilterState; settings: Settings; date: string; venueName: string | null; onChange(id: string, value: unknown): void };

export function FilterBar({ state, settings, date, venueName, onChange }: Props) {
  return (
    <div class="chips" role="group" aria-label={de.filters.label}>
      {FILTERS.map((f) => {
        const value = state[f.id];
        if (f.control === "removable") {
          if (!f.isActive(value, settings)) return null;
          return (
            <button type="button" key={f.id} class="chip venue" aria-label={de.filters.removeVenue(venueName ?? "")} onClick={() => onChange(f.id, f.defaultValue(settings))}>
              {venueName} ✕
            </button>
          );
        }
        if (f.control === "toggle") {
          if (f.id === "alter" && settings.birthDate === null) return null;
          return (
            <button type="button" key={f.id} class="chip" aria-pressed={Boolean(value)} onClick={() => onChange(f.id, !value)}>
              {f.label(settings, date)}
            </button>
          );
        }
        if (f.control === "select") {
          return (
            <select key={f.id} id={`filter-${f.id}`} class="chip" aria-label={f.label(settings, date)} value={value as string}
              onChange={(e) => onChange(f.id, (e.currentTarget as HTMLSelectElement).value)}>
              {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          );
        }
        const selected = value as number[];
        return (
          <Fragment key={f.id}>
            <span class="sep" aria-hidden="true" />
            {f.options!.map((o) => {
              const k = Number(o.value);
              const on = selected.includes(k);
              return (
                <button type="button" key={o.value} class="chip kreis" aria-pressed={on}
                  onClick={() => onChange(f.id, on ? selected.filter((x) => x !== k) : [...selected, k])}>
                  {o.label}
                </button>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
