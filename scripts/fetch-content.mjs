import fs from 'node:fs';
import crypto from 'node:crypto';
const source =
  'https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true';
const response = await fetch(source);
if (!response.ok) throw Error('Tanzil download failed');
const raw = await response.text();
const refs = [
  '20:14',
  '4:103',
  '39:53',
  '2:286',
  '94:5',
  '94:6',
  '2:153',
  '29:45',
  '31:17',
  '40:60',
  '66:8',
  '7:156',
  '93:3',
  '99:7',
  '99:8',
];
const verses = raw
  .split(/\r?\n/)
  .map((line) => line.split('|'))
  .filter((x) => x.length === 3 && refs.includes(x[0] + ':' + x[1]))
  .map(([surah, ayah, text]) => ({ ref: surah + ':' + ayah, text }));
if (verses.length !== refs.length) throw Error('Unexpected Tanzil format; no files changed');
const translations = {};
for (const [lang, edition] of [
  ['en', 'en.sahih'],
  ['ur', 'ur.junagarhi'],
]) {
  const url = 'https://tanzil.net/trans/' + edition;
  const r = await fetch(url);
  if (!r.ok) throw Error('Translation download failed');
  const text = await r.text();
  translations[lang] = {
    edition,
    source: url,
    translator: lang === 'en' ? 'Saheeh International' : 'Muhammad Junagarhi',
    retrieved: new Date().toISOString(),
    sha256: crypto.createHash('sha256').update(text).digest('hex'),
    license: 'Non-commercial use per https://tanzil.net/trans/',
    verses: Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((x) => x.split('|'))
        .filter((x) => x.length === 3 && refs.includes(x[0] + ':' + x[1]))
        .map((x) => [x[0] + ':' + x[1], x[2]]),
    ),
  };
  if (Object.keys(translations[lang].verses).length !== refs.length)
    throw Error('Unexpected translation format');
}
const license = raw.slice(raw.indexOf('# PLEASE DO NOT REMOVE'));
const copyright = `Tanzil Quran Text\nCopyright (C) 2007-2021 Tanzil Project\nLicense: Creative Commons Attribution 3.0\n\nPermission is granted to copy and distribute verbatim copies of this text, but CHANGING IT IS NOT ALLOWED.\nSource: Tanzil Project https://tanzil.net\nUpdates: https://tanzil.net/updates/\nFull terms: https://tanzil.net/docs/Text_License\n`;
fs.mkdirSync('src/content', { recursive: true });
fs.writeFileSync(
  'src/content/quran.json',
  JSON.stringify(
    {
      source,
      license: copyright,
      retrieved: new Date().toISOString(),
      sha256: crypto.createHash('sha256').update(raw).digest('hex'),
      verses,
      translations,
    },
    null,
    2,
  ),
);
fs.writeFileSync(
  'docs/CONTENT-LICENSE.txt',
  copyright +
    (license.startsWith('# PLEASE') ? '\n' + license : '') +
    '\n\nTranslations: Saheeh International (English), Muhammad Junagarhi (Urdu), distributed by Tanzil for non-commercial use per https://tanzil.net/trans/. No modifications. Keep DeenPath non-commercial; reassess permissions before any commercial redistribution.\n',
);
console.log(
  'Verified source format; bundled ' +
    verses.length +
    ' unmodified verses with English and Urdu translations.',
);
