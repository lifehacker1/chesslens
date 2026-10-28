# ChessLens learning release

## Scope and acceptance criteria

This release adds local learning tools without an account or cloud AI dependency.

| Feature | Acceptance criteria |
| --- | --- |
| Explain a move | Use the selected move's before/after evaluations; describe only verifiable board facts and legal engine lines; show analysis coverage. |
| Retry mistakes | Start before the mistake, hide solutions, accept legal input and optional hints; do not label an unanalysed alternative wrong. |
| Critical moments | Rank expected-point losses, distinguish missed wins/lost advantages/defensive chances, jump to the original move. |
| Compare variations | Both lines start at the identical FEN; legal replay, highlighted squares, White-perspective evaluations. |
| Opening explorer | Identify named positions and catalogue continuations; distinguish catalogue data from game-frequency statistics. |
| Weakness dashboard | Select a player; aggregate only their analysed moves across saved games; show denominators and heuristic limitations. |
| Personal practice | Save source positions, hints and attempts; persist review scheduling and allow deletion. |
| Endgame teaching | Curated interactive opposition, passed-pawn, rook-activity and mating lessons with explicit objectives and persistent completion. |

## Architecture

- Pure chess-domain functions own legal line replay, critical moments and phase classification.
- Learn is a separate navigation destination; review remains focused on the board and moves.
- Coaching uses existing evaluations. It is deterministic, not generated strategic prose.
- Study boards use the existing original SVG pieces and legal chess.js moves, including promotions.
- Learning records have their own versioned browser storage; existing review persistence is unchanged.
- Opening names are vendored from the CC0 Lichess catalogue with a pinned source revision and licence.

## Quality gates

Unit tests cover legal-prefix replay, score perspective, critical thresholds, lesson objectives and scheduling. Browser tests cover learning navigation, practice persistence, solution concealment and comparison roots on desktop and mobile. Run the existing regression suite and production build before release.

## Boundaries

Engine evaluations are estimates at the saved depth. A forcing reply is evidence, not proof of a strategic cause. Phase and king-safety labels are heuristic indicators. Opening catalogue counts are not popularity or win rates. Endgame exercises teach a stated concept and do not claim tablebase-perfect play. Browser storage is device/origin-local and can be cleared by the browser.

## Delivery log

- Architecture and acceptance criteria recorded before implementation.
- Implementation and validation results to be recorded below.
