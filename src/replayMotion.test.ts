import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { createReplayMotion } from "./replayMotion";
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
function setup(start = 0) {
  let value = start;
  const applied: number[] = [];
  const motion = createReplayMotion(
    () => value,
    () => 33,
    (next) => {
      value = next;
      applied.push(next);
    },
  );
  return {
    motion,
    applied,
    read: () => value,
    set: (n: number) => (value = n),
  };
}
it("paces a large wheel event into individual moves", () => {
  const x = setup();
  x.motion.wheel(1000);
  expect(x.applied).toEqual([1]);
  vi.advanceTimersByTime(200);
  expect(x.applied).toEqual([1, 2]);
  vi.advanceTimersByTime(200);
  expect(x.applied).toEqual([1, 2, 3]);
  x.motion.dispose();
});
it("continues sustained input without an unbounded backlog", () => {
  const x = setup();
  for (let i = 0; i < 30; i++) {
    x.motion.wheel(40);
    vi.advanceTimersByTime(50);
  }
  const before = x.read();
  expect(before).toBeGreaterThan(3);
  vi.advanceTimersByTime(2000);
  expect(x.read() - before).toBeLessThanOrEqual(3);
  x.motion.dispose();
});
it("reversing discards forward momentum", () => {
  const x = setup(10);
  x.motion.wheel(500);
  expect(x.read()).toBe(11);
  x.motion.wheel(-40);
  vi.advanceTimersByTime(200);
  expect(x.read()).toBe(10);
  vi.advanceTimersByTime(1000);
  expect(x.read()).toBe(10);
  x.motion.dispose();
});
it("preserves small trackpad deltas until they make one step", () => {
  const x = setup();
  for (let i = 0; i < 8; i++) x.motion.wheel(5);
  expect(x.read()).toBe(1);
  x.motion.dispose();
});
it("external navigation cancels queued motion and boundaries clamp", () => {
  const x = setup(32);
  x.motion.wheel(1000);
  expect(x.read()).toBe(33);
  x.set(5);
  x.motion.synchronize();
  vi.advanceTimersByTime(1000);
  expect(x.read()).toBe(5);
  x.motion.seek(-100);
  vi.advanceTimersByTime(1000);
  expect(x.read()).toBe(2);
  x.motion.dispose();
});
it("disposal prevents updates after unmount", () => {
  const x = setup();
  x.motion.wheel(1000);
  x.motion.dispose();
  vi.advanceTimersByTime(1000);
  expect(x.applied).toEqual([1]);
});
