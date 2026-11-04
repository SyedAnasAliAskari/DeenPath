import { VerseTranslations } from './VerseTranslations';
import quran from './content/quran.json';
import { RoutineAttachment } from './RoutineAttachment';
import { type LocalFile } from './files';
import { prayerLabel } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { type RecordData, periodKey } from './domain';
import { tr } from './deen-ui';
import { db } from './store';

export const tasbihPresets = [
  { title: 'Astaghfar', dhikr: 'أَسْتَغْفِرُ اللَّهَ', target: 100 },
  {
    title: 'Kalma Shahadah',
    dhikr:
      'أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
    target: 1,
  },
  {
    title: 'Durood Shareef',
    dhikr: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ',
    target: 100,
  },
  { title: 'SubhanAllah', dhikr: 'سُبْحَانَ اللَّهِ', target: 33 },
  { title: 'Alhamdulillah', dhikr: 'الْحَمْدُ لِلَّهِ', target: 33 },
  { title: 'Allahu Akbar', dhikr: 'اللَّهُ أَكْبَرُ', target: 34 },
];
type Props = {
  routines: RecordData[];
  files?: LocalFile[];
  now: Date;
  done: (r: RecordData) => boolean;
  count: (r: RecordData) => number;
  onCount: (r: RecordData) => Promise<unknown>;
  onComplete: (r: RecordData) => Promise<unknown>;
  onRead: (r: RecordData) => Promise<unknown>;
  onFile: (r: RecordData) => Promise<unknown>;
  onEdit: (r: RecordData) => void;
  onDelete: (r: RecordData) => void;
  onUndo: (r: RecordData) => void;
  onPreset: (r: (typeof tasbihPresets)[number]) => Promise<void>;
};
function periodIdentity(r: RecordData, now: Date) {
  try {
    return periodKey(r.data, now, db.state.records);
  } catch {
    return 'unavailable';
  }
}
const categories = [
  ['tasbih', () => tr('Tasbih', 'تسبیح', 'تسبيح'), '✦'],
  ['dua', () => tr('Duas', 'دعائیں', 'أدعية'), '☾'],
  ['quran', () => tr('Ayat', 'آیات', 'آيات'), '۞'],
  ['nafl', () => tr('Nafl prayers', 'نفل نماز', 'صلاة النافلة'), '◈'],
  ['custom', () => tr('Personal routines', 'ذاتی معمولات', 'أوراد شخصية'), '◇'],
] as const;
export function RoutineStacks(props: Props) {
  const [presets, setPresets] = useState(false),
    [adding, setAdding] = useState('');
  return (
    <div className="routine-workspace">
      <div className="routine-intro">
        <div>
          <span className="eyebrow">
            {tr('A little, every day', 'روزانہ تھوڑا سا', 'القليل كل يوم')}
          </span>
          <h2>{tr('Your daily practice', 'آپ کے روزانہ معمولات', 'ممارستك اليومية')}</h2>
        </div>
        <button className="secondary" onClick={() => setPresets(!presets)} aria-expanded={presets}>
          <Plus size={16} />
          {tr('Popular tasbihs', 'مشہور تسبیحات', 'تسابيح شائعة')}
        </button>
      </div>
      {presets && (
        <section className="preset-library">
          <p>
            {tr(
              'Choose a starting point. Targets are editable personal goals.',
              'اپنی پسند سے آغاز کریں۔ ہدف بدل سکتے ہیں۔',
              'اختر بداية. الأهداف شخصية وقابلة للتعديل.',
            )}
          </p>
          <div className="preset-grid">
            {tasbihPresets.map((p) => (
              <button
                key={p.title}
                className="preset-option"
                disabled={!!adding}
                onClick={async () => {
                  setAdding(p.title);
                  try {
                    await props.onPreset(p);
                  } finally {
                    setAdding('');
                  }
                }}
              >
                <strong>{p.title}</strong>
                <span dir="rtl">{p.dhikr}</span>
                <small>
                  <Plus size={13} />
                  {adding === p.title
                    ? tr('Adding…', 'شامل ہو رہا ہے…', 'جارٍ الإضافة…')
                    : tr('Add to my routines', 'میرے معمولات میں شامل کریں', 'إضافة إلى أورادي')}
                </small>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="routine-stacks">
        {categories.map(([kind, title, symbol]) => {
          const routines = props.routines.filter((r) => r.data.kind === kind);
          if (!routines.length) return null;
          return (
            <CategoryStack
              {...props}
              key={kind + routines.map((r) => r.id + periodIdentity(r, props.now)).join('|')}
              routines={routines}
              title={title()}
              symbol={symbol}
            />
          );
        })}
      </div>
      {!props.routines.length && (
        <div className="routine-empty">
          <Layers size={36} />
          <h3>
            {tr(
              'Make room for a daily practice',
              'روزانہ کے معمول سے آغاز کریں',
              'ابدأ بممارسة يومية',
            )}
          </h3>
          <p>
            {tr(
              'Add your own routine, or choose a popular tasbih above.',
              'اپنا معمول شامل کریں یا اوپر سے تسبیح منتخب کریں۔',
              'أضف وردًا أو اختر تسبيحًا أعلاه.',
            )}
          </p>
        </div>
      )}
    </div>
  );
}
function CategoryStack(props: Props & { title: string; symbol: string }) {
  const [dismissed, setDismissed] = useState<string[]>([]),
    [direction, setDirection] = useState(''),
    [busy, setBusy] = useState(false);
  const slideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(slideTimer.current), []);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const available = props.routines.filter((r) => !dismissed.includes(r.id));
  const routine = available[0],
    completed = routine ? props.done(routine) : true;
  const finished = props.routines.filter(props.done).length;
  const unavailable = !!routine && periodIdentity(routine, props.now) === 'unavailable';
  async function act(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }
  function next(side: string) {
    if (!routine || !completed || direction) return;
    setDirection(side);
    slideTimer.current = setTimeout(
      () => {
        setDismissed((d) => [...d, routine.id]);
        setDirection('');
      },
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220,
    );
  }
  return (
    <section className="category-stack" aria-label={props.title}>
      <div className="stack-heading">
        <h3>
          <span>{props.symbol}</span>
          {props.title}
        </h3>
        <span dir="ltr">
          {finished} / {props.routines.length} <Check size={13} />
        </span>
      </div>
      <div className={'stack-deck ' + (available.length > 1 ? 'has-next' : '')}>
        {routine ? (
          <article
            className={'routine practice-card ' + (completed ? 'is-complete ' : '') + direction}
            data-countable={routine.data.kind === 'tasbih' && !completed && !unavailable}
            tabIndex={routine.data.kind === 'tasbih' && !completed && !unavailable ? 0 : undefined}
            aria-label={
              routine.data.kind === 'tasbih' ? 'Tasbih card: ' + routine.data.title : undefined
            }
            onKeyDown={(event) => {
              if (
                event.target === event.currentTarget &&
                routine.data.kind === 'tasbih' &&
                !completed &&
                !unavailable &&
                (event.key === ' ' || event.key === 'Enter')
              ) {
                event.preventDefault();
                void props.onCount(routine);
              }
            }}
            onClick={(event) => {
              if (moved.current) {
                moved.current = false;
                return;
              }
              if (
                routine.data.kind === 'tasbih' &&
                !completed &&
                !unavailable &&
                !(event.target as HTMLElement).closest(
                  'button,a,input,select,textarea,summary,[role="button"]',
                ) &&
                !window.getSelection()?.toString()
              )
                void props.onCount(routine);
            }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('button, a, input, summary')) return;
              moved.current = false;
              pointer.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerMove={(event) => {
              const p = pointer.current;
              if (p && (Math.abs(event.clientX - p.x) > 8 || Math.abs(event.clientY - p.y) > 8))
                moved.current = true;
            }}
            onPointerCancel={() => {
              moved.current = true;
              pointer.current = null;
            }}
            onPointerUp={(e) => {
              const p = pointer.current;
              pointer.current = null;
              if (p && Math.abs(e.clientX - p.x) > 60 && Math.abs(e.clientY - p.y) < 80)
                next(e.clientX > p.x ? 'slide-right' : 'slide-left');
            }}
          >
            <div className="practice-top">
              <span className="practice-status">
                {completed ? (
                  <>
                    <Check size={14} />
                    {tr('Completed', 'مکمل', 'مكتمل')}
                  </>
                ) : (
                  <>
                    <span className="practice-dot" />
                    {routine.data.resetPrayers?.length
                      ? tr('After Namaz', 'نماز کے بعد', 'بعد الصلاة')
                      : routine.data.frequency === 'unscheduled'
                        ? tr('At your pace', 'اپنی رفتار سے', 'على وتيرتك')
                        : tr('Your next practice', 'آپ کا اگلا معمول', 'ممارستك التالية')}
                  </>
                )}
              </span>
              <details className="practice-menu">
                <summary aria-label={tr('Routine options', 'معمول کے اختیارات', 'خيارات الورد')}>
                  <MoreHorizontal size={20} />
                </summary>
                <div>
                  <button onClick={() => props.onEdit(routine)}>
                    {tr('Edit routine', 'معمول کی ترمیم', 'تعديل الورد')}
                  </button>
                  <button onClick={() => props.onUndo(routine)}>
                    <RotateCcw size={14} />
                    {tr('Correct progress', 'پیش رفت درست کریں', 'تصحيح التقدم')}
                  </button>
                  <button onClick={() => props.onDelete(routine)}>
                    <Trash2 size={14} />
                    {tr('Delete', 'حذف کریں', 'حذف')}
                  </button>
                </div>
              </details>
            </div>
            <h2>{routine.data.title}</h2>
            {unavailable && (
              <p role="status">
                {tr(
                  'Prayer starts are unavailable for this schedule. Choose a supported location when adding a new routine.',
                  'ان اوقات میں نماز کا آغاز دستیاب نہیں۔ نیا معمول بناتے وقت مناسب مقام منتخب کریں۔',
                  'مواقيت البدء غير متاحة لهذا الجدول. اختر موقعًا مدعومًا لورد جديد.',
                )}
              </p>
            )}
            {routine.data.kind === 'nafl' && (
              <p className="muted">
                {routine.data.target} {tr('Rak’ahs', 'رکعات', 'ركعات')}
              </p>
            )}
            {(routine.data.dhikr || routine.data.duaText) && (
              <p className="practice-text" dir="auto">
                {routine.data.dhikr || routine.data.duaText}
              </p>
            )}
            {routine.data.kind === 'quran' && routine.data.contentRef && (
              <>
                <blockquote className="quran-text" dir="rtl">
                  {quran.verses.find((v) => v.ref === routine.data.contentRef)?.text}
                </blockquote>
                <VerseTranslations verseRef={routine.data.contentRef} />
              </>
            )}
            {routine.data.kind === 'tasbih' ? (
              <button
                className="practice-counter"
                disabled={busy || completed || unavailable}
                onClick={() => void props.onCount(routine)}
                aria-label={tr('Tap to count', 'گنتی', 'عدّ')}
                style={
                  {
                    '--count-progress': `${Math.min(100, (props.count(routine) / routine.data.target) * 100)}%`,
                  } as React.CSSProperties
                }
              >
                <strong>{props.count(routine)}</strong>
                <span dir="ltr">/ {routine.data.target}</span>
                <small>
                  {completed ? '✓' : tr('Tap to count', 'گننے کے لیے دبائیں', 'اضغط للعدّ')}
                </small>
              </button>
            ) : (
              <button
                className={completed ? 'practice-done' : 'primary practice-complete'}
                disabled={busy || completed || unavailable}
                onClick={() => void act(() => props.onComplete(routine))}
              >
                <Check size={18} />
                {completed
                  ? tr('Completed', 'مکمل', 'مكتمل')
                  : tr('Mark complete', 'مکمل درج کریں', 'تسجيل الإكمال')}
              </button>
            )}
            {props.files
              ?.filter(
                (f) =>
                  f.id === routine.data.fileId ||
                  (f.cloudId && f.cloudId === routine.data.fileCloudId),
              )
              .map((file) => (
                <RoutineAttachment
                  key={file.id}
                  file={file}
                  open={() => void act(() => props.onFile(routine))}
                />
              ))}
            <div className="practice-materials">
              {(routine.data.duaText || routine.data.contentRef) && (
                <button className="secondary" onClick={() => void act(() => props.onRead(routine))}>
                  <BookOpen size={15} />
                  {tr('Read', 'متن پڑھیں', 'قراءة النص')}
                </button>
              )}
              {(routine.data.fileId || routine.data.fileCloudId) && (
                <button className="secondary" onClick={() => void act(() => props.onFile(routine))}>
                  <FileText size={15} />
                  {tr('Open attachment', 'منسلک فائل کھولیں', 'فتح المرفق')}
                </button>
              )}
            </div>
            <div className="practice-footer">
              <span>
                {completed
                  ? tr(
                      'Swipe to the next card',
                      'اگلے کارڈ کے لیے سوائپ کریں',
                      'اسحب للبطاقة التالية',
                    )
                  : routine.data.resetPrayers
                      ?.map((name: string) => prayerLabel(name, db.state.settings.lang))
                      .join(' · ') || routine.data.time}
              </span>
              {completed && (
                <div>
                  <button
                    className="icon"
                    aria-label={tr('Previous side', 'بائیں طرف', 'إلى اليسار')}
                    onClick={() => next('slide-left')}
                  >
                    <ChevronLeft size={19} />
                  </button>
                  <button
                    className="icon"
                    aria-label={tr('Next routine', 'اگلا معمول', 'الورد التالي')}
                    onClick={() => next('slide-right')}
                  >
                    <ChevronRight size={19} />
                  </button>
                </div>
              )}
            </div>
          </article>
        ) : (
          <article className="practice-card stack-finished">
            <Check size={32} />
            <h2>{tr('A moment well spent', 'ایک اچھا لمحہ', 'وقت طيب')}</h2>
            <p>
              {tr(
                'You have reached the end of this stack.',
                'اس زمرے کے کارڈ مکمل ہو گئے۔',
                'وصلت إلى نهاية هذه المجموعة.',
              )}
            </p>
            <button className="secondary" onClick={() => setDismissed([])}>
              {tr('Review cards', 'کارڈ دوبارہ دیکھیں', 'مراجعة البطاقات')}
            </button>
          </article>
        )}
      </div>
    </section>
  );
}
