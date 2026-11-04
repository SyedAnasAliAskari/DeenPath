import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
const source = unzipSync(fs.readFileSync('deliverables/v0.3.8/DeenPath-0.3.8-source.zip'));
for (const name of [
  'src/main.tsx',
  'src/AboutContact.tsx',
  'src/VerseTranslations.tsx',
  'src/ReminderPassage.tsx',
  'src/content/reminder-passages.json',
  'android/app/src/main/java/org/salahguard/app/ReminderPassages.kt',
  'src/deployment.json',
  'android/app/src/main/java/org/salahguard/app/TimedEnforcerService.kt',
  'android/app/src/main/java/org/salahguard/app/PrayerReminderRules.kt',
  'android/app/src/main/java/org/salahguard/app/PrayerCadence.kt',
  'src/PrayerBacklog.tsx',
  'src/prayer-backlog.ts',
  'android/app/src/main/java/org/salahguard/app/LocationFix.kt',
  'src/Secrets.tsx',
  'src/secrets-model.ts',
  'src/RoutineAttachment.tsx',
  'android/app/src/main/java/org/salahguard/app/SecretRules.kt',
  'src/RoutineStacks.tsx',
  'src/practice.css',
  'backend/src/PrayerStarts.php',
  'backend/src/ADHAN-LICENSE.txt',
  'android/app/src/main/java/org/salahguard/app/PrivacyPolicy.kt',
  'src/calm.css',
  'docs/V0.3.8-RELEASE.md',
  'android/app/src/main/java/org/salahguard/app/SnapshotDocument.kt',
  'android/app/src/main/java/org/salahguard/app/ReminderText.kt',
  'src/back.ts',
  'src/compass.ts',
  'src/PrayerReport.tsx',
  'src/PrivateLife.tsx',
  'src/Guidance.tsx',
  'backend/sql/migrations/003_deenpath.sql',
  'docs/V0.3.0-UPDATE.md',
  'docs/V0.3.0-TESTING.md',
  'backend/sql/install.sql',
  'android/gradlew',
  'android/gradle/wrapper/gradle-wrapper.jar',
  'android/app/src/main/java/org/salahguard/app/LocalDatabase.kt',
  'README.md',
  'docs/DEPLOYMENT.md',
  'package-lock.json',
  'LICENSE',
])
  assert(source[name], `Missing source: ${name}`);
for (const name of Object.keys(source))
  assert(
    !/(^|\/)(\.tools|\.npm-cache|node_modules|\.git|storage|backups)(\/|$)|production\.php$|local\.properties$|\.(keystore|jks|apk)$/.test(
      name,
    ),
    `Excluded material in source: ${name}`,
  );
const privateBackend = unzipSync(
  fs.readFileSync('deliverables/v0.3.8/DeenPath-0.3.8-private-backend.zip'),
);
assert(privateBackend['config/example.php']);
assert(privateBackend['src/bootstrap.php']);
assert(!privateBackend['public/api.php']);
assert.deepEqual(
  fs.readFileSync('deliverables/v0.3.8/install.sql'),
  fs.readFileSync('backend/sql/install.sql'),
);
const apk = unzipSync(fs.readFileSync('deliverables/v0.3.8/DeenPath-0.3.8-debug.apk'));
assert.deepEqual(
  Buffer.from(apk['assets/islamic-reminders.json']),
  fs.readFileSync('src/content/quran.json'),
  'Native translation bundle is stale',
);
assert.deepEqual(Buffer.from(apk['assets/reminder-passages.json']),fs.readFileSync('src/content/reminder-passages.json'),'Native reading rotation is stale');
assert(!source['android/app/src/main/java/org/salahguard/app/AppOpenEnforcerService.kt']);
assert(!fs.readFileSync('android/app/src/main/AndroidManifest.xml','utf8').includes('PACKAGE_USAGE_STATS'));
for (const name of [
  'ReminderText',
  'MainActivity',
  'PrayerActions',
  'LockEnforcerActivity',
  'EnforcerUi',
  'PrayerCadence',
  'TimedEnforcerService',
  'PrayerReminderRules',
  'ReminderPassages',
  'PassageRotation',
  'SecretRules',
  'SecretEnforcerUi',
  'LocationFix',
  'LocationFixRules',
  'PrayerWidget',
  'StreakWidget',
  'GardenWidget',
  'DailyWidget',
])
  assert(
    Object.entries(apk)
      .filter(([name]) => /^classes[0-9]*\.dex$/.test(name))
      .some(([, data]) =>
        Buffer.from(data)
          .toString('latin1')
          .includes('Lorg/salahguard/app/' + name + ';'),
      ),
    'Missing native fix: ' + name,
  );
assert(
  Object.entries(apk)
    .filter(([name]) => /^classes[0-9]*\.dex$/.test(name))
    .some(([, data]) =>
      Buffer.from(data).toString('latin1').includes('Lorg/salahguard/app/SnapshotDocument;'),
    ),
  'APK is missing the native fresh-install fix',
);
assert.deepEqual(Buffer.from(apk['assets/public/index.html']), fs.readFileSync('dist/index.html'));
for (const name of fs.readdirSync('dist/assets'))
  assert.deepEqual(
    Buffer.from(apk['assets/public/assets/' + name]),
    fs.readFileSync('dist/assets/' + name),
    `APK contains stale asset ${name}`,
  );
for(const [name,data] of Object.entries(apk).filter(([name])=>/^classes[0-9]*\.dex$/.test(name))) assert(!Buffer.from(data).toString('latin1').includes('Lorg/salahguard/app/AppOpenEnforcerService;'),'Cancelled app-opening service remains in APK');
const checks = fs.readFileSync('deliverables/v0.3.8/SHA256SUMS.txt', 'utf8').trim().split('\n');
for (const row of checks) {
  const [hash, name] = row.split('  ');
  assert.equal(
    crypto
      .createHash('sha256')
      .update(fs.readFileSync('deliverables/v0.3.8/' + name))
      .digest('hex'),
    hash,
    `Checksum mismatch: ${name}`,
  );
}
console.log(
  `Verified ${Object.keys(source).length} source files, private backend boundaries, current APK web assets and ${checks.length} artifact checksums.`,
);
