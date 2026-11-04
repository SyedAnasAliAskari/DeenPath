import { useBack } from './back';
import { setLessonDraft } from './guidance-model';
import { useState } from 'react';
import quran from './content/quran.json';
import { db } from './store';
import { Heading, Panel, tr, saveAction, type SuiteProps } from './deen-ui';
import { Field } from './components';
import { reminderBody } from './content';
const lessons = () => [
  {
    id: 'prayer',
    ref: '20:14',
    title: tr('Prayer and remembrance', 'نماز اور یاد الٰہی', 'الصلاة والذكر'),
    topic: tr('Salah', 'نماز', 'الصلاة'),
    body: tr(
      'Read the verse and reflect on making time for prayer. Use the recorded prayer windows and seek qualified guidance about individual circumstances.',
      'آیت پڑھیں اور نماز کے لیے وقت نکالنے پر غور کریں۔ درج اوقات استعمال کریں اور ذاتی حالات کے لیے مستند رہنمائی لیں۔',
      'اقرأ الآية وتأمل تخصيص وقت للصلاة. استخدم الأوقات المسجلة واطلب إرشادًا مؤهلًا لظروفك.',
    ),
  },
  {
    id: 'quran',
    ref: '2:153',
    title: tr('Patience and prayer', 'صبر اور نماز', 'الصبر والصلاة'),
    topic: tr('Quran', 'قرآن', 'القرآن'),
    body: tr(
      'Read the attributed text and translation. This short reflection is educational commentary, not a religious ruling. Choose one practical way to protect a calm moment today.',
      'منسوب متن اور ترجمہ پڑھیں۔ یہ مختصر غور تعلیمی تشریح ہے، شرعی حکم نہیں۔ آج سکون کا ایک وقت محفوظ کرنے کا طریقہ چنیں۔',
      'اقرأ النص وترجمته المنسوبة. هذا تأمل تعليمي وليس حكمًا شرعيًا. اختر طريقة عملية لحفظ لحظة هادئة اليوم.',
    ),
  },
  {
    id: 'dua',
    ref: '40:60',
    title: tr('Turning to Allah in Dua', 'دعا میں اللہ کی طرف رجوع', 'التوجه إلى الله بالدعاء'),
    topic: tr('Dua', 'دعا', 'الدعاء'),
    body: tr(
      'Read the verse in context. Keep a personal Dua routine if it helps you remember; a reminder app does not define the acceptance of worship.',
      'آیت کو سیاق میں پڑھیں۔ ذاتی دعا کا معمول یاد رکھنے میں مدد دے سکتا ہے؛ ایپ عبادت کی قبولیت کا فیصلہ نہیں کرتی۔',
      'اقرأ الآية في سياقها. قد يساعدك ورد دعاء شخصي على التذكر؛ التطبيق لا يحكم على قبول العبادة.',
    ),
  },
  {
    id: 'manners',
    ref: '99:7',
    title: tr('Small beneficial actions', 'چھوٹے مفید اعمال', 'أعمال نافعة صغيرة'),
    topic: tr('Manners', 'اخلاق', 'الآداب'),
    body: tr(
      'Reflect on a small good action you can choose today. App milestones are motivational markers, not measures of divine reward.',
      'آج کے لیے ایک چھوٹے نیک عمل پر غور کریں۔ ایپ کے سنگ میل حوصلہ افزائی ہیں، خدائی اجر کا پیمانہ نہیں۔',
      'تأمل عملًا صالحًا صغيرًا تختاره اليوم. معالم التطبيق للتشجيع وليست مقاييس للأجر الإلهي.',
    ),
  },
  {
    id: 'hope',
    ref: '39:53',
    title: tr('Hope and a fresh beginning', 'امید اور نیا آغاز', 'الأمل والبداية الجديدة'),
    topic: tr('Personal growth', 'ذاتی اصلاح', 'النمو الشخصي'),
    body: tr(
      'Read the verse and its meaning. A difficult day does not erase your previous effort. For sensitive personal religious questions, consult a qualified scholar.',
      'آیت اور اس کا مفہوم پڑھیں۔ مشکل دن سابقہ کوشش نہیں مٹاتا۔ حساس ذاتی شرعی سوالات کے لیے مستند عالم سے رجوع کریں۔',
      'اقرأ الآية ومعناها. يوم صعب لا يمحو جهودك السابقة. استشر عالمًا مؤهلًا للأسئلة الدينية الشخصية الحساسة.',
    ),
  },
  {
    id: 'dhikr',
    ref: '31:17',
    title: tr('Consistency and patience', 'استقامت اور صبر', 'الاستمرار والصبر'),
    topic: tr('Dhikr', 'ذکر', 'الذكر'),
    body: tr(
      'Read the source, then choose a manageable voluntary routine. Numerical targets are personal planning tools; they do not establish a prescribed religious count.',
      'ماخذ پڑھ کر قابل عمل رضاکارانہ معمول چنیں۔ عددی اہداف ذاتی منصوبہ بندی ہیں؛ شرعی تعداد مقرر نہیں کرتے۔',
      'اقرأ المصدر ثم اختر وردًا تطوعيًا مناسبًا. الأهداف العددية أدوات تخطيط شخصية ولا تثبت عددًا شرعيًا مقررًا.',
    ),
  },
];
export function Learning(
  props: SuiteProps & {
    selected: string;
    selectLesson: (id: string) => void;
    previousLesson: () => boolean;
  },
) {
  const [query, setQuery] = useState(''),
    [answer, setAnswer] = useState('');
  const { selected, selectLesson: setSelected } = props;
  useBack(() => {
    setAnswer('');
    return props.previousLesson();
  });
  const list = lessons(),
    lesson = list.find((l) => l.id === selected);
  return (
    <>
      <Heading
        title={tr('Islamic Learning', 'اسلامی تعلیم', 'التعلم الإسلامي')}
        text={tr(
          'Short reflections with verified-source Quran excerpts.',
          'تصدیق شدہ قرآنی ماخذ کے ساتھ مختصر غور۔',
          'تأملات قصيرة مع مقتطفات قرآنية موثقة المصدر.',
        )}
      />
      <Panel title={tr('Browse and search', 'دیکھیں اور تلاش کریں', 'تصفح وابحث')}>
        <Field label={tr('Search lessons', 'اسباق تلاش کریں', 'البحث عن الدروس')}>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
        <div className="dp-menu">
          {list
            .filter((l) => (l.title + l.topic + l.body).toLowerCase().includes(query.toLowerCase()))
            .map((l) => (
              <button
                className="secondary"
                key={l.id}
                onClick={() => {
                  setSelected(l.id);
                  setAnswer('');
                }}
              >
                <span>
                  {l.title}
                  <small>
                    {l.topic} · Quran {l.ref}
                  </small>
                </span>
                {db.find('learning_progress', l.id) && !db.find('learning_progress', l.id)?.deleted
                  ? '✓'
                  : '→'}
              </button>
            ))}
        </div>
      </Panel>
      {lesson && (
        <Panel title={lesson.title}>
          <button
            className="text-button subview-back"
            onClick={() => {
              setSelected('');
              setAnswer('');
            }}
          >
            ← {tr('Back to lessons', 'اسباق پر واپس', 'العودة للدروس')}
          </button>
          <p>{lesson.body}</p>
          <p className="preserve-lines dp-source" dir="auto">
            {reminderBody(lesson.ref, {
              ...db.state.settings,
              reminderLanguage: 'both',
            })}
          </p>
          <a target="_blank" rel="noreferrer" href={`https://tanzil.net/#${lesson.ref}`}>
            {tr('Read source in context', 'ماخذ کو سیاق میں پڑھیں', 'اقرأ المصدر في سياقه')}
          </a>
          <p className="muted">
            {tr(
              'Arabic: Tanzil. English: Saheeh International. Urdu: Muhammad Junagarhi. Commentary above is app-authored reflection, not a quotation.',
              'عربی: تنزیل۔ انگریزی: صحیح انٹرنیشنل۔ اردو: محمد جوناگڑھی۔ اوپر کی تشریح ایپ کی تعلیمی سوچ ہے، اقتباس نہیں۔',
              'العربية: تنزيل. الإنجليزية: صحيح إنترناشيونال. الأردية: محمد جوناكري. التعليق أعلاه تأمل من إعداد التطبيق وليس اقتباسًا.',
            )}
          </p>
          <Field
            label={tr(
              'Optional quiz: which reference did you read?',
              'اختیاری سوال: کون سا حوالہ پڑھا؟',
              'اختبار اختياري: ما المرجع الذي قرأته؟',
            )}
          >
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={tr('Surah:verse', 'سورت:آیت', 'سورة:آية')}
            />
          </Field>
          {answer && (
            <p>
              {answer.trim() === lesson.ref
                ? tr('Correct', 'درست', 'صحيح')
                : tr(
                    'Check the source reference above.',
                    'اوپر ماخذ کا حوالہ دیکھیں۔',
                    'راجع مرجع المصدر أعلاه.',
                  )}
            </p>
          )}
          <div className="actions">
            <button
              className="primary"
              onClick={() =>
                saveAction(
                  () =>
                    db.put('learning_progress', lesson.id, {
                      lessonId: lesson.id,
                      completedAt: new Date().toISOString(),
                      reference: lesson.ref,
                    }),
                  props,
                )
              }
            >
              {tr('Mark lesson complete', 'سبق مکمل درج کریں', 'تسجيل إكمال الدرس')}
            </button>
            <button
              className="secondary"
              onClick={() => {
                setLessonDraft(
                  tr(
                    'Explain this Quran reference in context: ',
                    '\u0627\u0633 \u0642\u0631\u0622\u0646\u06cc \u062d\u0648\u0627\u0644\u06d2 \u06a9\u06cc \u0633\u06cc\u0627\u0642 \u0645\u06cc\u06ba \u0648\u0636\u0627\u062d\u062a \u06a9\u0631\u06cc\u06ba: ',
                    '\u0627\u0634\u0631\u062d \u0647\u0630\u0627 \u0627\u0644\u0645\u0631\u062c\u0639 \u0627\u0644\u0642\u0631\u0622\u0646\u064a \u0641\u064a \u0633\u064a\u0627\u0642\u0647: ',
                  ) + lesson.ref,
                );
                props.navigate('guidance');
              }}
            >
              {tr(
                'Ask Guidance a follow-up',
                'گائیڈنس سے مزید پوچھیں',
                'اسأل الإرشاد سؤالًا لاحقًا',
              )}
            </button>
          </div>
        </Panel>
      )}
    </>
  );
}
