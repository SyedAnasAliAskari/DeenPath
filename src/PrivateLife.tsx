import { penaltySchedules } from './penalties';
import { ShieldCheck, Fingerprint, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from './store';
import { Native, isNative } from './native';
import { dayKey, zonedDate, advanceCounter } from './domain';
import { habitStats, recoveryTasks, type Habit, type Checkin, type Recovery } from './deen';
import {
  privateItems,
  putPrivate,
  privacyStatus,
  lockPrivate,
  type PrivateItem,
} from './private-store';
import { tr, Heading, Panel, err, type SuiteProps } from './deen-ui';
import { Field, Toggle } from './components';
import { scheduleReminders } from './reminders';
import { useBack } from './back';

export function usePrivate(notify: (s: string) => void) {
  const [items, setItems] = useState<PrivateItem[]>([]),
    [locked, setLocked] = useState(true),
    [enabled, setEnabled] = useState(false),
    [biometricEnabled, setBiometricEnabled] = useState(false),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false);
  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    try {
      const status = await privacyStatus();
      setEnabled(status.enabled);
      setBiometricEnabled(!!status.biometricEnabled);
      setLocked(!status.unlocked);
      if (status.unlocked) {
        setItems(await privateItems());
        setFailed(false);
      } else setItems([]);
    } catch {
      setItems([]);
      setFailed(true);
      notify(
        tr(
          'Private data could not be decrypted. Restore your recovery backup on a new device.',
          'نجی ڈیٹا نہیں کھل سکا۔ نئے آلے پر اپنی ریکوری بیک اپ بحال کریں۔',
          'تعذر فك البيانات الخاصة. استعد نسخة الاسترداد على الجهاز الجديد.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const hide = () => {
      if (document.visibilityState === 'hidden') {
        setItems([]);
        setLocked(true);
        void lockPrivate();
      } else {
        void load();
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      void lockPrivate();
    };
  }, []);
  useEffect(() => {
    if (locked || !enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => {
          setItems([]);
          setLocked(true);
          void lockPrivate();
        },
        Number(db.state.settings.privateTimeout || 2) * 60000,
      );
    };
    reset();
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [locked, enabled]);
  useEffect(() => {
    if (isNative) void Native.deen({ op: 'privacyScreen', enabled: true });
    return () => {
      if (isNative) void Native.deen({ op: 'privacyScreen', enabled: false });
    };
  }, []);
  return { items, locked, enabled, biometricEnabled, loading, failed, load, setLocked };
}
export function Unlock({
  load,
  notify,
}: {
  load: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [hasPin, setHasPin] = useState(true);
  useEffect(() => {
    void privacyStatus().then((status) => setHasPin(status.pinEnabled !== false));
  }, []);
  async function unlock(op: string, pin?: string) {
    setBusy(true);
    try {
      await Native.deen({ op, pin });
      await load();
    } catch (e) {
      notify(err(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title={tr('Private space is locked', 'نجی جگہ مقفل ہے', 'المساحة الخاصة مقفلة')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const pin = String(new FormData(e.currentTarget).get('pin'));
          void unlock('unlock', pin);
          e.currentTarget.reset();
        }}
      >
        {hasPin && (
          <>
            <Field label={tr('Protection PIN', 'تحفظ کا پن', 'رمز الحماية')}>
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                minLength={6}
                maxLength={12}
                required
                autoComplete="off"
              />
            </Field>
            <button disabled={busy} className="primary">
              {tr('Unlock', 'کھولیں', 'فتح')}
            </button>
          </>
        )}
        <button
          disabled={busy}
          type="button"
          className="secondary"
          onClick={() => void unlock('biometric')}
        >
          {tr('Use biometrics', 'بایومیٹرک استعمال کریں', 'استخدام القياسات الحيوية')}
        </button>
      </form>
    </Panel>
  );
}
export function PrivateLife({
  page,
  ...props
}: SuiteProps & { page: 'protection' | 'journal' | 'activities' | 'privacy' }) {
  const vault = usePrivate(props.notify),
    today = dayKey(new Date(), db.state.settings.timezone);
  const [editing, setEditing] = useState<PrivateItem | null>(null),
    [date, setDate] = useState(today),
    [period, setPeriod] = useState('30'),
    [from, setFrom] = useState(today),
    [trendEnd, setTrendEnd] = useState(today),
    [showSettings, setShowSettings] = useState(page === 'privacy'),
    [selectedHabit, setSelectedHabit] = useState(''),
    [checkinDrafts, setCheckinDrafts] = useState<Record<string, string>>({}),
    [penaltyEnabled, setPenaltyEnabled] = useState(false),
    [activityReminderEnabled, setActivityReminderEnabled] = useState(false),
    [penaltyReminderEnabled, setPenaltyReminderEnabled] = useState(false),
    [activitiesOpen, setActivitiesOpen] = useState(false),
    [saving, setSaving] = useState(false);
  useBack(() => {
    if (editing) {
      setEditing(null);
      return true;
    }
    if (showSettings && page !== 'privacy') {
      setShowSettings(false);
      return true;
    }
    return false;
  });
  useEffect(() => {
    setPenaltyEnabled(!!editing?.recovery);
    setActivityReminderEnabled(!!editing?.time);
    setPenaltyReminderEnabled(!!editing?.recovery?.time);
    if (editing)
      requestAnimationFrame(() =>
        document
          .getElementById('private-editor')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
  }, [editing?.id]);
  const habits = vault.items.filter((x) => x.type === 'habit') as unknown as (Habit &
      PrivateItem)[],
    checks = vault.items.filter((x) => x.type === 'checkin') as unknown as (Checkin &
      PrivateItem)[],
    tasks = vault.items.filter(
      (x) => x.type === 'recovery' && x.kind !== 'charity',
    ) as unknown as (Recovery & PrivateItem)[];
  const activeHabits = habits.filter((h) => !h.archived);
  const shownHabit = activeHabits.find((h) => h.id === selectedHabit)?.id || activeHabits[0]?.id;
  async function action(fn: () => Promise<unknown>) {
    setSaving(true);
    try {
      await fn();
      if (!(await privacyStatus()).unlocked) {
        await vault.load();
        return;
      }
      const current = await privateItems();
      const privateActivityReminders = current
        .filter((x) => x.type === 'recovery' && x.state === 'pending' && (x.postponed || x.time))
        .map((x) => ({
          id: x.id,
          at: x.postponed
            ? Date.parse(x.postponed)
            : zonedDate(x.day, x.time, db.state.settings.timezone).getTime(),
        }))
        .filter((x) => x.at > Date.now());
      db.state.settings.privateActivityReminders = privateActivityReminders;
      db.state.settings.privatePenaltyReminders = penaltySchedules(current, db.state.records);
      const activeHabits = current.filter((x) => x.type === 'habit' && !x.archived);
      db.state.settings.privateCheckinDoneDay =
        activeHabits.length &&
        activeHabits.every((h) =>
          current.some((x) => x.type === 'checkin' && x.habitId === h.id && x.day === today),
        )
          ? today
          : '';
      await db.persist();
      await vault.load(true);
      props.refresh();
      await scheduleReminders();
    } catch (e) {
      props.notify(err(e));
    } finally {
      setSaving(false);
    }
  }
  const title =
    page === 'privacy'
      ? tr('Security and recovery', 'تحفظ اور بحالی', 'الأمان والاسترداد')
      : page === 'journal'
        ? tr('Gratitude Journal', 'شکر گزاری کی ڈائری', 'دفتر الامتنان')
        : page === 'activities'
          ? tr('Personal activities', 'ذاتی سرگرمیاں', 'الأنشطة الشخصية')
          : tr('Personal repentance', 'ذاتی توبہ', 'التوبة الشخصية');
  const start =
    period === 'lifetime'
      ? '2000-01-01'
      : period === 'custom'
        ? from
        : new Date(Date.parse(today + 'T12:00Z') - (Number(period) - 1) * 86400000)
            .toISOString()
            .slice(0, 10);
  return (
    <>
      <Heading
        title={title}
        text={tr(
          'Private, supportive, and at your pace.',
          'نجی، مددگار، اور آپ کی رفتار کے مطابق۔',
          'خصوصية ودعم وفق وتيرتك.',
        )}
      />
      <section className="privacy-banner" aria-label={tr('Security', 'تحفظ', 'الأمان')}>
        <ShieldCheck size={26} />
        <div>
          <strong>{tr('Your private space', 'آپ کی نجی جگہ', 'مساحتك الخاصة')}</strong>
          <small>
            {vault.enabled
              ? tr(
                  'Protected with your PIN or biometrics',
                  'پن یا بایومیٹرک سے محفوظ',
                  'محمي بالرمز أو القياسات الحيوية',
                )
              : tr(
                  'Choose a PIN or biometric lock for private entries.',
                  'پن بنائیں۔ بایومیٹرک سے بھی کھول سکتے ہیں۔',
                  'اختر قفل رمز. يمكن فتحه بالبصمة أيضًا.',
                )}
          </small>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setShowSettings(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <LockKeyhole size={16} />
          {tr('PIN lock', 'پن کا قفل', 'قفل الرمز')}
        </button>
        {isNative && vault.enabled && (
          <button
            className="secondary"
            onClick={() => void action(() => Native.deen({ op: 'biometric' }))}
          >
            <Fingerprint size={17} />
            {tr('Biometrics', 'بایومیٹرک', 'البصمة')}
          </button>
        )}
      </section>
      {!isNative && (
        <p className="notice">
          {tr(
            'Browser preview: private entries exist only in this session. Install Android for encrypted persistence and PIN/biometric protection.',
            'براؤزر میں نجی اندراجات صرف اس سیشن تک ہیں۔ خفیہ محفوظ کاری اور پن کے لیے اینڈرائیڈ ایپ نصب کریں۔',
            'في المتصفح تبقى الإدخالات لهذه الجلسة فقط. ثبّت أندرويد للحفظ المشفر والقفل.',
          )}
        </p>
      )}
      {vault.loading ? (
        <p role="status">
          {tr('Opening private space…', 'نجی جگہ کھل رہی ہے…', 'جارٍ فتح المساحة الخاصة…')}
        </p>
      ) : vault.locked ? (
        <Unlock load={vault.load} notify={props.notify} />
      ) : (
        <>
          <div className="dp-tabs">
            {page === 'protection' && (
              <button
                className="primary"
                onClick={() =>
                  setEditing({ id: crypto.randomUUID(), type: 'habit', name: '', start: today })
                }
              >
                {tr('Add repentance', 'توبہ کا عہد شامل کریں', 'إضافة تعهد توبة')}
              </button>
            )}
            {page !== 'journal' && page !== 'privacy' && (
              <button
                className="primary"
                onClick={() => {
                  setActivitiesOpen(true);
                  setEditing({ id: crypto.randomUUID(), type: 'recovery', day: today });
                }}
              >
                {tr('Add activity', 'سرگرمی شامل کریں', 'إضافة نشاط')}
              </button>
            )}
            <button className="secondary" onClick={() => setShowSettings(!showSettings)}>
              {tr(
                'Privacy & recovery backup',
                'رازداری اور ریکوری بیک اپ',
                'الخصوصية ونسخة الاسترداد',
              )}
            </button>
            {vault.enabled && (
              <button
                className="secondary"
                onClick={() => {
                  void lockPrivate().then(() => vault.load());
                }}
              >
                {tr('Lock now', 'ابھی مقفل کریں', 'قفل الآن')}
              </button>
            )}
          </div>
          {(showSettings || vault.failed) && (
            <Panel title={tr('Privacy settings', 'رازداری کی ترتیبات', 'إعدادات الخصوصية')}>
              <p>
                {tr(
                  'Android encrypts these records before SQLite and cloud sync. Keep an encrypted recovery backup: uninstalling removes the device key. A PIN lock is an additional screen gate. Private text is never sent to Guidance automatically.',
                  'اینڈرائیڈ نجی ریکارڈ کو مقامی اور کلاؤڈ محفوظ کرنے سے پہلے خفیہ کرتا ہے۔ ریکوری بیک اپ رکھیں: ان انسٹال کرنے سے آلے کی کلید مٹ جاتی ہے۔ پن اضافی اسکرین قفل ہے۔ نجی متن خودکار طور پر گائیڈنس کو نہیں بھیجا جاتا۔',
                  'يشفّر أندرويد السجلات قبل الحفظ والمزامنة. احتفظ بنسخة استرداد مشفرة؛ إلغاء التثبيت يمحو مفتاح الجهاز. الرمز قفل إضافي للشاشة. لا ترسل النصوص الخاصة تلقائيًا إلى الإرشاد.',
                )}
              </p>
              {isNative && (
                <>
                  <div className="private-form-section">
                    <h3>{tr('Biometric lock', 'بایومیٹرک قفل', 'القفل الحيوي')}</h3>
                    <p>
                      {tr(
                        'Use your enrolled biometrics. A PIN can be kept as a fallback.',
                        'اندراج شدہ بایومیٹرک استعمال کریں۔ متبادل کے لیے پن رکھ سکتے ہیں۔',
                        'استخدم البصمة المسجلة. يمكنك الاحتفاظ برمز احتياطي.',
                      )}
                    </p>
                    <button
                      type="button"
                      className="secondary"
                      disabled={saving}
                      onClick={() =>
                        void action(() =>
                          Native.deen(
                            vault.biometricEnabled
                              ? { op: 'disableBiometric' }
                              : { op: 'biometric', enable: true },
                          ),
                        )
                      }
                    >
                      <Fingerprint size={17} />
                      {vault.biometricEnabled
                        ? tr(
                            'Disable biometric lock',
                            'بایومیٹرک قفل بند کریں',
                            'تعطيل القفل الحيوي',
                          )
                        : tr(
                            'Enable biometric lock',
                            'بایومیٹرک قفل فعال کریں',
                            'تفعيل القفل الحيوي',
                          )}
                    </button>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void action(() => Native.deen({ op: 'setPin', pin: String(f.get('pin')) }));
                      e.currentTarget.reset();
                    }}
                  >
                    <Field
                      label={tr(
                        'Set / replace PIN (6–12 digits)',
                        'پن بنائیں یا بدلیں (۶ تا ۱۲ ہندسے)',
                        'تعيين / استبدال الرمز (٦–١٢ رقمًا)',
                      )}
                    >
                      <input
                        name="pin"
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]{6,12}"
                        required
                      />
                    </Field>
                    <button className="primary" disabled={saving}>
                      {tr('Save PIN', 'پن محفوظ کریں', 'حفظ الرمز')}
                    </button>
                  </form>
                  {vault.enabled && (
                    <button
                      className="secondary"
                      onClick={() => void action(() => Native.deen({ op: 'setPin', pin: '' }))}
                    >
                      {tr('Disable PIN lock', 'پن قفل بند کریں', 'تعطيل قفل الرمز')}
                    </button>
                  )}
                  <Field
                    label={tr(
                      'Automatic relock (minutes)',
                      'خودکار قفل (منٹ)',
                      'القفل التلقائي (دقائق)',
                    )}
                  >
                    <select
                      defaultValue={db.state.settings.privateTimeout || 2}
                      onChange={(e) =>
                        void action(() =>
                          db.configure({
                            ...db.state.settings,
                            privateTimeout: Number(e.target.value),
                          }),
                        )
                      }
                    >
                      {[1, 2, 5, 10].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const password = String(new FormData(e.currentTarget).get('password'));
                      void action(async () => {
                        const r = await Native.deen({ op: 'backupKey', password });
                        await Native.deen({
                          op: 'exportDocument',
                          value: JSON.stringify({
                            format: 'deenpath-private-backup-v1',
                            owner: db.state.owner,
                            key: r.value,
                            records: db.list('private_records'),
                          }),
                        });
                      });
                    }}
                  >
                    <Field
                      label={tr(
                        'Recovery password (12+ characters)',
                        'ریکوری پاس ورڈ (۱۲ یا زائد حروف)',
                        'كلمة مرور الاسترداد (١٢ حرفًا فأكثر)',
                      )}
                    >
                      <input name="password" type="password" minLength={12} required />
                    </Field>
                    <button className="secondary" disabled={saving}>
                      {tr(
                        'Export encrypted recovery backup',
                        'خفیہ ریکوری بیک اپ برآمد کریں',
                        'تصدير نسخة استرداد مشفرة',
                      )}
                    </button>
                  </form>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void action(async () => {
                        const backup = JSON.parse(await (f.get('file') as File).text());
                        if (
                          backup.format !== 'deenpath-private-backup-v1' ||
                          backup.owner !== db.state.owner
                        )
                          throw Error(
                            tr(
                              'Sign in to the same account before restoring.',
                              'بحال کرنے سے پہلے اسی اکاؤنٹ میں لاگ ان کریں۔',
                              'سجّل دخول الحساب نفسه قبل الاستعادة.',
                            ),
                          );
                        if (
                          !confirm(
                            tr(
                              'Restore this key? Keep a backup of any current private data first.',
                              'یہ کلید بحال کریں؟ موجودہ نجی ڈیٹا کا پہلے بیک اپ رکھیں۔',
                              'استعادة المفتاح؟ احتفظ بنسخة من البيانات الحالية أولًا.',
                            ),
                          )
                        )
                          return;
                        await Native.deen({
                          op: 'restoreKey',
                          password: String(f.get('password')),
                          value: backup.key,
                        });
                        for (const r of backup.records)
                          if (!db.find('private_records', r.id))
                            await db.put('private_records', r.id, r.data);
                      });
                    }}
                  >
                    <Field
                      label={tr('Recovery backup file', 'ریکوری بیک اپ فائل', 'ملف نسخة الاسترداد')}
                    >
                      <input type="file" name="file" accept="application/json" required />
                    </Field>
                    <Field label={tr('Recovery password', 'ریکوری پاس ورڈ', 'كلمة مرور الاسترداد')}>
                      <input name="password" type="password" required />
                    </Field>
                    <button className="secondary" disabled={saving}>
                      {tr(
                        'Restore encrypted backup',
                        'خفیہ بیک اپ بحال کریں',
                        'استعادة النسخة المشفرة',
                      )}
                    </button>
                  </form>
                </>
              )}
            </Panel>
          )}
          {!vault.failed && page !== 'privacy' && (
            <>
              {page === 'journal' ? (
                <>
                  <Panel title={tr('A moment of gratitude', 'شکر کا ایک لمحہ', 'لحظة امتنان')}>
                    <form
                      key={editing?.id || 'new'}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget),
                          form = e.currentTarget;
                        void action(async () => {
                          await putPrivate({
                            id: editing?.id || crypto.randomUUID(),
                            type: 'journal',
                            day: f.get('day'),
                            text: f.get('text'),
                            updatedAt: new Date().toISOString(),
                          });
                          setEditing(null);
                          form.reset();
                        });
                      }}
                    >
                      <Field label={tr('Date', 'تاریخ', 'التاريخ')}>
                        <input
                          name="day"
                          type="date"
                          defaultValue={editing?.day || today}
                          max={today}
                          required
                        />
                      </Field>
                      <Field
                        label={tr(
                          'What are you thankful for?',
                          'آپ کس بات پر شکر گزار ہیں؟',
                          'ما الذي تشعر بالامتنان له؟',
                        )}
                      >
                        <textarea
                          name="text"
                          maxLength={10000}
                          defaultValue={editing?.text}
                          required
                          rows={5}
                        />
                      </Field>
                      <button disabled={saving} className="primary">
                        {tr('Save reflection', 'غور و فکر محفوظ کریں', 'حفظ التأمل')}
                      </button>
                    </form>
                    <p className="muted">
                      {tr(
                        'No streaks, targets, or penalties.',
                        'کوئی تسلسل، ہدف یا جرمانہ نہیں۔',
                        'لا تتابع ولا أهداف ولا عقوبات.',
                      )}
                    </p>
                    <Toggle
                      label={tr(
                        'Optional gentle reminder',
                        'اختیاری نرم یاد دہانی',
                        'تذكير لطيف اختياري',
                      )}
                      value={!!db.state.settings.journalReminder}
                      onChange={(value) =>
                        void action(() =>
                          db.configure({ ...db.state.settings, journalReminder: value }),
                        )
                      }
                    />
                  </Panel>
                  <Panel collapsible title={tr('Your entries', 'آپ کے اندراجات', 'إدخالاتك')}>
                    <Field label={tr('Browse date', 'تاریخ کے مطابق دیکھیں', 'تصفح التاريخ')}>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </Field>
                    <button className="text-button" onClick={() => setDate('')}>
                      {tr('Show all', 'سب دکھائیں', 'عرض الكل')}
                    </button>
                    {vault.items
                      .filter((x) => x.type === 'journal' && (!date || x.day === date))
                      .sort((a, b) => b.day.localeCompare(a.day))
                      .map((x) => (
                        <article key={x.id} className="dp-entry">
                          <strong>{x.day}</strong>
                          <p className="preserve-lines">{x.text}</p>
                          <button className="secondary" onClick={() => setEditing(x)}>
                            {tr('Edit', 'ترمیم', 'تعديل')}
                          </button>
                          <button
                            className="secondary"
                            onClick={() => {
                              if (confirm(tr('Delete entry?', 'اندراج حذف کریں؟', 'حذف الإدخال؟')))
                                void action(() => putPrivate(x, true));
                            }}
                          >
                            {tr('Delete', 'حذف', 'حذف')}
                          </button>
                        </article>
                      ))}
                  </Panel>
                </>
              ) : (
                <>
                  {page === 'protection' && (
                    <>
                      <Panel
                        collapsible
                        defaultOpen={habits.length === 0}
                        title={tr('Your habits', 'آپ کی عادتیں', 'عاداتك')}
                      >
                        <button
                          className="primary"
                          onClick={() =>
                            setEditing({ id: crypto.randomUUID(), type: 'habit', start: today })
                          }
                        >
                          {tr('Add habit', 'عادت شامل کریں', 'إضافة عادة')}
                        </button>
                        <Field label={tr('Trend period', 'رجحان کی مدت', 'فترة الاتجاه')}>
                          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                            {['7', '30', '90', 'custom', 'lifetime'].map((x) => (
                              <option key={x} value={x}>
                                {x === 'custom'
                                  ? tr('Custom', 'حسب ضرورت', 'مخصص')
                                  : x === 'lifetime'
                                    ? tr('Lifetime', 'تمام مدت', 'كل المدة')
                                    : x + ' ' + tr('days', 'دن', 'أيام')}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {period === 'custom' && (
                          <Field label={tr('From', 'آغاز', 'من')}>
                            <input
                              type="date"
                              value={from}
                              onChange={(e) => setFrom(e.target.value)}
                              max={today}
                            />
                          </Field>
                        )}
                        {period === 'custom' && (
                          <Field
                            label={tr(
                              'To',
                              '\u0627\u062e\u062a\u062a\u0627\u0645',
                              '\u0625\u0644\u0649',
                            )}
                          >
                            <input
                              type="date"
                              value={trendEnd}
                              min={from}
                              max={today}
                              onChange={(e) => setTrendEnd(e.target.value)}
                            />
                          </Field>
                        )}
                        {habits.map((h) => {
                          const stats = habitStats(
                            h,
                            checks,
                            start,
                            period === 'custom' ? trendEnd : today,
                          );
                          return (
                            <article className="dp-entry" key={h.id}>
                              <h3>
                                {h.name}
                                {h.archived ? ' · ' + tr('Archived', 'محفوظ شدہ', 'مؤرشف') : ''}
                              </h3>
                              <div className="dp-metrics">
                                <span>
                                  {tr('Current / best', 'موجودہ / بہترین', 'الحالي / الأفضل')}
                                  <strong>
                                    {stats.current} / {stats.best}
                                  </strong>
                                </span>
                                <span>
                                  {tr('Avoided / slipped', 'اجتناب / لغزش', 'تجنب / تعثر')}
                                  <strong>
                                    {stats.success} / {stats.slipped}
                                  </strong>
                                </span>
                                <span>
                                  {tr(
                                    'Unanswered / skipped',
                                    'بے جواب / چھوڑے',
                                    'بلا إجابة / متجاوز',
                                  )}
                                  <strong>{stats.unanswered}</strong>
                                </span>
                                <span>
                                  {tr('Occurrences', 'واقعات', 'المرات')}
                                  <strong>{stats.occurrences}</strong>
                                </span>
                              </div>
                              <div className="dp-heatmap">
                                {checks
                                  .filter((c) => c.habitId === h.id && c.day >= start)
                                  .map((c) => (
                                    <span
                                      className={
                                        'dp-day ' +
                                        (c.state === 'avoided'
                                          ? 'ontime'
                                          : c.state === 'slipped'
                                            ? 'missed'
                                            : 'unknown')
                                      }
                                      key={c.id}
                                    >
                                      {c.day.slice(5)}
                                      <small>{c.count || '—'}</small>
                                    </span>
                                  ))}
                              </div>
                              <div className="actions">
                                <button className="secondary" onClick={() => setEditing(h)}>
                                  {tr('Edit', 'ترمیم', 'تعديل')}
                                </button>
                                <button
                                  className="secondary"
                                  onClick={() =>
                                    void action(() => putPrivate({ ...h, archived: !h.archived }))
                                  }
                                >
                                  {h.archived
                                    ? tr('Restore', 'بحال کریں', 'استعادة')
                                    : tr('Archive', 'محفوظ کریں', 'أرشفة')}
                                </button>
                                <button
                                  className="secondary"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        tr(
                                          'Delete habit and its private check-ins and activities?',
                                          'عادت اور اس کے نجی اندراجات اور سرگرمیاں حذف کریں؟',
                                          'حذف العادة وسجلاتها وأنشطتها الخاصة؟',
                                        ),
                                      )
                                    )
                                      void action(async () => {
                                        for (const x of vault.items.filter(
                                          (x) => x.id === h.id || x.habitId === h.id,
                                        ))
                                          await putPrivate(x, true);
                                      });
                                  }}
                                >
                                  {tr('Delete', 'حذف', 'حذف')}
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </Panel>
                      <Panel title={tr('Daily check-in', 'روزانہ اندراج', 'تسجيل يومي')}>
                        {activeHabits.length > 1 && (
                          <Field
                            label={tr(
                              'Choose habit',
                              '\u0639\u0627\u062f\u062a \u0645\u0646\u062a\u062e\u0628 \u06a9\u0631\u06cc\u06ba',
                              '\u0627\u062e\u062a\u0631 \u0627\u0644\u0639\u0627\u062f\u0629',
                            )}
                          >
                            <select
                              value={shownHabit}
                              onChange={(e) => setSelectedHabit(e.target.value)}
                            >
                              {activeHabits.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                        )}

                        <Field label={tr('Date', 'تاریخ', 'التاريخ')}>
                          <input
                            type="date"
                            max={today}
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                          />
                        </Field>
                        {habits
                          .filter((h) => !h.archived && h.id === shownHabit)
                          .map((h) => {
                            const prior = checks.find((c) => c.habitId === h.id && c.day === date);
                            const checkState = checkinDrafts[h.id + date] ?? prior?.state ?? '';
                            return (
                              <form
                                className="dp-entry"
                                key={h.id + date + prior?.state}
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const f = new FormData(e.currentTarget),
                                    state = String(f.get('state')) as Checkin['state'];
                                  void action(async () => {
                                    const check: Checkin = {
                                      id: `${h.id}:${date}`,
                                      habitId: h.id,
                                      day: date,
                                      state,
                                      count: state === 'slipped' ? Number(f.get('count') || 1) : 0,
                                      note: String(f.get('note') || ''),
                                    };
                                    await putPrivate({ ...check, type: 'checkin' });
                                    const generated = recoveryTasks(h, check, tasks);
                                    for (const task of generated)
                                      await putPrivate({ ...task, type: 'recovery' });
                                    for (const task of tasks.filter(
                                      (t) =>
                                        t.habitId === h.id &&
                                        t.day === date &&
                                        t.state === 'pending' &&
                                        !generated.some((g) => g.id === t.id),
                                    ))
                                      await putPrivate({ ...task, type: 'recovery' }, true);
                                    if (state === 'slipped')
                                      props.notify(
                                        tr(
                                          'A difficult day does not erase your progress. Begin again gently.',
                                          'ایک مشکل دن آپ کی کوشش مٹاتا نہیں۔ نرمی سے دوبارہ شروع کریں۔',
                                          'يوم صعب لا يمحو تقدمك. ابدأ مجددًا برفق.',
                                        ),
                                      );
                                  });
                                }}
                              >
                                <h3>{h.name}</h3>
                                {h.description && (
                                  <p className="preserve-lines muted">{h.description}</p>
                                )}
                                <Field
                                  label={tr('How did today go?', 'آج کیسا گزرا؟', 'كيف كان يومك؟')}
                                >
                                  <select
                                    name="state"
                                    value={checkState}
                                    onChange={(e) =>
                                      setCheckinDrafts({
                                        ...checkinDrafts,
                                        [h.id + date]: e.target.value,
                                      })
                                    }
                                    required
                                  >
                                    <option value="" disabled>
                                      —
                                    </option>
                                    <option value="avoided">
                                      {tr('I avoided it', 'میں نے اجتناب کیا', 'تجنبتها')}
                                    </option>
                                    <option value="slipped">
                                      {tr('I slipped', 'مجھ سے لغزش ہوئی', 'تعثرت')}
                                    </option>
                                    <option value="skip">
                                      {tr('Skip today', 'آج چھوڑ دیں', 'تجاوز اليوم')}
                                    </option>
                                  </select>
                                </Field>
                                {checkState === 'slipped' && (
                                  <Field
                                    label={tr(
                                      'Occurrences if slipped',
                                      'لغزش کے واقعات کی تعداد',
                                      'عدد المرات عند التعثر',
                                    )}
                                  >
                                    <input
                                      type="number"
                                      name="count"
                                      min="1"
                                      max="1000"
                                      defaultValue={prior?.count || 1}
                                    />
                                  </Field>
                                )}
                                <details className="calm-advanced">
                                  <summary>
                                    {tr(
                                      'Private reflection (optional)',
                                      '\u0646\u062c\u06cc \u063a\u0648\u0631 \u0648 \u0641\u06a9\u0631 (\u0627\u062e\u062a\u06cc\u0627\u0631\u06cc)',
                                      '\u062a\u0623\u0645\u0644 \u062e\u0627\u0635 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)',
                                    )}
                                  </summary>
                                  <Field
                                    label={tr(
                                      'Private reflection (optional)',
                                      'نجی غور و فکر (اختیاری)',
                                      'تأمل خاص (اختياري)',
                                    )}
                                  >
                                    <textarea
                                      name="note"
                                      maxLength={3000}
                                      defaultValue={prior?.note}
                                    />
                                  </Field>
                                </details>
                                <button className="primary" disabled={saving}>
                                  {tr('Save check-in', 'اندراج محفوظ کریں', 'حفظ التسجيل')}
                                </button>
                              </form>
                            );
                          })}
                        <Toggle
                          label={tr(
                            'Discreet daily reminder',
                            'نجی روزانہ یاد دہانی',
                            'تذكير يومي متحفظ',
                          )}
                          value={!!db.state.settings.privateReminder}
                          onChange={(value) =>
                            void action(() =>
                              db.configure({ ...db.state.settings, privateReminder: value }),
                            )
                          }
                        />
                        <Field label={tr('Check-in time', 'اندراج کا وقت', 'وقت التسجيل')}>
                          <input
                            type="time"
                            defaultValue={db.state.settings.privateTime || '21:30'}
                            onChange={(e) =>
                              void action(() =>
                                db.configure({ ...db.state.settings, privateTime: e.target.value }),
                              )
                            }
                          />
                        </Field>
                      </Panel>
                    </>
                  )}
                  <Panel
                    collapsible={page !== 'activities'}
                    defaultOpen={activitiesOpen}
                    title={tr('My activities', 'ذاتی اصلاحی سرگرمیاں', 'أنشطة التعافي الشخصية')}
                  >
                    <p className="notice">
                      {tr(
                        'Choose a helpful activity for yourself. A personal penalty is your own promise, not a required religious punishment.',
                        'یہ آپ کی منتخب رضاکارانہ سرگرمیاں ہیں۔ یہ شرعی سزا یا لازمی کفارہ نہیں، اور لغزش یا ٹوٹا تسلسل نہیں مٹاتیں۔ فریز پوائنٹس لاگو نہیں۔',
                        'التزامات تطوعية تختارها أنت؛ ليست عقوبات شرعية أو كفارات واجبة ولا تمحو التعثر أو تعيد التتابع. لا تنطبق نقاط التجميد.',
                      )}
                    </p>
                    {!tasks.length && (
                      <p className="muted">
                        {tr(
                          'No activities yet. Add one here, or set a personal penalty when adding a habit.',
                          'ابھی کوئی سرگرمی نہیں۔ یہاں شامل کریں یا عادت کے ساتھ ذاتی جرمانہ مقرر کریں۔',
                          'لا توجد أنشطة. أضف نشاطًا أو التزامًا مع عادة.',
                        )}
                      </p>
                    )}
                    {tasks.map((task) => (
                      <article key={task.id} className="dp-entry">
                        <h3>{task.title}</h3>
                        {task.description && (
                          <p className="preserve-lines muted">{task.description}</p>
                        )}
                        <p>
                          {task.day} ·{' '}
                          {task.kind === 'nafl'
                            ? tr('Rak’ahs', 'رکعات', 'ركعات')
                            : tr('Progress', 'پیش رفت', 'التقدم')}
                          : {task.count}/{task.target} ·{' '}
                          {task.state === 'done'
                            ? tr('Completed', 'مکمل', 'مكتمل')
                            : task.state === 'dismissed'
                              ? tr('Dismissed', 'بند شدہ', 'مرفوض')
                              : tr('Pending', 'باقی', 'معلق')}
                        </p>
                        {task.postponed && <small>{task.postponed}</small>}
                        <div className="actions">
                          <button
                            className="primary"
                            disabled={task.state !== 'pending' || saving}
                            onClick={() =>
                              void action(() =>
                                putPrivate({
                                  ...task,
                                  count: advanceCounter(task.count, task.target),
                                  state: task.count + 1 >= task.target ? 'done' : 'pending',
                                }),
                              )
                            }
                          >
                            +1
                          </button>
                          <button
                            className="secondary"
                            onClick={() =>
                              void action(() =>
                                putPrivate({ ...task, count: task.target, state: 'done' }),
                              )
                            }
                          >
                            {tr('Complete', 'مکمل کریں', 'إكمال')}
                          </button>
                          <button
                            className="secondary"
                            onClick={() => {
                              const at = prompt(
                                tr(
                                  'Postpone until (YYYY-MM-DD HH:mm)',
                                  'ملتوی کریں (YYYY-MM-DD HH:mm)',
                                  'التأجيل إلى (YYYY-MM-DD HH:mm)',
                                ),
                              );
                              if (at && Number.isFinite(Date.parse(at)))
                                void action(() =>
                                  putPrivate({
                                    ...task,
                                    postponed: new Date(at).toISOString(),
                                    state: 'pending',
                                  }),
                                );
                            }}
                          >
                            {tr('Postpone', 'ملتوی کریں', 'تأجيل')}
                          </button>
                          <button
                            className="secondary"
                            onClick={() => {
                              const name = prompt(
                                tr('Activity name', 'سرگرمی کا نام', 'اسم النشاط'),
                                task.title,
                              );
                              if (name?.trim())
                                void action(() =>
                                  putPrivate({ ...task, title: name.slice(0, 160) }),
                                );
                            }}
                          >
                            {tr('Edit', 'ترمیم', 'تعديل')}
                          </button>
                          <button
                            className="secondary"
                            onClick={() =>
                              void action(() => putPrivate({ ...task, state: 'dismissed' }))
                            }
                          >
                            {tr('Dismiss', 'بند کریں', 'رفض')}
                          </button>
                        </div>
                      </article>
                    ))}
                  </Panel>
                </>
              )}
            </>
          )}
          {editing?.type === 'recovery' && (
            <div id="private-editor">
              <Panel title={tr('Add activity', 'سرگرمی شامل کریں', 'إضافة نشاط')}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action(async () => {
                      await putPrivate({
                        ...editing,
                        title: String(f.get('title')).trim(),
                        description: String(f.get('description') || '').trim(),
                        kind: f.get('kind'),
                        target: Number(f.get('target') || 1),
                        count: 0,
                        state: 'pending',
                        day: f.get('day') || today,
                        time: f.get('reminderEnabled') ? f.get('time') : '',
                      });
                      setEditing(null);
                    });
                  }}
                >
                  <Field label={tr('Activity name', 'سرگرمی کا نام', 'اسم النشاط')}>
                    <input name="title" required maxLength={160} />
                  </Field>
                  <Field label={tr('Description', 'تفصیل', 'الوصف')}>
                    <textarea
                      name="description"
                      rows={3}
                      maxLength={2000}
                      defaultValue={editing.description || ''}
                    />
                  </Field>
                  <Field label={tr('Activity type', 'سرگرمی کی قسم', 'نوع النشاط')}>
                    <select name="kind">
                      <option value="tasbih">{tr('Tasbih', 'تسبیح', 'تسبيح')}</option>
                      <option value="nafl">{tr('Nafl prayer', 'نفل نماز', 'صلاة نافلة')}</option>
                      <option value="custom">{tr('Something else', 'کچھ اور', 'نشاط آخر')}</option>
                    </select>
                  </Field>
                  <Field label={tr('Count or Rak’ahs', 'تعداد یا رکعات', 'العدد أو الركعات')}>
                    <input
                      name="target"
                      type="number"
                      min="1"
                      max="100000"
                      defaultValue={1}
                      required
                    />
                  </Field>
                  <label className="toggle">
                    {tr('Set a reminder', 'یاد دہانی مقرر کریں', 'تعيين تذكير')}
                    <input
                      type="checkbox"
                      name="reminderEnabled"
                      checked={activityReminderEnabled}
                      onChange={(e) => setActivityReminderEnabled(e.target.checked)}
                    />
                  </label>
                  {activityReminderEnabled && (
                    <div className="field-grid">
                      <Field label={tr('Reminder date', 'یاد دہانی کی تاریخ', 'تاريخ التذكير')}>
                        <input
                          type="date"
                          name="day"
                          defaultValue={editing.day || today}
                          required
                        />
                      </Field>
                      <Field label={tr('Reminder time', 'یاد دہانی کا وقت', 'وقت التذكير')}>
                        <input
                          type="time"
                          name="time"
                          defaultValue={editing.time || '21:00'}
                          required
                        />
                      </Field>
                    </div>
                  )}
                  <div className="actions">
                    <button className="primary" disabled={saving}>
                      {tr('Save activity', 'سرگرمی محفوظ کریں', 'حفظ النشاط')}
                    </button>
                    <button className="secondary" type="button" onClick={() => setEditing(null)}>
                      {tr('Cancel', 'منسوخ', 'إلغاء')}
                    </button>
                  </div>
                </form>
              </Panel>
            </div>
          )}
          {editing?.type === 'habit' && (
            <div id="private-editor">
              <Panel
                title={tr(
                  'Habit and personal penalty',
                  'عادت اور ذاتی جرمانہ',
                  'العادة والالتزام الشخصي',
                )}
              >
                <form
                  key={editing.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (f.get('recovery') && !String(f.get('title') || '').trim()) {
                      props.notify(
                        tr(
                          'Name your chosen recovery activity.',
                          '\u0627\u067e\u0646\u06cc \u0645\u0646\u062a\u062e\u0628 \u0633\u0631\u06af\u0631\u0645\u06cc \u06a9\u0627 \u0646\u0627\u0645 \u062f\u06cc\u06ba\u06d4',
                          '\u0633\u0645 \u0646\u0634\u0627\u0637 \u0627\u0644\u062a\u0639\u0627\u0641\u064a \u0627\u0644\u0645\u062e\u062a\u0627\u0631.',
                        ),
                      );
                      return;
                    }
                    void action(async () => {
                      await putPrivate({
                        ...editing,
                        name: String(f.get('name')).trim(),
                        description: String(f.get('description') || '').trim(),
                        recovery: f.get('recovery')
                          ? {
                              kind: f.get('kind'),
                              title: f.get('title'),
                              target: Number(f.get('target') || 1),
                              perOccurrence: f.get('perOccurrence') === 'on',
                              time: f.get('penaltyReminder') ? f.get('time') : '',
                              reminderDay: f.get('penaltyReminder') ? f.get('reminderDay') : '',
                            }
                          : undefined,
                      });
                      setEditing(null);
                    });
                  }}
                >
                  <Field label={tr('Habit name', 'عادت کا نام', 'اسم العادة')}>
                    <input
                      name="name"
                      defaultValue={editing.name}
                      maxLength={160}
                      required
                      list="habit-ideas"
                    />
                  </Field>
                  <Field label={tr('Description', 'تفصیل', 'الوصف')}>
                    <textarea
                      name="description"
                      rows={3}
                      maxLength={2000}
                      defaultValue={editing.description || ''}
                      placeholder={tr(
                        'What would you like to work on?',
                        'آپ کس چیز پر کام کرنا چاہتے ہیں؟',
                        'ما الذي ترغب في تحسينه؟',
                      )}
                    />
                  </Field>
                  <datalist id="habit-ideas">
                    {[
                      tr('Lying', 'جھوٹ', 'الكذب'),
                      tr('Backbiting', 'غیبت', 'الغيبة'),
                      tr('Smoking', 'تمباکو نوشی', 'التدخين'),
                      tr('Excessive anger', 'شدید غصہ', 'الغضب المفرط'),
                      tr('Gambling', 'جوا', 'القمار'),
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </datalist>
                  <label className="toggle">
                    {tr(
                      'Add a personal penalty for a slip (optional)',
                      'لغزش پر ذاتی جرمانہ رکھیں (اختیاری)',
                      'إضافة التزام شخصي عند التعثر (اختياري)',
                    )}
                    <input
                      type="checkbox"
                      name="recovery"
                      checked={penaltyEnabled}
                      onChange={(e) => setPenaltyEnabled(e.target.checked)}
                    />
                  </label>
                  {penaltyEnabled && (
                    <div className="penalty-fields">
                      <Field label={tr('Activity type', 'سرگرمی کی قسم', 'نوع النشاط')}>
                        <select name="kind" defaultValue={editing.recovery?.kind || 'tasbih'}>
                          <option value="tasbih">{tr('Tasbih', 'تسبیح', 'تسبيح')}</option>
                          <option value="nafl">
                            {tr('Nafl Salah', 'نفل نماز', 'صلاة النافلة')}
                          </option>
                          <option value="custom">
                            {tr('Custom beneficial activity', 'اپنی مفید سرگرمی', 'نشاط نافع مخصص')}
                          </option>
                        </select>
                      </Field>
                      <Field
                        label={tr(
                          'Activity / Dhikr name',
                          'سرگرمی / ذکر کا نام',
                          'اسم النشاط / الذكر',
                        )}
                      >
                        <input
                          name="title"
                          maxLength={160}
                          defaultValue={editing.recovery?.title || ''}
                        />
                      </Field>
                      <Field label={tr('Target / Rak’ahs', 'ہدف / رکعات', 'الهدف / الركعات')}>
                        <input
                          name="target"
                          type="number"
                          min="1"
                          max="100000"
                          defaultValue={editing.recovery?.target || 20}
                        />
                      </Field>
                      <label className="toggle">
                        {tr(
                          'Repeat the penalty for each slip',
                          'ہر لغزش پر جرمانہ دہرائیں',
                          'كرر الالتزام لكل تعثر',
                        )}
                        <input
                          name="perOccurrence"
                          type="checkbox"
                          defaultChecked={editing.recovery?.perOccurrence}
                        />
                      </label>
                      <label className="toggle">
                        {tr(
                          'Remind me about this penalty',
                          'اس عہد کی یاد دہانی',
                          'ذكرني بهذا الالتزام',
                        )}
                        <input
                          name="penaltyReminder"
                          type="checkbox"
                          checked={penaltyReminderEnabled}
                          onChange={(e) => setPenaltyReminderEnabled(e.target.checked)}
                        />
                      </label>
                      {penaltyReminderEnabled && (
                        <div className="field-grid">
                          <Field label={tr('Reminder date', 'یاد دہانی کی تاریخ', 'تاريخ التذكير')}>
                            <input
                              type="date"
                              name="reminderDay"
                              defaultValue={editing.recovery?.reminderDay || today}
                              required
                            />
                          </Field>
                          <Field label={tr('Reminder time', 'یاد دہانی کا وقت', 'وقت التذكير')}>
                            <input
                              name="time"
                              type="time"
                              defaultValue={editing.recovery?.time || '21:00'}
                              required
                            />
                          </Field>
                        </div>
                      )}
                    </div>
                  )}
                  <button disabled={saving} className="primary">
                    {tr('Save', 'محفوظ کریں', 'حفظ')}
                  </button>
                  <button type="button" className="secondary" onClick={() => setEditing(null)}>
                    {tr('Cancel', 'منسوخ', 'إلغاء')}
                  </button>
                </form>
              </Panel>
            </div>
          )}
        </>
      )}
    </>
  );
}
