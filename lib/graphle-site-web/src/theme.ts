import { useEffect, useMemo, useState } from "react";

export type GraphleSiteThemePreference = "dark" | "light" | "system";
export type GraphleSiteResolvedTheme = "dark" | "light";

export const graphleSiteThemeStorageKey = "graphle.theme";

function isThemePreference(value: unknown): value is GraphleSiteThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

export function readGraphleSiteThemePreference(
  storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage,
): GraphleSiteThemePreference {
  try {
    const stored = storage?.getItem(graphleSiteThemeStorageKey);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function writeGraphleSiteThemePreference(
  preference: GraphleSiteThemePreference,
  storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(graphleSiteThemeStorageKey, preference);
  } catch {
    // Local theme persistence is best-effort because storage can be disabled.
  }
}

export function resolveGraphleSiteTheme(
  preference: GraphleSiteThemePreference,
  matchMedia: ((query: string) => MediaQueryList) | undefined = globalThis.matchMedia?.bind(
    globalThis,
  ),
): GraphleSiteResolvedTheme {
  if (preference !== "system") return preference;
  return matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyGraphleSiteTheme(
  preference: GraphleSiteThemePreference,
  root: Pick<Element, "classList"> = document.documentElement,
  matchMedia?: (query: string) => MediaQueryList,
): GraphleSiteResolvedTheme {
  const resolved = resolveGraphleSiteTheme(preference, matchMedia);
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  return resolved;
}

export function useGraphleSiteTheme() {
  const [preference, setPreference] = useState<GraphleSiteThemePreference>(() =>
    typeof window === "undefined" ? "system" : readGraphleSiteThemePreference(window.localStorage),
  );
  const [resolved, setResolved] = useState<GraphleSiteResolvedTheme>(() =>
    typeof window === "undefined" ? "light" : resolveGraphleSiteTheme(preference),
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function syncTheme() {
      setResolved(applyGraphleSiteTheme(preference));
    }

    syncTheme();
    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, [preference]);

  return useMemo(
    () => ({
      preference,
      resolved,
      setPreference(nextPreference: GraphleSiteThemePreference) {
        writeGraphleSiteThemePreference(nextPreference, window.localStorage);
        setPreference(nextPreference);
      },
      toggle() {
        const nextPreference = resolved === "dark" ? "light" : "dark";
        writeGraphleSiteThemePreference(nextPreference, window.localStorage);
        setPreference(nextPreference);
      },
    }),
    [preference, resolved],
  );
}
