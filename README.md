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
- Sequential depth-12 analysis, white-perspective centipawn/mate evaluation, evaluation bar, next best move, six move classifications, per-side summary and estimated accuracy. Stop/restart and PGN import terminate the worker; stale results cannot overwrite a new game.
- Dark original ChessLens identity, responsive layout, manifest, install icons, install prompt on supported browsers, and a service worker for offline shell/engine use after the initial online load and analysis.

## Review methodology

Position scores are normalized to White's perspective. For each move we compare the evaluations before and after it from the mover's perspective, clamping centipawn loss to zero. A move matching Stockfish's root best move is **Best**; otherwise loss ≤15 is Excellent, ≤50 Good, ≤100 Inaccuracy, ≤200 Mistake, and >200 Blunder. Mate scores are mapped to ±10,000 centipawns for grading. Per-side accuracy is the mean of `100 * exp(-loss / 220)` across analysed moves, rounded to an integer. Partial results are marked as partial, and unanalysed positions never receive fabricated grades.

These are transparent MVP heuristics, not Chess.com classifications or rating estimates. Independent depth-limited searches can be noisy. Mate transitions use a coarse proxy. Longer games take more time and battery on phones; analysis only starts on request. No opening book or cloud engine is used.

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
