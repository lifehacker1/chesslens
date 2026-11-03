# Recent games and persistent insights

## User experience
- Games has two sections: Library and Chess.com. Existing download collections remain manageable inside Library; the old Downloads preference migrates automatically.
- Chess.com loads the most recent 100 standard games, newest first, reading older months as necessary. There is no month selector. Filters apply to these recent games, not the player's entire history.
- The username remains editable. Enter or the Load icon fetches fresh results, bypassing the response cache. Successful usernames are remembered on this device (up to 10 suggestions).
- Actions below the filters save matching games to Library, export matching PGNs, or analyse and save matching games. Icons have accessible names and tooltips; destructive menu actions retain text.
- The active game has a highlighted border instead of a card badge. On section entry it is brought into view, including loading the page of results containing it. Existing filters are respected.
- Download collections created by earlier versions can still resume, analyse, export and be removed in Library.

## Persistence
- Analysed imported games automatically enter Library. Partial results survive interruption; batch results are saved per game. Compatible stored engine results are reused.
- The sample game is not automatically added to Library. Explicit Save remains available.
- Navigation updates an existing saved review without recreating a game deleted during that review when analysis has not changed.
- Game Summary and Advantage Timeline precede the personal weakness dashboard on Insights. They are regenerated from the persisted game and engine evaluations; no second, potentially stale copy of accuracy statistics is stored. Dashboard filters already use persistent preferences.
- Storage is browser-local. PGN exports contain moves only; use the existing JSON backup for analysis and settings. Storage errors remain visible.

## Validation
Unit tests cover recent archive ordering, the 100-game limit, duplicate games, invalid archive addresses, cancellation and empty accounts. Desktop and mobile browser coverage checks filters, PGN exports, automatic analysis saving, insight restoration and ordering, active-card location, account history, and compatibility with old download collections.

Verified on 2026-11-03: production build passed; 106 unit tests passed; complete Chrome desktop/mobile suite passed 120 tests with 2 intentional desktop skips for mobile-only tests. Mobile screenshot inspection confirmed the recent-games toolbar and cards fit at 390px. The production bundle retains the existing Vite chunk-size advisory.

### Compact action refinement
The single Load games control always requests fresh Chess.com results (including Enter submission); automatic initial loading can still use the cache. The duplicate account label is removed. Save game and Export PGN use labelled SVG buttons outside card menus. Library menus retain Rename and Delete; filtered Library export also uses an icon.

Compact-action validation: production build and 18 targeted desktop/mobile checks passed, including fresh fetch on repeated Load and direct Save/Export actions.

### Library cleanup and review coverage
- A saved current game appears only as its highlighted Library card. The separate Continue/Save card remains for an unsaved review.
- Card actions share one row: Open Review, Export PGN, and a single ellipsis menu for Rename/Delete. Saved games do not ask for another Save.
- The Library toolbar has one export action: matching games normally, selected games in selection mode. Select all matching includes all filtered results, including cards beyond the currently rendered page; Clear selection remains explicit.
- Status and Collection filters are independent, persisted, and included in JSON backups. Previously combined collection preferences migrate automatically.
- Review coverage means fully engine-analysed saved games divided by all saved games, rounded to a whole percent. Opening a game does not mark it reviewed. The overall bar shows complete (green), partial (amber), and unanalysed (grey) counts with text labels. It remains library-wide while filtering. Individual cards show analysed-position percentages, rounded down to avoid reporting 100% prematurely.
- Validation: production build passed, 106 unit tests passed, 34 targeted desktop/mobile browser checks passed; visual inspection at 390px confirmed one action row and no horizontal overflow.

### Page lifetime loading
The remembered player loads automatically at most once per page lifetime. Returning to Games restores the existing results; manual Load still refreshes them. Errors wait for manual retry and editing another username does not fetch it on tab re-entry. Page reload permits a new initial load. See [performance investigation](games-tab-performance.md).
