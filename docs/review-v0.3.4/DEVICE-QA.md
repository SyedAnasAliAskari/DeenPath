# v0.3.4 device qualification - 2026-10-30

Device: Infinix X6725B / Android 15 API 35, XOS launcher. The user unlocked it normally for this pass. Package org.salahguard.app / version 0.3.4 / code 7; folder remains SalahGuide.

The earlier in-place v0.3.3-to-v0.3.4 upgrade preserved existing records, pending operations, settings, account scope and user files. No uninstall or database reset was performed. A fresh snapshot taken at the start of this visual pass was used for the final integrity comparison, preserving the phone's current data rather than restoring an older backup.

| Actual phone check | Observation |
| --- | --- |
| Routines | The current account's empty state rendered without horizontal overflow. The native WebView showed the Tasbih PDF/image attachment input and all five After Namaz selections. The unsaved form was closed without creating a routine. Populated category stacks and swipe behavior were covered by isolated browser tests; no artificial worship data was inserted on the phone. |
| Statistics / Garden / Back | Statistics displayed seven streak cards and the separate Garden entry without horizontal overflow. Android Back from Garden restored Statistics, including its selected view. |
| Enforcer appearance | Actual rounded panel, compact header/Close row, live timer panel, attributed scripture and styled snooze action were reviewed. The Jummah preview showed 12:17 PM and Ends 4:17 PM. No prayer-completion action was offered by the test preview. |
| Live timer / overlay / Close | The countdown visibly decreased between captures. The same native overlay remained visible above Home. Close dismissed it through the actual native control. |
| Notification appearance | Both collapsed and expanded native notification presentation were reviewed. The expanded row showed the full test title, time window, live Starts in countdown, scripture/attribution and separate Remind me later / Close actions. The preview notification was then dismissed and all test-route reminders canceled. |
| Widget appearance | A temporary Daily Progress widget was added through XOS. Its actual RemoteViews displayed prayer and routine totals and two separate thin progress bars in the new surface style. Only this QA widget was removed afterward, restoring the original launcher contents. This pass does not claim all four providers/sizes were newly rendered. |
| Delivery limit | The initial background overlay preview did not appear at its 15-second target and appeared later when the app was resumed. A subsequent foreground preview was posted near its scheduled target. Appearance success is not a claim of reliable immediate background delivery under this OEM's policies. |

## Cleanup and limits

Final native snapshots exactly matched the visual-pass baseline for records, pending operations and account scope. Diagnostics reported testActive=false and notificationCount=0. No false prayer/routine completions were recorded. The original stay-awake and rotation settings were restored; QA XML and ADB forwarding were removed. Private phone captures/backups remain under excluded .tools/device-qa and are not distributed in the source archive.

The installed APK remains unchanged by this documentation pass and matches the packaged build: SHA-256 `30b9d19dd68940da69cbfbc66d3829c70f84f75671a32eca557f633679cff222`.

Live biometric/PIN configuration was not changed. Production backend/account sync, physical compass calibration, lock-screen/wake permission combinations, reboot/long-Doze recovery, every widget size and other OEM launchers remain separate manual acceptance cases. Browser fixtures and native/JVM calculations do not substitute for those cases.
