import { it, expect } from 'vitest';
import {
  reminderBody,
  reminderLanguage,
  chooseReminderPassage,
  reminderPassages,
  passageBody,
} from '../src/content';
import { defaults } from '../src/domain';
import quran from '../src/content/quran.json';
it('includes the licensed English/Urdu meaning and Arabic inside the notification body', () => {
  for (const language of ['en', 'ur'] as const) {
    const body = reminderBody('20:14', { ...defaults, reminderLanguage: language });
    expect(body.startsWith(quran.translations[language].verses['20:14'])).toBe(true);
    expect(body).toContain(quran.verses.find((v) => v.ref === '20:14')!.text);
    expect(body).toContain('20:14');
    expect(body).toContain('Tanzil');
  }
});
it('defaults to both translations while preserving explicit Arabic-only content', () => {
  expect(reminderLanguage({ ...defaults, lang: 'ur' })).toBe('both');
  const body = reminderBody('20:14', defaults);
  expect(body).toContain(quran.translations.en.verses['20:14']);
  expect(body).toContain(quran.translations.ur.verses['20:14']);
  expect(body).toContain(quran.translations.en.translator);
  expect(body).toContain(quran.translations.ur.translator);
  expect(reminderBody('20:14', { ...defaults, reminderLanguage: 'none' })).not.toContain(
    quran.translations.en.verses['20:14'],
  );
});

it('varies readings within each selected theme and keeps Quran references in the offline bundle', () => {
  for (const theme of ['balanced', 'hope', 'forgiveness', 'prayer']) {
    let previous = '';
    for (let i = 0; i < 50; i++) {
      const row = chooseReminderPassage(theme, i, previous);
      expect(row.id).not.toBe(previous);
      if (theme !== 'balanced') expect(row.themes).toContain(theme);
      previous = row.id;
    }
  }
  for (const row of reminderPassages) {
    if (row.kind === 'quran') expect(quran.verses.some((v) => v.ref === row.ref)).toBe(true);
    else {
      const body = passageBody(row, defaults);
      expect(body).toContain('Meaning (summary)');
      expect(body).toContain(row.source);
      expect(body).toContain(row.enSummary);
      expect(body).toContain(row.urSummary);
    }
  }
});
