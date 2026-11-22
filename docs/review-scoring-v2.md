# Review scoring v2: foundation release

## Problem and acceptance criteria
ChessLens showed an uncalibrated Elo estimate derived from accuracy. In the inspected PA555555/zohhon game, Chess.com displayed 350/350 while ChessLens displayed approximately 1675/1900. The current accuracy, move classification and rating systems are separate from Chess.com's proprietary models. Increasing engine power does not calibrate a rating formula.

This release must remove unsupported Elo claims, make score evidence inspectable, prefer comparable engine searches, preserve saved raw analysis, and clarify the player/time scope of historical insights.

## Delivered
- Removed the accuracy-to-Elo formula and its misleading assertion of realism. Accuracy remains explicitly a ChessLens expected-score estimate; no replacement Elo number is fabricated.
- Scoring identifier: `chesslens-expected-score-v2`. Same-position candidates are preferred when their UCI move matches, their depth equals the primary evaluation, and their principal variation is compatible. Exact saved recommendations retain zero loss. Otherwise, the model compares separate before/after searches.
- Centipawn-loss displays, expected-score loss, move classifications, critical moments and explanations use the same selected comparison. Special classification outcome checks also use the selected candidate.
- Expected-score transform remains logistic(cp / 250), with mate scores mapped to the corresponding outcome. Accuracy remains mean(100 * exp(-6 * loss)). No empirical claim is made that this fixed-strength mapping matches human winning chances or CAPS2.
- Game performance profile shows per-player Opening, Tactics, Positional Play and Endgame move-quality scores out of 100, analysed/identified decision counts, and the three highest-loss examples per category. Examples jump to the played move on the review board.
- Missing categories show "Not enough data", without a zero score or empty progress bar. Samples under eight moves are marked limited; this is a presentation rule, not a statistical confidence interval. All results remain single-game samples.
- Analysis details disclose requested engine settings, observed minimum/maximum comparison depths, same-position comparison coverage, and large depth gaps. Cross-engine fallback pairs are excluded from the profile.
- Historical insights identify their selected player and filtered saved-game scope. If that player is outside the current game, an explicit action selects the remembered current-game player; filters are not silently overwritten. Exports include the scoring identifier.

## Category boundaries and limits
- Opening: first 20 plies unless the position meets the endgame material rule. This is a phase heuristic, not opening-book knowledge or a rating.
- Tactics: moves with a played check/capture/promotion or a legal forcing saved engine recommendation/reply. The score measures decision quality in this sample, not tactic discovery rates. Exchanges and checks do not prove combinations; missing engine recommendations can leave decisions unidentified.
- Positional Play: quiet middlegame decisions outside the forcing sample. A proxy for move quality, not a complete assessment of strategy, activity or pawn structure.
- Endgame: at most four non-pawn/non-king pieces before the move. No endgame receives an invented score when this game did not reach one.
- Category samples overlap. They must not be averaged into a purported performance rating.

## Persistence and compatibility
Raw evaluations, engine principal variations, games and options retain their storage schema. Profiles derive from these records and survive reload/backup restoration without another engine run. Derived scores may change under the new version; older raw analyses are retained. Scores from different engines, depths or model versions should not be treated as a calibrated trend.

## Next stages (not delivered by this foundation)
1. Add explicit Book recognition from licensed opening data and expand tactical opportunity detection beyond forcing-move proxies.
2. Collect a consented/appropriately licensed benchmark with actual player ratings, time controls, position complexity, engine/version/configuration and outcomes; partition by game/player so training and held-out evaluation do not leak.
3. Fit and validate rating-aware expected-score and category models across rating bands and time controls. Report held-out calibration and sample uncertainty; avoid tuning a formula to one example or copying Chess.com's displayed labels.
4. Add recency-weighted historical category trends only with comparable engine/model provenance, adequate sample counts and player scope. Add Elo-scale estimates only if their calibration warrants the label.

## Validation strategy
Unit fixtures cover same-position consistency, perspective symmetry, stale/invalid candidates, missing categories, player attribution, legal forcing evidence and cross-engine uncertainty. Browser tests cover real engine analysis, category evidence navigation/highlights, no Elo badge, score persistence, profile player choice and explicit historical-player switching. Existing review, learning, analysis-cache and persistence checks are retained.

## Release verification
- Production build passed.
- Full desktop/mobile regression run: 132 passed, 2 intentional desktop skips for mobile-only checks.
- Final selection-persistence/style refinement: all 114 unit tests and 6 focused desktop/mobile profile/backup checks passed.
- Inspected the profile at 390px: no horizontal overflow; category score colour supplements numeric labels (below 60 coral, 60-84 amber, 85+ green). These are presentation bands, not rating cohorts.
- Profile player selection is stored for the current player pairing, validated during backup import, and restored after evidence navigation/reload. Missing choices default to the remembered player when present.
- Analysis completion now commits non-sample analysed games to Library before reporting completion, preventing a fast import of another game from losing the first game's library entry.

Final evidence-label regression: setup PGNs preserve their actual move number and side (for example, `15... g1=Q+`). The final 6 desktop/mobile profile checks passed after this refinement.
