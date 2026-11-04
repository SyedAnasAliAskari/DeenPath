import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { zipSync } from 'fflate';
const root = process.cwd(),version=JSON.parse(fs.readFileSync('package.json','utf8')).version,
  out = path.join(root, 'deliverables', 'v'+version);
if(version==='0.3.8')throw Error('Refusing to overwrite the preserved rollback release.');
fs.mkdirSync(out, { recursive: true });
const skip = new Set([
  'node_modules',
  'auth.json',
  '.npmrc',
  '.tools',
  '.npm-cache',
  '.git',
  '.agents',
  '.codex',
  '.aws',
  'storage',
  'backups',
  '.gradle',
  'build',
  'dist',
  'test-results',
  'deliverables',
  'production.php',
  'local.properties',
  'key.properties',
]);
function gather(dir, prefix = '', files = {}, includeVendor=false) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      skip.has(entry.name) || (!includeVendor&&entry.name==='vendor') ||
      (entry.name.startsWith('.env') && entry.name !== '.env.example') ||
      /\.(apk|aab|jks|keystore|mp4|mov|webm)$/.test(entry.name)
    )
      continue;
    const rel = prefix ? prefix + '/' + entry.name : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (rel === 'android/app/src/main/assets/public' || rel === 'docs/review-v0.3.3/video' || rel === 'docs/review-v0.3.4/video' || rel === 'docs/review-v0.3.5/video' || rel === 'docs/review-v0.3.6/video' || rel === 'docs/review-v0.3.7/video' || rel === 'docs/review-v0.3.8/video')
        continue;
      gather(full, rel, files,includeVendor);
    } else if (entry.isFile()) files[rel] = new Uint8Array(fs.readFileSync(full));
  }
  return files;
}
const source = gather(root);
fs.writeFileSync(path.join(out, `DeenPath-${version}-source.zip`), zipSync(source, { level: 6 }));
const privateFiles = {};
const privateSource=gather(path.join(root,'backend'),'backend',{},true);
for (const [name, data] of Object.entries(privateSource))
  if (
    name.startsWith('backend/src/') || name.startsWith('backend/vendor/') || name.startsWith('backend/bin/') || name==='backend/composer.json' || name==='backend/composer.lock' ||
    name === 'backend/config/example.php' ||
    name === 'backend/.htaccess'
  )
    privateFiles[name.replace(/^backend\//, '')] = data;
privateFiles['DEPLOYMENT.md'] = fs.readFileSync('docs/DEPLOYMENT.md');
privateFiles['EXTERNAL-SETUP.md']=fs.readFileSync('docs/EXTERNAL-SETUP.md');
fs.writeFileSync(
  path.join(out, `DeenPath-${version}-private-backend.zip`),
  zipSync(privateFiles, { level: 6 }),
);
fs.copyFileSync('backend/public/api.php', path.join(out, 'api.php'));
fs.copyFileSync('backend/sql/install.sql', path.join(out, 'install.sql'));
fs.copyFileSync('backend/sql/migrations/003_deenpath.sql', path.join(out, '003_deenpath.sql'));
for(const migration of ['004_economy.sql','005_bilingual_stories.sql'])fs.copyFileSync('backend/sql/migrations/'+migration,path.join(out,migration));
fs.copyFileSync('docs/V'+version+'-RELEASE.md', path.join(out, 'START-HERE.md'));
fs.copyFileSync('docs/V'+version+'-TESTING.md', path.join(out, 'TESTING.md'));
fs.copyFileSync('docs/EXTERNAL-SETUP.md',path.join(out,'EXTERNAL-SETUP.md'));
fs.copyFileSync('docs/V'+version+'-CHANGES.md',path.join(out,'CHANGES.md'));
const apk = 'android/app/build/outputs/apk/debug/app-debug.apk';
if (fs.existsSync(apk)) fs.copyFileSync(apk, path.join(out, `DeenPath-${version}-debug.apk`));
const brand = Object.fromEntries(
  Object.entries(source).filter(([name]) => name.startsWith('branding/')),
);
fs.writeFileSync(path.join(out, `DeenPath-${version}-branding.zip`), zipSync(brand, { level: 6 }));
const checks = fs
  .readdirSync(out)
  .filter((f) => f !== 'SHA256SUMS.txt' && fs.statSync(path.join(out, f)).isFile())
  .map(
    (f) =>
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(out, f)))
        .digest('hex') +
      '  ' +
      f,
  );
fs.writeFileSync(path.join(out, 'SHA256SUMS.txt'), checks.join('\n') + '\n');
console.log(
  'Packaged source, private backend, public entry point, schema and available debug APK.',
);
console.log(checks.join('\n'));
