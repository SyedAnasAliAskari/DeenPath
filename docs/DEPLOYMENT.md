> DeenPath v0.3.0: read [V0.3.0-UPDATE.md](V0.3.0-UPDATE.md) first. Existing installations must apply only `backend/sql/migrations/003_deenpath.sql`, then replace private PHP source while retaining real configuration and upload storage. Do not re-import `install.sql`. Hosting directories and the public API URL retain their SalahGuard names.

# Namecheap Stellar Plus deployment through cPanel

For an existing v0.1.0 deployment, back up and replace the private `src/` files for v0.2.0, keep `config/production.php`, and do not re-import the installation schema. This app update has no new MySQL columns/tables. Follow the versioned update guide for the Android upgrade.

No SSH, additional host, new database, new domain, new subdomain or public website is required. Do not change any LendAFile file, database, document root or domain setting.

## 1. Verify the real paths

In cPanel General Information, note **Home Directory**. In Domains, note the **Document Root** of the owner's chosen existing HTTPS domain. In File Manager, enable hidden files. Navigate outside `public_html` and confirm where the existing `home/mobile_apps/SalahGuard/` folder actually resides. That relative description is not proof of an absolute path.

Use these symbols throughout this guide:

- `CPANEL_HOME`: the verified home directory, e.g. `/home/actual_account`, without assuming this example is correct.
- `PRIVATE`: the actual private SalahGuard directory, usually `CPANEL_HOME/mobile_apps/SalahGuard`.
- `DOCROOT`: the verified document root of the existing HTTPS domain.

Confirm PRIVATE is outside DOCROOT **and every other public/addon-domain document root**. If a folder already contains files, back it up and inspect it before placing anything there. Never overwrite an unrelated or unidentified file.

## 2. Prepare the existing database

In cPanel MySQL Databases, confirm database `lendwhgp_salah_guard` exists and the existing user `lendwhgp_anasaskari` is assigned to that database with the necessary table CRUD/schema privileges. Do not create another database. Use phpMyAdmin to inspect the selected database and export a backup first.

If the table names in `backend/sql/install.sql` already exist, **stop the import** and review a migration; the installer intentionally does not use DROP TABLE or silently replace existing tables. Otherwise select `lendwhgp_salah_guard`, choose Import, select `backend/sql/install.sql`, and execute. It uses InnoDB and utf8mb4; MySQL 5.7+ or MariaDB 10.4+ is expected. No stored procedures, SUPER or privileged MySQL commands are needed.

## 3. Upload only the private backend

Using File Manager, upload the contents of `backend/src/` to `PRIVATE/src/`, and `backend/config/example.php` to `PRIVATE/config/example.php`. Keep `backend/sql/install.sql` privately if desired; it need not be uploaded. Create these directories:

```
PRIVATE/config/
PRIVATE/src/
PRIVATE/storage/uploads/
PRIVATE/storage/logs/
PRIVATE/backups/
```

Place `backend/.htaccess` in PRIVATE as additional defense if Apache ever serves it; physical placement outside all document roots is the real control. Do not upload the entire repository, `.tools`, `node_modules`, Android source, tests or build assets into DOCROOT.

## 4. Configure credentials privately

In File Manager copy `PRIVATE/config/example.php` to `PRIVATE/config/production.php`. Edit the latter using cPanel's editor. Keep the existing database and username, set the private password there, and confirm `db_host` (usually `localhost`). Set `uploads` to `PRIVATE/storage/uploads` using the verified absolute path. Keep `allow_local_http` false.

Do not paste the password into an issue, commit, build variable, README or APK. The Android app knows only the HTTPS API URL.

For optional password-reset and verification mail, set `mail_enabled` true and `mail_from` to an authorized mailbox on the existing domain. Ensure cPanel Email Deliverability reports SPF/DKIM correctly; send a real test and inspect spam folders. PHP `mail()` acceptance does not guarantee delivery. If the hosting account disables PHP mail, keep this feature disabled until a supported mail transport is configured; login/registration still work.

## 5. Set permissions

Start with PRIVATE directories `0700`, private config and uploaded files `0600`, private source `0640` if the PHP execution user can read it. Public API files normally use `0644`, and their new directory `0755`. Permissions vary by PHP handler; use the minimum required by that hosting account. Never use `0777`. Disable public directory listings.

## 6. Install the single public entry point

Create a **new, unused** `DOCROOT/salahguard/` directory. If it already exists, inspect it and back it up before proceeding. Copy only `backend/public/api.php` to `DOCROOT/salahguard/api.php`.

In this new API file, replace the deliberately invalid `$privateRoot` default with the **verified absolute PRIVATE path**. Alternatively configure `SALAHGUARD_PRIVATE_ROOT` through a hosting-supported environment mechanism. Do not guess `/home/mobile_apps/SalahGuard`.

Do not modify the site's existing root `.htaccess`. Query routing works without rewrites:

```
https://EXISTING-DOMAIN/salahguard/api.php?route=/v1/health
```

PATH_INFO is also supported when available, e.g. `api.php/v1/health`. The app uses query routing for cPanel compatibility. In cPanel MultiPHP Manager choose a supported PHP version **8.2 or newer**; ensure PDO MySQL, fileinfo, JSON and password hashing support are enabled. Keep `display_errors` off and PHP logs private.

## 7. Validate routing and Authorization

Visit the HTTPS health URL; expect `{"service":"SalahGuard","version":1}`. An unconfigured entry point returns 503 without private details. `/v1/profile` without a bearer token must return 401.

Some CGI handlers strip `Authorization`. The code accepts both `HTTP_AUTHORIZATION` and `REDIRECT_HTTP_AUTHORIZATION`. If tokens are not reaching PHP, use a **directory-local** `.htaccess` inside the new SalahGuard API directory, after verifying the hosting handler supports it:

```
SetEnvIf Authorization "(.+)" HTTP_AUTHORIZATION=$1
Options -Indexes
```

This must not be placed in an unrelated site's directory or alter LendAFile. Do not log bearer tokens during diagnosis. If HTTPS is terminated by a proxy and PHP does not see `HTTPS`, ask hosting support to expose a trusted HTTPS indicator; the implementation deliberately does not trust arbitrary client `X-Forwarded-Proto` headers.

## 8. Configure the Android app

Settings → Sync Center → HTTPS API URL:

```
https://EXISTING-DOMAIN/salahguard/api.php
```

Do not include `/v1` or the query string. Save, create a test account, sign out, sign back in, update its profile and synchronize. Android's local origin is `https://localhost`; the API allows this origin. The browser development preview is local-only by default and is not a separately hosted web client.

## 9. Test synchronization and files

Mark a prayer, create a routine, count part of a Tasbih and synchronize. Check pending operations reaches zero and last-sync updates. On a second installation with the **same** account, Restore from Cloud; verify the records and count. Make edits offline on both devices to the same record and verify conflict review is shown before choosing a value.

Import a small PDF/image, sync, and verify it appears only through authenticated `/v1/files` access. Sign in on a second phone and use Restore Files. Test a different test account cannot download the first account's file UUID. Test offline reading after download. Remove test accounts through the app when finished.

## 10. Configure storage and backups

Default per-file size is 8 MiB and per-account quota 100 MiB. Adjust the private PHP config conservatively. In MultiPHP INI Editor set `upload_max_filesize` at least 8M and `post_max_size` at least 10M. Ensure memory/time limits suit these small files. The current client uses an 8 MiB ceiling even if the server is raised. Never store upload bytes as MySQL BLOBs or expose the private upload folder through a URL/symlink.

Use cPanel Backup/phpMyAdmin exports for this database and File Manager archives for PRIVATE storage/config. Store backups outside document roots with restricted access. Coordinate database/file snapshots; protect their passwords and user documents. Review disk quotas and PHP errors. Expired auth_sessions/auth_actions and old rate_limits may be purged periodically through phpMyAdmin, using date predicates after a backup; retain sync history, dedupe operations and tombstones until a migration with a documented retention protocol exists.

## 11. Build and qualify

Follow [BUILD.md](BUILD.md). Install on a physical Android 10+ phone. Complete the [manual test matrix](TESTING.md), especially notifications, exact-alarm permission denied, reboot, force-stop, battery restrictions, PDF memory and multi-device late-offline sync. Do not label a release production-ready until these boundaries pass on the actual deployment.
