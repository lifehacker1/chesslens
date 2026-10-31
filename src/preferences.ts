import { useLayoutEffect, useState } from "react";
import type { MobileView } from "./MobileShell";
export function readPreference<T>(
  key: string,
  fallback: T,
  valid: (value: unknown) => value is T,
): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "null");
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
export function usePreference<T>(
  key: string,
  fallback: T,
  valid: (value: unknown) => value is T,
  onError: (message: string) => void,
) {
  const [value, setValue] = useState(() =>
    readPreference(key, fallback, valid),
  );
  const update = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      onError(
        "This preference could not be saved. Browser storage may be unavailable or full.",
      );
    }
  };
  return [value, update] as const;
}
export const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";
export const isDraft = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 2000;
interface PageState {
  scroll: number;
  sections: Record<string, boolean>;
}
const key = "chesslens-settings-page-v1";
export function useSettingsPage(
  view: MobileView,
  onError: (message: string) => void,
) {
  useLayoutEffect(() => {
    if (view !== "settings") {
      if (matchMedia("(max-width:800px)").matches)
        window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    const state = readPreference<PageState>(
      key,
      { scroll: 0, sections: {} },
      (v): v is PageState => {
        const x = v as PageState | null;
        return (
          !!x &&
          Number.isFinite(x.scroll) &&
          x.scroll >= 0 &&
          !!x.sections &&
          typeof x.sections === "object" &&
          Object.values(x.sections).every((b) => typeof b === "boolean")
        );
      },
    );
    const sections = document.querySelectorAll<HTMLDetailsElement>(
      "details[data-setting-section]",
    );
    for (const section of sections) {
      const id = section.dataset.settingSection!;
      if (id in state.sections) section.open = state.sections[id];
    }
    window.scrollTo({ top: state.scroll, behavior: "instant" });
    const save = () => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        onError("Settings page position could not be saved on this device.");
      }
    };
    const scroll = () => {
      state.scroll = window.scrollY;
    };
    const toggle = (event: Event) => {
      const section = event.target as HTMLDetailsElement;
      if (!section.dataset?.settingSection) return;
      state.sections[section.dataset.settingSection] = section.open;
      save();
    };
    const checkpoint = () => {
      scroll();
      save();
    };
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("toggle", toggle, true);
    window.addEventListener("pagehide", checkpoint);
    document.addEventListener("visibilitychange", checkpoint);
    return () => {
      save();
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("toggle", toggle, true);
      window.removeEventListener("pagehide", checkpoint);
      document.removeEventListener("visibilitychange", checkpoint);
    };
  }, [view]);
}

export function readLegacyUsername() {
  try {
    return localStorage.getItem("chesslens_cc_user") || "";
  } catch {
    return "";
  }
}
