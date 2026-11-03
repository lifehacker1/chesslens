# Original piece designs

Settings > Board & review appearance now separates shape design from finish.

- ChessLens: the existing detailed, original vector artwork.
- Tournament: traditional rounded silhouettes with broad bases.
- Minimal: angular, geometric silhouettes with simpler details.

Each design includes king, queen, rook, bishop, knight and pawn for both colours, and supports Sculpted (gradient) or Flat (solid) finish. All artwork is authored in `src/pieces.ts` with no external assets or font dependencies. SVG stays sharp when enlarged.

A live 12-piece preview changes immediately in Settings and uses the selected board palette. Changes apply to the review board and study/practice boards. Design and finish are saved together in browser preferences and included in JSON backups. Older preferences/backups without `pieceDesign` default to ChessLens, retaining the old finish. Reset settings restores ChessLens/Sculpted.

The reported dropdown failure was not reproduced: the original control changed all 32 board pieces and persisted across reload. Its visual effect was hidden while Settings was open, and the label mixed finish with design. The preview and separate labels address that ambiguity. Native keyboard selection, visible artwork changes, reload persistence and backup restoration are covered by desktop/mobile checks.

Validation: production build passed. Piece design/finish keyboard selection, preview/board rendering, reload persistence and JSON backup restoration passed on Chrome desktop and mobile (4 browser checks). All 12 pieces in each set were visually inspected on light and dark squares. Unit run: 106 passed; the unchanged `learning.test.ts` opening-data legality check exceeded its 60-second timeout both in the full run and an isolated rerun. That unrelated test was not modified or disabled.
