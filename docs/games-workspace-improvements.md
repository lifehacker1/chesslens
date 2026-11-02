# Games workspace improvement plan - 2026-11-02

Three stacked local branches isolate reviewable changes. Merge in this order; later branches include earlier commits. Main is not changed.

1. `fix/games-library-state`: include the active saved game in filtered rows (so rename/delete/export remain available and pagination counts agree), continue/save from current review state, and recover job controls if refreshing download records fails. Error completion must not claim success.
2. `ui/games-library-layout`: separate the current review from library results, expose result counts and active-filter reset, improve card hierarchy, responsive layout and empty-state actions.
3. `feat/games-import-drafts`: retain an unfinished PGN across dialog closure and reload; explicit discard; clear only after a valid import. Limit the draft size and report storage failures. A draft must never replace the active game automatically.

Audit findings are from source inspection; browser regression results are recorded as checks are completed. No external account actions or deployment are part of this work.

Further feature candidates: selected-game exports, favorites/study collections, and a review inbox ordered by unanalysed games. These need separate scope and are not claimed as implemented here.
