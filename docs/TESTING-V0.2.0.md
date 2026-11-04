# v0.2.0 verification

Local verification on 27 October 2026:

| Check | Result |
|---|---|
| TypeScript domain, rewards, merge, localization, content and reminder tests | 26 passed |
| PHP validation and reward checks | 15 passed |
| PHP syntax | All 6 files passed |
| Browser flows in installed Chrome | 5 passed |
| SQLite upgrade fixtures, versions 1 and 2 to 3 | 2 passed, queued progress and reading positions retained |
| Native JVM tests | 13 passed |
| Android debug assembly | Passed, versionCode 2 / versionName 0.2.0 |
| npm dependency audit | No vulnerabilities reported |

Browser checks cover persistent counters, RTL, mobile layout, typing through clock updates, delete confirmation dismissal, six-second toast dismissal, system dark appearance, 320px overflow and the Urdu translation selector. Light/dark and Urdu screenshots were inspected locally. Browser tests use localStorage, not the Android database.

Native JVM checks cover repeated large alarm plans through a fake alarm driver, empty/overdue scheduling, snapshot merges, Adhan parity, native translation selection, channel identity, multipart encoding and routine period keys. The alarm stress check replans a 1,000-item queue 1,000 times with at most one active fake OS alarm. These are unit tests, not physical AlarmManager delivery tests. SQLite fixtures run real SQLite DDL outside Android; physical SQLiteOpenHelper upgrades still need device qualification.

The packaged APK is checked against the current Vite assets, artifact SHA-256 checksums and source/backend archive boundaries. APK signature verification confirms the same debug signing certificate as v0.1.0, allowing an in-place update without an uninstall. The original debug key is private and excluded from source archives.

No Android phone was connected. Sound playback, native ringtone picker interactions, permission flows, overlay behavior over Instagram/YouTube, locked-screen behavior, reboot recovery and OEM battery policy remain unverified on a physical device. Follow [the phone test steps](V0.2.0-UPDATE.md). No configured hosting account was supplied: live MySQL, cross-user authorization, mail, HTTP sync and file-transfer integration remain unverified. Local passing tests do not establish production release qualification.

Reproduce with `npm test`, `php tests/backend.php`, `npm run check:php`, `python tests/sqlite_migrations.py`, `npm run android:sync`, Gradle `assembleDebug testDebugUnitTest`, and `npm run test:ui` against `npm run preview`. Package with `node scripts/package.mjs`, then run `node scripts/verify-artifacts.mjs`.
