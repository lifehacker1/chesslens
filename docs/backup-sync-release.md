# Backup and latest-game sync release

Delivered 2026-11-01. This completes the first two workflows in Phase 2 of the delivery roadmap.

## User-facing behavior

Settings now provides a full JSON backup and a validated restore preview. Backups include saved games, saved analysis, the current review, download collection records, practice puzzles, completed lessons and supported app preferences. Restore merges games by canonical PGN and does not replace the active board. The backed-up current review is recovered into the library. Restoring preferences is optional and takes effect after reload.

Before merging, the user must download a recovery backup of this device. Repeating the same restore does not duplicate games or puzzles. Existing puzzle progress wins on duplicate IDs; lesson completions are combined. Practice records are read and merged inside the write transaction so restore does not overwrite progress saved while game restoration was running.

Latest game sync has a persistent enable/disable setting, enabled by default. Check again works with automatic sync disabled. Stop latest sync cancels an active request/analysis while retaining saved progress. A remembered Chess.com username is required. Automatic checks run once per page load and account/analysis configuration, waiting for active review/download work; enabling sync starts another check. The temporary review-latest banner remains exclusive to Games.

## Compatibility and limits

- Backup schema version 1; maximum JSON size 50 MiB. Unsupported versions, malformed analysis and unsafe engine URLs are rejected before restore writes begin.
- Legacy collection JSON exports are accepted. Imported download jobs are paused rather than automatically resumed.
- Duplicate games preserve local names and engine configuration. Compatible analysis is merged; imported analysis for other configurations uses the existing bounded recent-analysis cache.
- Custom engine registrations are included, but engine binaries and fetched-game caches are excluded. Absolute custom worker URLs must match the receiving site's origin and the worker files must still exist there.
- Backup covers explicitly supported preference keys, including the automatic-sync toggle. It is not a copy of arbitrary browser storage.
- Writes across separate databases and localStorage are not one atomic transaction. A quota/storage failure can leave a partial merge; the UI reports this and the recovery copy remains available. A repeated merge is supported.
- Web Locks serialize participating background jobs across tabs where supported. Export is not a transaction spanning every database. Other learning operations still have the previously documented concurrency limits.
- This is manual backup/restore, not cloud synchronization. Closed tabs do not fetch or analyse games.

## Acceptance and validation

- Production TypeScript/Vite build passed.
- All 93 unit tests passed. Unit coverage includes version rejection, corrupt evaluations, unsafe engines, legacy exports, sync preference round-trip and preservation of local practice progress.
- Desktop/mobile browser coverage passed for backup export into a fresh browser context, saved analysis and lesson recovery, optional preference restore, repeated merge, future-version rejection and same-origin custom engine registrations.
- Desktop/mobile sync tests passed for disabled automatic requests, manual checks, reload persistence, stopping an in-flight request, re-enabling sync and saved game results.
- Learning regression tests passed alongside the backup and sync tests (12 browser tests total). An earlier targeted run also passed latest-game banner and settings persistence coverage (10 tests total).

Next: storage usage/quota visibility and explicit retention controls, followed by opening and learning improvements.

