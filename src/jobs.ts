export type JobState =
  "queued" | "running" | "paused" | "completed" | "cancelled" | "failed";
export interface Job {
  id: number;
  label: string;
  state: JobState;
  priority: number;
  detail: string;
  controls: boolean;
}
type Internal = Job & {
  started?: boolean;
  controller: AbortController;
  paused: boolean;
  wake: Set<() => void>;
  start: () => void;
};
const jobs: Internal[] = [];
const signals = new WeakMap<AbortSignal, Internal>();
const listeners = new Set<() => void>();
let serial = 0,
  active = false;
const emit = () => listeners.forEach((fn) => fn());
export const subscribeJobs = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const jobSnapshot = () =>
  jobs.map(({ id, label, state, priority, detail, controls }) => ({
    id,
    label,
    state,
    priority,
    detail,
    controls,
  }));
export function hasJob(signal: AbortSignal) {
  return signals.has(signal);
}
export function inheritJob(parent: AbortSignal, child: AbortSignal) {
  const job = signals.get(parent);
  if (job) signals.set(child, job);
}
export function jobProgress(signal: AbortSignal, detail: string) {
  const job = signals.get(signal);
  if (job) {
    job.detail = detail;
    emit();
  }
}
function pump() {
  if (active) return;
  const next = jobs
    .filter((j) => j.state === "queued")
    .sort((a, b) => b.priority - a.priority || a.id - b.id)[0];
  if (next) {
    active = true;
    next.start();
  }
}
export function controlJob(
  id: number,
  action: "pause" | "resume" | "cancel" | "priority",
) {
  const job = jobs.find((j) => j.id === id);
  if (
    !job ||
    !job.controls ||
    ["completed", "cancelled", "failed"].includes(job.state)
  )
    return;
  if (action === "priority") job.priority = job.priority === 1 ? 0 : 1;
  if (action === "pause") {
    job.paused = true;
    job.state = "paused";
  }
  if (action === "resume") {
    job.paused = false;
    job.state = job.started ? "running" : "queued";
    job.wake.forEach((fn) => fn());
  }
  if (action === "cancel") {
    job.controller.abort();
    job.paused = false;
    job.wake.forEach((fn) => fn());
  }
  emit();
  pump();
}
export async function jobCheckpoint(signal: AbortSignal) {
  signal.throwIfAborted();
  const job = signals.get(signal);
  if (job?.paused)
    await new Promise<void>((resolve) => {
      const wake = () => {
        job.wake.delete(wake);
        signal.removeEventListener("abort", wake);
        resolve();
      };
      job.wake.add(wake);
      signal.addEventListener("abort", wake, { once: true });
    });
  signal.throwIfAborted();
}
export function runJob<T>(
  signal: AbortSignal,
  work: (signal: AbortSignal) => Promise<T>,
  label: string,
  controls = true,
): Promise<T> {
  if (hasJob(signal)) return work(signal);
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    const job: Internal & { started?: boolean } = {
      id: ++serial,
      label,
      state: "queued",
      priority: 0,
      detail: "Waiting",
      controls,
      controller,
      paused: false,
      wake: new Set(),
      start: () => {},
    };
    const abort = () => {
      controller.abort();
      job.paused = false;
      job.wake.forEach((fn) => fn());
      if (!job.started) {
        job.state = "cancelled";
        signal.removeEventListener("abort", abort);
        reject(new DOMException("Cancelled", "AbortError"));
        emit();
        pump();
      }
    };
    signal.addEventListener("abort", abort, { once: true });
    controller.signal.addEventListener(
      "abort",
      () => {
        if (!job.started) abort();
      },
      { once: true },
    );
    signals.set(controller.signal, job);
    job.start = () => {
      job.started = true;
      job.state = "running";
      emit();
      void Promise.resolve()
        .then(async () => {
          await jobCheckpoint(controller.signal);
          return work(controller.signal);
        })
        .then(
          (value) => {
            if (controller.signal.aborted) {
              job.state = "cancelled";
              reject(new DOMException("Cancelled", "AbortError"));
            } else {
              job.state = "completed";
              resolve(value);
            }
          },
          (error) => {
            job.state = controller.signal.aborted ? "cancelled" : "failed";
            job.detail = error instanceof Error ? error.message : String(error);
            reject(error);
          },
        )
        .finally(() => {
          signal.removeEventListener("abort", abort);
          active = false;
          while (
            jobs.length > 30 &&
            ["completed", "cancelled", "failed"].includes(jobs[0].state)
          )
            jobs.shift();
          emit();
          pump();
        });
    };
    jobs.push(job);
    emit();
    queueMicrotask(pump);
  });
}
