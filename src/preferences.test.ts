import { afterEach, expect, it, vi } from "vitest";
import { readPreference, isBoolean, isDraft } from "./preferences";
afterEach(() => vi.unstubAllGlobals());
it("preserves explicitly false preferences", () => {
  vi.stubGlobal("localStorage", { getItem: () => "false" });
  expect(readPreference("arrows", true, isBoolean)).toBe(false);
});
it("falls back safely for corrupt or unavailable storage", () => {
  vi.stubGlobal("localStorage", { getItem: () => "{broken" });
  expect(readPreference("arrows", true, isBoolean)).toBe(true);
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("denied");
    },
  });
  expect(readPreference("draft", "", isDraft)).toBe("");
});
it("rejects wrong types and unbounded drafts", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => JSON.stringify("x".repeat(2001)),
  });
  expect(readPreference("draft", "", isDraft)).toBe("");
  expect(readPreference("arrows", true, isBoolean)).toBe(true);
});
