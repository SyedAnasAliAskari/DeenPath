import { moneyMinor, formatMoney, penaltyPerformed } from './penalties';
import { useEffect, useRef, useState } from 'react';
import {
  LockKeyhole,
  Plus,
  ShieldCheck,
  Flame,
  Star,
  Check,
  Archive,
  Trash2,
  Settings2,
} from 'lucide-react';
import { db } from './store';
import { dayKey } from './domain';
import { Heading, Panel, tr, type SuiteProps } from './deen-ui';
import { Field, Toggle } from './components';
import { usePrivate, Unlock } from './PrivateLife';
import { putPrivate, type PrivateItem } from './private-store';
import {
  deleteSecret,
  answerSecret,
  refreshSecretSchedule,
  completeCharityPenalty,
} from './secrets-store';
import { secretStats, type SecretAnswer } from './secrets-model';
import { useBack } from './back';
import { isNative, Native } from './native';
export function Secrets(props: SuiteProps) {
  const vault = usePrivate(props.notify),
    today = dayKey(new Date(), db.state.settings.timezone),
    [editing, setEditing] = useState<PrivateItem | null>(null),
    [kind, setKind] = useState('tasbih'),
    [busy, setBusy] = useState(false),
    [change, setChange] = useState('');
  const flight = useRef(false);
  const habits = vault.items.filter((x) => x.type === 'habit'),
    active = habits.filter((h) => !h.archived),
    points = habits.reduce((n, h) => n + secretStats(h as any, vault.items, today).points, 0);
  useBack(() => {
    if (editing) {
      setEditing(null);
      return true;
    }
    return false;
  });
  useEffect(() => {
    const listener = () => void vault.load(true);
    window.addEventListener('salahguard:store', listener);
    return () => window.removeEventListener('salahguard:store', listener);
  }, []);
  useEffect(() => {
    setKind(
      ['nafl', 'charity'].includes(editing?.recovery?.kind) ? editing!.recovery.kind : 'tasbih',
    );
  }, [editing?.id]);
  async function act(fn: () => Promise<unknown>) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    try {
      await fn();
      await vault.load(true);
      props.refresh();
    } catch (e) {
      props.notify((e as Error).message);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function removeSecret(h: PrivateItem) {
    if (
      !confirm(
        tr(
          'Delete this secret and its check-in history? Completed prayers and counted Tasbih are kept.',
          'یہ راز اور اس کے اندراجات حذف کریں؟ ادا شدہ نماز اور پڑھی ہوئی تسبیح محفوظ رہیں گی۔',
          'حذف هذا السر وسجل المتابعة؟ تبقى الصلوات والأذكار المنجزة محفوظة.',
        ),
      )
    )
      return;
    await act(async () => {
      await deleteSecret(h.id);
      setEditing((current) => (current?.id === h.id ? null : current));
    });
  }
  async function answer(h: PrivateItem, state: SecretAnswer) {
    await act(async () => {
      const changed = await answerSecret(h.id, today, state);
      setChange('');
      props.notify(
        changed
          ? state === 'avoided'
            ? tr(
                'Avoidance saved · streak updated',
                'اجتناب محفوظ · ایک ایپ پوائنٹ',
                'حفظ الاجتناب · نقطة تطبيق واحدة',
              )
            : tr(
                'Your chosen penalty is ready. Begin again gently.',
                'آپ کا منتخب عہد تیار ہے۔ نرمی سے پھر آغاز کریں۔',
                'التزامك المختار جاهز. ابدأ مجددًا برفق.',
              )
          : tr(
              'This check-in is already saved.',
              'یہ اندراج پہلے محفوظ ہے۔',
              'هذا التسجيل محفوظ مسبقًا.',
            ),
      );
    });
  }
  return (
    <div className="secrets-screen">
      <Heading
        title={tr('Secrets', 'راز', 'الأسرار')}
        text={tr(
          'Private promises. One honest check-in at a time.',
          'نجی عہد۔ روزانہ ایک سچا اندراج۔',
          'عهود خاصة. تسجيل صادق كل يوم.',
        )}
      />
      <section className="privacy-banner">
        <ShieldCheck size={26} />
        <div>
          <strong>
            {tr('Your secrets stay private', 'آپ کے راز نجی رہتے ہیں', 'أسرارك تبقى خاصة')}
          </strong>
          <small>
            {vault.enabled
              ? tr('PIN / biometric protection', 'پن / بایومیٹرک تحفظ', 'حماية بالرمز / البصمة')
              : tr(
                  'Add a PIN or biometric lock in Security.',
                  'تحفظ میں پن یا بایومیٹرک قفل بنائیں۔',
                  'أضف قفل رمز أو بصمة في الأمان.',
                )}
          </small>
        </div>
        <button className="secondary" onClick={() => props.navigate('privacy')}>
          <LockKeyhole size={16} />
          {tr('Security', 'تحفظ', 'الأمان')}
        </button>
      </section>
      {!isNative && (
        <p className="notice">
          {tr(
            'Browser preview: Secrets are session-only. Android keeps them encrypted.',
            'براؤزر میں راز صرف اس سیشن تک ہیں۔ اینڈرائیڈ پر خفیہ محفوظ ہیں۔',
            'معاينة المتصفح مؤقتة؛ أندرويد يحفظ الأسرار مشفرة.',
          )}
        </p>
      )}
      {vault.loading ? (
        <p role="status">{tr('Opening Secrets…', 'راز کھل رہے ہیں…', 'جارٍ فتح الأسرار…')}</p>
      ) : vault.locked ? (
        <Unlock load={vault.load} notify={props.notify} />
      ) : vault.failed ? (
        <p role="alert">
          {tr(
            'Open Security to restore your encrypted recovery backup.',
            'تحفظ میں خفیہ بیک اپ بحال کریں۔',
            'افتح الأمان لاستعادة النسخة المشفرة.',
          )}
        </p>
      ) : (
        <>
          <div className="secrets-summary">
            <div>
              <Star size={19} />
              <strong>{points}</strong>
              <span>{tr('Avoided days', 'اجتناب کے دن', 'أيام الاجتناب')}</span>
            </div>
            <div>
              <Flame size={19} />
              <strong>{active.length}</strong>
              <span>{tr('Private promises', 'نجی عہد', 'عهود خاصة')}</span>
            </div>
            <button
              className="primary"
              onClick={() =>
                setEditing({
                  id: crypto.randomUUID(),
                  type: 'habit',
                  start: today,
                  name: '',
                  description: '',
                })
              }
            >
              <Plus size={17} />
              {tr('Add secret', 'راز شامل کریں', 'إضافة سر')}
            </button>
          </div>
          <details className="card dp-panel">
            <summary>
              {tr('End-of-day Enforcer', 'دن کے اختتام پر یاد دہانی', 'تذكير نهاية اليوم')}
            </summary>
            <Toggle
              label={tr(
                'Ask me at the end of the day',
                'دن کے آخر میں مجھ سے پوچھیں',
                'اسألني في نهاية اليوم',
              )}
              value={!!db.state.settings.privateReminder}
              onChange={(value) =>
                void act(async () => {
                  await db.configure({
                    ...db.state.settings,
                    privateReminder: value,
                    privateTime: db.state.settings.privateTime || '23:00',
                  });
                  await refreshSecretSchedule();
                  if (isNative && value) await Native.requestNotifications();
                })
              }
            />
            <Field label={tr('Daily check-in time', 'روزانہ سوال کا وقت', 'وقت التسجيل اليومي')}>
              <input
                type="time"
                value={db.state.settings.privateTime || '23:00'}
                onChange={(e) =>
                  void act(async () => {
                    await db.configure({ ...db.state.settings, privateTime: e.target.value });
                    await refreshSecretSchedule();
                  })
                }
              />
            </Field>
            <p className="muted">
              {tr(
                'The Enforcer needs overlay access. Locked Secrets ask you to unlock before showing names or saving an answer.',
                'اینفورسر کے لیے اوورلے کی اجازت دیں۔ مقفل راز کھولنے کے بعد نام اور جواب دکھتے ہیں۔',
                'يحتاج التذكير إذن الظهور. افتح الأسرار المقفلة لإظهار الأسماء وحفظ الإجابات.',
              )}
            </p>
            <button className="secondary" onClick={() => props.navigate('settings/reminders')}>
              {tr('Enforcer settings', 'اینفورسر کی ترتیبات', 'إعدادات التذكير')}
            </button>
          </details>
          {vault.items.some(
            (t) => t.type === 'recovery' && t.source === 'secret-checkin' && t.createdAt,
          ) && (
            <Panel title={tr('Your penalties', 'آپ کے عہد', 'التزاماتك')}>
              {vault.items
                .filter(
                  (t) =>
                    t.type === 'recovery' &&
                    t.source === 'secret-checkin' &&
                    t.createdAt &&
                    t.state !== 'dismissed',
                )
                .map((task) => {
                  const done = penaltyPerformed(task, db.state.records),
                    overdue = Date.parse(task.dueAt) <= Date.now();
                  return (
                    <article className="dp-entry" key={task.id}>
                      <h3>
                        {task.kind === 'charity'
                          ? tr('Charity', 'صدقہ', 'صدقة')
                          : task.kind === 'nafl'
                            ? tr('Nafl penalty', 'نفل کا عہد', 'التزام النافلة')
                            : tr('Tasbih penalty', 'تسبیح کا عہد', 'التزام التسبيح')}
                      </h3>
                      {task.kind === 'charity' && (
                        <p>{formatMoney(task.amountMinor, task.currency)}</p>
                      )}
                      <p>
                        {done
                          ? tr('Completed', 'مکمل', 'مكتمل')
                          : overdue
                            ? tr('Overdue', 'وقت گزر گیا', 'متأخر')
                            : tr('Pending', 'باقی', 'معلق')}{' '}
                        · {tr('Due', 'آخری وقت', 'الموعد')}: {new Date(task.dueAt).toLocaleString()}
                      </p>
                      {!done &&
                        (task.kind === 'charity' ? (
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={() => void act(() => completeCharityPenalty(task.id))}
                          >
                            {tr('Mark charity given', 'صدقہ ادا کر دیا', 'تسجيل تقديم الصدقة')}
                          </button>
                        ) : (
                          <button className="secondary" onClick={() => props.navigate('routines')}>
                            {tr('Open routine', 'معمول کھولیں', 'فتح الورد')}
                          </button>
                        ))}
                    </article>
                  );
                })}
            </Panel>
          )}
          {editing && (
            <Panel title={tr('Your private promise', 'آپ کا نجی عہد', 'عهدك الخاص')}>
              <form
                className="secret-form"
                key={editing.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(async () => {
                    await putPrivate({
                      ...editing,
                      name: String(f.get('name')).trim(),
                      description: String(f.get('description') || '').trim(),
                      recovery: {
                        kind,
                        title: String(f.get('penaltyText') || '').trim(),
                        target: kind === 'charity' ? 1 : Number(f.get('target')),
                        ...(kind === 'charity'
                          ? {
                              amountMinor: moneyMinor(String(f.get('amount'))),
                              currency: String(f.get('currency') || 'PKR')
                                .trim()
                                .toUpperCase(),
                            }
                          : {}),
                        perOccurrence: false,
                      },
                    });
                    await db.configure({
                      ...db.state.settings,
                      privateReminder: f.get('remind') === 'on',
                      privateTime: String(f.get('time') || '23:00'),
                    });
                    await refreshSecretSchedule();
                    setEditing(null);
                  });
                }}
              >
                <Field label={tr('Secret name', 'راز کا نام', 'اسم السر')}>
                  <input name="name" required maxLength={160} defaultValue={editing.name} />
                </Field>
                <Field label={tr('Description', 'تفصیل', 'الوصف')}>
                  <textarea
                    name="description"
                    rows={3}
                    maxLength={2000}
                    defaultValue={editing.description || ''}
                  />
                </Field>
                <fieldset className="private-form-section">
                  <legend>
                    {tr(
                      'Chosen penalty if I do it',
                      'اگر مجھ سے ہوا تو منتخب عہد',
                      'الالتزام المختار إذا فعلته',
                    )}
                  </legend>
                  <Field label={tr('Penalty', 'عہد', 'الالتزام')}>
                    <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                      <option value="charity">{tr('Charity', 'صدقہ', 'صدقة')}</option>
                      <option value="tasbih">{tr('Tasbih', 'تسبیح', 'تسبيح')}</option>
                      <option value="nafl">{tr('Nafl prayers', 'نفل نماز', 'صلاة النافلة')}</option>
                    </select>
                  </Field>
                  {kind === 'tasbih' && (
                    <Field label={tr('Tasbih text', 'تسبیح کا متن', 'نص التسبيح')}>
                      <textarea
                        name="penaltyText"
                        required
                        maxLength={3000}
                        defaultValue={editing.recovery?.title || 'أَسْتَغْفِرُ اللَّهَ'}
                      />
                    </Field>
                  )}
                  {kind !== 'charity' && (
                    <>
                      {' '}
                      <Field
                        label={
                          kind === 'nafl'
                            ? tr('Number of Rak’ahs', 'رکعات کی تعداد', 'عدد الركعات')
                            : tr('Tasbih target', 'تسبیح کا ہدف', 'عدد التسبيح')
                        }
                      >
                        <input
                          key={kind}
                          type="number"
                          name="target"
                          required
                          min={kind === 'nafl' ? 2 : 1}
                          step={kind === 'nafl' ? 2 : 1}
                          max={100000}
                          defaultValue={
                            editing.recovery?.kind === kind
                              ? editing.recovery.target
                              : kind === 'nafl'
                                ? 2
                                : 100
                          }
                        />
                      </Field>
                    </>
                  )}
                  {kind === 'charity' && (
                    <div className="field-grid">
                      <Field label={tr('Charity amount', 'صدقے کی رقم', 'مبلغ الصدقة')}>
                        <input
                          name="amount"
                          type="number"
                          min="0.01"
                          max="999999999.99"
                          step="0.01"
                          required
                          defaultValue={
                            editing.recovery?.amountMinor ? editing.recovery.amountMinor / 100 : 100
                          }
                        />
                      </Field>
                      <Field label={tr('Currency', 'کرنسی', 'العملة')}>
                        <input
                          name="currency"
                          maxLength={3}
                          minLength={3}
                          pattern="[A-Za-z]{3}"
                          required
                          defaultValue={editing.recovery?.currency || 'PKR'}
                        />
                      </Field>
                    </div>
                  )}
                  <p className="muted">
                    {tr(
                      'New penalties are due in 24 hours. Private reminders arrive every 4 hours until the deadline or completion. Charity is a record of your own donation; the app does not transfer money.',
                      'نیا عہد ۲۴ گھنٹوں میں مکمل کریں۔ تکمیل یا آخری وقت تک ہر ۴ گھنٹے نجی یاد دہانی آئے گی۔ صدقہ آپ خود دیتے ہیں؛ ایپ صرف ریکارڈ رکھتی ہے۔',
                      'الالتزام الجديد مستحق خلال ٢٤ ساعة، مع تذكير خاص كل ٤ ساعات حتى الإنجاز أو الموعد. تسجل الصدقة التي تقدمها بنفسك.',
                    )}
                  </p>
                  <p className="muted">
                    {tr(
                      'Only the chosen penalty appears in Prayer or Tasbih. Your secret name and description stay here.',
                      'صرف منتخب عہد نماز یا تسبیح میں نظر آئے گا۔ راز کا نام اور تفصیل یہیں رہیں گے۔',
                      'يظهر الالتزام فقط في الصلاة أو التسبيح. يبقى اسم السر ووصفه هنا.',
                    )}
                  </p>
                </fieldset>
                <label className="toggle">
                  {tr('End-of-day reminder', 'دن کے آخر میں یاد دہانی', 'تذكير نهاية اليوم')}
                  <input
                    type="checkbox"
                    name="remind"
                    defaultChecked={db.state.settings.privateReminder ?? true}
                  />
                </label>
                <Field
                  label={tr('Daily check-in time', 'روزانہ سوال کا وقت', 'وقت التسجيل اليومي')}
                >
                  <input
                    type="time"
                    name="time"
                    required
                    defaultValue={db.state.settings.privateTime || '23:00'}
                  />
                </Field>
                <div className="actions">
                  <button className="primary" disabled={busy}>
                    {tr('Save secret', 'راز محفوظ کریں', 'حفظ السر')}
                  </button>
                  <button className="secondary" type="button" onClick={() => setEditing(null)}>
                    {tr('Cancel', 'منسوخ', 'إلغاء')}
                  </button>
                </div>
              </form>
            </Panel>
          )}
          <div className="secret-cards">
            {active.map((h) => {
              const stats = secretStats(h as any, vault.items, today),
                check = vault.items.find(
                  (x) => x.type === 'checkin' && x.habitId === h.id && x.day === today,
                ),
                answered = check && ['avoided', 'slipped'].includes(check.state),
                notStarted = h.start > today;
              return (
                <article className="secret-card card" key={h.id}>
                  <div className="secret-card-heading">
                    <span className="eyebrow">
                      <LockKeyhole size={13} />
                      {tr('PRIVATE', 'نجی', 'خاص')}
                    </span>
                    <button
                      className="icon"
                      aria-label={tr('Edit secret', 'راز کی ترمیم', 'تعديل السر')}
                      onClick={() => setEditing(h)}
                    >
                      <Settings2 size={17} />
                    </button>
                  </div>
                  <h2>{h.name}</h2>
                  <p className="preserve-lines">{h.description}</p>
                  <div className="secret-card-stats">
                    <span>
                      <Flame size={15} />
                      {stats.current} {tr('day streak', 'دن کا تسلسل', 'أيام متتالية')}
                    </span>
                    <span>
                      <Star size={15} />
                      {stats.points} {tr('avoided days', 'اجتناب کے دن', 'أيام الاجتناب')}
                    </span>
                  </div>
                  <p className="secret-penalty">
                    {tr('Penalty', 'عہد', 'الالتزام')}:{' '}
                    {h.recovery?.kind === 'charity'
                      ? formatMoney(h.recovery.amountMinor || 0, h.recovery.currency || 'PKR')
                      : h.recovery?.target || 0}{' '}
                    {h.recovery?.kind === 'charity'
                      ? tr('Charity', 'صدقہ', 'صدقة')
                      : h.recovery?.kind === 'nafl'
                        ? tr('Rak’ahs in Prayer', 'رکعات نماز میں', 'ركعات في الصلاة')
                        : tr('counts in Tasbih', 'گنتی تسبیح میں', 'عدّات في التسبيح')}
                  </p>
                  {notStarted ? (
                    <p>{h.start}</p>
                  ) : answered && change !== h.id ? (
                    <div className="secret-answer">
                      <Check size={19} />
                      <strong>
                        {check.state === 'avoided'
                          ? tr(
                              'Avoided today · streak updated',
                              'آج اجتناب · ایک ایپ پوائنٹ',
                              'اجتنبت اليوم · نقطة تطبيق',
                            )
                          : tr(
                              'Penalty added. A fresh start is possible.',
                              'عہد شامل ہو گیا۔ پھر آغاز ممکن ہے۔',
                              'أضيف الالتزام. يمكنك البدء مجددًا.',
                            )}
                      </strong>
                      <button className="text-button" onClick={() => setChange(h.id)}>
                        {tr('Correct today’s answer', 'آج کا جواب درست کریں', 'تصحيح إجابة اليوم')}
                      </button>
                    </div>
                  ) : (
                    <div className="secret-question">
                      <h3>
                        {tr(
                          'Did you do this deed today?',
                          'کیا آج آپ سے یہ عمل ہوا؟',
                          'هل فعلت هذا اليوم؟',
                        )}
                      </h3>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => void answer(h, 'avoided')}
                      >
                        {tr('No, I avoided it', 'نہیں، میں نے اجتناب کیا', 'لا، تجنبته')}
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => void answer(h, 'slipped')}
                      >
                        {tr('Yes, I did', 'ہاں، مجھ سے ہوا', 'نعم، فعلته')}
                      </button>
                    </div>
                  )}
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        confirm(
                          tr(
                            'Archive this secret and stop its future check-ins?',
                            'یہ راز محفوظ کر کے آئندہ سوال بند کریں؟',
                            'أرشفة هذا السر وإيقاف تسجيلاته؟',
                          ),
                        )
                      )
                        void act(async () => {
                          await putPrivate({ ...h, archived: true });
                          await refreshSecretSchedule();
                        });
                    }}
                  >
                    <Archive size={14} />
                    {tr('Archive', 'محفوظ کریں', 'أرشفة')}
                  </button>
                  <button
                    className="text-button danger"
                    disabled={busy}
                    onClick={() => void removeSecret(h)}
                  >
                    <Trash2 size={14} />
                    {tr('Delete secret', 'راز حذف کریں', 'حذف السر')}
                  </button>
                </article>
              );
            })}
          </div>
          {!active.length && !editing && (
            <div className="routine-empty">
              <ShieldCheck size={36} />
              <h3>
                {tr(
                  'Start with one private promise',
                  'ایک نجی عہد سے آغاز کریں',
                  'ابدأ بعهد خاص واحد',
                )}
              </h3>
              <p>
                {tr(
                  'Name the habit, describe your intention and choose your penalty.',
                  'عادت کا نام، ارادہ اور عہد منتخب کریں۔',
                  'سمّ العادة وصف نيتك واختر التزامك.',
                )}
              </p>
            </div>
          )}
          {(habits.some((h) => h.archived) ||
            vault.items.some(
              (x) => x.type === 'recovery' && !x.routineId && x.kind !== 'charity',
            )) && (
            <details className="card dp-panel">
              <summary>
                {tr('Earlier private records', 'پرانے نجی اندراجات', 'السجلات الخاصة السابقة')}
              </summary>
              {habits
                .filter((h) => h.archived)
                .map((h) => (
                  <p key={h.id}>
                    {h.name}
                    <button
                      className="text-button"
                      onClick={() =>
                        void act(async () => {
                          await putPrivate({ ...h, archived: false });
                          await refreshSecretSchedule();
                        })
                      }
                    >
                      {tr('Restore', 'بحال کریں', 'استعادة')}
                    </button>
                    <button className="text-button danger" onClick={() => void removeSecret(h)}>
                      {tr('Delete secret', 'راز حذف کریں', 'حذف السر')}
                    </button>
                  </p>
                ))}
              {vault.items.some(
                (x) => x.type === 'recovery' && !x.routineId && x.kind !== 'charity',
              ) && (
                <button className="secondary" onClick={() => props.navigate('legacy-activities')}>
                  {tr(
                    'Open earlier recovery tasks',
                    'پرانے اصلاحی کام کھولیں',
                    'فتح مهام التعافي السابقة',
                  )}
                </button>
              )}
            </details>
          )}
        </>
      )}
    </div>
  );
}
