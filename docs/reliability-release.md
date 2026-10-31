# Confirmed bug fixes - 2026-10-31

## Scope

BUG-01 through BUG-06 from delivery-roadmap.md. This release preserves existing review/engine schemas and does not add a new engine, backend or external dependency.

## Changes

- Games uses a guarded legacy-username reader, so denied browser storage cannot crash the screen.
- Changing a player clears account-specific archives, results, filters and selected month. A Change player action is available after fetching. Requests use AbortController plus the existing generation guard; leaving Games also aborts its pending fetch.
- Weakness exports distinguish matching games from games with analysed player moves and include the analysed-move count.
- Selecting a promotable pawn reveals a four-piece promotion selector in Review. Queen remains the default; the selector is keyboard accessible and uses a 44px minimum touch height.
- Latest-game progress uses a valid plain-text separator.
- Parsed dates must round-trip to the original calendar date; impossible dates are excluded rather than silently rolling forward.
- README review/CPU/automatic-analysis descriptions are updated to match behavior.

## Verification

Regression tests exercise denied storage, account switching/reload, actual legal knight promotion with from/to highlights, and downloaded report coverage on desktop/mobile. Unit tests cover valid leap days and invalid calendar dates. Existing archive and automatic-sync scenarios are also run.

## Remaining work

Concurrency across saves/tabs and large-library performance remain Phase 1b risks; they are not resolved by these fixes. Incomplete workflows and new features remain queued in delivery-roadmap.md.

## Validation results

Production build passed. All 86 unit tests passed. Full browser regression: 90 passed, 2 existing desktop skips. Final promotion touch-target check: 2 passed after CSS polish. Mobile promotion layout visually inspected. No production engine asset or licence changes.
