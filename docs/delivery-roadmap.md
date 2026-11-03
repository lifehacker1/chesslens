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

## Phase 1b: storage and background reliability (software scope completed 2026-11-01)

- Done: atomic saved-game merges, collection detachment and restoration; real two-tab regression coverage.
- Done: cross-tab library notifications and serialized archive/latest-game background jobs using Web Locks. Interactive review sessions remain independent.
- Done: 1,000 short-game benchmark; worker-prepared phases and reused critical moments. Added 100 synthetic games of 200 plies and atomic practice editing. Physical-device thermal/battery testing is outside the verified scope.
- README reconciliation completed with Phase 1; maintain it with later releases.

See [storage reliability release](storage-reliability-release.md) for the original guarantees and browser fallbacks. The completion release below adds atomic practice edits; the shared active-session recovery boundary remains.

## Phase 2: complete existing workflows (completed 2026-11-01)

1. Done: versioned backup/restore covering games, analysis, settings and practice, with validation and duplicate handling.
2. Done: automatic-sync enable/disable, Check again and Stop controls.
3. Done: storage usage/quota estimates, persistence requests and recent-analysis retention controls.
4. Done: personal opening frequencies/results, inspectable tactical evidence and eight interactive endgame exercises.

See [backup and sync release](backup-sync-release.md) for restore boundaries and validation.

## Phase 3: new features (completed 2026-11-01)

1. Done: shared in-tab job manager with cooperative pause/resume, cancellation and queued priority. Participating library jobs retain cross-tab Web Locks.
2. Done: legal engine-reply families (mate, check, capture, promotion and fork geometry), source evidence and deduplicated practice sets.
3. Done: bounded practice history, 30-day progress and due/streak summaries; deeper analysis of both positions around the eight highest-loss moves.

See [roadmap completion release](roadmap-completion-release.md) for acceptance criteria, validation, queue semantics and limits. These phases cover the documented local-browser software workflows. Physical-device certification, closed-tab execution and cross-device sync are not claimed.

## Games simplification and Insights persistence (2026-11-03)

Implemented recent 100-game fetching, editable remembered accounts, filtered save/export/analysis actions, unified Library/download management, automatic analysed-game saving, and active-game highlighting/location. Insights now starts with the current game summary and advantage timeline, restored from persisted engine results. Opening a library card reads the latest saved record to avoid stale analysis during batch completion.

See [recent games and persistent insights](games-recent-library.md) for behavior and storage boundaries.

Library refinement: consolidated saved-current cards and action rows, separated persistent Status/Collection filters, added Select all matching and one contextual export action, and added library-wide plus per-game analysis percentages. Validated with 106 unit and 34 targeted desktop/mobile checks.

Games-tab performance refinement: recent-game lists now reuse page-lifetime results and do not refetch on tab visits, even when the API cache expires or the last request failed. Bounded PGN metadata reuse removes repeated parsing during library reads. See [Games tab fetching and responsiveness](games-tab-performance.md) for measured costs and remaining limits.
