# Roadmap completion release - 2026-11-01

## Scope and acceptance

This release delivers the remaining software scope of roadmap Phases 1b, 2 and 3. Phase 1's six confirmed fixes remain covered by regression tests. Physical-device testing is not implied by a mobile viewport test.

| Workflow | Acceptance and implementation |
| --- | --- |
| Storage management | Settings displays site usage/quota when supported, saved-game count and persistence status. Users can request browser persistence. Recent analysis retention is configurable from 0 to 20; cleanup never removes saved games, active/previous review, practice or engines. The preference is backed up. |
| Personal openings | Insights groups matching games by identified ECO opening and displays frequency, wins/draws/losses and score from the selected player's perspective. Unknown/unfinished results are excluded from score. Catalogue positions identify transpositions; headers provide a fallback. |
| Tactical evidence | Critical moves are grouped by legal saved replies: checkmate, check, capture, promotion and fork geometry. Each group includes game/move, loss, search depth and inspectable evidence. A geometric fork does not establish forced material gain. |
| Practice sets | Each evidence family can be saved to Learn as a deduplicated set. Existing practice progress is preserved. |
| Teaching | Eight legal interactive endgame exercises now cover opposition, passed pawns, rook support, queen/rook mate, knight promotion with check, king support and rook cutoff. These teach stated objectives rather than claiming unique optimal moves. |
| Job manager | Settings lists current/recent engine analysis, engine downloads, latest sync, collection downloads/analysis, deeper review and storage jobs. Controllable jobs support pause, resume, cancel and queued priority. Storage merge/cleanup jobs finish without interruption. |
| Progress | Practice stores up to 500 review events per puzzle. Displays due positions, three-solve streaks and 30-day recorded reviews, unassisted solves and active UTC days. Legacy attempts have no invented historical timestamps. |
| Adaptive analysis | Learn rechecks both positions around up to eight highest-loss moves. It increases search depth/time within normal caps, preserves already-higher limits, reuses compatible deeper results and stores results separately from the original review. Actual achieved depth is displayed. |
| Learning concurrency | Practice edits read/merge/write in one IndexedDB transaction; concurrent additions and attempt increments are retained. Explicit deletion is not undone by a stale tab. Restore keeps local puzzle progress on duplicate IDs. |

## Architecture and compatibility

- `jobs.ts` owns the in-tab priority queue, cancellation and cooperative checkpoints. `backgroundJobs.ts` also uses the existing same-origin Web Lock for library/storage jobs. Nested engine work shares its parent job, avoiding queue deadlocks.
- Pause waits for an in-flight search/request to reach a checkpoint. Engine workers remain allocated while paused. A paused active job retains its queue slot and any Web Lock until resumed or cancelled. Priority affects queued jobs in this tab only; it does not preempt active work or coordinate priority across tabs.
- Interactive analysis in different tabs remains independent. This is not an operating-system scheduler and does not promise exclusive access to all CPU cores.
- Queue state is session-only. Reloading does not silently restart jobs; existing game/collection checkpoints remain available for explicit resume/retry. No work executes after the tab closes.
- `insightAnalysis.ts` provides opening summaries, legal tactical evidence and bounded critical-position selection. Pattern preparation runs in the existing worker.
- `learningStorage.ts` retains schema version 1, adding optional bounded per-puzzle history. Existing backup files remain supported. Deleting a puzzle also deletes its history.
- Deeper analysis is an additional cached configuration, subject to retention. With retention zero, the UI explicitly reports that results last only in the current view. This is a user-triggered adaptive pass, not continuous unattended re-analysis.
- Browser quota is an estimate for the origin; it is not an exact per-feature accounting. Persistence requests can be denied. Downloaded engines retain their existing individual removal controls; fetched-game cleanup remains in Games.
- Stockfish assets, corresponding source archives and GPL notices are unchanged.

## Validation

Production build and 101 unit tests passed. Unit coverage includes queue priority/cancellation/pause, legal evidence, opening outcome perspective, bounded position selection, practice history and concurrent merge logic. The first targeted browser run identified a shared-database close error in retention cleanup; this was corrected before final regression validation.

All 112 applicable desktop/mobile checks passed across the full suite and targeted rechecks; two mobile-only tests were skipped on desktop. The full run passed 110 checks and exposed two instances of an older fixture racing the active-review saver. The fixture now uses a separate unanalysed game: both rechecks passed. A final 24-check targeted run also passed the changed learning, backup, storage and job flows; the two export checks were then rerun after fixture isolation. The viewport configurations run on a development machine, not physical phones. Existing bundle-size warnings remain; the vendored opening catalogue is included in both the application and pattern worker.

## Explicit boundaries

Physical-phone thermal/battery and memory-pressure testing, cloud synchronization, closed-tab execution, arbitrary engine dependency packaging and causal tactical diagnosis are outside the delivered scope. The shared active-review recovery record still follows the latest tab update; saved-game and practice merges are atomic.

### Development-machine stress results

| Dataset | Desktop library / dashboard | Mobile viewport library / dashboard |
| --- | --- | --- |
| 1,000 games, 10 plies each | 3,048 / 3,853 ms | 3,276 / 3,864 ms |
| 100 games, 200 plies each | 3,328 / 4,231 ms | 3,661 / 4,113 ms |

The long-game dataset uses synthetic repeated knight moves to exercise parsing/storage and worker volume; it is not representative tournament-game data. These observations are not performance guarantees. Mobile storage layout was also visually inspected at 390px width after spacing and touch-target adjustments.
