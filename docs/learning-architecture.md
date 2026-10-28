# Learning architecture and operations

## Responsibilities

- `learning.ts`: pure legal line replay, expected-score critical moments, factual move explanations, phase heuristics, scheduling and lesson objectives.
- `StudyBoard.tsx`: legal square-to-square entry, underpromotions, original SVG pieces, orientation and origin/destination highlighting. Study boards never mutate the active game.
- `LearningHub.tsx`: coach, comparison, opening catalogue, puzzle collection, optional live verification, lessons and saved-game dashboard.
- `learningStorage.ts`: isolated IndexedDB schema, validation and transactional writes.
- `scripts/update-openings.mjs`: retrieves a revision, generates the vendored catalogue and saves upstream provenance/licence. Updating the catalogue is an intentional maintenance step, not a build-time network dependency.

## Evidence model

Evaluations always use White's perspective for display. Expected-score loss is normalised to the player moving. Comparisons use the FEN before the played move; your line uses the played move plus the opponent's saved PV, while the recommended line uses the pre-move PV. Every line is truncated at the first illegal move. Scores shown alongside boards remain the saved line evaluation as you replay, not an invented per-node score.

Critical moments require before/after results and at least five expected-score percentage points of loss. Labels use the estimated score before and after; they are opportunities, not mathematical proof of a win. Phase is Opening in the first 20 plies unless at most four non-pawn/non-king pieces remain (Endgame); otherwise Middlegame. The dashboard excludes the opponent's moves, reports denominators, and shows examples. Checks/captures in the engine reply are overlapping indicators, not diagnosed strategic causes.

Practice accepts the saved best move or a saved candidate within two expected-score points. Unknown legal alternatives remain unverified. Explicit verification analyses root and candidate positions afresh with the currently selected engine/settings; it is blocked during game analysis, supports cancellation, and terminates on leaving the exercise. Engine errors do not become incorrect answers. A reveal, hint, or previously incorrect known candidate makes the attempt assisted. Successful unassisted spacing is 1, 3, 7, 14 then 30 days; assisted positions return after 10 minutes. This is a simple deterministic schedule, not a personalised learning model.

## Storage contract

Database `chesslens-learning`, version 1, object store `data`, key `current`:

- `version: 1`
- `puzzles`: FEN-identified positions with source PGN/ply, engine evidence, title, attempt count, streak and due timestamp.
- `completed`: unique known lesson IDs.

Writes commit before the UI reports a successful save. Failed writes leave existing records intact and offer Retry saving progress. Reads validate legal source positions and evidence. Unknown schema versions fail without rewriting the record. A future migration must retain the previous version until conversion and validation succeed in an IndexedDB upgrade transaction. Data is local to the browser/origin, with no server account, sync or backup guarantee. Concurrent editing in multiple tabs is not synchronised in this first version.

## Validation and release checklist

- Unit: legal prefixes, black/white score perspective, partial coverage, special moves, lesson objectives, schedule intervals and all vendored opening lines.
- Browser (desktop/mobile): comparison roots and highlights, concealed hints/solutions, saved practice and completed lessons after reload, unknown schema preservation, selected-player dashboard.
- Existing review, engine-download, cache, persistence and navigation tests remain regression gates.
- Production build plus visual inspection of a mobile coach screenshot.
- Service-worker shell version incremented; engine download cache is retained.

## Deliberate initial scope

Five curated endgame exercises, deterministic factual coaching, local practice and heuristic pattern summaries. No LLM-generated narratives, full tactical motif classifier, tablebase service, population opening statistics, cloud synchronisation or adaptive curriculum. General opening plans are educational guidelines, not position-specific engine conclusions. These can be added behind the existing domain/storage boundaries in later releases.
