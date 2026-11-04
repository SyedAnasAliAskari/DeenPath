# v0.3.7 verification — 2026-10-30 to 2026-10-31

## Automated checks

- TypeScript/Vite/Capacitor production build passed; existing Vite bundle-size notices remain.
- `npm test`: 83 tests / 15 files passed.
- `assembleDebug testDebugUnitTest lintDebug`: passed. 69 tests / 18 native suites, 0 failures. Lint: 0 errors, 89 warnings. Added cadence escalation, final-ten-minute priority with late thresholds, short windows, custom once/one-minute modes, alarm-clock selection, overdue coalescing and exact snooze deadlines.
- Browser suite: 36/36 passed, including adaptive/custom persistence, disabled custom controls in adaptive mode, and the prior prayer/Qaza/Nafl/Secrets/attachment/location/RTL/navigation cases. Settings checks were repeated after the app-specific battery-status UI addition.
- Backend and schema unchanged; prior 30 PHP checks and three SQLite migration fixtures remain applicable.

## Device delivery

Authorized device: Infinix X6725B, Android 15. All alarm, notification, full-screen and overlay permissions were already granted, but app-level overlay and wake switches were false. They were enabled through the app’s normal UI. Alarm channels were verified at importance 4 with no user-locked importance fields.

1. Home-screen preview displayed the dismissible Enforcer and visible I Prayed/Close/Snooze controls. Preview actions cannot write worship.
2. The native alarm restarted the app after explicit process termination. This used process death, not Android Force stop, which cancels pending intents.
3. Early lock attempts were inconclusive because the phone was unlocked before delivery. A coordinated untouched test kept keyguard locked and screen off but left the alarm overdue. Dumpsys confirmed a queued AlarmClock RTC_WAKEUP event, package stopped=false, exact permission, active standby bucket, device-idle ACTIVE and battery saver off. DeenPath was not battery-exempt.
4. Android’s app-specific background operation dialog was opened. After access was allowed, the battery allowlist and native status both confirmed the exemption.
5. A repeated coordinated test terminated the app process before the alarm. Samples stayed locked/screen-off through the target. The alarm receiver ran at target +1641 ms, attached its full-screen intent at +2207 ms, posted with locked=true and interactive=false, and created LockEnforcerActivity at +2604 ms. Later samples had screenOn=true and locked=true. This qualifies the short screen-off/process-death delivery path on this device after setup.

No public prayer/routine completions or private admissions were inserted. Final comparison: all non-settings records and owner unchanged. Settings have enforcer=true, overlay=true, wakeEnforcer=true, adaptive cadence and reliable alarms enabled; all five setup statuses, including background battery access, are true. Test active=false and notificationCount=0 after cleanup. Background access remains allowed as requested; the original screen timeout is restored to 60000 ms. QA XML and tcp:9223 forwarding are removed. Device snapshots/captures remain private under .tools/device-qa and are excluded from archives.

## Limits

The physical test uses a preview and a short locked interval, not an entire prayer window or an overnight Doze/reboot endurance test. Cadence timing is qualified by pure native tests. Different OEMs, notification cooldown, Do Not Disturb, denied permissions and vendor auto-start controls can still affect presentation. Real biometric interaction and production hosted/cloud integrations were not retested. Android Force stop requires user interaction/opening the app to restore alarms; this release does not circumvent that control.
