import { tr } from './deen-ui';
import { SoundSettings } from './SoundSettings';
import { reminderLanguage } from './content';
import { useEffect, useState } from 'react';
import { Bell, Shield, Volume2 } from 'lucide-react';
import { Field, Toggle } from './components';
import { Native, isNative } from './native';
import { translator } from './i18n';
import type { Settings } from './domain';
import { scheduleReminders } from './reminders';
export function ReminderSettings({
  settings: s,
  change,
  notify,
}: {
  settings: Settings;
  change: (next: Settings) => Promise<unknown>;
  notify: (message: string) => void;
}) {
  const t = translator(s.lang);
  const [permissions, setPermissions] = useState<{
    notifications: boolean;
    exact: boolean;
    overlay: boolean;
    fullScreen?: boolean;
    batteryUnrestricted?: boolean;
  } | null>(null);
  const inspect = async () => {
    if (isNative) {
      setPermissions(await Native.permissions());
      await scheduleReminders();
    }
  };
  useEffect(() => {
    void inspect().catch(() => {});
    const visible = () => {
      if (document.visibilityState === 'visible') void inspect().catch(() => {});
    };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, []);
  return (
    <div className="section-divider notification-tests">
      {isNative && permissions && (
        <section className="reminder-setup">
          <h3>{tr('Set up reminders', 'یاد دہانیاں ترتیب دیں', 'إعداد التذكيرات')}</h3>
          {(['notifications', 'exact', 'overlay'] as const)
            .filter((key) => key !== 'overlay' || s.overlay)
            .map((key) => (
              <div className="permission-row" key={key}>
                <div>
                  <strong>
                    {t(
                      key === 'exact'
                        ? 'alarms'
                        : key === 'overlay'
                          ? 'overlayPermission'
                          : 'notifications',
                    )}
                  </strong>
                  <small>{t(permissions[key] ? 'enabled' : 'disabled')}</small>
                </div>
                <button
                  className="secondary"
                  onClick={() =>
                    void (async () => {
                      try {
                        if (key === 'notifications' && !permissions.notifications)
                          await Native.requestNotifications();
                        await Native.openSettings({ kind: key });
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    })()
                  }
                >
                  {tr('Open settings', 'ترتیبات کھولیں', 'فتح الإعدادات')}
                </button>
              </div>
            ))}
          {permissions.batteryUnrestricted === false && (
            <div className="permission-row">
              <div>
                <strong>
                  {tr(
                    'Background battery access',
                    'پس منظر میں بیٹری کی اجازت',
                    'صلاحية البطارية في الخلفية',
                  )}
                </strong>
                <small>
                  {tr(
                    'Battery optimization can restrict screen-off reminders on some phones.',
                    'کچھ فونز پر بیٹری کی پابندی اسکرین بند ہونے پر یاد دہانی روک سکتی ہے۔',
                    'قد يقيد تحسين البطارية التذكيرات عند إطفاء الشاشة في بعض الهواتف.',
                  )}
                </small>
              </div>
              <button
                className="secondary"
                onClick={() =>
                  void Native.openSettings({ kind: 'battery' }).catch((e) => notify(e.message))
                }
              >
                {tr(
                  'Allow background alarms',
                  'پس منظر کے الارم کی اجازت دیں',
                  'السماح بمنبهات الخلفية',
                )}
              </button>
            </div>
          )}
          {!permissions.exact && (
            <p className="notice">
              {tr(
                'Allow Alarms & reminders so reminders arrive on time when the app is closed.',
                'ایپ بند ہونے پر وقت پر یاد دہانی کے لیے الارم کی اجازت دیں۔',
                'اسمح بالمنبهات لتصل التذكيرات في وقتها عند إغلاق التطبيق.',
              )}
            </p>
          )}
          <details className="calm-advanced">
            <summary>
              {tr(
                'Still missing reminders?',
                'اب بھی یاد دہانی نہیں آتی؟',
                'هل ما زالت التذكيرات لا تصل؟',
              )}
            </summary>
            <div>
              <p>
                {tr(
                  'Allow background use in your phone’s battery settings. After Force stop, open DeenPath once to restart reminders.',
                  'بیٹری کی ترتیبات میں پس منظر میں چلنے کی اجازت دیں۔ زبردستی بند کرنے کے بعد ایپ ایک بار کھولیں۔',
                  'اسمح بالتشغيل في الخلفية في إعدادات البطارية. بعد الإيقاف الإجباري افتح التطبيق مجددًا.',
                )}
              </p>
              <button
                className="secondary"
                onClick={() =>
                  void Native.openSettings({ kind: 'battery' }).catch((e) =>
                    notify((e as Error).message),
                  )
                }
              >
                {t('battery')}
              </button>
            </div>
          </details>
        </section>
      )}
      <p className="muted">{t('notificationHelp')}</p>
      <details className="calm-advanced">
        <summary>
          {tr(
            'Quiet hours',
            '\u062e\u0627\u0645\u0648\u0634 \u0627\u0648\u0642\u0627\u062a',
            '\u0633\u0627\u0639\u0627\u062a \u0627\u0644\u0647\u062f\u0648\u0621',
          )}
        </summary>
        <div>
          <Toggle
            label={tr(
              'Quiet hours for nonessential reminders',
              '\u063a\u06cc\u0631 \u0644\u0627\u0632\u0645\u06cc \u06cc\u0627\u062f \u062f\u06c1\u0627\u0646\u06cc\u0648\u06ba \u06a9\u06d2 \u0644\u06cc\u06d2 \u062e\u0627\u0645\u0648\u0634 \u0627\u0648\u0642\u0627\u062a',
              '\u0633\u0627\u0639\u0627\u062a \u0647\u062f\u0648\u0621 \u0644\u0644\u062a\u0630\u0643\u064a\u0631\u0627\u062a \u063a\u064a\u0631 \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629',
            )}
            value={!!s.quietEnabled}
            onChange={(value) => void change({ ...s, quietEnabled: value })}
          />
          {s.quietEnabled && (
            <div className="field-grid">
              <Field
                label={tr(
                  'Quiet hours start',
                  '\u062e\u0627\u0645\u0648\u0634\u06cc \u06a9\u0627 \u0622\u063a\u0627\u0632',
                  '\u0628\u062f\u0627\u064a\u0629 \u0627\u0644\u0647\u062f\u0648\u0621',
                )}
              >
                <input
                  type="time"
                  value={s.quietStart || '22:00'}
                  onChange={(e) => void change({ ...s, quietStart: e.target.value })}
                />
              </Field>
              <Field
                label={tr(
                  'Quiet hours end',
                  '\u062e\u0627\u0645\u0648\u0634\u06cc \u06a9\u0627 \u0627\u062e\u062a\u062a\u0627\u0645',
                  '\u0646\u0647\u0627\u064a\u0629 \u0627\u0644\u0647\u062f\u0648\u0621',
                )}
              >
                <input
                  type="time"
                  value={s.quietEnd || '07:00'}
                  onChange={(e) => void change({ ...s, quietEnd: e.target.value })}
                />
              </Field>
            </div>
          )}
        </div>
      </details>
      {isNative && s.overlay && permissions?.fullScreen === false && (
        <div className="notice">
          <p>
            {tr(
              'Lock-screen access is restricted. Notifications still work.',
              'لاک اسکرین کی اجازت محدود ہے۔ نوٹیفکیشن پھر بھی کام کریں گے۔',
              'الوصول إلى شاشة القفل مقيّد. تستمر الإشعارات في العمل.',
            )}
          </p>
          <button
            className="secondary"
            onClick={() =>
              void Native.openSettings({ kind: 'fullscreen' }).catch((e) =>
                notify((e as Error).message),
              )
            }
          >
            {tr(
              'Lock-screen reminder settings',
              'لاک اسکرین کی یاد دہانی کی ترتیب',
              'إعدادات تذكير شاشة القفل',
            )}
          </button>
        </div>
      )}
      <SoundSettings settings={s} change={change} notify={notify} />
      <Field label={t('reminderTranslation')}>
        <select
          value={reminderLanguage(s)}
          onChange={(e) => void change({ ...s, reminderLanguage: e.target.value })}
        >
          <option value="both">English + اردو + العربية</option>
          <option value="en">{t('arabicEnglish')}</option>
          <option value="ur">{t('arabicUrdu')}</option>
          <option value="none">{t('arabic')}</option>
        </select>
      </Field>
      <Toggle
        label={tr(
          'Wake Screen for Enforcer',
          'یاد دہانی پر اسکرین روشن کریں',
          'إيقاظ الشاشة للتذكير',
        )}
        value={!!s.wakeEnforcer}
        onChange={(wakeEnforcer) => void change({ ...s, wakeEnforcer })}
      />
      <p className="muted">
        {tr(
          'Off by default. Android may limit lock-screen reminders.',
          'پہلے سے بند۔ اینڈرائیڈ لاک اسکرین یاد دہانی محدود کر سکتا ہے۔',
          'معطل افتراضيًا. قد يقيّد أندرويد تذكيرات شاشة القفل.',
        )}
      </p>
      <section className="card dp-panel">
        <div>
          <h3 className="subheading">
            <Shield size={16} /> {t('overlay')}
          </h3>
          <p className="muted">{t('overlayHelp')}</p>
          <Toggle
            label={t('overlay')}
            value={!!s.overlay}
            onChange={(value) =>
              void change({ ...s, overlay: value }).then(async () => {
                if (value && isNative && !permissions?.overlay)
                  await Native.openSettings({ kind: 'overlay' });
                await inspect();
              })
            }
          />
        </div>
      </section>
      <section className="card dp-panel">
        <h3>{tr('Prayer reminder rhythm', 'نماز کی یاد دہانی کا وقفہ', 'وتيرة تذكير الصلاة')}</h3>
        <p>
          {tr(
            'Choose the pause between reminders in each phase and when the phases begin. Prompts stop when you mark I Prayed or the prayer time ends.',
            'ہر مرحلے میں یاد دہانی کا وقفہ اور مرحلے کا آغاز منتخب کریں۔ نماز درج کرنے یا وقت ختم ہونے پر یاد دہانی بند ہو جاتی ہے۔',
            'اختر الفاصل بين التذكيرات وبداية كل مرحلة. يتوقف التذكير عند تسجيل الصلاة أو انتهاء وقتها.',
          )}
        </p>
        <div className="field-grid">
          {(['gentle', 'warning', 'strict'] as const).map((stage, index) => (
            <Field
              key={stage}
              label={tr(
                [
                  'Early interval (minutes)',
                  'Middle interval (minutes)',
                  'Final interval (minutes)',
                ][index],
                ['ابتدائی وقفہ (منٹ)', 'درمیانی وقفہ (منٹ)', 'آخری وقفہ (منٹ)'][index],
                ['الفاصل الأول (دقائق)', 'الفاصل الأوسط (دقائق)', 'الفاصل الأخير (دقائق)'][index],
              )}
            >
              <select
                value={s.reminderRepeat?.[stage] ?? [15, 10, 1][index]}
                onChange={(e) =>
                  void change({
                    ...s,
                    reminderRepeat: {
                      gentle: 15,
                      warning: 10,
                      strict: 1,
                      ...s.reminderRepeat,
                      [stage]: Number(e.target.value),
                    },
                  })
                }
              >
                <option value={0}>{t('once')}</option>
                {[1, 2, 3, 5, 10, 15, 20, 30, 60].map((n) => (
                  <option key={n} value={n}>
                    {n} min
                  </option>
                ))}
              </select>
            </Field>
          ))}
          <Field
            label={tr(
              'Middle phase starts at (%)',
              'درمیانی مرحلے کا آغاز (%)',
              'بداية المرحلة الوسطى (%)',
            )}
          >
            <input
              type="number"
              min="1"
              max={Number(s.reminderFinalPercent ?? 75) - 1}
              value={s.reminderMiddlePercent ?? 42}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 1 && v < Number(s.reminderFinalPercent ?? 75))
                  void change({ ...s, reminderMiddlePercent: v });
              }}
            />
          </Field>
          <Field
            label={tr(
              'Final phase starts at (%)',
              'آخری مرحلے کا آغاز (%)',
              'بداية المرحلة الأخيرة (%)',
            )}
          >
            <input
              type="number"
              min={Number(s.reminderMiddlePercent ?? 42) + 1}
              max="99"
              value={s.reminderFinalPercent ?? 75}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v > Number(s.reminderMiddlePercent ?? 42) && v <= 99)
                  void change({ ...s, reminderFinalPercent: v });
              }}
            />
          </Field>
        </div>
        <p className="muted">
          {tr(
            'Default example, 5–6 AM: 5:00 and 5:15; then 5:25 and 5:35; then every minute from 5:45 to 5:59. No Qaza reminders after 6:00.',
            'مثال، ۵ تا ۶ بجے: ۵:۰۰ اور ۵:۱۵، پھر ۵:۲۵ اور ۵:۳۵، پھر ۵:۴۵ سے ۵:۵۹ ہر منٹ۔ ۶ بجے کے بعد قضا کی یاد دہانی نہیں۔',
            'مثال ٥–٦ صباحاً: ٥:٠٠ و٥:١٥، ثم ٥:٢٥ و٥:٣٥، ثم كل دقيقة من ٥:٤٥ إلى ٥:٥٩. لا تذكير بالقضاء بعد ٦:٠٠.',
          )}
        </p>
        <Field label={tr('Reminder theme', 'یاد دہانی کا موضوع', 'موضوع التذكير')}>
          <select
            value={s.reminderTheme || 'balanced'}
            onChange={(e) => void change({ ...s, reminderTheme: e.target.value })}
          >
            {[
              [
                'balanced',
                'Hope, forgiveness & prayer',
                'امید، مغفرت اور نماز',
                'الرجاء والمغفرة والصلاة',
              ],
              ['hope', 'Hope & mercy', 'امید اور رحمت', 'الرجاء والرحمة'],
              ['forgiveness', 'Forgiveness & repentance', 'مغفرت اور توبہ', 'المغفرة والتوبة'],
              ['prayer', 'Prayer & consistency', 'نماز اور مستقل مزاجی', 'الصلاة والاستمرار'],
            ].map(([value, en, ur, ar]) => (
              <option key={value} value={value}>
                {tr(en, ur, ar)}
              </option>
            ))}
          </select>
        </Field>
        <Toggle
          label={tr(
            'Keep timed reminders active in background',
            'اسکرین بند ہونے پر نماز کے الارم',
            'منبهات الصلاة أثناء إطفاء الشاشة',
          )}
          value={s.reliablePrayerAlarms !== false}
          onChange={(value) => void change({ ...s, reliablePrayerAlarms: value })}
        />
        <p className="muted">
          {tr(
            'Uses a visible background service and Android reminder alarms. This can use more battery. Android sleep and manufacturer restrictions can delay reminders, including one-minute intervals. Force stop pauses reminders until you open the app again.',
            'پس منظر کی نمایاں سروس اور اینڈرائیڈ کی یاد دہانیاں استعمال ہوتی ہیں۔ بیٹری زیادہ استعمال ہو سکتی ہے۔ فون کی نیند اور کمپنی کی پابندیاں ایک منٹ کے وقفے سمیت یاد دہانیوں میں تاخیر کر سکتی ہیں۔ زبردستی بند کرنے کے بعد ایپ دوبارہ کھولیں۔',
            'يستخدم خدمة خلفية ظاهرة وتذكيرات أندرويد وقد يستهلك بطارية أكثر. قد يؤخر السكون وقيود الشركة التذكيرات، بما فيها فواصل الدقيقة. الإيقاف الإجباري يوقفها حتى فتح التطبيق.',
          )}
        </p>
      </section>
      <details className="calm-advanced">
        <summary>{t('intervals')}</summary>
        <div>
          <h3 className="subheading">{t('intervals')}</h3>
          <div className="field-grid">
            <Field label={t('snoozeMinutes')}>
              <select
                value={s.snoozeMinutes || 10}
                onChange={(e) => void change({ ...s, snoozeMinutes: Number(e.target.value) })}
              >
                {[1, 5, 10, 15, 30, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {isNative && permissions && (
            <div className="permission-summary">
              {(['notifications', 'exact', 'overlay'] as const).map((key) => (
                <div className="permission-row" key={key}>
                  <span>
                    {t(
                      key === 'exact'
                        ? 'alarms'
                        : key === 'overlay'
                          ? 'overlayPermission'
                          : 'notifications',
                    )}
                  </span>
                  <strong>{t(permissions[key] ? 'enabled' : 'disabled')}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
