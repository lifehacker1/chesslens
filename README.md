# ChessLens

A mobile-first React + TypeScript chess review PWA. Paste or import a PGN, replay the game, explore legal moves, and analyse privately with Stockfish WebAssembly in a Web Worker. No account, backend, API key, or game uploads.

## Run

Requires Node.js 22.12+ (tested with Node 24) and npm.

```sh
npm ci
npm run dev
```

`npm ci` prepares the pinned single-thread Stockfish 19 lite engine and its GPLv3 distribution files. If lifecycle scripts are disabled, run `npm run prepare:engine` manually. The lite engine is smaller and weaker than full Stockfish; it requires WebAssembly but no SharedArrayBuffer or cross-origin isolation headers.

## Build and verify

```sh
npm test
npm run build
npm run preview
npm run test:e2e
```

Browser tests use installed Microsoft Edge through Playwright. Change `channel: 'msedge'` in playwright.config.ts to your installed Chromium browser or install Playwright Chromium and remove the channel setting. The browser suite builds and serves the production app, checks desktop and 390px mobile layouts, real WASM analysis, navigation, variations, validation, cancellation, file imports, FEN starts and offline analysis. Screenshots are written to ignored test-results/. `node scripts/generate-icons.mjs` regenerates the PNG PWA icons from the SVG using Edge.

## Features and controls

- Direct Chess.com player import via the official public Published-Data API with zero server proxy or tracking. Browse archives by month, filter by speed (Bullet, Blitz, Rapid, Daily) and outcome (Wins, Losses, Draws), search opponents/ECO, review games with 1-click, and download full month PGN archives.
- PGN paste and .pgn/.txt file import, including SetUp/FEN games, castling and promotion in imported games. Invalid input preserves the current game.
- Interactive board with last-move highlights, legal move indicators, board flip and click-to-explore variations. Exploration promotes to a queen; return to game resets the variation. Variations are not engine-analysed.
- First/previous/next/last controls, move-list navigation and Left/Right/Home/End keyboard navigation.
- Sequential depth-12 analysis, white-perspective centipawn/mate evaluation, evaluation bar, next best move, nine move classifications, per-side summary and estimated accuracy. Stop/restart and PGN import terminate the worker; stale results cannot overwrite a new game.
- Dark original ChessLens identity, responsive layout, manifest, install icons, install prompt on supported browsers, and a service worker for offline shell/engine use after the initial online load and analysis.

## Review methodology

Position scores are normalized to White's perspective. ChessLens estimates expected points using a transparent fixed-strength curve: `P(White) = 1 / (1 + exp(-centipawns / 250))`. Mate scores map to 1 or 0. Scores are inverted for Black; a move's expected-point loss is the non-negative decrease from the mover's perspective. Engine-best moves are assigned zero loss to avoid penalizing search noise.

The standard cutoffs follow the public [Chess.com classification guide](https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc): Excellent ≤0.02, Good ≤0.05, Inaccuracy ≤0.10, Mistake ≤0.20, otherwise Blunder. Best matches the engine's top recommendation. **The curve is a local ChessLens estimate, not Chess.com's proprietary rating-trained model.** Scores and special labels may differ.

Special labels are deliberately conservative:

- **Great:** the engine's best move preserves at least an equal expected outcome, while every other returned candidate is below 0.45 and trails by at least 0.15 expected points.
- **Brilliant:** a near-best move offers a non-pawn piece that the engine continuation actually captures on its next move, for a net material sacrifice of more than one point. The resulting position must remain sound, and alternatives must not all be completely winning. Declined or delayed sacrifices are not labelled Brilliant by this heuristic.
- **Miss:** the opponent's last move creates a winning chance (expected points ≥0.75 from a prior position ≤0.60), but the played move drops back to ≤0.55 and loses at least 0.10 expected points.

Per-move accuracy is `100 * exp(-6 * expected-point loss)`; game accuracy is its mean across analysed moves. Both are ChessLens estimates. Partial results remain marked as partial, and unanalysed moves receive no invented classification or board badge. Independent depth/time-limited searches can be noisy. Longer games use more battery; analysis starts only on request. No opening book or cloud engine is used.

## Hosting and PWA

Publish the whole `dist/` directory to an HTTPS static host. The app uses relative asset URLs and supports a directory such as `/chesslens/` with a trailing slash. Serve `.wasm` as `application/wasm`; the bundled engine uses streaming WebAssembly compilation. HTTPS (or localhost) is required for service workers and installation. No special isolation headers are needed. Install support varies by browser; Android Chromium offers installation, while iOS uses Add to Home Screen.

### Deploying to GitHub Pages

ChessLens is pre-configured for GitHub Pages:

- `vite.config.ts` uses `base: "./"` so all assets and engine binaries resolve under any repository subpath (e.g. `https://<user>.github.io/chesslens/`).
- `public/.nojekyll` bypasses Jekyll static filtering so WASM and asset chunks are served directly.
- An automated GitHub Actions workflow is included at `.github/workflows/deploy.yml`.

To deploy via GitHub Actions:

1. Push your commits to GitHub on the `main` branch.
2. Go to repository **Settings** → **Pages**.
3. Under **Build and deployment** > **Source**, choose **GitHub Actions**.
4. GitHub Actions will automatically test, build, and deploy the site upon every push to `main`.

The worker caches the built shell and assets at installation, then caches the local engine files when first used. Offline analysis works after one successful online analysis. An offline reload opens the demo; imported games and analysis are held in memory and are not saved between reloads. Update the service-worker cache version when changing the caching strategy. Keep older hashed assets available during deployments to support existing offline clients.

## Structure and licensing

`src/game.ts` handles PGN parsing and review estimates; `src/engine.ts` owns the worker/UCI lifecycle; `src/main.tsx` contains the review UI; `public/sw.js` provides offline caching. `scripts/prepare-engine.mjs` assembles the engine distribution from pinned dependencies and checked-in corresponding source.

App code: MIT. Stockfish: GPLv3, with license, notices, corresponding source, embedded network and build instructions supplied with every build. **Deploy the complete engine directory, including source and license files.** See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for distribution requirements. The in-app footer exposes the license and source download.

## Review workspace and engine options

The board, replay controls and move dial stay pinned while you scroll the review. Drag the integrated dial, use its arrow keys, or scrub horizontally using a trackpad or Shift+wheel. Normal vertical scrolling moves the page. Every analysed move displays its individual accuracy estimate; the selected move also shows centipawn loss. Individual accuracy uses the same transparent loss formula as the game summary and is not a rating.

Open **Engine & analysis options** for Quick (depth 8, 0.5 seconds per position), Balanced (depth 12, 2 seconds), or Deep (depth 18, 5 seconds). Search stops at either limit. Configure 1–3 candidate lines and 16–64 MB of engine hash. Options are locked during analysis; changing them clears old results so different settings are not mixed. A bounded, session-only cache of 400 positions reuses exact matching engine/settings/FEN results, including when restarting a stopped game. The worker stays alive throughout a game and is terminated on stop, import or unmount.

The **Better move icon** compares your move with engine choices from the position _before_ you played it. Up to three lines show their score, depth and playable continuations. Click a continuation move to preview that position on the board; **Return to played position** restores the game. Scores are from White's perspective, and a candidate may match your move. Time-limited or interrupted MultiPV searches may return fewer lines. Engines without MultiPV support return one line.

**Add another engine** registers an already hosted same-origin `.js` UCI Web Worker. Deploy the worker and its dependencies under this site's engine directory, then enter a name and relative worker path. It must accept string UCI commands (`uci`, `isready`, `position fen`, `go depth … movetime …`) and post string responses (`info … score … pv …`, `bestmove …`). Only advertised Hash/MultiPV/analysis-mode options are sent. Registrations are saved in this browser; no engine binary is uploaded by registration. Custom engine distributors must ship that engine's required notices and corresponding source, and must check browser isolation/threading requirements. ChessLens continues to bundle only the licensed Stockfish lite build.

Moves that match the selected engine’s top recommendation are assigned zero review loss and 100% move accuracy; other moves use the expected-point-loss estimate. Both individual and game-summary accuracy apply this rule to avoid penalizing engine-best moves for noise between independent searches.

## Mobile app navigation and touch feedback

On screens up to 800px wide, the bottom app bar separates Review (board and move review), Games (PGN or Chess.com import), Insights (accuracy summary and advantage timeline), and Settings (engine controls, touch preferences and licenses). Switching tabs keeps the selected game and move in memory; it does not restart analysis. Importing a game returns to Review with a confirmation. Desktop retains the complete workspace.

The move dial provides a visual tick, current-position progress, and explicit start/end feedback while scrubbing. The page also shows scroll progress. Haptic move ticks are optional and off by default; devices without vibration support keep the visual feedback. Reduced animations can be saved in Settings, and system reduced-motion preferences are respected automatically. Mobile controls use larger touch targets, 16px form text to avoid unwanted iOS input zoom, and safe-area padding for the home indicator.

For browser testing, `CHESSLENS_TEST_BROWSER=chrome` selects an installed Chrome instead of the default Edge. CI uses Playwright Chromium. `CHESSLENS_TEST_PORT` changes the preview port; `CHESSLENS_TEST_SKIP_SERVER=1` runs against an already managed preview at that port.

## Captured pieces and material lead

Each player row shows the opponent pieces captured in the recorded game up to the displayed move. A single mint `+N` badge appears for the player ahead in remaining board material; neither player gets a badge when level. Values are pawn 1, knight/bishop 3, rook 5, queen 9, with kings excluded. This counter is independent of engine evaluation and game accuracy. It updates on replay, flip, manual variations and engine continuation previews. Promotions use the promoted piece's current value; capturing a promoted queen records a queen. For FEN starts, only recorded captures are shown, while the material badge still reflects the actual board.

## Consolidated replay and natural scrolling

Replay now uses one bar: Previous, an integrated move dial with one position count, Next, a Better move icon, and a tools menu. The icon is disabled until the position has engine analysis; activating it previews the recommendation and opens playable alternatives, and activating it again restores the game. The former large Show better move button and duplicate count badge have been removed. First/last, autoplay, flip, arrows, key-move jumps and analysis are available in the tools menu.

The moves list grows naturally with the document instead of using its own vertical scrollbar. Ordinary vertical wheel and touch gestures pass through the dial to the page, while deliberate horizontal gestures (or Shift+wheel) scrub moves. Selecting a move does not auto-scroll or pull the document back to its row.

## Larger boards, themes and move badges

On portrait phones, the board now uses the full available screen width; short landscape screens are height-limited so replay controls remain reachable. **Expand board** in the replay tools menu opens a focus view that uses the viewport and hides the surrounding app. Exit through the visible button or Escape.

**Board & review appearance** in Settings provides Classic Green, ChessLens Jade, Walnut, Slate Blue, Midnight and High Contrast palettes. The piece artwork is original inline SVG, so it remains sharp at any board size and needs no external assets. Theme and badge preferences stay in this browser.

After analysis, the selected move's destination square shows its classification symbol and individual accuracy. The badge follows replay and board flipping; it is hidden in unanalysed variations. It can be disabled in Settings.
