/** Pace discrete chess positions without accumulating a long inertial backlog. */
export function createReplayMotion(
  read: () => number,
  length: () => number,
  apply: (value: number) => void,
) {
  let target = read(),
    expected = read(),
    remainder = 0,
    direction = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = () => {
    const current = read();
    if (current !== target) {
      expected = current + Math.sign(target - current);
      apply(expected);
    }
    timer = setTimeout(() => {
      timer = undefined;
      if (read() !== target) tick();
    }, 200);
  };
  const seek = (next: number) => {
    const current = read();
    target = Math.max(
      0,
      Math.min(length(), current + Math.max(-3, Math.min(3, next - current))),
    );
    if (!timer && target !== current) tick();
  };
  const reset = () => {
    clearTimeout(timer);
    timer = undefined;
    target = expected = read();
    remainder = direction = 0;
  };
  return {
    seek,
    wheel(delta: number) {
      if (!delta) return;
      const sign = Math.sign(delta);
      if (direction !== sign) {
        remainder = 0;
        target = read();
      }
      direction = sign;
      remainder += delta;
      const count = Math.min(3, Math.floor(Math.abs(remainder) / 40));
      if (count) {
        remainder = sign * (Math.abs(remainder) % 40);
        seek(target + sign * count);
      }
    },
    synchronize() {
      if (read() !== expected) reset();
    },
    reset,
    dispose() {
      clearTimeout(timer);
    },
  };
}
