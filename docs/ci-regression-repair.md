# CI regression repair - 2026-11-02

The Games section selector was renamed from `Import source` to `Games sections`, but the mobile navigation and Chess.com review tests still queried the old name. Update both tests and require the section group to be visible instead of silently skipping navigation when the locator fails.

The manual latest-game test observed an enabled button before the new React effect started, then synchronously asserted the request count. Wait for the second request to be observed before waiting for completion. Apply the same ordering when re-enabling sync. Clear the previous completion text when a new check starts so the UI does not show stale success during an in-flight request.

Repeated tests exposed another pre-existing timing dependency: the FEN-import test expected an exact move accessible name, but completed analysis adds the classification. Match the player and SAN with an optional classification suffix; this still verifies black-to-move numbering and move identity.

Add a read-only pull-request workflow that runs unit and full desktop/mobile tests before merge. Production deployment remains triggered by main; the new workflow does not deploy. Repository branch-protection rules are not changed.

Validation results are recorded after local checks. Local browser checks run Chrome on Windows; GitHub's Ubuntu Chromium execution remains a separate validation.

Repeated testing also exposed an offline prerequisite race: a worker started before service-worker control can finish analysis using HTTP cache without durable engine files. The offline test now explicitly downloads the engine and waits for its saved state before disconnecting; no offline assertions were removed.

Validation: production build passed; 103 unit tests passed. The final focused desktop/mobile run repeated the reported failures, FEN import and offline analysis three times: 27 passed, three intentional desktop skips for the mobile-only navigation test. Existing bundle-size warnings remain. This is local validation, not a claim that GitHub's deployment has succeeded.
