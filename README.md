# DeenPath v0.3.8

See [the v0.3.8 release and upgrade report](docs/V0.3.8-RELEASE.md) for upgrading the existing installation without clearing its data.

Guidance for a Better You.

An offline-first Android 10+ application built with React, TypeScript, Capacitor and Kotlin, with a private PHP 8.2/PDO/MySQL backend for the owner's existing Namecheap account. No ads, payments, analytics, Firebase, public website or production Node server.

This repository contains a working implementation, with release qualification still required on real Android devices and the configured hosting account. See [test results and unverified boundaries](docs/TESTING.md) and [limitations](docs/LIMITATIONS.md) before distribution.

## Start here

1. `npm ci`
2. `npm test`
3. `php tests/backend.php`
4. `npm run check:php`
5. `npm run build`
6. `npm run android:sync`
7. Open `android/` in Android Studio, using JDK 21, SDK 36 and Android Build Tools 36.0.0.

`npm run dev` is a development preview of the app UI. It is not the production deliverable. Android uses native SQLite, Keystore, AlarmManager, WorkManager and PdfRenderer. The browser preview uses localStorage and cannot demonstrate Android background execution. Browser preview credentials are held only in memory; Android credentials are encrypted with Keystore.

Read the [DeenPath feature/upgrade guide](docs/V0.3.0-UPDATE.md), [test report](docs/V0.3.0-TESTING.md), [security review](docs/V0.3.0-SECURITY.md), and [current limitations](docs/V0.3.0-LIMITATIONS.md).

## Included

- Five daily prayers via Adhan, manual coordinates/cities, foreground location, calculation methods, Asr school, prayer adjustments, sunrise and configurable Isha boundaries.
- Prayer completion, explicit correction, immutable distinction between on-time prayer and Qaza, and date-based history.
- Optional staged native reminders, a single-alarm dispatcher, native sound picker, translated notification bodies, dismissible opt-in overlays, test actions, snooze and reboot/time-change recovery.
- Quran/Dua routines, daily/weekly/monthly/yearly/custom schedules, optional daily deadlines, imported PDF/images and a small attributed offline Quran collection with English and Urdu translations.
- Named persistent Tasbih counters, targets, partial progress, scheduled or unscheduled use and completion deduplication.
- Offline streaks, a deterministic Freeze Point ledger and a routine garden. Server recalculates and validates derived rewards under an account transaction lock.
- Registration/login, rotating 30-day bearer sessions, logout, profile editing/avatar upload, password change/reset, optional email verification, export and deletion.
- SQLite migrations, local private documents, durable operation/upload/deletion queues, backoff, incremental sync, tombstones, idempotency and explicit conflict review.
- English, Urdu and Arabic offline dictionaries; RTL and System/Light/Dark appearance. Vendor sound names retain their system names.
- Private file upload/download with MIME checks, quotas and ownership enforcement.

## Layout

| Path | Purpose |
|---|---|
| `src/` | React app, domain rules, local data layer, sync client, translations and content |
| `android/` | Full Gradle/Capacitor project and native Kotlin components |
| `backend/public/api.php` | The sole public production entry point |
| `backend/src/` | Private PHP API, validators and reward engine |
| `backend/config/example.php` | Private configuration template; contains no password |
| `backend/sql/install.sql` | Schema for the existing database; no CREATE DATABASE |
| `tests/` | Domain, reward/validation and browser flow tests |
| `docs/` | Deployment, build, API, synchronization, privacy, QA and content licensing |

## Deployment and releases

Follow [cPanel deployment](docs/DEPLOYMENT.md), [APK build and signing](docs/BUILD.md), [API contract](docs/API.md), [sync/conflict policy](docs/SYNC.md) and [GitHub release checklist](docs/RELEASE.md). The actual existing HTTPS domain and absolute cPanel home path must be configured by the owner. Production database credentials and signing keys never belong in the app or repository.

The project directory remains `SalahGuide`; the product is **DeenPath**; its preserved Android identity is package `org.salahguard.app`.

## Local deliverables

`deliverables/v0.3.3/` contains the verified debug APK, complete source archive, private-backend archive, public `api.php`, existing-database `install.sql`, and SHA-256 checksums. Read the deployment guide before uploading anything. Recreate these files with `node scripts/package.mjs`, then verify archive boundaries and APK asset freshness with `node scripts/verify-artifacts.mjs`.
