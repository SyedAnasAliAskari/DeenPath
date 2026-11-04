import { it, expect } from 'vitest';
import { signedAngle, smoothHeading } from '../src/compass';
import { prayerReport, prayerSlots } from '../src/deen';
import { defaults, prayers, type RecordData } from '../src/domain';
import { prayerLabel } from '../src/i18n';
import quran from '../src/content/quran.json';

it('keeps compass motion continuous across north in both directions', () => {
  expect(smoothHeading(359, 1)).toBeCloseTo(359.44);
  expect(smoothHeading(1, 359)).toBeCloseTo(0.56);
  expect(signedAngle(350)).toBe(-10);
  expect(signedAngle(-350)).toBe(10);
});
it('counts Friday once, with a separate Jummah row and an explicit Dhuhr choice', () => {
  const day = '2026-10-02',
    w = prayers(day, defaults)[1];
  const entry: RecordData = {
    id: w.key,
    entity: 'prayer_records',
    version: 0,
    data: { completedAt: new Date(w.start.getTime() + 60000).toISOString() },
  };
  const rows = prayerReport(prayerSlots([entry], defaults, day, day, new Date('2026-10-03')));
  expect(rows.find((r) => r.name === 'Jummah')).toMatchObject({ total: 1, ontime: 1 });
  expect(rows.find((r) => r.name === 'Dhuhr')?.total).toBe(0);
  expect(rows.at(-1)?.total).toBe(5);
  entry.data.midday = 'Dhuhr';
  const edited = prayerReport(prayerSlots([entry], defaults, day, day, new Date('2026-10-03')));
  expect(edited.find((r) => r.name === 'Dhuhr')?.ontime).toBe(1);
  expect(edited.find((r) => r.name === 'Jummah')?.total).toBe(0);
  expect(prayerLabel('Dhuhr', 'en', day)).toBe('Jummah');
});
it('bundles complete attributed translations for every Arabic verse', () => {
  expect(quran.translations.en.edition).toBe('en.sahih');
  expect(quran.translations.ur.edition).toBe('ur.junagarhi');
  for (const verse of quran.verses)
    for (const language of ['en', 'ur'] as const) {
      expect(
        quran.translations[language].verses[verse.ref as keyof typeof quran.translations.en.verses]
          .length,
      ).toBeGreaterThan(10);
    }
});
