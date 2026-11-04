# v0.3.5 verification — 2026-10-30

- `npm test`: 77 tests / 14 files passed. Includes Secrets unique-day rewards, streak continuity, retry idempotency, separate Nafl routines, corrections preserving partial/completed worship, legacy projection, date validation and shared/profile attachment ownership/deletion.
- `npm run android:sync`: TypeScript and Vite production build passed; existing dynamic-import and bundle-size notices remain.
- `gradlew assembleDebug testDebugUnitTest lintDebug`: passed. 60 native tests / 16 suites; 0 lint errors, 87 warnings. A final assemble includes the Security Back and attachment-preview loading fixes.
- `playwright test --timeout=30000`: 33/33 passed. Existing prayer/Qaza/reset/RTL/navigation checks plus Secrets penalties, points, corrections, Prayer Nafl total, Security Back, inline image rendering and file deletion.
- `php tests/backend.php`: 30 passed; PHP syntax scan passed.
- `python tests/sqlite_migrations.py`: 3 migration fixtures passed.

Physical-device checks used the authorized Infinix X6725B (Android 15), in-place installation and preview-only actions. The native prayer preview showed I Prayed and the Secrets preview showed both daily answers. Record list, operation queue and owner were identical before/after preview taps. Only test reminders were cancelled. No PIN/biometric configuration or actual user admissions were changed. Secure Secrets screen capture was blocked as intended; DOM confirmed the heading and no horizontal overflow. Temporary ADB forwarding and QA XML were removed.

Limits: actual private check-ins run in pure native tests and browser fixtures; no invented private admission was saved to the live phone. Native PDF page rendering compiled but was not visually qualified with a personal document. Production cloud file deletion, database/mail/provider integration, real biometric prompts, reboot and long Doze delivery are not qualified by these checks. Previous OEM screen-off delay observations still apply.
