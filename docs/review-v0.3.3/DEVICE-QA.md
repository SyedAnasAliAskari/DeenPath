# Physical Android qualification - 2026-10-29

Device: Infinix X6725B, Android 15 / API 35, XOS launcher. App: org.salahguard.app, DeenPath 0.3.3 / code 6. USB debugging was already authorized; the user unlocked the phone normally. Testing used the real installed app, native bridge, ADB, launcher and local WebView inspection. This is not Android instrumentation or broad OEM certification.

| Check | Observed result |
| --- | --- |
| Upgrade over installed 0.3.2 / code 5 | Passed with `adb install -r`; original install time retained and signing certificate matched. No uninstall or storage clearing. |
| Existing data | Every pre-upgrade record, account scope, existing setting and user file preserved. Only the expected Android `files/profileInstalled` runtime marker changed. A private local backup was retained outside deliverables. |
| Account/backend | Guest/offline on this phone; no authenticated sync token or production backend was used. |
| Five primary tabs | Real controls opened Home, Prayer, Routines, Progress and More; no horizontal overflow. |
| Specific Qaza | Today's Fajr was tested through its real Today control after the user confirmed it was missed. Exactly one corresponding Qaza record/operation was produced; a repeated native action returned changed=false. Original worship records and queue were restored and compared exactly afterward. No test completion remains. |
| Home overlay | Native rounded Enforcer appeared above the launcher, with actual Isha start/end, attributed scripture and a live countdown. Close dismissed it. |
| Other-app overlays | Native Enforcer appeared above YouTube, Instagram and WhatsApp; Close worked in all three. YouTube/WhatsApp were landscape: lower content required scrolling. The automated both-buttons-visible detector returned false there; visual screenshots confirmed the overlay, title, window, countdown and Close. |
| Remind me later | Actual native control dismissed the test overlay and scheduled its snooze. Completion integrity was checked separately; snooze/close do not invoke worship completion. |
| Screen off / Wake off | With wakeEnforcer=false, the phone remained Dozing at the initial check. The test was scheduled for 15 seconds; delivery occurred about 21 seconds after scheduling, after manual wake, with diagnostics locked=true / interactive=true and a system notification present. Immediate screen-off delivery and visual lock-screen Enforcer were not established. |
| Prayer widget | Real launcher-bound RemoteViews rendered current/next prayer, end time and ticking countdown from saved settings, plus daily prayer progress. |
| Islamic Garden widget | Real launcher-bound widget rendered the saved Garden plant and aggregate maturation bar; no artificial growth or completions were inserted. |
| Daily Progress widget | Real launcher-bound widget displayed prayers 0/5 and routines 0/1 with separate bars. Launcher resize handles successfully expanded it from compact to a readable large layout. |
| Streak widget | Real launcher-bound widget rendered Overall; tapping its title opened all seven choices including Jummah. Selecting Fajr succeeded. |

All four widget instances remained bound after the final in-place APK upgrade. Physical Android Back from Prayer returned Home. The corrected Home Hijri badge displayed 17 Jumada I on the phone.

The first phone pass found controls under Android 15 system bars; native viewport padding now handles the inset. This WebView also returned an invalid named Islamic-calendar month/era; the Hijri display now uses numeric civil-calendar parts and explicit localized Islamic month names. Launcher creation exposed an unbound-ID configuration edge case, which was corrected. Native test IDs are now unique, and test reminders can be canceled without touching normal prayer reminders.

The final cleanup compared the current records and pending sync operations before/after cleanup, including newer routine data added since the earlier snapshot. Current records and operations were unchanged; today's temporary Fajr test state matched its original state. Only the temporary snooze preference was restored, and test-route reminders were canceled.

Private launcher/other-app captures, personal snapshots, phone serial, APK backups and temporary QA scripts stay under excluded `.tools/device-qa`; they are not published in the source archive.

## Remaining acceptance boundaries

Lock-screen Activity presentation, Wake Screen enabled, Recents/reboot recovery, physical compass calibration/reference accuracy, prolonged Doze/battery restrictions, all widget sizes and font scales, permission-denial combinations, TalkBack, reduced-motion perception, live login/MySQL sync/cross-device restore and live provider requests are not established by these checks. Native unit/browser tests cover relevant logic but do not replace these physical or hosted cases. No real multi-day Garden growth was fabricated.

## Final cleanup and deliverable

After the user unlocked the phone normally, the final test was canceled through the app. Diagnostics reported testActive=false and notificationCount=0. Records and pending sync operations matched the snapshot immediately before the screen-off test. The temporary Fajr state matched its original state; no false completion remains. The original rotation settings and global stay-awake value 0 were restored. The QA XML file and ADB forwarding were removed. Four useful DeenPath widgets remain installed; Daily Progress is in its tested large layout and Streak is set to Fajr.

The final APK installed on the phone matches the packaged APK byte-for-byte: SHA-256 `b6d086749a0e2bac32b1f9c9b48c89782eebb88f6aa2ed11afa331a04e90c5e6`. Original install time remains 2026-10-27 20:30:49; version 0.3.3/code 6 was installed on 2026-10-29. The original signing certificate is retained. The main project folder remains SalahGuide, as requested.
