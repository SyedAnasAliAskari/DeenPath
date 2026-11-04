# Privacy and account data

SalahGuard stores the profile details the owner supplies, self-reported worship history, routine settings, counters and imported documents. Coordinates are used for offline prayer calculation; the application requests location only in the foreground. No ad SDK, analytics SDK, paid service or cross-application usage monitor is included.

If an account is configured, records and explicitly imported files synchronize to the owner's private PHP/MySQL service over HTTPS. The hosting operator controls that service and its backup/access policies. A public release must identify the actual data controller, contact address and retention policy; this file is technical documentation, not a substitute for that public privacy notice.

Android data lives in the app sandbox. Session credentials use Android Keystore encryption. Offline databases/documents are private to the app but not independently encrypted. Signing out revokes the credential while retaining local offline history. Export and account deletion are available in Settings; deletion requires the password. Hosting backups may retain deleted data until their configured retention period expires. Configure and disclose that retention period before public distribution.

Reset/verification codes and bearer tokens are hashed in MySQL. Passwords use secure PHP password hashing. Private files have random server disk names and require authenticated ownership checks for access. Neither database passwords nor private filesystem paths are embedded in the APK.

Uninstalling or clearing Android app data may permanently destroy unsynchronized changes and private local-only documents. Sync first and verify the Sync Center. Force-stop prevents scheduled background work until the next manual launch.
