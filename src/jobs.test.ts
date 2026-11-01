import { describe, it, expect } from "vitest";
import { runJob, jobCheckpoint, controlJob, jobSnapshot } from "./jobs";
const tick = () => new Promise((r) => setTimeout(r, 0));
it("prioritizes queued jobs and cancels queued work without running it", async () => {
  let release!: () => void;
  const order: string[] = [];
  const first = runJob(
    new AbortController().signal,
    async () => {
      await new Promise<void>((r) => (release = r));
    },
    "first",
  );
  await tick();
  const low = runJob(
    new AbortController().signal,
    async () => {
      order.push("low");
    },
    "low",
  );
  const high = runJob(
    new AbortController().signal,
    async () => {
      order.push("high");
    },
    "high",
  );
  controlJob(jobSnapshot().find((j) => j.label === "high")!.id, "priority");
  const cancel = runJob(
    new AbortController().signal,
    async () => {
      order.push("cancel");
    },
    "cancel",
  );
  const caught = cancel.catch(() => {});
  controlJob(jobSnapshot().find((j) => j.label === "cancel")!.id, "cancel");
  release();
  await Promise.all([first, low, high, caught]);
  expect(order).toEqual(["high", "low"]);
});
it("pauses at a checkpoint, resumes and aborts a paused job", async () => {
  let stage = 0,
    go!: () => void;
  const p = runJob(
    new AbortController().signal,
    async (signal) => {
      await new Promise<void>((r) => (go = r));
      await jobCheckpoint(signal);
      stage++;
    },
    "pausable",
  );
  await tick();
  const id = jobSnapshot().find((j) => j.label === "pausable")!.id;
  controlJob(id, "pause");
  go();
  await tick();
  expect(stage).toBe(0);
  controlJob(id, "resume");
  await p;
  expect(stage).toBe(1);
  let next!: () => void;
  const q = runJob(
    new AbortController().signal,
    async (signal) => {
      await new Promise<void>((r) => (next = r));
      await jobCheckpoint(signal);
      stage++;
    },
    "abort paused",
  );
  await tick();
  const qid = jobSnapshot().find((j) => j.label === "abort paused")!.id;
  controlJob(qid, "pause");
  next();
  await tick();
  const rejected = expect(q).rejects.toThrow();
  controlJob(qid, "cancel");
  await rejected;
  expect(stage).toBe(1);
});
