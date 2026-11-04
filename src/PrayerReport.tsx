import { completionSequence } from './completion-feedback';
import { PrayerBacklog } from './PrayerBacklog';
import { useEffect, useMemo, useState } from 'react';
import { db } from './store';
import { dayKey, prayers, prayerNames, prayerState, recordedPrayerWindow } from './domain';
import { prayerLabel } from './i18n';
import { useBack } from './back';
import {
  dateRange,
  prayerSlots,
  prayerReport,
  type RangePreset,
  type Slot,
  completedQaza,
  shiftDay,
} from './deen';
import { Field } from './components';
import { Heading, Panel, tr, saveAction, type SuiteProps } from './deen-ui';
import { scheduleReminders } from './reminders';
export function RangeFilter({
  preset,
  setPreset,
  selected,
  setSelected,
  end,
  setEnd,
}: {
  preset: RangePreset;
  setPreset: (s: RangePreset) => void;
  selected: string;
  setSelected: (s: string) => void;
  end: string;
  setEnd: (s: string) => void;
}) {
  return (
    <div className="dp-filters">
      <Field label={tr('Date range', 'تاریخ کی حد', 'الفترة')}>
        <select value={preset} onChange={(e) => setPreset(e.target.value as RangePreset)}>
          {[
            ['7', 'Last 7 days', 'گزشتہ ۷ دن', 'آخر ٧ أيام'],
            ['30', 'Last 30 days', 'گزشتہ ۳۰ دن', 'آخر ٣٠ يومًا'],
            ['90', 'Last 90 days', 'گزشتہ ۹۰ دن', 'آخر ٩٠ يومًا'],
            ['month', 'Current month', 'موجودہ مہینہ', 'الشهر الحالي'],
            ['previous', 'Previous month', 'گزشتہ مہینہ', 'الشهر السابق'],
            ['selectedMonth', 'Selected month', 'منتخب مہینہ', 'شهر محدد'],
            ['year', 'Selected year', 'منتخب سال', 'سنة محددة'],
            ['custom', 'Custom date range', 'حسب ضرورت تاریخیں', 'فترة مخصصة'],
            ['lifetime', 'Lifetime', 'تمام مدت', 'كل المدة'],
          ].map(([v, en, ur, ar]) => (
            <option key={v} value={v}>
              {tr(en, ur, ar)}
            </option>
          ))}
        </select>
      </Field>
      {['selectedMonth', 'year', 'custom'].includes(preset) && (
        <Field label={tr('From / selected date', 'آغاز / منتخب تاریخ', 'من / التاريخ المحدد')}>
          <input type="date" value={selected} onChange={(e) => setSelected(e.target.value)} />
        </Field>
      )}
      {preset === 'custom' && (
        <Field label={tr('To', 'اختتام', 'إلى')}>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      )}
    </div>
  );
}
const statusLabel = (s: string) =>
  ({
    ontime: tr('On Time', 'وقت پر', 'في الوقت'),
    qaza: tr('Qaza Done', 'قضا ادا', 'قضاء مكتمل'),
    missed: tr('Qaza Pending', 'قضا باقی', 'قضاء معلق'),
    unknown: tr('Unrecorded', 'غیر درج شدہ', 'غير مسجل'),
    open: tr('Window open', 'وقت جاری', 'الوقت متاح'),
    notDue: tr('Not yet due', 'وقت نہیں آیا', 'لم يحن الوقت'),
    na: tr('Not applicable', 'لاگو نہیں', 'غير منطبق'),
  })[s] || s;
export function PrayerReport(
  props: SuiteProps & {
    view: string;
    setView: (next: string) => void;
    previousView: () => boolean;
  },
) {
  const s = db.state.settings,
    today = dayKey(new Date(), s.timezone);
  const earliest =
    db
      .list('prayer_records')
      .map((r) => r.data.day)
      .sort()[0] || today;
  const start = [s.trackingStart || today, earliest].sort()[0];
  const [preset, setPreset] = useState<RangePreset>('30'),
    [selected, setSelected] = useState(today),
    [end, setEnd] = useState(today),
    [detail, setDetail] = useState(''),
    [clock, setClock] = useState(new Date()),
    [month, setMonth] = useState(today.slice(0, 7)),
    [calendarDay, setCalendarDay] = useState(today),
    [saving, setSaving] = useState(false),
    [edit, setEdit] = useState<Slot | null>(null),
    [history, setHistory] = useState<string | null>(null);
  const { view, setView, previousView } = props;
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      if (timer) clearInterval(timer);
      if (document.visibilityState === 'visible') {
        setClock(new Date());
        timer = setInterval(() => setClock(new Date()), 1000);
      }
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  useEffect(() => {
    if (!edit) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    dialog?.querySelector<HTMLElement>('button,input,select')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEdit(null);
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const nodes = [...dialog.querySelectorAll<HTMLElement>('button,input,select,textarea')];
      if (e.shiftKey && document.activeElement === nodes[0]) {
        e.preventDefault();
        nodes.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
        e.preventDefault();
        nodes[0]?.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [edit]);
  const range = dateRange(preset, today, start, selected, end);
  const slots = useMemo(
    () => prayerSlots(db.state.records, s, start, today),
    [
      JSON.stringify(db.list('prayer_records')),
      s,
      start,
      today,
      Math.floor(clock.getTime() / 60000),
    ],
  );
  const filtered = slots.filter((x) => x.day >= range.from && x.day <= range.to),
    rows = prayerReport(filtered),
    lifetime = prayerReport(slots);
  const pending = slots.filter((x) => x.status === 'missed'),
    old = db.list('qaza_history');
  async function correct(slot: Slot, data: Record<string, unknown>) {
    if (data.qazaAt && Date.parse(String(data.qazaAt)) < Date.parse(slot.end))
      throw Error('Qaza completion must follow the prayer window');
    if (data.completedAt && Date.parse(String(data.completedAt)) > Date.now())
      throw Error('Completion cannot be in the future');
    const original = db.find('prayer_records', slot.id)?.data || {};
    await db.put('prayer_records', slot.id, {
      ...original,
      day: slot.day,
      prayer: slot.prayer,
      windowStart: slot.start,
      windowEnd: slot.end,
      timezone: original.timezone || s.timezone,
      completedAt: undefined,
      qazaAt: undefined,
      ...data,
    });
    const q = db.find('qaza_records', slot.id);
    if (data.qazaAt)
      await db.put('qaza_records', slot.id, {
        day: slot.day,
        prayer: slot.prayer,
        qazaAt: data.qazaAt,
      });
    else if (q && !q.deleted) await db.put('qaza_records', slot.id, q.data, true);
    setEdit(null);
    await scheduleReminders();
  }
  const format = (date: Date) =>
    new Intl.DateTimeFormat(s.lang, {
      timeZone: s.timezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  const left = (end: Date) => {
    const n = Math.max(0, Math.ceil((end.getTime() - clock.getTime()) / 1000));
    return [Math.floor(n / 3600), Math.floor((n % 3600) / 60), n % 60]
      .map((v) => String(v).padStart(2, '0'))
      .join(':');
  };
  const changeMonth = (offset: number) => {
    const date = new Date(month + '-15T12:00Z');
    date.setUTCMonth(date.getUTCMonth() + offset);
    setMonth(date.toISOString().slice(0, 7));
  };
  async function recordPrayer(key: string, qaza: boolean) {
    if (saving) return;
    setSaving(true);
    try {
      const receipt = completionSequence();
      await db.applyPrayer(qaza ? 'qaza' : 'prayed', key);
      await scheduleReminders();
      props.refresh();
      if (receipt === completionSequence())
        props.notify(tr('Prayer saved', 'نماز محفوظ ہو گئی', 'تم حفظ الصلاة'));
    } catch (error) {
      props.notify((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const sum = rows.find((r) => r.name === detail);
  useBack(() => {
    if (edit) {
      setEdit(null);
      return true;
    }
    if (previousView()) {
      setDetail('');
      return true;
    }
    return false;
  });
  const calendarSlots = useMemo(
    () =>
      prayerSlots(
        db.state.records,
        s,
        month + '-01',
        shiftDay(
          new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1))
            .toISOString()
            .slice(0, 10),
          -1,
        ),
        clock,
      ),
    [month, s, JSON.stringify(db.list('prayer_records')), Math.floor(clock.getTime() / 60000)],
  );
  const previousPending = old.reduce(
    (n, r) => n + Math.max(0, r.data.quantity - completedQaza(r.data)),
    0,
  );
  return (
    <>
      <Heading
        title={tr('Prayer', 'نماز', 'الصلاة')}
        text={tr(
          'Your prayers, one day at a time.',
          'ہر فرض نماز کا ایک ریکارڈ۔ غیر درج نماز کو فوت شدہ نہیں سمجھا جاتا۔',
          'سجل واحد لكل فريضة. لا نعد غير المسجل فائتًا.',
        )}
      />
      <div className="dp-tabs">
        {[
          ['today', 'Today', 'آج', 'اليوم'],
          ['calendar', 'Calendar', 'کیلنڈر', 'التقويم'],
          ['report', 'Prayer Report', 'نماز کی رپورٹ', 'تقرير الصلاة'],
          ['pending', 'Pending Qaza', 'قضا باقی', 'القضاء المعلق'],
          ['previous', 'Add Previous Qaza', 'سابقہ قضا شامل کریں', 'إضافة قضاء سابق'],
        ].map(([v, en, ur, ar]) => (
          <button
            className={view === v ? 'primary' : 'secondary'}
            key={v}
            onClick={() => {
              setView(v);
              setDetail('');
            }}
          >
            {tr(en, ur, ar)}
          </button>
        ))}
      </div>
      {(view === 'today' || view === 'calendar') && (
        <>
          {view === 'calendar' && (
            <Panel title={tr('Prayer calendar', 'نماز کا کیلنڈر', 'تقويم الصلاة')}>
              <div className="calendar-toolbar">
                <button
                  className="secondary"
                  aria-label={tr('Previous month', 'پچھلا مہینہ', 'الشهر السابق')}
                  onClick={() => changeMonth(-1)}
                >
                  ‹
                </button>
                <strong>
                  {new Intl.DateTimeFormat(s.lang, {
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(month + '-15T12:00Z'))}
                </strong>
                <button
                  className="secondary"
                  aria-label={tr('Next month', 'اگلا مہینہ', 'الشهر التالي')}
                  onClick={() => changeMonth(1)}
                >
                  ›
                </button>
              </div>
              <div className="prayer-calendar">
                {Array.from({ length: new Date(month + '-01T12:00Z').getUTCDay() }, (_, i) => (
                  <span key={'blank' + i} />
                ))}
                {Array.from(
                  {
                    length: new Date(
                      Number(month.slice(0, 4)),
                      Number(month.slice(5, 7)),
                      0,
                    ).getDate(),
                  },
                  (_, i) => {
                    const day = month + '-' + String(i + 1).padStart(2, '0');
                    const records = calendarSlots.filter((x) => x.day === day);
                    return (
                      <button
                        key={day}
                        className={calendarDay === day ? 'selected' : ''}
                        aria-label={
                          day + ' ' + records.map((x) => statusLabel(x.status)).join(', ')
                        }
                        onClick={() => setCalendarDay(day)}
                      >
                        <strong>{new Intl.NumberFormat(s.lang).format(i + 1)}</strong>
                        <span className="day-dots">
                          {records.map((x) => (
                            <i key={x.id} className={x.status} />
                          ))}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
              <div className="calendar-legend">
                {['ontime', 'qaza', 'missed', 'unknown', 'notDue'].map((status) => (
                  <span key={status}>
                    <i className={status} />
                    {statusLabel(status)}
                  </span>
                ))}
              </div>
            </Panel>
          )}
          <Panel
            title={
              view === 'today' ? tr('Today’s prayers', 'آج کی نمازیں', 'صلوات اليوم') : calendarDay
            }
          >
            <div className="today-prayers">
              {[
                ...(view === 'today'
                  ? prayers(shiftDay(today, -1), s).filter((w) => w.start <= clock && clock < w.end)
                  : []),
                ...prayers(view === 'today' ? today : calendarDay, s),
              ].map((calculated) => {
                const w = recordedPrayerWindow(
                  calculated,
                  db.find('prayer_records', calculated.key),
                );
                const status = prayerState(w, db.find('prayer_records', w.key), clock);
                const slot = prayerSlots(
                  db.state.records,
                  s,
                  w.key.slice(0, 10),
                  w.key.slice(0, 10),
                  clock,
                ).find((x) => x.id === w.key)!;
                return (
                  <article key={w.key} className={'today-prayer ' + status}>
                    <div>
                      <h3>{prayerLabel(slot.displayPrayer, s.lang)}</h3>
                      <span>
                        {format(new Date(slot.start))} – {format(new Date(slot.end))}
                      </span>
                      {w.key.slice(0, 10) !== today && view === 'today' && (
                        <small>{w.key.slice(0, 10)}</small>
                      )}
                      <small>{statusLabel(slot.status)}</small>
                    </div>
                    {status === 'pending' && (
                      <strong
                        className={
                          'live-time ' +
                          (w.end.getTime() - clock.getTime() < 900000 ? 'urgency' : '')
                        }
                      >
                        {left(w.end)}
                      </strong>
                    )}
                    <div className="actions">
                      {!['ontime', 'qaza', 'na', 'upcoming'].includes(status) && (
                        <button
                          type="button"
                          className="primary"
                          disabled={saving}
                          onClick={() => void recordPrayer(w.key, clock >= w.end)}
                        >
                          {clock >= w.end
                            ? tr('Complete Qaza', 'قضا ادا کریں', 'إكمال القضاء')
                            : tr('I Prayed', 'نماز ادا کر لی', 'صليت')}
                        </button>
                      )}
                      <button className="text-button" onClick={() => setEdit(slot)}>
                        {tr('Details / correct', 'تفصیل / تصحیح', 'تفاصيل / تصحيح')}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="muted">
              {tr(
                'Isha ends at the configured night boundary:',
                'عشاء کی مقررہ آخری حد:',
                'نهاية العشاء حسب الإعداد:',
              )}{' '}
              {s.ishaEnd === 'fajr'
                ? tr('next Fajr', 'اگلی فجر', 'الفجر التالي')
                : tr(
                    'midpoint between Maghrib and next Fajr',
                    'مغرب اور اگلی فجر کا درمیانی وقت',
                    'منتصف الوقت بين المغرب والفجر التالي',
                  )}
            </p>
          </Panel>
        </>
      )}
      {view === 'today' && <PrayerBacklog {...props} now={clock} mode="qaza" />}
      {view === 'report' && (
        <>
          <Panel collapsible title={tr('Tracking period', 'نگرانی کی مدت', 'فترة التتبع')}>
            <Field label={tr('Tracking start date', 'آغاز کی تاریخ', 'تاريخ البداية')}>
              <input
                type="date"
                min="2000-01-01"
                max={today}
                value={start}
                onChange={(e) =>
                  saveAction(() => db.configure({ ...s, trackingStart: e.target.value }), props)
                }
              />
            </Field>
            <RangeFilter {...{ preset, setPreset, selected, setSelected, end, setEnd }} />
            <p className="muted">
              {range.from} — {range.to}
            </p>
          </Panel>
          <Panel title={tr('Prayer Report', 'نماز کی رپورٹ', 'تقرير الصلاة')}>
            <div className="dp-table-wrap">
              <table className="dp-table">
                <thead>
                  <tr>
                    {[
                      tr('Prayer', 'نماز', 'الصلاة'),
                      tr('Total', 'کل', 'الإجمالي'),
                      tr('On Time', 'وقت پر', 'في الوقت'),
                      tr('Qaza Done', 'قضا ادا', 'قضاء مكتمل'),
                      tr('Qaza Pending', 'قضا باقی', 'قضاء معلق'),
                      tr('Current Streak', 'موجودہ تسلسل', 'التتابع الحالي'),
                      tr('Best Streak', 'بہترین تسلسل', 'أفضل تتابع'),
                      tr('Unrecorded', 'غیر درج شدہ', 'غير مسجل'),
                    ].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name}>
                      <th>
                        <button
                          className="text-button"
                          onClick={() => {
                            setDetail(r.name);
                            setView('details');
                            window.scrollTo({ top: 0 });
                          }}
                        >
                          {r.name === 'Overall'
                            ? tr('Overall', 'مجموعی', 'الإجمالي')
                            : prayerLabel(r.name, s.lang)}
                        </button>
                      </th>
                      <td data-label={tr('Total', 'کل', 'الإجمالي')}>{r.total}</td>
                      <td data-label={tr('On Time', 'وقت پر', 'في الوقت')}>{r.ontime}</td>
                      <td data-label={tr('Qaza Done', 'قضا ادا', 'قضاء مكتمل')}>{r.qaza}</td>
                      <td data-label={tr('Qaza Pending', 'قضا باقی', 'قضاء معلق')}>{r.missed}</td>
                      <td data-label={tr('Current Streak', 'موجودہ تسلسل', 'التتابع الحالي')}>
                        {lifetime.find((l) => l.name === r.name)?.current}
                      </td>
                      <td data-label={tr('Best Streak', 'بہترین تسلسل', 'أفضل تتابع')}>
                        {lifetime.find((l) => l.name === r.name)?.best}
                      </td>
                      <td data-label={tr('Unrecorded', 'غیر درج شدہ', 'غير مسجل')}>{r.unknown}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">
              {tr(
                'Totals follow the selected period; streaks cover the full tracking history. Overall totals count prayer slots; overall streaks count complete days. Previous Qaza is separate.',
                'کل منتخب مدت کے ہیں؛ تسلسل مکمل تاریخ کا ہے۔ مجموعی کل نمازیں ہیں اور تسلسل مکمل دن ہیں۔ سابقہ قضا الگ ہے۔',
                'المجاميع للفترة المحددة والتتابع لكل السجل. الإجمالي يعد الصلوات والتتابع يعد الأيام المكتملة. القضاء السابق منفصل.',
              )}
            </p>
          </Panel>
          <Panel
            collapsible
            title={tr(
              'Date-by-date entries and corrections',
              'تاریخ وار اندراج اور تصحیح',
              'السجل والتصحيح حسب التاريخ',
            )}
          >
            <Field label={tr('Date', 'تاریخ', 'التاريخ')}>
              <input
                type="date"
                min={start}
                max={today}
                value={history || today}
                onChange={(e) => setHistory(e.target.value)}
              />
            </Field>
            {slots
              .filter((x) => x.day === (history || today))
              .map((slot) => (
                <div className="dp-row" key={slot.id}>
                  <span>
                    {prayerLabel(slot.displayPrayer, s.lang)}
                    <small>{statusLabel(slot.status)}</small>
                  </span>
                  <button className="secondary" onClick={() => setEdit(slot)}>
                    {tr('Correct', 'درست کریں', 'تصحيح')}
                  </button>
                </div>
              ))}
          </Panel>
        </>
      )}
      {view === 'details' && detail && sum && (
        <Panel
          title={
            detail === 'Overall'
              ? tr('Overall details', 'مجموعی تفصیل', 'التفاصيل الإجمالية')
              : prayerLabel(detail, s.lang)
          }
        >
          <button
            className="text-button section-back"
            onClick={() => {
              previousView();
            }}
          >
            {tr(
              'Back to report',
              '\u0631\u067e\u0648\u0631\u0679 \u067e\u0631 \u0648\u0627\u067e\u0633',
              '\u0627\u0644\u0639\u0648\u062f\u0629 \u0644\u0644\u062a\u0642\u0631\u064a\u0631',
            )}
          </button>
          <p>
            {tr('On-time consistency', 'وقت کی پابندی', 'الانتظام في الوقت')}:{' '}
            {sum.total ? Math.round((sum.ontime / sum.total) * 100) : 0}% ·{' '}
            {tr('Completion', 'تکمیل', 'الإكمال')}:{' '}
            {sum.total ? Math.round(((sum.ontime + sum.qaza) / sum.total) * 100) : 0}%
          </p>
          <div className="dp-heatmap">
            {filtered
              .filter((x) => detail === 'Overall' || x.displayPrayer === detail)
              .map((slot) => (
                <button
                  key={slot.id}
                  className={'dp-day ' + slot.status}
                  title={slot.day + ' ' + slot.prayer + ' ' + statusLabel(slot.status)}
                  onClick={() => setEdit(slot)}
                >
                  {slot.day.slice(8)}
                  <small>{statusLabel(slot.status)}</small>
                </button>
              ))}
          </div>
        </Panel>
      )}
      {view === 'pending' && (
        <>
          <Panel
            title={`${tr('Pending Qaza', 'قضا باقی', 'القضاء المعلق')}: ${pending.length + previousPending}`}
          >
            <p>
              {tr('Current tracking period', 'موجودہ مدت', 'فترة التتبع')}: {pending.length} ·{' '}
              {tr('Previous Qaza', 'سابقہ قضا', 'قضاء سابق')}: {previousPending}
            </p>
            {prayerNames.map((p) => (
              <p key={p}>
                {prayerLabel(p, s.lang)}:{' '}
                {pending.filter((x) => x.prayer === p).length +
                  old
                    .filter((r) => r.data.prayer === p)
                    .reduce((n, r) => n + r.data.quantity - completedQaza(r.data), 0)}
              </p>
            ))}
          </Panel>
          <PrayerBacklog {...props} mode="qaza" now={clock} />
        </>
      )}
      {view === 'previous' && (
        <>
          <Panel title={tr('Add Previous Qaza', 'سابقہ قضا شامل کریں', 'إضافة قضاء سابق')}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  form = e.currentTarget;
                saveAction(async () => {
                  await db.put('qaza_history', crypto.randomUUID(), {
                    prayer: f.get('prayer'),
                    quantity: Number(f.get('quantity')),
                    date: f.get('date') || null,
                    notes: f.get('notes'),
                    origin: 'previous',
                    completed: [],
                  });
                  form.reset();
                }, props);
              }}
            >
              <Field label={tr('Prayer', 'نماز', 'الصلاة')}>
                <select name="prayer">
                  {prayerNames.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label={tr('Quantity', 'تعداد', 'العدد')}>
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  max="100000"
                  defaultValue="1"
                  required
                />
              </Field>
              <Field
                label={tr(
                  'Original date (optional)',
                  'اصل تاریخ (اختیاری)',
                  'التاريخ الأصلي (اختياري)',
                )}
              >
                <input name="date" type="date" max={shiftDay(start, -1)} />
              </Field>
              <Field label={tr('Notes', 'نوٹ', 'ملاحظات')}>
                <textarea name="notes" maxLength={2000} />
              </Field>
              <button className="primary">{tr('Save', 'محفوظ کریں', 'حفظ')}</button>
            </form>
          </Panel>
          <Panel
            collapsible
            title={tr('Previous Qaza history', 'سابقہ قضا کی تاریخ', 'سجل القضاء السابق')}
          >
            {old.map((r) => (
              <article className="dp-entry" key={r.id}>
                <strong>
                  {prayerLabel(r.data.prayer, s.lang)} · {r.data.quantity}
                </strong>
                <p>{r.data.notes}</p>
                <p>
                  {tr('Completed', 'ادا شدہ', 'مكتمل')}: {completedQaza(r.data)}
                </p>
                <div className="actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      const value = prompt(
                        tr('Correct quantity', 'تعداد درست کریں', 'تصحيح العدد'),
                        String(r.data.quantity),
                      );
                      if (
                        value &&
                        Number.isInteger(Number(value)) &&
                        Number(value) >= completedQaza(r.data) &&
                        Number(value) > 0
                      )
                        saveAction(
                          () =>
                            db.put('qaza_history', r.id, { ...r.data, quantity: Number(value) }),
                          props,
                        );
                    }}
                  >
                    {tr('Correct', 'درست کریں', 'تصحيح')}
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      saveAction(
                        () =>
                          db.put('qaza_history', r.id, {
                            ...r.data,
                            completed: [
                              {
                                id: crypto.randomUUID(),
                                at: new Date().toISOString(),
                                quantity: r.data.quantity,
                              },
                            ],
                          }),
                        props,
                      )
                    }
                  >
                    {tr('Complete group', 'گروپ ادا کریں', 'إكمال المجموعة')}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      if (
                        confirm(tr('Delete this entry?', 'یہ اندراج حذف کریں؟', 'حذف هذا الإدخال؟'))
                      )
                        saveAction(() => db.put('qaza_history', r.id, r.data, true), props);
                    }}
                  >
                    {tr('Delete', 'حذف', 'حذف')}
                  </button>
                </div>
                <details>
                  <summary>
                    {tr(
                      'Edit date and notes',
                      '\u062a\u0627\u0631\u06cc\u062e \u0627\u0648\u0631 \u0646\u0648\u0679 \u0628\u062f\u0644\u06cc\u06ba',
                      '\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0648\u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a',
                    )}
                  </summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      saveAction(
                        () =>
                          db.put('qaza_history', r.id, {
                            ...r.data,
                            date: f.get('date') || null,
                            notes: f.get('notes'),
                          }),
                        props,
                      );
                    }}
                  >
                    <Field
                      label={tr(
                        'Date',
                        '\u062a\u0627\u0631\u06cc\u062e',
                        '\u0627\u0644\u062a\u0627\u0631\u064a\u062e',
                      )}
                    >
                      <input
                        type="date"
                        name="date"
                        max={shiftDay(start, -1)}
                        defaultValue={r.data.date || ''}
                      />
                    </Field>
                    <Field
                      label={tr(
                        'Notes',
                        '\u0646\u0648\u0679',
                        '\u0645\u0644\u0627\u062d\u0638\u0627\u062a',
                      )}
                    >
                      <textarea name="notes" maxLength={2000} defaultValue={r.data.notes} />
                    </Field>
                    <button className="primary">
                      {tr(
                        'Save correction',
                        '\u062a\u0635\u062d\u06cc\u062d \u0645\u062d\u0641\u0648\u0638 \u06a9\u0631\u06cc\u06ba',
                        '\u062d\u0641\u0638 \u0627\u0644\u062a\u0635\u062d\u064a\u062d',
                      )}
                    </button>
                  </form>
                </details>
                {completedQaza(r.data) > 0 && (
                  <button
                    className="secondary"
                    onClick={() =>
                      saveAction(
                        () =>
                          db.put('qaza_history', r.id, {
                            ...r.data,
                            completed: r.data.completed.slice(0, -1),
                          }),
                        props,
                      )
                    }
                  >
                    {tr(
                      'Undo last completion',
                      '\u0622\u062e\u0631\u06cc \u0627\u062f\u0627\u0626\u06cc\u06af\u06cc \u0648\u0627\u067e\u0633 \u06a9\u0631\u06cc\u06ba',
                      '\u062a\u0631\u0627\u062c\u0639 \u0639\u0646 \u0622\u062e\u0631 \u0625\u0643\u0645\u0627\u0644',
                    )}
                  </button>
                )}
                {(r.data.completed || []).slice(-10).map((c: { id: string; at: string }) => (
                  <small key={c.id}>
                    {c.at}
                    <br />
                  </small>
                ))}
              </article>
            ))}
          </Panel>
        </>
      )}
      {edit && (
        <div className="modal-backdrop">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tr('Correct prayer', 'نماز درست کریں', 'تصحيح الصلاة')}
            className="modal"
          >
            <button className="icon modal-close" onClick={() => setEdit(null)}>
              ×
            </button>
            <h2>
              {edit.day} · {prayerLabel(edit.displayPrayer, s.lang)}
            </h2>
            <p>{statusLabel(edit.status)}</p>
            {edit.friday && (
              <p>
                {tr(
                  'One midday slot: choose Jumu’ah or Dhuhr according to your circumstances. Consult a scholar for rulings.',
                  'دوپہر کی ایک فرض نماز: اپنے حالات کے مطابق جمعہ یا ظہر منتخب کریں۔ مسائل کے لیے عالم سے رجوع کریں۔',
                  'فريضة واحدة وقت الظهر: اختر الجمعة أو الظهر بحسب ظروفك واستشر عالمًا للأحكام.',
                )}
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  status = f.get('status');
                const at = f.get('at')
                  ? new Date(String(f.get('at'))).toISOString()
                  : new Date().toISOString();
                if (
                  status === 'ontime' &&
                  (Date.parse(at) < Date.parse(edit.start) ||
                    Date.parse(at) >= Date.parse(edit.end))
                ) {
                  props.notify(
                    tr(
                      'Completion must be inside the recorded prayer window.',
                      'ادائیگی درج وقت کے اندر ہونی چاہیے۔',
                      'يجب أن يكون الإكمال ضمن وقت الصلاة المسجل.',
                    ),
                  );
                  return;
                }
                saveAction(
                  () =>
                    correct(edit, {
                      status: status === 'ontime' ? 'recorded' : status,
                      completedAt: status === 'ontime' ? at : undefined,
                      qazaAt: status === 'qaza' ? at : undefined,
                      midday: f.get('midday'),
                    }),
                  props,
                );
              }}
            >
              <Field label={tr('Status', 'حالت', 'الحالة')}>
                <select
                  name="status"
                  defaultValue={
                    edit.status === 'open' || edit.status === 'notDue' ? 'unknown' : edit.status
                  }
                >
                  {['ontime', 'qaza', 'missed', 'unknown', 'na'].map((v) => (
                    <option key={v} value={v}>
                      {statusLabel(v)}
                    </option>
                  ))}
                </select>
              </Field>
              {edit.friday && (
                <Field label={tr('Midday prayer', 'دوپہر کی نماز', 'صلاة منتصف النهار')}>
                  <select
                    name="midday"
                    defaultValue={db.find('prayer_records', edit.id)?.data.midday || 'Jumuah'}
                  >
                    <option>Dhuhr</option>
                    <option>Jumuah</option>
                  </select>
                </Field>
              )}
              <Field
                label={tr('Actual completion time', 'ادائیگی کا اصل وقت', 'وقت الإكمال الفعلي')}
              >
                <input name="at" type="datetime-local" />
              </Field>
              <p className="muted">
                {new Date(edit.start).toLocaleString()} — {new Date(edit.end).toLocaleString()}
              </p>
              <button className="primary">
                {tr('Save correction', 'تصحیح محفوظ کریں', 'حفظ التصحيح')}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
