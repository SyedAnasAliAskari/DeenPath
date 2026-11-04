import { completionSequence } from './completion-feedback';
import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Layers, Check } from 'lucide-react';
import { db } from './store';
import { tr, type SuiteProps } from './deen-ui';
import { prayerLabel } from './i18n';
import { pendingNaflEntries, pendingQazaSlots, historicalQazaRemaining } from './prayer-backlog';
import { prayerSlots } from './deen';
import { dayKey } from './domain';
import { scheduleReminders } from './reminders';
interface Card {
  id: string;
  title: string;
  date: string;
  detail: string;
  action: string;
  complete: () => Promise<unknown>;
  quantity: number;
}
function Pile({ title, items, props }: { title: string; items: Card[]; props: SuiteProps }) {
  const [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false),
    flight = useRef(false),
    pointer = useRef<number | null>(null),
    current = items[Math.min(index, Math.max(0, items.length - 1))];
  const move = (by: number) =>
    setIndex((i) => (items.length ? (i + by + items.length) % items.length : 0));
  async function complete() {
    if (!current || flight.current) return;
    flight.current = true;
    setBusy(true);
    try {
      const receipt = completionSequence();
      await current.complete();
      await scheduleReminders();
      props.refresh();
      if (receipt === completionSequence())
        props.notify(tr('Prayer saved', 'نماز محفوظ ہو گئی', 'تم حفظ الصلاة'));
    } catch (e) {
      props.notify((e as Error).message);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="prayer-pile" aria-label={title}>
      <div className="pile-heading">
        <h2>
          <Layers size={20} />
          {title}
        </h2>
        <span>
          {items.reduce((n, x) => n + x.quantity, 0)} {tr('remaining', 'باقی', 'متبقية')}
        </span>
      </div>
      {current ? (
        <>
          <div className={'pile-cards ' + (items.length > 1 ? 'has-stack' : '')}>
            <article
              className="card prayer-backlog-card"
              key={current.id}
              onPointerDown={(e) => {
                pointer.current = (e.target as HTMLElement).closest('button') ? null : e.clientX;
              }}
              onPointerCancel={() => {
                pointer.current = null;
              }}
              onPointerUp={(e) => {
                if (pointer.current !== null && Math.abs(e.clientX - pointer.current) > 70)
                  move(e.clientX < pointer.current ? 1 : -1);
                pointer.current = null;
              }}
            >
              <span className="eyebrow">{current.date}</span>
              <h3>{current.title}</h3>
              <p>{current.detail}</p>
              <button className="primary" disabled={busy} onClick={() => void complete()}>
                <Check size={18} />
                {current.action}
              </button>
            </article>
          </div>
          <div className="pile-navigation">
            <button
              className="icon"
              aria-label={tr('Previous card', 'پچھلا کارڈ', 'البطاقة السابقة')}
              disabled={items.length < 2 || busy}
              onClick={() => move(-1)}
            >
              <ChevronLeft size={20} />
            </button>
            <span>
              {Math.min(index + 1, items.length)} / {items.length} {tr('cards', 'کارڈز', 'بطاقات')}
            </span>
            <button
              className="icon"
              aria-label={tr('Next card', 'اگلا کارڈ', 'البطاقة التالية')}
              disabled={items.length < 2 || busy}
              onClick={() => move(1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <small className="muted">
            {tr(
              'Swipe to browse. Completed cards leave the stack.',
              'کارڈ دیکھنے کے لیے سلائیڈ کریں۔ تکمیل پر کارڈ ہٹ جاتا ہے۔',
              'اسحب للتصفح. تغادر البطاقة المجموعة عند الإكمال.',
            )}
          </small>
        </>
      ) : (
        <div className="card pile-empty">
          <Check size={25} />
          <p>
            {tr(
              'No pending prayers in this stack.',
              'اس مجموعے میں کوئی نماز باقی نہیں۔',
              'لا توجد صلوات معلقة في هذه المجموعة.',
            )}
          </p>
        </div>
      )}
    </section>
  );
}
export function PrayerBacklog(props: SuiteProps & { mode?: 'qaza' | 'nafl' | 'both'; now?: Date }) {
  const now = props.now || new Date(),
    s = db.state.settings,
    today = dayKey(now, s.timezone),
    start = [
      s.trackingStart || today,
      ...db.list('prayer_records').map((r) => r.data.day),
    ].sort()[0],
    mode = props.mode || 'both';
  const recordKey = JSON.stringify(db.state.records);
  const qazaSlots = useMemo(
    () =>
      mode === 'nafl'
        ? []
        : pendingQazaSlots(prayerSlots(db.state.records, s, start, today, now), now),
    [recordKey, s, start, today, mode, Math.floor(now.getTime() / 60000)],
  );
  const naflEntries = useMemo(
    () => (mode === 'qaza' ? [] : pendingNaflEntries(db.state.records, now)),
    [recordKey, mode, Math.floor(now.getTime() / 60000)],
  );
  const qazas: Card[] =
    mode === 'nafl'
      ? []
      : qazaSlots.map((slot) => ({
          id: slot.id,
          title: prayerLabel(slot.displayPrayer, s.lang),
          date: slot.day,
          detail:
            slot.status === 'unknown'
              ? tr(
                  'Unrecorded — complete here only if this prayer was missed.',
                  'غیر درج شدہ — صرف فوت شدہ نماز کی قضا یہاں درج کریں۔',
                  'غير مسجلة — سجل القضاء هنا فقط إذا فاتتك الصلاة.',
                )
              : tr('Qaza pending', 'قضا باقی', 'قضاء معلق'),
          action: tr('Complete Qaza', 'قضا ادا کریں', 'إكمال القضاء'),
          quantity: 1,
          complete: () => db.applyPrayer('qaza', slot.id),
        }));
  if (mode !== 'nafl')
    for (const r of db.list('qaza_history')) {
      const remaining = historicalQazaRemaining(r);
      if (remaining)
        qazas.push({
          id: r.id,
          title: prayerLabel(r.data.prayer, s.lang),
          date: r.data.date || tr('Earlier Qaza', 'سابقہ قضا', 'قضاء سابق'),
          detail: remaining + ' ' + tr('prayers remaining', 'نمازیں باقی', 'صلوات متبقية'),
          action: tr('Complete one', 'ایک ادا کریں', 'إكمال واحدة'),
          quantity: remaining,
          complete: async () => {
            const latest = db.find('qaza_history', r.id);
            if (!latest || latest.deleted || !historicalQazaRemaining(latest)) return;
            await db.put('qaza_history', r.id, {
              ...latest.data,
              completed: [
                ...(latest.data.completed || []),
                { id: crypto.randomUUID(), at: new Date().toISOString() },
              ],
            });
          },
        });
    }
  const nafl: Card[] =
    mode === 'qaza'
      ? []
      : naflEntries.map((entry) => ({
          id: entry.id,
          title: entry.title,
          date: entry.day,
          detail: entry.target + ' ' + tr('Nafl Rak’ahs', 'نفل رکعات', 'ركعات نافلة'),
          action: tr('Complete Nafl', 'نفل ادا کریں', 'إكمال النافلة'),
          quantity: 1,
          complete: async () => {
            const existing = db.find('routine_completions', entry.id);
            if (existing && !existing.deleted) return;
            await db.put('routine_completions', entry.id, {
              routineId: entry.routineId,
              period: entry.period,
              completedAt: new Date().toISOString(),
            });
          },
        }));
  return (
    <>
      {mode !== 'nafl' && (
        <label className="backlog-start">
          {tr('Include prayers from', 'نمازیں اس تاریخ سے شامل کریں', 'تضمين الصلوات منذ')}
          <input
            aria-label={tr(
              'Include prayers from',
              'نمازیں اس تاریخ سے شامل کریں',
              'تضمين الصلوات منذ',
            )}
            type="date"
            min="2000-01-01"
            max={today}
            value={s.trackingStart || start}
            onChange={(e) => {
              const day = e.target.value;
              if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today || day < '2000-01-01') return;
              void db
                .configure({ ...db.state.settings, trackingStart: day })
                .then(() => props.refresh())
                .catch((error) => props.notify(error.message));
            }}
          />
        </label>
      )}
      <div className="prayer-backlog">
        {mode !== 'nafl' && (
          <Pile
            title={tr('Qaza prayer stack', 'قضا نمازوں کا مجموعہ', 'مجموعة صلوات القضاء')}
            items={qazas}
            props={props}
          />
        )}
        {mode !== 'qaza' && (
          <Pile
            title={tr('Nafl prayer stack', 'نفل نمازوں کا مجموعہ', 'مجموعة النوافل')}
            items={nafl}
            props={props}
          />
        )}
      </div>
    </>
  );
}
