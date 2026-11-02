# Games workspace improvement plan - 2026-11-02

Three stacked local branches isolate reviewable changes. Merge in this order; later branches include earlier commits. Main is not changed.

1. `fix/games-library-state`: include the active saved game in filtered rows (so rename/delete/export remain available and pagination counts agree), continue/save from current review state, and recover job controls if refreshing download records fails. Error completion must not claim success.
2. `ui/games-library-layout`: separate the current review from library results, expose result counts and active-filter reset, improve card hierarchy, responsive layout and empty-state actions.
3. `feat/games-import-drafts`: retain an unfinished PGN across dialog closure and reload; explicit discard; clear after a valid import. Draft text is bounded to 100,000 characters; writes report storage failures. A draft never replaces the active game automatically. Adds explicit Select games mode and selected-only PGN export; selections survive filtering but are intentionally transient across leaving Games/reload.

Audit findings began with source inspection and now have desktop/mobile regression coverage. No external account actions or deployment are part of this work.

Further feature candidates: favorites/study collections, per-game study notes, and a review inbox ordered by unanalysed games. These need separate scope and are not claimed as implemented here.

## Delivery and validation

- Fix branch commit: `13de05f`. UI branch commit: `b10eee2`. Feature branch includes both ancestors and the final integration tests.
- Production build passed. All 103 unit tests passed. The combined stack passed 28 desktop/mobile integration checks across Games, persistence, archives, backup and existing reliability cases. After selection-mode polish, all six focused Games tests passed, including injected collection-read failure.
- Browser checks cover active-game rename/search, accurate visible rows, no horizontal page overflow, draft reload/discard, selected-only PGN output and recovery from download-record refresh failure.
- Mobile layout inspected at 390px width. Bulk-export checkboxes are opt-in; default game names do not repeat the player pair. Main remains unchanged. These are local branches, not a deployment.
- TypeScript checks passed before the fix and UI commits. Browser validation exercises the combined branch stack; no independent compatibility with older main versions is claimed.
- Existing large-bundle warnings remain. Drafts and export selection are excluded from full backups; saved games and analysis retain their existing backup behavior. Physical-phone testing and exhaustive failure injection remain outside this audit.
