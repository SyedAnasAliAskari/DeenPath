# Verification and release test matrix

Current release: **DeenPath v0.3.2**. See `V0.3.2-FIXES.md` for the latest results; v0.3.0 results below are historical. The detailed physical-device/hosting matrix below remains unexecuted here; its v0.1.0 results are historical.

## Commands

```
npm test
php tests/backend.php
npm run check:php
npm run build
```

For UI tests, start a stable Vite build preview, set the Playwright base URL appropriately, then run `npm exec -- playwright test`. `CHROME_PATH` can select an installed Chrome/Chromium executable. The browser preview exercises UI/localStorage logic, not native SQLite or Android permissions.

## Historical v0.1.0 executed evidence

Final local verification on **27 October 2026**:

| Check | Result |
|---|---|
| TypeScript domain/progress/schema tests | 18 passed |
| PHP validation/reward unit checks | 15 passed |
| Playwright mobile flows | 2 passed, process exited successfully |
| Android JVM prayer parity test | 1 passed, 0 failures/errors |
| TypeScript type check and Vite production build | Passed |
| PHP lint | All 6 backend PHP files passed |
| Gradle `assembleDebug testDebugUnitTest` | BUILD SUCCESSFUL |
| Debug APK signature | `apksigner verify` passed, APK Signature Scheme v2 |
| APK identity | `org.salahguard.app`, version 0.1.0, minimum API 29, target API 36 |
| npm audit (full tree and runtime) | 0 reported vulnerabilities |
| Connected Android devices | None; physical-device tests not executed |

The 36 automated test cases include no claim about a live database or phone. Browser checks exercised offline counter persistence, a single completion at target, durable queued edits, Urdu RTL/mobile width, and typing across clock ticks. The native JVM fixture compared Karachi/Hanafi prayer times with the frontend fixture within one minute. Earlier browser attempts exposed a form-label issue and development-server/runner teardown timeouts; the form was fixed and final tests used a separately started static preview. An initial schema safety assertion matched a SQL comment; the assertion was corrected to ignore comments. These initial failures are not counted as passes.

The final schema review also made table collations explicit and uniform, preventing foreign-key incompatibilities caused by differing hosting defaults. This is statically tested; a real SQL import remains unexecuted until the existing database is configured.

Unit checks cover Fajr/sunrise boundaries, Isha end policy, Hanafi/Standard Asr, Qaza distinction, out-of-window corrections, time zones/DST, weekly/monthly/custom periods, retry backoff, canonical IDs, invalid inputs, seven-day awards, wallet cap, missed-day spending, stable ledger identities and late-offline repair. Passing these checks does not demonstrate live PDO transactions, authorization, email delivery or real-device scheduling.

## Manual deployment tests — not executed without private configuration

| Area | Procedure | Expected result |
|---|---|---|
| Schema | Import into the existing backed-up database | All tables created, foreign keys/indexes present; no unrelated objects changed |
| Registration | Register two test users, invalid email, short password, duplicate email | Valid accounts work, invalid requests safely reject |
| Sessions | Login, refresh, retry interrupted refresh, logout, password change | Rotation works; expired/revoked sessions reject; other sessions revoke on password change |
| Mail | Request reset and verification; consume code twice | Delivery works; code expires and is single use; unknown email response remains generic |
| Ownership | User B tries A's file/record UUID and export routes | No cross-account data returned or changed |
| Injection | Send SQL syntax in email, record IDs and JSON | Values validate safely; privileged entities reject; database intact |
| Idempotency | Repeat identical sync operation/upload UUID | One record/version acknowledgment/file quota charge |
| Conflicts | Two devices edit one base version | Stale edit needs explicit resolution, no silent overwrite |
| Offline | Create routine, pray, count and import file in airplane mode; restart | Data remains on device and queues persist |
| Reconnect | Restore connectivity/open app | Pending operations retry, cursor advances, no duplicates |
| Late device | Device B syncs old completed days after A processed rewards | Replayed ledger/wallet converge without double awards |
| Failed transfer | Interrupt upload/download; reopen/retry | Local original survives; retry does not duplicate cloud file |
| Files | MIME spoof, executable, oversized file, quota exhaustion | Request rejected; no executable public upload |
| Restore | Fresh installation, sign in, restore records/files | Own records and readable private documents restored |
| Delete/export | Export, then delete with wrong/right password | Export is scoped; wrong password fails; cloud/local data removed |

## Manual Android tests — physical device/emulator required

- Android 10/API 29 and recent API 33–36: install, fresh setup, permission denial/regrant, foreground coarse/fine location, light/dark and RTL.
- Native SQLite restart/migration; no token in snapshot/exports; Keystore survives restart and invalidation safely requests login.
- Enable reminders, background/swipe app away, wait for Gentle/Warning/Strict/Missed; open correct prayer; snooze; mark prayed and ensure later alarms suppress; Qaza acknowledgment.
- Deny exact alarms and notification permission independently; inspect delayed/blocked behavior and settings guidance. Configure different channel sounds/vibration/silent, and test Do Not Disturb.
- Reboot, change time/time zone, update app, restore schedules. Force-stop and confirm Android's expected suppression until manual reopen. Test OEM battery restrictions; do not claim these restrictions can be bypassed.
- Compare native and frontend prayer times across selected methods, DST/travel dates, sunrise and middle-of-night boundaries; verify Umm al-Qura Ramadan adjustment manually.
- Routines: all frequencies, monthly short months, leap-year yearly date, custom deadline, no scheduled reminders for unscheduled counters.
- PDF: offline, multi-page navigation, saved page, zoom, encrypted/corrupt PDF failure, large page memory on older hardware. Images: scrolling/pinch and layout preservation.
- Rapid counter taps, interruption/restart at partial progress, target completion once, correction/reset and multi-device explicit conflicts.
- Seven successful daily periods, three-point cap, multiple simultaneous routine deadlines, frozen missed period never marked complete; prayers never protected by points.
- Accessibility: TalkBack, focus order, font scaling, keyboard/switch access, touch targets, reduced motion and contrast; native-language editorial review.

Keep a test record naming device model, API level, app commit/version, hosting PHP/MySQL versions, permissions, steps, result and logs with tokens/passwords redacted. Unexecuted rows remain unverified.
