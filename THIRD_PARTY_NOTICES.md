# Stockfish distribution

ChessLens application code is MIT licensed (see LICENSE). Stockfish is a separate, unmodified engine running in a dedicated Web Worker under **GNU GPL version 3**. Its license and copyright notices must be preserved when redistributing ChessLens with the engine.

- Distribution: `stockfish@19.0.1`, pinned in package-lock.json.
- Builds: `stockfish-19-lite-single.js` / `.wasm` and `stockfish-19-single.js` / `.wasm` (Full).
- Embedded Full network: `nn-1a298aa575a0.nnue`, SHA-256 `1a298aa575a085434d29027978dc36867fe9c5bcea9376654b7a8eba1e52dfc2`.
- Stockfish.js copyright 2026 Chess.com, LLC; Nathan Rugg and contributors.
- Based on Stockfish by Tord Romstad, Marco Costalba, Joona Kiiski, Gary Linscott and other contributors.
- Embedded lite network: Chris Bao (sscg13), `nn-61e7af4bb97d.nnue`.
- Upstream: https://github.com/nmrugg/stockfish.js/tree/v19.0.1
- Network: https://tests.stockfishchess.org/api/nn/nn-61e7af4bb97d.nnue

`npm ci` copies the unmodified engine, its complete GPLv3 license, corresponding source archive and SHA-256 checksums into `public/engine/`. Vite copies them to the same `engine/` directory in the production output. The in-app footer links directly to the license and downloadable source beside the binary.

The checked-in `public/stockfish-source.tar.gz` contains the original upstream v19.0.1 source tarball, matching Lite and Full neural networks, and BUILD.txt. This preserves upstream source, copyright notices, build scripts and build instructions without modifying the archive's symlinks. Extract the inner archive on a platform that supports symlinks; copy both supplied networks into its src/ directory. The upstream build uses Emscripten 6.0.9 and `node build.js --single-threaded --lite -f` for Lite or `node build.js --single-threaded -f` for Full (see the included README).

Redistribute the **entire** production output, including the engine license and corresponding source download. Keep the source available from the same location while distributing the engine. For modified engines, supply the modified corresponding source and build instructions, preserve notices and mark modifications under GPLv3. Do not substitute a binary without updating its matching source, network, notices and checksums. No warranty is provided by the engine authors.

React, React DOM (Meta), chess.js (Jeff Hlywa and contributors), Vite and the other package dependencies retain their own licenses in their packages. The UI uses system fonts and locally authored SVG/PNG branding; there are no externally loaded fonts, chess piece assets or analytics.

## Lozza 12.1 distribution

Lozza by Colin Jenkins is MIT licensed. ChessLens bundles the unmodified `lozzaNNUE.js` and `lozzaHCE.js` assets from https://github.com/op12no2/lozza/releases/tag/12.1. These are two evaluation builds of the same Lozza engine, distinct from Stockfish. The neural build includes its embedded network; neither worker downloads external dependencies.

The original readable JavaScript, MIT license (copyright 2014 Colin Jenkins), release URL and SHA-256 manifest are checked in under `vendor/lozza-12.1/`. `npm run prepare:engine` verifies every file against that manifest and copies the workers, license and manifest into `public/engine/lozza/`, which Vite distributes under `engine/lozza/`. Preserve these notices and license when redistributing. Stockfish's existing GPLv3 license and corresponding source distribution are unchanged.
