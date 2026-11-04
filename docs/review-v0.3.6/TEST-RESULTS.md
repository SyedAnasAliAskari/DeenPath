# v0.3.6 verification — 2026-10-30

- `npm test`: 83 tests / 15 files passed. Added daily Nafl carry-over, period-specific completions, one-off Secrets penalties, scheduled filtering, all five unrecorded prayers from yesterday, historical quantities and selected-prayer-start accumulation.
- `npm run android:sync`: TypeScript and Vite production build passed. Existing bundle-size and dynamic-import notices remain.
- Android `assembleDebug testDebugUnitTest lintDebug`: passed. 62 unit tests / 17 suites; lint 0 errors, 87 warnings. Location rules test recent approximate/precise fixes and reject invalid, stale and unbounded positions.
- Browser workflow suite: 34 passed; one navigation encountered HTTP 404 while Vite rebuilt the preview directory. That unchanged offline/RTL routine check passed when rerun after the build. All 35 cases passed across those final runs. New checks cover prayer stacks across reload/midnight, completing only one entry, coordinate field refresh, and preserving saved coordinates on location failure.
- Backend code/schema unchanged from the preceding verified build (30 backend unit checks, PHP syntax scan and three SQLite migration fixtures passed in that verification).

## Physical device

The authorized Infinix X6725B/Android 15 accepted an in-place upgrade to 0.3.6/code 9. Both prayer stacks were present and there was no horizontal overflow. Native locate returned a recent cached fix, accuracy 100 m, about 16 seconds old, in about 30 ms. Location permission was already granted. Automatic location was already enabled and updated saved settings; comparison found only a user_settings record changed, with no non-settings records added, removed or changed. Pending operations remained 15, with changes confined to the settings operation. Account owner was retained.

Two native PDF preview requests rendered distinct pages from a temporary two-page PDF. It was deleted in finally cleanup. No live prayer completion or Secrets answer was entered. The screen timeout was restored from 600000 ms to its saved 60000 ms; the QA XML and tcp:9223 forwarding were removed. Captures, local snapshots and scripts are private under .tools/device-qa and excluded from deliverables.

## Limits

A successful recent fix on this device does not qualify all GPS/network/fused failure states or guarantee indoor accuracy. Real private biometric prompts, cloud deletion HTTP integration, hosted database/mail/provider integration, other devices, reboot and long Doze were not tested in this follow-up. Browser Nafl fixtures are synthetic; no fake Nafl was added to the user’s phone. Secure private screen capture remains enabled.
