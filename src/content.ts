import passages from './content/reminder-passages.json';
import quran from './content/quran.json';
import type { Settings } from './domain';
export function reminderLanguage(s: Settings): 'en' | 'ur' | 'both' | 'none' {
  return s.reminderLanguage || 'both';
}
export function reminderTranslation(ref: string, s: Settings) {
  const language = reminderLanguage(s);
  if (language === 'both')
    return ['en', 'ur']
      .map(
        (lang) =>
          `${lang === 'en' ? 'English' : 'اردو'}: ${(quran.translations[lang as 'en' | 'ur'].verses as Record<string, string>)[ref] || ''}`,
      )
      .join('\n\n');
  return language === 'none'
    ? ''
    : (quran.translations[language].verses as Record<string, string>)[ref] || '';
}
export function reminderBody(ref: string, s: Settings) {
  const arabic = quran.verses.find((v) => v.ref === ref)?.text || '';
  return [
    reminderTranslation(ref, s),
    arabic,
    `${s.lang === 'en' ? 'Quran' : 'القرآن'} ${ref} · Tanzil${reminderLanguage(s) === 'none' ? '' : ' · ' + (reminderLanguage(s) === 'both' ? `${quran.translations.en.translator} · ${quran.translations.ur.translator}` : quran.translations[reminderLanguage(s) as 'en' | 'ur'].translator)}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export const reminderPassages = passages.entries;
export function chooseReminderPassage(theme = 'balanced', sequence = 0, previous = '') {
  const pool = reminderPassages.filter((p) => theme === 'balanced' || p.themes.includes(theme));
  const rows = pool.length ? pool : reminderPassages;
  let index = Math.abs(sequence) % rows.length;
  if (rows.length > 1 && rows[index].id === previous) index = (index + 1) % rows.length;
  return rows[index];
}
export function passageBody(entry: (typeof reminderPassages)[number], s: Settings) {
  if (entry.kind === 'quran') return reminderBody(entry.ref, s);
  const language = reminderLanguage(s);
  return [
    entry.arabicExcerpt,
    language === 'en' || language === 'both'
      ? `English · Meaning (summary)\n${entry.enSummary}`
      : '',
    language === 'ur' || language === 'both' ? `اردو · مفہوم کا خلاصہ\n${entry.urSummary}` : '',
    `${entry.ref} · Sahih · Arabic excerpt\n${entry.source}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
