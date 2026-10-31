# ChessLens delivery roadmap

Work proceeds in this order: confirmed bugs, reliability risks, incomplete features, then new features. Each change requires acceptance criteria, appropriate regression coverage, a production build, and a recorded validation result. Existing saves and engine assets must remain compatible.

## Phase 1: confirmed bugs (completed 2026-10-31)

| ID | Issue | Acceptance |
| --- | --- | --- |
| BUG-01 | Games crashes when local storage is denied | Games remains usable; storage failures do not blank the app |
| BUG-02 | Chess.com account switching retains the old profile | Explicit Change player control; changing Downloads username clears old results and month; stale requests cannot replace new results |
| BUG-03 | Report counts unanalysed games as analysed | Export distinguishes matching games, games with analysed player moves, and analysed moves |
| BUG-04 | Review board only promotes to queen | Review exploration supports queen, rook, bishop and knight with correct square highlights |
| BUG-05 | Broken progress separator | Latest-game progress contains valid text |
| BUG-06 | Invalid calendar dates roll forward | Invalid dates excluded; valid leap days accepted |

## Phase 1b: storage and background reliability (delivered initial scope 2026-10-31)

- Done: atomic saved-game merges, collection detachment and restoration; real two-tab regression coverage.
- Done: cross-tab library notifications and serialized archive/latest-game background jobs using Web Locks. Interactive review sessions remain independent.
- Done: 1,000 short-game benchmark; worker-prepared phases and reused critical moments. Long-game/physical-device stress testing remains a follow-up.
- README reconciliation completed with Phase 1; maintain it with later releases.

See [storage reliability release](storage-reliability-release.md) for guarantees, browser fallbacks and remaining learning/active-session concurrency boundaries.

## Phase 2: complete existing workflows (queued)

1. Versioned backup/restore covering games, analysis, settings and practice, with validation and duplicate handling.
2. Automatic-sync enable/disable and Check again controls.
3. Storage usage, quota reporting and retention controls.
4. Personal opening frequencies and results; deeper weakness evidence and teaching coverage.

## Phase 3: new features (queued)

1. Unified job manager with pause/resume/cancel/priority.
2. Evidence-based tactical mistake families and weakness-to-practice sets.
3. Retention/progress tracking and adaptive deeper analysis of critical positions.

No queued item is claimed as implemented. Closed-tab execution and cross-device sync require separate design decisions.
