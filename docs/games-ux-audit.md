# Games tab UX audit — 2026-10-29

Scope: read-only inspection of the current local implementation, plus desktop (1365×900) and mobile (390×844) browser inspection using synthetic saved games and mocked Chess.com responses. No user games or application code were changed.

## Findings

| Priority | Finding | Evidence / impact |
| --- | --- | --- |
| P0 | Import errors are rendered in the hidden Review workspace | PGN failure calls setError while remaining on Games; the review-error container is inside the workspace hidden outside Review. Render errors next to the import input. |
| P1 | Source selection does not control the whole content area | SavedGames stays above Chess.com and PGN panels. With three saved games, the first fetched game began 2,302px below the mobile page top (844px viewport). |
| P1 | Current review duplicates a saved-library entry | Both show the same game with different action sets; no clear saved/current state. A new visitor also sees the sample as the current review. |
| P1 | Nested scrolling | Chess.com list has max-height:520px and overflow-y:auto inside a scrolling page. Use one page scroll, with pagination/load more when necessary. |
| P1 | Saved-game rows are oversized and difficult to scan | A mobile card measured about 238px high. Open, export, rename and delete have nearly equal prominence. Saved games have no search/filter/sort controls. |
| P1 | Desktop and mobile use different information organisation | The source selector exists only below 800px. Desktop stacks the library, Chess.com controls/results and PGN form, with a generic review heading. |
| P2 | Excessive setup before fetched results | Profile, cache explanation/actions, celebrity suggestions, month controls, download, speed/result chips and search all precede games. |
| P2 | Saved-card progress can become stale | SavedGames loads a snapshot on mount and after its own actions; it does not refresh when the app updates analysis in the background. |
| P2 | Fetched cache, active review and saved library are poorly distinguished | Different storage roles use similar saved language; active auto-resume does not equal explicitly saving a game to the library. PGN exports do not include analysis/progress. |
| P2 | Labels and visual treatments are inconsistent | Review Game, Open review and Continue reviewing; mixed emoji and SVG; long timestamps and raw position counts compete with game identity. |
| P2 | Loading and error states need localisation | Empty library appears before its async load completes; native prompt/confirm for rename/delete; no inline retry for library load failures. |
| P2 | Privacy copy is too absolute | “100% private in your browser” appears beside an external API fetch. Say that analysis stays local and fetching contacts Chess.com's public API. |

## Proposed structure

Games header with a compact Import action. Persistent Library / Chess.com destinations on every screen size. PGN paste/upload lives in an Import sheet/dialog, with local validation, explicit errors and optional preview. Keep import discoverable in the empty library too.

Library: one compact Continue review card, search and a Filters control, then game rows. Do not duplicate the active saved game in the immediately adjacent list. Show an active marker and saved state. Keep sample review clearly labelled.

Chess.com: compact remembered username + month toolbar, one Refresh control, search and Filters, then results. Collapse account details after fetching. Put month download and cache maintenance in an overflow menu. Show sample usernames only in the initial empty state.

Use the same row vocabulary in both lists: players/opponent, result, date, time control, source and analysis status. One primary Review/Resume action and an accessible overflow menu for export/rename/delete. Display accuracy only when sufficiently analysed; distinguish partial analysis. Keep destructive actions visually secondary and support undo where practical.

Use one vertical page scroll. Persist source, filters, query, selected month and scroll position. On returning from Review restore the relevant row and focus. A compact sticky toolbar must leave enough viewport height for results and account for the bottom app navigation and safe area.

## Delivery order

1. Fix hidden import errors; separate destinations; single-scroll layout; compact continue card.
2. Shared compact game rows; saved-library search/filter/sort; clear review/saved/analysis states; live progress refresh.
3. Accessible import and rename dialogs; delete undo; loading skeletons; inline retry; overflow/bulk actions and storage labels.

## Acceptance criteria

- Switching to Chess.com immediately reveals that source's controls/results, independent of saved-library size.
- On a 390×844 device with a remembered account, at least one game is visible in the initial viewport; no nested vertical scrolling or horizontal overflow.
- Primary actions remain at least 44px high; keyboard focus is visible; menus/dialogs restore focus to their trigger.
- Invalid PGN and oversized-file errors are visible next to the import controls, while preserving the input.
- A saved game has an unambiguous saved/current/review status, without duplicated full cards.
- Searching/filtering a library and returning from Review preserves context.
- Background analysis updates card status without reopening Games.
- Empty, loading, no matches, offline cache and fetch failure each have distinct copy/actions.
- Test with zero, three and 100+ saved games; long names; partial/full analysis; both source types; mobile and desktop.
