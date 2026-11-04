import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
const mark = {
  arch: 'M28 78V49C28 36 40 28 54 21C68 28 80 36 80 49V78',
  dome: 'M37 73V62C37 54 47 50 54 44C61 50 71 54 71 62V73H59V65A5 5 0 0 0 49 65V73Z',
  plant: 'M80 81C84 73 88 69 94 68C94 75 89 79 83 79M80 81C78 74 74 71 70 71C70 77 74 80 80 81Z',
  moon: 'M65 32A10 10 0 1 0 69 49A11 11 0 0 1 65 32Z',
};
const svg = (dark = false, mono = false) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><title>DeenPath — crescent, mosque and arch</title>${mono ? '' : `<rect width="108" height="108" rx="24" fill="${dark ? '#12271f' : '#faf7ec'}"/>`}<path d="${mark.arch}" fill="none" stroke="${mono ? 'currentColor' : dark ? '#f3f2e6' : '#18513d'}" stroke-width="4.5" stroke-linecap="round"/><path d="${mark.dome}" fill="${mono ? 'currentColor' : dark ? '#f3f2e6' : '#18513d'}"/><path d="${mark.plant}" fill="${mono ? 'currentColor' : '#63855b'}"/><path d="${mark.moon}" fill="${mono ? 'currentColor' : '#b79a59'}"/></svg>`;
const dir = 'branding';
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync('src/assets', { recursive: true });
for (const [name, dark, mono] of [
  ['master', false, false],
  ['light', false, false],
  ['dark', true, false],
  ['monochrome', false, true],
]) {
  fs.writeFileSync(`${dir}/deenpath-${name}.svg`, svg(dark, mono));
  if (!mono)
    for (const size of [24, 48, 192, 512])
      fs.writeFileSync(
        `${dir}/deenpath-${name}-${size}.png`,
        new Resvg(svg(dark), { fitTo: { mode: 'width', value: size } }).render().asPng(),
      );
}
fs.copyFileSync(`${dir}/deenpath-light.svg`, 'src/assets/logo-light.svg');
fs.copyFileSync(`${dir}/deenpath-dark.svg`, 'src/assets/logo-dark.svg');
const res = 'android/app/src/main/res';
const write = (rel, value) => {
  const full = path.join(res, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, value);
};
write(
  'values/brand.xml',
  '<resources><color name="brand_background">#FAF7EC</color><color name="brand_ink">#18513D</color><color name="brand_accent">#B79A59</color></resources>',
);
write(
  'values-night/brand.xml',
  '<resources><color name="brand_background">#12271F</color><color name="brand_ink">#F3F2E6</color><color name="brand_accent">#C8AE75</color></resources>',
);
const vector = (mono = false) =>
  `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:pathData="${mark.arch}" android:strokeColor="${mono ? '#FFFFFFFF' : '@color/brand_ink'}" android:strokeWidth="4.5" android:strokeLineCap="round" android:fillColor="#00000000"/><path android:pathData="${mark.dome}" android:fillColor="${mono ? '#FFFFFFFF' : '@color/brand_ink'}"/><path android:pathData="${mark.plant}" android:fillColor="${mono ? '#FFFFFFFF' : '#63855B'}"/><path android:pathData="${mark.moon}" android:fillColor="${mono ? '#FFFFFFFF' : '@color/brand_accent'}"/></vector>`;
write('drawable/brand_foreground.xml', vector());
write('drawable/brand_monochrome.xml', vector(true));
write('drawable/ic_notification.xml', vector(true));
for (const name of ['ic_launcher', 'ic_launcher_round']) {
  write(
    `mipmap-anydpi-v26/${name}.xml`,
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/brand_background"/><foreground android:drawable="@drawable/brand_foreground"/></adaptive-icon>',
  );
  write(
    `mipmap-anydpi-v33/${name}.xml`,
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/brand_background"/><foreground android:drawable="@drawable/brand_foreground"/><monochrome android:drawable="@drawable/brand_monochrome"/></adaptive-icon>',
  );
}
for (const [density, size] of [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
])
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    const target = `${res}/mipmap-${density}/${name}.png`;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
      target,
      new Resvg(svg(), { fitTo: { mode: 'width', value: size } }).render().asPng(),
    );
  }
write(
  'drawable/brand_splash.xml',
  '<layer-list xmlns:android="http://schemas.android.com/apk/res/android"><item android:drawable="@color/brand_background"/><item android:width="108dp" android:height="108dp" android:gravity="center" android:drawable="@drawable/brand_foreground"/></layer-list>',
);
write(
  'drawable/brand_background.xml',
  '<shape xmlns:android="http://schemas.android.com/apk/res/android"><solid android:color="@color/brand_background"/></shape>',
);
fs.copyFileSync(`${res}/drawable/brand_foreground.xml`, `${dir}/android-adaptive-foreground.xml`);
fs.copyFileSync(`${res}/drawable/brand_background.xml`, `${dir}/android-adaptive-background.xml`);
fs.copyFileSync(`${res}/drawable/brand_monochrome.xml`, `${dir}/android-monochrome.xml`);
fs.copyFileSync(`${res}/drawable/ic_notification.xml`, `${dir}/android-notification.xml`);
fs.mkdirSync('android/app/src/main/assets', { recursive: true });
fs.copyFileSync('src/content/quran.json', 'android/app/src/main/assets/islamic-reminders.json');
fs.copyFileSync('src/content/reminder-passages.json', 'android/app/src/main/assets/reminder-passages.json');
console.log('Branding vectors, PNG densities, themed icons and native content generated.');
