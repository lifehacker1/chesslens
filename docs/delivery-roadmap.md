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

## Phase 1b: reliability risks (queued)

- Make saved-game read/merge/write atomic and test competing updates across tabs.
- Coordinate jobs across tabs; avoid duplicate analysis and conflicting writes.
- Benchmark large libraries and remove remaining repeated main-thread calculations.
- README reconciliation completed with Phase 1; maintain it with later releases.

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
