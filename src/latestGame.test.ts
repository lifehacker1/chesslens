import { afterEach, expect, it, vi } from "vitest";
import { rememberedUsername } from "./latestGame";
afterEach(() => vi.unstubAllGlobals());
it("uses remembered username and ignores invalid or unavailable storage", () => {
  const values = new Map([["chesslens_cc_user", "OldUser"]]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) || null,
  });
  expect(rememberedUsername()).toBe("olduser");
  values.set("chesslens-games-username", JSON.stringify(" NewUser "));
  expect(rememberedUsername()).toBe("newuser");
  values.set("chesslens-games-username", JSON.stringify("../bad"));
  expect(rememberedUsername()).toBe("");
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw Error("blocked");
    },
  });
  expect(rememberedUsername()).toBe("");
});
