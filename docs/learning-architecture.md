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

## Variation navigation update — 2026-10-29

The Better move control now uses a two-way switching-arrows icon and cycles the available engine candidates, wrapping back to the first candidate. Its counter identifies the selected candidate. Return to game remains explicit, including in the review-tools menu for focus mode.

While comparing, previous/next, keyboard arrows, first/last and autoplay operate on the selected predicted line. The recorded game cursor stays unchanged. Selecting a candidate resets its cursor to its first move; selecting a continuation chip jumps to that step. Origin/destination squares, the next predicted-move arrow and the selected chip follow the same cursor. The scroll pane keeps the selected chip visible.

Predicted positions are analysed separately with the configured engine. Per-move accuracy and classification require both before/after evaluations; until then the UI says Pending. The position evaluation bar, depth and destination badge use the predicted position's result rather than the recorded game's score. These are engine estimates, not guaranteed outcomes. Candidate-line scores remain root scores, labelled separately from position details.

Analysis is cancelled when the candidate, configuration or review view changes. It waits while the recorded game is being analysed. Results are reused in memory for the current engine configuration. The optional persisted `alternativeCursor` identifies the candidate by its first UCI move and stores its step; its position is checked against the legal line on restoration. Older sessions recover the cursor from the saved preview FEN.

Icon choices considered: switching arrows (selected, emphasises cycling), branching paths (exploration), and stacked lines with a cycle arrow (list cycling).

Validation for the variation update: production build passed; 75 unit tests passed. The full 78-case browser run had 74 passes, 2 existing skips and 2 failures from the old exact-label expectation. After separating the preview label from predicted-only details, all 6 affected/expanded desktop-mobile cases passed, including cycling wraparound, autoplay and root-cursor restoration. The earlier 20-case variation/persistence/highlight regression also passed. Mobile screenshot inspected at 390×844. The exhaustive opening-data test retains all assertions with a 60-second limit for slower sandbox execution.

## Parallel analysis — 2026-10-29

`cpuBudget.ts` owns CPU mode selection and resource estimates. Missing/invalid CPU hints fall back to one core. Missing memory hints use a 512 MB budget; otherwise the pool budget is 25% of reported memory, clamped to 128–4096 MB. Estimated per-worker overhead is 384 MB for Stockfish Full, 64 MB for Lite and 128 MB for other engines, plus configured hash memory. These conservative estimates are not a measurement or guarantee of actual memory use. Maximum concurrency is bounded by this budget, reported logical CPUs, 32 workers and pending positions. Balanced additionally caps at four and half the logical CPUs. Default remains Single worker.

`analyse` serves completed/cached results first, prepares Full Stockfish once, then starts a pool of independent single-thread UCI workers. Each worker pulls the next original position index from a shared queue, preserving result associations when searches finish out of order. On failure or cancellation all sibling workers are terminated and settled before returning. Workers run the unchanged depth/time/MultiPV limits. CPU mode is execution configuration, excluded from position and saved-game analysis identity; switching it preserves useful results. Only new/pending work requires CPU time.

The existing Stockfish binaries, source archive and licences are unchanged. Independent workers do not require SharedArrayBuffer or cross-origin isolation. Actual CPU occupancy and speedup depend on browser scheduling, available work, thermal limits, startup costs and engine memory. A single position remains a single-thread search; native engine threading is outside this release.

Acceptance checks: CPU/memory/queue bounds; old-setting migration; cached results survive CPU changes; out-of-order results keep original indices; every worker terminates on cancel/error; real-browser parallelism and persisted preference; existing Full engine downloads, review cache and alternative analysis remain functional.

Parallel-analysis validation: production build passed; 81 unit tests passed; 78 desktop/mobile browser tests passed with 2 existing desktop skips. The real-engine test observed four concurrent workers, restored Maximum after reload, and verified that Stop terminated every worker. Default engine, full downloads/offline usage, practice verification, alternatives, saved analyses and existing settings regressions passed.
