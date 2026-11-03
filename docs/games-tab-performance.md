# Games tab fetching and responsiveness

## Behavior
- Only the username remembered when the page starts is eligible for one automatic recent-games load. Load can always request fresh results manually.
- Recent-game results, empty results and errors survive app-tab remounts for this page lifetime. Visiting Games, switching Library/Chess.com, or returning after the persistent API cache expires does not fetch again.
- A failed or interrupted automatic request waits for manual retry. Editing a username does not fetch it merely by revisiting Games.
- Reloading the browser resets the page snapshot; the initial load may reuse the existing 15-minute API cache, including its offline fallback. Load explicitly bypasses that cache.
- Page snapshots retain at most five player results and 1.5 million PGN characters. Eviction does not trigger an automatic fetch on the next tab visit.

## Confirmed performance costs and changes
- Games was unmounted on each tab exit, losing recent-game state and rebuilding it on return. A bounded page snapshot removes that repeated work.
- Every library read validated sessions by replaying their complete PGNs. A 100-game, 200-ply browser fixture took around 0.9 seconds per repeated validation pass before optimisation. Warm passes with cached PGN metadata took less than 1 ms in the isolated fixture. Cold parsing remains necessary; these are targeted measurements, not whole-app timings or measurements of the user's device.
- Validated PGN metadata is reused by session validation and Library completion counts. The cache holds only position/move counts, at most 2,000 PGNs and one million PGN characters. Evaluations and mutable session fields are still validated on every read.
- Reading the fetched-games cache repeatedly parsed its entire localStorage JSON. The parsed object is now reused when the stored text is unchanged; cross-tab edits and explicit clearing still invalidate it.

## Other contributors
- Maximum CPU mode can start several engine workers, up to the device/memory budget and a cap of 32. It can compete with UI work while analysis is active. Balanced or Single CPU mode offers more headroom. Existing preferences are preserved.
- Stored engine downloads and analysis caches consume storage, not ongoing engine CPU time. Clearing them can cause repeat downloads/analysis; no user data or cache was deleted for this fix.
- Large-library IndexedDB reads, initial PGN parsing and Insights pattern preparation still have a cost. Engine files and the main production bundle are also substantial on first load. No claim is made that all app latency is eliminated.

## Verification
Browser checks count real intercepted API requests through repeated tab visits, cache expiry, manual loading, page reload, failure/retry, and edited account names. Existing review, offline cache, sync and storage validation checks remain in place.

Validated: production build passed; 107 unit tests passed; 30 existing desktop/mobile review, cache, sync and Games checks passed, followed by 6 focused checks on the final startup/failure guards. CPU preference and stored user data were preserved.
