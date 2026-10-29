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
