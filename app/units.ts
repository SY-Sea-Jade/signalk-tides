import type { CategoryPref } from "./hooks/useUnitPreferences";

export interface DisplayUnit {
  toDisplay: (siMeters: number) => number;
  symbol: string;
  decimals: number;
}

const METERS_TO_FEET = 3.28084;

const METERS: DisplayUnit = {
  toDisplay: (m) => m,
  symbol: "m",
  decimals: 2,
};

const FEET: DisplayUnit = {
  toDisplay: (m) => m * METERS_TO_FEET,
  symbol: "ft",
  decimals: 1,
};

let warnedUnsupported: string | null = null;

// Derives a DisplayUnit for tide heights from the active preset's `depth`
// category. When the server doesn't expose unit preferences (older server or
// missing category), falls back to the locale-based guess that matches the
// webapp's prior behaviour.
export function heightUnitFromPreset(
  depth: CategoryPref | null,
  fallbackLocale: string,
): DisplayUnit {
  if (!depth) return localeFallback(fallbackLocale);

  const { targetUnit, symbol, displayFormat } = depth;

  if (targetUnit === "foot") {
    return {
      toDisplay: FEET.toDisplay,
      // The server's standard definition returns symbol:"foot"; we prefer the
      // conventional "ft" for marine UI.
      symbol: FEET.symbol,
      decimals: parseDisplayFormat(displayFormat, FEET.decimals),
    };
  }

  if (targetUnit === "m") {
    return {
      toDisplay: METERS.toDisplay,
      symbol: symbol ?? METERS.symbol,
      decimals: parseDisplayFormat(displayFormat, METERS.decimals),
    };
  }

  // Unknown / custom target unit: we can't evaluate arbitrary mathjs formulas
  // without pulling in the full library, so display in SI meters. See the PR
  // for a follow-up to generalise this.
  if (warnedUnsupported !== targetUnit) {
    warnedUnsupported = targetUnit;
    console.warn(
      `[signalk-tides] Unsupported depth targetUnit "${targetUnit}" in active unit preferences; displaying metres.`,
    );
  }
  return {
    toDisplay: METERS.toDisplay,
    symbol: METERS.symbol,
    decimals: parseDisplayFormat(displayFormat, METERS.decimals),
  };
}

function localeFallback(locale: string): DisplayUnit {
  return locale === "en-US" ? FEET : METERS;
}

// Parses the SignalK displayFormat pattern ("0.0", "0.00", ...) into a
// digit count. Anything unrecognised falls back to the caller's default.
export function parseDisplayFormat(fmt: string | undefined, fallback: number): number {
  if (!fmt) return fallback;
  const match = /^0+(?:\.(0+))?$/.exec(fmt);
  if (!match) return fallback;
  return match[1]?.length ?? 0;
}
