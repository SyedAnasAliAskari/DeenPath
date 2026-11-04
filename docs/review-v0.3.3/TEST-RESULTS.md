# v0.3.3 verification results

Qualification continued on 2026-10-29 with the user's authorized USB phone: Infinix X6725B, Android 15 / API 35, XOS launcher. No production backend was accessed.

| Layer | Final result | Scope |
| --- | --- | --- |
| TypeScript/Vite/Capacitor | Passed | Production build and native asset synchronization |
| Vitest | 63 tests passed / 11 files | Existing tests plus explicit prayer actions, snooze/close, Qaza idempotency, expiration, Friday, Isha, DST/timezones and geographic Qibla fixtures |
| Playwright | 26 tests passed | Five tabs, forms/files/private activity preservation, Back event, actual calendar Qaza records, due/snooze/expiration without completion, narrow/large-text English/Urdu/Arabic |
| Native JVM | 50 tests passed / 13 suites | Native business rules, stale/consumed/cross-account actions, Qaza, sensor math, window parity, widget saved-data/empty/privacy projections and existing native suites |
| PHP | 23 backend unit checks and all PHP syntax checks passed | Local validation/reward logic; no HTTP/MySQL integration |
| SQLite | 3 fixture migrations passed | Versions 1/2/3 to 4 preserve snapshot, pending counter operation and reading position; no Android instrumentation implied |
| Android Gradle | assembleDebug and lintDebug passed | App and native modules compiled; app lint has 0 errors and 82 warnings |
| APK signature | Verified, APK Signature Scheme v2 | Certificate matches v0.3.2; see APK-SIGNATURE.txt |
| APK identity | org.salahguard.app / 0.3.3 / code 6 | Minimum API 29, target 36; see APK-METADATA.txt |
| Instrumentation | Not run | No Android instrumentation runner was used; physical checks used ADB and the real app |
| Physical Android | Partially verified | In-place upgrade, saved-data preservation, five tabs/physical Back, overlays above Home/YouTube/Instagram/WhatsApp, four launcher widgets, Streak configuration, Daily resize, snooze/close and specific Qaza with rollback; see DEVICE-QA.md for the final matrix |
| Hosted backend/providers | Unverified | No production DB, login, cross-device restore or live Gemini call was used |

## Native suites

- org.salahguard.app.AlarmPolicyTest: 4 passed
- org.salahguard.app.DeenRulesTest: 6 passed
- org.salahguard.app.MultipartBodyTest: 1 passed
- org.salahguard.app.NativeContentTest: 2 passed
- org.salahguard.app.NotificationAudioTest: 2 passed
- org.salahguard.app.PrayerActionsTest: 11 passed
- org.salahguard.app.PrayerParityTest: 1 passed
- org.salahguard.app.ReminderQueueTest: 2 passed
- org.salahguard.app.ReminderTextTest: 3 passed
- org.salahguard.app.RoutinePeriodsTest: 1 passed
- org.salahguard.app.SnapshotDocumentTest: 3 passed
- org.salahguard.app.SnapshotMergeTest: 2 passed
- org.salahguard.app.WidgetModelTest: 12 passed

## Lint and earlier failures

The full app lint report is included as ANDROID-LINT.txt. Its warnings include existing icon/dependency/resource/KTX advice and widget cell attributes ignored on Android 10/11, small brand labels and hardcoded brand text. No new app lint baseline or blanket error suppression was introduced. The Capacitor dependency has its pre-existing baseline, which Gradle reports separately; an app lint pass is not a claim that dependencies have no warnings.

Earlier development checks found a widget SystemClock name collision, an unhandled consumed-event regression and incidental Java Calendar milliseconds in repeated prayer calculations. The final source corrects each; the final native XML reports contain zero failures/errors. UI tests that previously assumed Prayer opened directly on Report were updated to select the preserved Report view explicitly; assertions were retained.

Browser fixtures use isolated test contexts and exercise offline storage and the app's Back event, not a physical Android Back button. Widget-model tests prove saved-data projection, not native launcher rendering, permission flows, timing under Doze or successful account restoration on a real server. See V0.3.3-RELEASE.md for the complete required real-device matrix and known limitations.

Final phone cleanup confirmed no active test or notification, unchanged records and pending operations across the screen-off test, and the original temporary settings restored. The installed APK hash exactly matches the packaged APK.
