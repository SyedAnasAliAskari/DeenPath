// Optional local build tools. All downloads stay in ignored .tools/.
import fs from 'node:fs';
fs.mkdirSync('.tools', { recursive: true });
async function download(url, path) {
  console.log('Downloading ' + path);
  const probe = await fetch(url, { headers: { Range: 'bytes=0-0' } });
  if (!probe.ok) throw Error(`${probe.status} ${url}`);
  const total = Number(
    probe.headers.get('content-range')?.split('/')[1] || probe.headers.get('content-length'),
  );
  await probe.body.cancel();
  if (fs.existsSync(path) && fs.statSync(path).size === total) {
    console.log('Already downloaded ' + path);
    return;
  }
  const dest = await fs.promises.open(path, 'w');
  let cursor = 0;
  const chunk = 4 * 1024 * 1024;
  try {
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (cursor < total) {
          const start = cursor;
          cursor += chunk;
          const end = Math.min(total - 1, start + chunk - 1);
          let good = false;
          for (let attempt = 0; attempt < 5 && !good; attempt++) {
            try {
              const r = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
              if (r.status !== 206) throw Error('Server did not support range download');
              const bytes = Buffer.from(await r.arrayBuffer());
              if (bytes.length !== end - start + 1) throw Error('Incomplete chunk');
              await dest.write(bytes, 0, bytes.length, start);
              good = true;
            } catch (e) {
              if (attempt === 4) throw e;
            }
          }
          if (start % (chunk * 8) === 0)
            console.log(`${path}: ${Math.round((end / total) * 100)}%`);
        }
      }),
    );
  } finally {
    await dest.close();
  }
  console.log('Saved ' + path);
}
await download(
  'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse',
  '.tools/jdk.zip',
);
await download(
  'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip',
  '.tools/android-tools.zip',
);
