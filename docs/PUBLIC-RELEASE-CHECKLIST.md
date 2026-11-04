# DeenPath public release checklist ? 2026-11-05

The current APK is a development build for testers. Automated checks do not establish that all live integrations or device background behavior work.

## Release blockers

- Resolve/qualify background reminder delivery after Recents removal and while locked on the Infinix. The service and recovery callback ran, but the process was frozen and delivery failed. Repeat on another manufacturer, after reboot, in Doze and with denied permissions. Do not promise one-minute asleep delivery.
- Verify audible reminders on the actual phone. Legacy reminder channels used alarm audio; the new channel revision uses notification audio and preserves the effective old sound and user importance. Silent mode, Android channel muting, notification volume and Do Not Disturb remain respected. Enforcer and notification share the reminder alert; no independent looping audio bypass is added.
- Deploy the private PHP backend and a separate MySQL database, configure HTTPS, writable private storage, backups and restore procedures, then test real registration/login, guest adoption, offline sync, attachments, Gems and interrupted purchases.
- Publish enough independently reviewed complete English/Urdu cards, references and symbolic artwork for every supported rarity. Until then new packs are unavailable and must not debit Gems. Review live generation quality and rights before enabling it.
- Configure and test Google login/link/account recovery if offered at launch. Otherwise leave the feature disabled and clearly communicate guest/account availability.
- Produce a non-debuggable release APK/AAB with a securely managed signing key; decide the update path before changing certificates. Existing development installs require the same signing identity for in-place updates.
- Review privacy disclosures, data collection/deletion behavior, contact/support information and permission explanations. Prepare store listing and current store-policy review if distributing through an app store.

## Final acceptance

Run the regression suites against the release variant, test upgrade preservation and rollback/forward recovery, verify downloaded artifacts and signatures, and run a small real-device beta before broad distribution. Keep PHP credentials, provider keys, device backups and signing keys out of public artifacts.

Hosting and provider setup steps are in EXTERNAL-SETUP.md. These items are not completed merely by uploading the APK.
