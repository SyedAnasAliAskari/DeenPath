import quran from './content/quran.json';
export function VerseTranslations({
  verseRef,
  languages = ['en', 'ur'],
}: {
  verseRef: string;
  languages?: ('en' | 'ur')[];
}) {
  return (
    <div className="verse-translations">
      {languages.map((language) => {
        const source = quran.translations[language];
        const text = (source.verses as Record<string, string>)[verseRef];
        return text ? (
          <section key={language} lang={language} dir={language === 'ur' ? 'rtl' : 'ltr'}>
            <strong>{language === 'en' ? 'English' : 'اردو'}</strong>
            <p className="translation-text">{text}</p>
            <small className="muted">{source.translator}</small>
          </section>
        ) : null;
      })}
    </div>
  );
}
