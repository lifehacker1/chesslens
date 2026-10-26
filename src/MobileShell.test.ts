import { describe, it, expect, vi, afterEach } from "vitest";
import { readPreferences, touchTick } from "./MobileShell";
afterEach(() => vi.unstubAllGlobals());
describe("mobile comfort preferences", () => {
  it("defaults to visual feedback without requiring vibration", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    expect(readPreferences()).toEqual({
      haptics: false,
      sounds: true,
      reducedMotion: false,
    });
  });
  it("recovers from unavailable or malformed browser storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("storage disabled");
      },
    });
    expect(readPreferences().haptics).toBe(false);
    vi.stubGlobal("localStorage", { getItem: () => "{invalid" });
    expect(readPreferences().reducedMotion).toBe(false);
  });
  it("restores explicit preferences and ignores non-boolean settings", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => '{"haptics":true,"reducedMotion":true}',
    });
    expect(readPreferences()).toEqual({
      haptics: true,
      sounds: true,
      reducedMotion: true,
    });
    vi.stubGlobal("localStorage", { getItem: () => '{"haptics":"true"}' });
    expect(readPreferences().haptics).toBe(false);
  });
  it("preserves an explicit sound mute", () => {
    vi.stubGlobal("localStorage", { getItem: () => '{"sounds":false}' });
    expect(readPreferences().sounds).toBe(false);
  });
  it("only requests optional haptics when enabled and supported", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    touchTick(false);
    expect(vibrate).not.toHaveBeenCalled();
    touchTick(true);
    expect(vibrate).toHaveBeenCalledWith(8);
    vi.stubGlobal("navigator", {});
    expect(() => touchTick(true)).not.toThrow();
  });
});
