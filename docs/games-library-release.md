# Games library, archive analysis and patterns release

## Accepted scope

Implement the Games UX audit: Library/Chess.com/Downloads destinations, compact cards, one page scroll, contextual import errors, menus/dialogs, live saved status and context restoration. Add current-game identity and metadata to Game summary.

Download all available standard-chess archive months for a Chess.com username; save games locally with source metadata and deduplication. Manage/export/delete download collections. Analyse a collection using the selected engine in a resumable foreground queue, retaining partial results. Jobs pause when Games unmounts or the tab closes; no unattended background execution is promised.

Expand the personal dashboard with analysis coverage, player/colour/date/engine filters, repeated exact-position errors, heuristic mistake categories, opening/phase breakdowns, recent/older rates and downloadable report evidence. Always distinguish correlations/indicators from proven tactical causes.

## Data / acceptance

- Existing saved games and settings migrate without destructive schema changes.
- Collection manifests use a separate versioned IndexedDB database; games remain in the review library and feed the dashboard.
- Re-fetching an archive preserves saved analysis; partial download resumes completed months and refreshes the latest month.
- API requests are serial and cancellable; failures and rate limits are visible and retain checkpoints.
- Analysis saves checkpoints; cancellation terminates all engine workers. Engine changes do not reuse incompatible scores.
- Removing a collection preserves independently saved games and games belonging to another collection.
- PGN exports contain games, while JSON collection backups include saved review sessions; labels explain the difference.
- Patterns use only the selected player's analysed moves, with denominators and sample size; exact repeated positions are distinct from heuristic tags.
- Validate zero/many games, long labels, invalid PGNs, network failure, cancellation/reload, deduplication, export and mobile/desktop navigation.

## Implementation notes (2026-10-30)

The Games workspace and download manager are implemented. Downloads are serial, resume completed months after failures, deduplicate by source URL/canonical PGN and preserve analysis. The dashboard now includes colour, played-since, engine, time-class and phase controls; preference persistence; exact recurring-position evidence with review links; analysis coverage; opening/phase counts; and a Markdown export. Its trend uses dated games with analysed moves, not review timestamps. Unknown dates are excluded from the trend.

Pattern preparation runs in a dedicated Web Worker. Library validation yields between batches, and game-card position counts are cached. Engine comparisons remain estimates: differing engines/depths and small samples affect results. Capture/check replies are indicators, not proven tactical diagnoses. JSON exports currently provide archival data; a guided JSON restore interface is a follow-up, not part of this release.

Regression coverage includes archive rate-limit recovery, duplicate games across months, persisted batch analysis, PGN export and dashboard integration on mobile and desktop. Unit tests cover date selection, recurring-position deduplication and preservation of deeper saved analysis. Existing import tests now open the explicit PGN dialog.

Validation: production build passed; 84 unit tests passed; 80 desktop/mobile browser tests passed with 2 existing desktop skips. Mobile layout inspected at 390 x 844.

## Automatic latest game (2026-10-30)

On app startup, a remembered Chess.com username triggers a fresh archive/month fetch. The newest available standard game is saved in Library and analysed using the selected engine/settings. Empty or variant-only recent months fall back to older months. Recent fetched game lists also populate the existing browser cache.

Automatic sync leaves the active board untouched and provides a Review latest game action. It waits for active analysis or Games downloads/fetches and checkpoints interrupted analysis. Completed compatible results are reused on reload. Existing download collection membership is preserved. Errors retain saved data and expose Retry latest sync; there is no continuous polling or closed-tab background task. With no remembered username, no automatic requests are made.

Validation: 85 unit tests passed; new latest-game and archive scenarios passed on desktop and mobile, including newest selection, fresh reload fetching, engine-free analysis reuse, no duplicates, unchanged active review and network failure recovery.

Additional review/persistence regressions: 30 desktop/mobile tests passed (34 browser cases total for this change). Production build passed.

Latest-game notice: displayed only in Games. It automatically dismisses after 10 seconds of an uninterrupted Games visit, supports immediate manual dismissal, and stays dismissed for the rest of that page session. Visibility and dismissal do not cancel background sync or delete saved analysis.
