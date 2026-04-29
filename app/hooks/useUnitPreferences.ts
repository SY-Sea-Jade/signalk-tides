import { useEffect, useState } from "react";

const { VITE_SIGNALK_URL = window.location.toString() } = import.meta.env;
export const UNIT_PREFERENCES_URL = new URL(
  "/signalk/v1/unitpreferences/active",
  VITE_SIGNALK_URL,
).toString();

export interface CategoryPref {
  baseUnit: string;
  targetUnit: string;
  symbol?: string;
  formula?: string;
  inverseFormula?: string;
  displayFormat?: string;
}

export interface ActivePreset {
  name?: string;
  categories: Record<string, CategoryPref>;
}

export type UnitPreferencesStatus = "loading" | "ready" | "unsupported";

export interface UnitPreferences {
  depth: CategoryPref | null;
  status: UnitPreferencesStatus;
}

// Reads the active SignalK unit-preferences preset so the webapp can honour
// the units the user configured on the server (per-user when logged in,
// server default otherwise). Falls back to `unsupported` on older servers
// that don't expose /signalk/v1/unitpreferences/active.
export function useUnitPreferences(): UnitPreferences {
  const [prefs, setPrefs] = useState<UnitPreferences>({
    depth: null,
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(UNIT_PREFERENCES_URL, { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setPrefs({ depth: null, status: "unsupported" });
          return;
        }
        const body = (await res.json()) as ActivePreset;
        if (cancelled) return;
        setPrefs({
          depth: body.categories?.depth ?? null,
          status: "ready",
        });
      } catch {
        if (!cancelled) setPrefs({ depth: null, status: "unsupported" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return prefs;
}
