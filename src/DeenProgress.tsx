import { useBack } from './back';
import { BookOpen, Gem, Leaf, ArrowUpRight, Flame, CheckCircle2, BarChart3 } from 'lucide-react';
import { Native, isNative } from './native';
import { Toggle } from './components';
import { useEffect, useMemo, useState } from 'react';
import { db } from './store';
import { prayerResetEvents, dayKey, routineDue, periodKey, zonedDate, scheduleOn } from './domain';
import { prayerSlots, prayerReport, shiftDay, dateRange, type RangePreset } from './deen';
import { prayerLabel } from './i18n';
import { RangeFilter } from './PrayerReport';
import { Heading, Panel, tr, type SuiteProps } from './deen-ui';
export function DeenProgress(
  props: SuiteProps & {
    view: string;
    setView: (view: string) => void;
    previousView: () => boolean;
    canGoBack: boolean;
  },
) {
  const { view, setView } = props;
  useBack(() => props.previousView());
  const s = db.state.settings,
    today = dayKey(new Date(), s.timezone),
    start =
      s.trackingStart ||
      db
        .list('prayer_records')
        .map((r) => r.data.day)
        .sort()[0] ||
      today;
  const [preset, setPreset] = useState<RangePreset>('30'),
    [selected, setSelected] = useState(today),
    [end, setEnd] = useState(today),
    [celebrate, setCelebrate] = useState('');
  const range = dateRange(preset, today, start, selected, end),
    slots = useMemo(
      () => prayerSlots(db.state.records, s, start, today),
      [JSON.stringify(db.list('prayer_records')), s, start, today],
    ),
    reports = prayerReport(slots),
    selectedSlots = slots.filter((x) => x.day >= range.from && x.day <= range.to);
  const routines = db.list('routines'),
    completions = db.list('routine_completions');
  const progress = db.state.progress;
  const signature = JSON.stringify([
    reports.map((r) => [r.name, r.best, r.current]),
    progress?.streaks,
  ]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const subjects = [
        ...reports.map((r) => ({
          id: 'prayer:' + r.name,
          name:
            r.name === 'Overall'
              ? tr('Overall prayer', 'مجموعی نماز', 'الصلاة الإجمالية')
              : prayerLabel(r.name, s.lang),
          best: r.best,
          current: r.current,
        })),
        ...(progress?.streaks || []).map((r) => ({
          id: 'routine:' + r.routine_id,
          name: routines.find((x) => x.id === r.routine_id)?.data.title || '',
          best: r.best_streak,
          current: r.current_streak,
        })),
      ];
      for (const subject of subjects) {
        const prior = db.list('milestone_events').filter((r) => r.data.subject === subject.id);
        const previous = Math.max(0, ...prior.map((r) => Number(r.data.best || 0)));
        if (subject.best > previous && subject.best >= 1) {
          const id = subject.id + ':best:' + subject.best;
          if (!db.find('milestone_events', id)) {
            await db.put('milestone_events', id, {
              subject: subject.id,
              name: subject.name,
              best: subject.best,
              previous,
              at: new Date().toISOString(),
            });
            if (!cancelled) {
              setCelebrate(
                `${subject.name}: ${subject.best} · ${tr('Previous best', 'سابقہ بہترین', 'الأفضل السابق')}: ${previous}`,
              );
              if (isNative && s.celebrationSound) void Native.deen({ op: 'celebrate' });
              if (s.celebrationHaptic && navigator.vibrate) navigator.vibrate([30, 50, 30]);
            }
          }
        }
      }
      if (!cancelled) props.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [signature]);
  useEffect(() => {
    if (!celebrate) return;
    const id = setTimeout(() => setCelebrate(''), 7000);
    return () => clearTimeout(id);
  }, [celebrate]);
  return (
    <div className="progress-screen">
      <Heading
        title={tr('Progress', 'پیش رفت', 'التقدم')}
        text={tr(
          'Your Personal Journey — a reflection of recorded effort.',
          'آپ کا ذاتی سفر — درج کوشش کی عکاسی۔',
          'رحلتك الشخصية — تأمل في جهودك المسجلة.',
        )}
      />
      <div className="dp-tabs">
        {[
          ['overview', tr('Overview', 'جائزہ', 'نظرة عامة')],
          ['gems', tr('Gems', 'جواہرات', 'الجواهر')],
          ['collectibles', tr('My Collection', 'میرا مجموعہ', 'مجموعتي')],
          ['statistics', tr('Statistics', 'اعداد و شمار', 'الإحصاءات')],
          ['journey', tr('Personal Journey', 'ذاتی سفر', 'الرحلة الشخصية')],
        ].map(([key, label]) => (
          <button
            key={key}
            className={view === key ? 'primary' : 'secondary'}
            onClick={() =>
              ['gems', 'collectibles'].includes(key) ? props.navigate(key) : setView(key)
            }
          >
            {label}
          </button>
        ))}
      </div>
      {props.canGoBack && (
        <button className="text-button subview-back" onClick={props.previousView}>
          ← {tr('Back', 'واپس', 'رجوع')}
        </button>
      )}
      <button className="collection-door" onClick={() => props.navigate('collectibles')}>
        <BookOpen size={30} />
        <span>
          <small>{tr('YOUR COLLECTION', 'آپ کا مجموعہ', 'مجموعتك')}</small>
          <strong>
            {tr(
              'Stories to keep and revisit',
              'محفوظ کہانیاں دوبارہ پڑھیں',
              'قصص تحفظها وتعود إليها',
            )}
          </strong>
          <span>
            {Object.values(db.state.collectibles?.copies || {}).filter((c) => !c.hidden).length}{' '}
            {tr('cards · Open your shelf', 'کارڈ · اپنا مجموعہ کھولیں', 'بطاقات · افتح مجموعتك')}
          </span>
        </span>
        <ArrowUpRight size={23} />
      </button>
      <details className="dp-panel">
        <summary>
          {tr(
            'Personal record preferences',
            '\u0630\u0627\u062a\u06cc \u0631\u06cc\u06a9\u0627\u0631\u0688 \u06a9\u06cc \u062a\u0631\u062c\u06cc\u062d\u0627\u062a',
            '\u062a\u0641\u0636\u064a\u0644\u0627\u062a \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0634\u062e\u0635\u064a',
          )}
        </summary>
        <Toggle
          label={tr(
            'Optional haptic feedback',
            '\u0627\u062e\u062a\u06cc\u0627\u0631\u06cc \u0627\u0631\u062a\u0639\u0627\u0634',
            '\u0627\u0647\u062a\u0632\u0627\u0632 \u0627\u062e\u062a\u064a\u0627\u0631\u064a',
          )}
          value={!!s.celebrationHaptic}
          onChange={(v) => void db.configure({ ...s, celebrationHaptic: v }).then(props.refresh)}
        />
        <Toggle
          label={tr(
            'Optional record sound',
            '\u0631\u06cc\u06a9\u0627\u0631\u0688 \u06a9\u06cc \u0627\u062e\u062a\u06cc\u0627\u0631\u06cc \u0622\u0648\u0627\u0632',
            '\u0635\u0648\u062a \u0627\u062e\u062a\u064a\u0627\u0631\u064a \u0644\u0644\u0631\u0642\u0645',
          )}
          value={!!s.celebrationSound}
          onChange={(v) => void db.configure({ ...s, celebrationSound: v }).then(props.refresh)}
        />
      </details>
      {celebrate && (
        <div role="status" className="dp-celebration">
          <strong>🏆 {tr('New Personal Record!', 'نیا ذاتی ریکارڈ!', 'رقم شخصي جديد!')}</strong>
          <p>{celebrate}</p>
          <button className="icon" onClick={() => setCelebrate('')}>
            ×
          </button>
        </div>
      )}
      <Panel
        title={tr('Your progress', 'اعداد و شمار اور ماہانہ جائزہ', 'الإحصاءات والتأمل الشهري')}
      >
        <details className="calm-advanced">
          <summary>
            {tr(
              'Choose dates',
              '\u062a\u0627\u0631\u06cc\u062e \u06a9\u06d2 \u0641\u0644\u0679\u0631',
              '\u062a\u0635\u0641\u064a\u0629 \u0627\u0644\u062a\u0627\u0631\u064a\u062e',
            )}
          </summary>
          <RangeFilter {...{ preset, setPreset, selected, setSelected, end, setEnd }} />
        </details>
        <p>
          {range.from} — {range.to}
        </p>
        <div className="dp-metrics">
          <span>
            {tr('On-time prayers', 'وقت پر نمازیں', 'صلوات في وقتها')}
            <strong>{selectedSlots.filter((x) => x.status === 'ontime').length}</strong>
          </span>
          <span>
            {tr('Qaza completed', 'قضا ادا', 'قضاء مكتمل')}
            <strong>{selectedSlots.filter((x) => x.status === 'qaza').length}</strong>
          </span>
          <span>
            {tr('Routines completed', 'مکمل معمولات', 'الأوراد المكتملة')}
            <strong>
              {
                completions.filter(
                  (c) =>
                    c.data.completedAt &&
                    dayKey(new Date(c.data.completedAt), s.timezone) >= range.from &&
                    dayKey(new Date(c.data.completedAt), s.timezone) <= range.to,
                ).length
              }
            </strong>
          </span>
        </div>
        <p>
          {tr(
            'Unknown entries are not confirmed missed prayers. Reflection uses recorded actions only; milestones do not represent divine rewards.',
            'غیر درج نمازیں یقینی فوت شدہ نہیں۔ جائزہ صرف درج اعمال کا ہے؛ سنگ میل خدائی اجر کی نمائندگی نہیں کرتے۔',
            'غير المسجل ليس صلاة فائتة مؤكدة. التأمل مبني على الأفعال المسجلة فقط؛ المعالم لا تمثل أجرًا إلهيًا.',
          )}
        </p>
      </Panel>
      <div hidden={view !== 'overview' && view !== 'statistics'}>
        <Panel title={tr('Prayer streaks', 'نماز کا تسلسل', 'تتابع الصلاة')}>
          <div className="streak-cards">
            {reports.map((r) => (
              <div className="streak-stat" key={r.name}>
                <Flame size={18} />
                <span>
                  {r.name === 'Overall'
                    ? tr('Overall daily prayers', 'مجموعی روزانہ نماز', 'الصلوات اليومية الإجمالية')
                    : prayerLabel(r.name, s.lang)}
                </span>
                <strong>
                  {r.current} / {r.best}{' '}
                  {r.name === 'Jummah'
                    ? tr('current / best Fridays', 'موجودہ / بہترین جمعے', 'الحالي / أفضل جمع')
                    : tr('current / best days', 'موجودہ / بہترین دن', 'الحالي / أفضل أيام')}
                </strong>
              </div>
            ))}
          </div>
          <button
            className="secondary progress-report-link"
            onClick={() => props.navigate('prayer/report')}
          >
            {tr('Open Prayer Report', 'نماز کی رپورٹ کھولیں', 'فتح تقرير الصلاة')}
          </button>
          <button className="secondary" onClick={() => props.navigate('protection')}>
            {tr('Secrets', 'راز', 'الأسرار')}
          </button>
        </Panel>
      </div>
      <div hidden={view !== 'statistics'}>
        <Panel title={tr('Activity trends', 'سرگرمیوں کے رجحانات', 'اتجاهات النشاط')}>
          <div
            className="dp-trends"
            role="img"
            aria-label={tr(
              'On-time prayers over the last seven days',
              'گزشتہ سات دن میں وقت پر نمازیں',
              'الصلوات في وقتها خلال سبعة أيام',
            )}
          >
            {Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6)).map((day) => {
              const count = slots.filter((x) => x.day === day && x.status === 'ontime').length;
              return (
                <div key={day}>
                  <span style={{ height: Math.max(4, count * 20) + 'px' }} />
                  <strong>{count}</strong>
                  <small>{day.slice(5)}</small>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel
          title={tr('Routine progress', 'معمولات کے الگ اعداد و شمار', 'إحصاءات مستقلة للأوراد')}
        >
          {routines.map((r) => {
            const stats = progress?.streaks.find((p) => p.routine_id === r.id),
              done = completions.filter(
                (c) =>
                  c.data.routineId === r.id &&
                  dayKey(new Date(c.data.completedAt), r.data.timezone) >= range.from &&
                  dayKey(new Date(c.data.completedAt), r.data.timezone) <= range.to,
              );
            const expected = new Set<string>();
            if (r.data.frequency === 'after_prayer') {
              for (const reset of prayerResetEvents(r.data, db.state.records))
                if (reset.day >= range.from && reset.day <= range.to) expected.add(reset.period);
              if (r.data.startDate >= range.from && r.data.startDate <= range.to)
                expected.add(`${r.data.startDate}:start`);
            }
            for (let day = range.from; day <= range.to; day = shiftDay(day, 1)) {
              const date = zonedDate(day, '23:59', r.data.timezone);
              const definition = scheduleOn(r.data, day);
              if (
                definition.frequency !== 'after_prayer' &&
                day >= definition.startDate &&
                routineDue(definition, date)
              )
                expected.add(periodKey(definition, date));
            }
            const completedPeriods = new Set(
              done.map((c) => c.data.period).filter((p) => expected.has(p)),
            );
            const times = done.slice(-10).map((c) => {
              const p = new Intl.DateTimeFormat('en-GB', {
                timeZone: r.data.timezone,
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
              })
                .format(new Date(c.data.completedAt))
                .split(':')
                .map(Number);
              return p[0] * 60 + p[1];
            });
            const average = times.length
                ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
                : 0,
              scheduled = r.data.time.split(':').map(Number),
              suggest =
                times.length >= 3 && Math.abs(average - scheduled[0] * 60 - scheduled[1]) >= 30;
            const suggested = `${Math.floor(average / 60)
              .toString()
              .padStart(2, '0')}:${(average % 60).toString().padStart(2, '0')}`;
            return (
              <article className="dp-entry" key={r.id}>
                <h3>{r.data.title}</h3>
                <p>
                  {done.length} {tr('completions', 'تکمیل', 'إكمالات')} ·{' '}
                  {expected.size
                    ? Math.min(100, Math.round((completedPeriods.size / expected.size) * 100))
                    : 0}
                  % ·{' '}
                  {stats
                    ? `${tr('Current / best', 'موجودہ / بہترین', 'الحالي / الأفضل')}: ${stats.current_streak} / ${stats.best_streak}`
                    : tr(
                        'Completion history for Nafl and recovery activities',
                        'نفل اور اصلاحی سرگرمیوں کی تکمیل کی تاریخ',
                        'سجل إكمال النافلة وأنشطة التعافي',
                      )}
                </p>
                {suggest && (
                  <p>
                    {tr(
                      'Your recorded completion times suggest',
                      'آپ کے درج اوقات تجویز کرتے ہیں',
                      'تشير أوقات الإكمال المسجلة إلى',
                    )}{' '}
                    {suggested}.{' '}
                    <button
                      className="text-button"
                      onClick={() => {
                        void db
                          .put('routines', r.id, {
                            ...r.data,
                            time: suggested,
                            scheduleHistory: [
                              ...(r.data.scheduleHistory || []),
                              { until: today, schedule: { ...r.data, scheduleHistory: undefined } },
                            ],
                          })
                          .then(props.refresh);
                      }}
                    >
                      {tr(
                        'Use this reminder time',
                        'یہ یاد دہانی وقت اپنائیں',
                        'استخدام وقت التذكير',
                      )}
                    </button>
                  </p>
                )}
              </article>
            );
          })}
        </Panel>
      </div>
      <div hidden={view !== 'journey'}>
        <Panel
          title={tr(
            'Personal records and milestones',
            'ذاتی ریکارڈ اور سنگ میل',
            'الأرقام الشخصية والمعالم',
          )}
        >
          <p>
            {tr(
              'Milestones: 7, 14, 30, 60, 90, 180, 365 days. A break does not erase previous effort or historical bests.',
              'سنگ میل: ۷، ۱۴، ۳۰، ۶۰، ۹۰، ۱۸۰، ۳۶۵ دن۔ تسلسل ٹوٹنے سے سابقہ کوشش یا بہترین ریکارڈ نہیں مٹتا۔',
              'المعالم: ٧، ١٤، ٣٠، ٦٠، ٩٠، ١٨٠، ٣٦٥ يومًا. الانقطاع لا يمحو الجهد أو أفضل الأرقام.',
            )}
          </p>
          {db
            .list('milestone_events')
            .slice(-20)
            .reverse()
            .map((r) => (
              <p key={r.id}>
                🏆 {r.data.name} · {r.data.best} · {r.data.at.slice(0, 10)}
              </p>
            ))}
          <button className="secondary" onClick={() => props.navigate('collectibles')}>
            {tr('My Collection', 'میرا مجموعہ', 'مجموعتي')}
          </button>
        </Panel>
      </div>
    </div>
  );
}
