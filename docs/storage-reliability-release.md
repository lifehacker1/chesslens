# Storage and background-job reliability - 2026-10-31

## Acceptance and implementation

- Saved-game reads, analysis merges and writes share one IndexedDB read/write transaction. Two tabs contributing different evaluated positions must preserve both.
- Compatible analysis keeps the deeper result for each position. Older snapshots cannot replace newer navigation or engine settings. Collection additions are unioned; automatic checkpoints cannot undo an explicit manual save.
- Collection detachment and undo restoration merge with current database records. A manually kept game survives removal of its download collection.
- Library changes broadcast to other tabs. Browsers without BroadcastChannel still refresh Games on window focus. Notifications are sent after successful transactions only.
- Archive download, archive analysis, collection removal and latest-game sync share a same-origin Web Lock. Queued work is cancellable through its existing signal; a closed tab releases its lock. Analysis re-reads the collection after acquiring the lock, avoiding stale manifests.
- Independent interactive review engines are intentionally not serialized by this background-job lock. Browsers without Web Locks retain same-tab behavior and atomic database saves, but cannot guarantee cross-tab background serialization.
- Dashboard phase calculations are prepared in its worker. Trend counts reuse prepared critical moments instead of recomputing them on the main thread.

## Verification strategy

Browser tests bundle the real storage/lock modules behind test-only intercepted URLs. No testing hooks are exposed in the production app. Two actual pages share the real IndexedDB database and Web Locks; tests cover concurrent contributions, preserved manual-save status, collection detachment, cross-tab library refresh, queued cancellation and subsequent lock reuse.

A benchmark seeds 1,000 synthetic games of 10 plies each, checks the initial list remains bounded to 30 rows, and verifies 5,000 analysed player moves in the dashboard. Timing is recorded rather than used as a flaky hardware-dependent assertion. Desktop and mobile refer to viewport configurations on the development machine, not physical phone hardware. Long-game and larger-library benchmarks remain future work.

## Boundaries

The last active review remains a shared per-origin recovery record, not a separate active-session record for every tab. Learning/practice records still require their own concurrency design. No cloud synchronization, background execution with the browser closed, or automatic conflict resolution across different engine configurations is claimed.

## Validation results

Production build passed; 87 unit tests passed; 30 targeted desktop/mobile browser checks passed before the final queued-manifest safeguard. The initial 1,000-game benchmark measured library rendering at 2,341 ms (desktop viewport) / 2,382 ms (mobile viewport), and dashboard coverage at 3,209 ms / 2,697 ms. These are development-machine observations, not performance guarantees or phone measurements.

Final queued-manifest safeguard and storage/archive regression run: 10 browser tests passed on the final build. The 1,000-game benchmark also passed again.
