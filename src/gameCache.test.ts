import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cached, saveCached, cachedRequest, clearGameCache } from "./gameCache";
let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) || null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("persistent game cache", () => {
  it("persists PGNs and reuses fresh results without a fetch", async () => {
    const load = vi.fn().mockResolvedValue([{ pgn: "1. e4 e5 *" }]);
    await cachedRequest("month:alice", load);
    expect(
      JSON.parse(store.get("chesslens-games-v1")!)["month:alice"].data[0].pgn,
    ).toBe("1. e4 e5 *");
    expect(await cachedRequest("month:alice", load)).toEqual([
      { pgn: "1. e4 e5 *" },
    ]);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("refreshes stale data and falls back to saved games offline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    saveCached("month:a", ["old"]);
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(
      await cachedRequest("month:a", () =>
        Promise.reject(new Error("offline")),
      ),
    ).toEqual(["old"]);
    expect(
      await cachedRequest("month:a", () => Promise.resolve(["new"])),
    ).toEqual(["new"]);
  });
  it("explicit refresh bypasses cache and reports failure without erasing it", async () => {
    saveCached("a", ["saved"]);
    await expect(
      cachedRequest("a", () => Promise.reject(new Error("offline")), true),
    ).rejects.toThrow("offline");
    expect(cached("a")?.data).toEqual(["saved"]);
    expect(
      await cachedRequest("a", () => Promise.resolve(["updated"]), true),
    ).toEqual(["updated"]);
  });
  it("ignores corrupt storage and works when persistence is denied", async () => {
    store.set("chesslens-games-v1", "invalid");
    expect(cached("a")).toBeUndefined();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error();
      },
      setItem: () => {
        throw Error();
      },
    });
    expect(await cachedRequest("a", () => Promise.resolve([1]))).toEqual([1]);
  });
  it("bounds storage, evicts old entries and leaves unrelated preferences intact", () => {
    store.set("chesslens-touch", "prefs");
    saveCached("old", "x".repeat(800000));
    saveCached("new", "x".repeat(800000));
    expect(cached("old")).toBeUndefined();
    expect(cached("new")).toBeDefined();
    expect(saveCached("oversized", "x".repeat(1600000))).toBe(false);
    expect(cached("new")).toBeDefined();
    clearGameCache();
    expect(cached("new")).toBeUndefined();
    expect(store.get("chesslens-touch")).toBe("prefs");
  });
  it("keeps different accounts and months isolated", () => {
    saveCached("month:alice/10", [1]);
    saveCached("month:bob/10", [2]);
    expect(cached("month:alice/10")?.data).toEqual([1]);
  });
});
