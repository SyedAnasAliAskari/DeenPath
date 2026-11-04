# v0.3.4 verification - 2026-10-30

| Layer | Result | Coverage |
| --- | --- | --- |
| TypeScript / Vite / Capacitor | Passed | Production assets built and synchronized |
| Logic | 67 tests / 12 files passed | Includes time-only resets, preserved prior periods, Qaza independence, replay and 384 prayer-start fixture cases |
| Browser | 31 tests passed | Existing regressions plus PDF on Tasbih, time-only reset with no prayer write, swipe advance, private description/reminder checkbox, Garden/prior-view Back |
| Native JVM | 54 tests / 15 suites passed | Existing action/storage/widget rules, native time resets, 384 cross-language start fixtures, biometric/PIN gate policy |
| PHP | 30 checks and syntax checks passed | Validation, replay, 384 start fixtures and unavailable-polar handling; no MySQL/HTTP integration |
| SQLite preservation fixtures | 3 passed | Existing migrations preserve pending counts and reading positions |
| Android | assembleDebug / testDebugUnitTest / lintDebug passed | 0 errors, 83 warnings; exact evidence in ANDROID-LINT.txt |
| Signature | Verified | Same certificate as v0.3.3; APK version 0.3.4 / code 7 |
| Phone upgrade | Passed | In-place update, all existing records/queue/settings/files retained |
| Native visual qualification | Selected checks passed on the unlocked phone | Enforcer, live timer/Close above Home, expanded notification, Daily widget, statistics/Garden/Android Back and routine form controls; see DEVICE-QA.md |
| Hosted backend / live biometrics | Not exercised | No production account/database/provider calls or security-setting changes on the user's phone |

The 384 cases are a shared parity fixture, not 384 separate JUnit tests. They cover eight calculation methods, six locations, four seasonal dates and both Asr choices. They are not a physical astronomy/compass calibration claim.

Earlier checks found a Singapore rounding mismatch between the older native library and the frontend; the final native calculation adapter corrects it and passes the complete shared fixture. The first new Garden test asserted visibility of a zero-height empty grid; it was corrected to assert the actual Garden heading while keeping the return-navigation checks. Final browser results use the corrected full suite. Test fixture strings initially had an encoding problem in a screenshot helper; that helper was corrected and the published captures refreshed.

Screenshots in this directory use isolated browser fixtures, including authored routine names and sample counts; they are not user-phone data or automatic worship records. Full-page captures show the fixed navigation bar at the captured viewport position. English/light 390px and Arabic/dark 320px layouts were inspected, with no horizontal overflow. Existing tests also cover Urdu, large text and other narrow layouts.

The build retains Vite's bundle-size advisory and Android lint warnings. Neither warning is suppressed or presented as an error-free dependency audit. See the captured lint report and native XML for exact evidence.

The final unlocked-phone visual pass preserved the current records/queue/account scope and left no test notification or active test. The temporary widget was removed and original system preferences restored. The initial background preview was delayed; this limit remains documented.
