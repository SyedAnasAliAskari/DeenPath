import { detectLocation } from './location';
import { useEffect, useState } from 'react';
import { db } from './store';
import { Native, isNative } from './native';
import { dayKey } from './domain';
import { hijriParts, qiblaBearing, shiftDay, formatHijriDay } from './deen';
import { Heading, Panel, tr, err, type SuiteProps } from './deen-ui';
import { Field, Toggle } from './components';
import { scheduleReminders } from './reminders';
import { ArrowUp } from 'lucide-react';
import { signedAngle, smoothHeading } from './compass';
export function DeenTools({
  page,
  ...props
}: SuiteProps & { page: 'qibla' | 'calendar' | 'travel' }) {
  const s = db.state.settings,
    today = dayKey(new Date(), s.timezone);
  const [heading, setHeading] = useState<number | null>(null),
    [accuracy, setAccuracy] = useState(0),
    [available, setAvailable] = useState(false),
    [anchor, setAnchor] = useState(today),
    [locating, setLocating] = useState(false);
  const bearing = qiblaBearing(s.lat, s.lng),
    adjust = Number(s.hijriAdjustment || 0);
  useEffect(() => {
    if (page !== 'qibla' || !isNative) return;
    let disposed = false,
      handle: { remove: () => Promise<void> } | undefined;
    void Native.addListener('heading', (data) => {
      setHeading((previous) => smoothHeading(previous, data.degrees));
      setAccuracy(data.accuracy);
    }).then((h) => {
      if (disposed) void h.remove();
      else handle = h;
    });
    const start = () => {
      if (document.visibilityState === 'visible')
        void Native.deen({ op: 'headingStart', lat: s.lat, lng: s.lng })
          .then((r) => setAvailable(r.available))
          .catch((e) => props.notify(err(e)));
      else void Native.deen({ op: 'headingStop' });
    };
    start();
    document.addEventListener('visibilitychange', start);
    return () => {
      disposed = true;
      if (handle) void handle.remove();
      void Native.deen({ op: 'headingStop' });
      document.removeEventListener('visibilitychange', start);
    };
  }, [page, s.lat, s.lng]);
  async function locate() {
    if (locating) return;
    setLocating(true);
    try {
      const coords = await detectLocation();
      await db.configure({
        ...s,
        ...coords,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        city: tr('Current location', 'موجودہ مقام', 'الموقع الحالي'),
      });
      await scheduleReminders();
      props.refresh();
      props.notify(
        tr(
          'Location updated. Qibla direction recalculated.',
          'مقام اپ ڈیٹ ہو گیا۔ قبلے کا رخ دوبارہ متعین ہو گیا۔',
          'تم تحديث الموقع وإعادة حساب اتجاه القبلة.',
        ),
      );
    } catch (e) {
      props.notify(err(e));
    } finally {
      setLocating(false);
    }
  }
  const current = hijriParts(anchor, adjust);
  let first = anchor;
  for (let i = 0; i < 31 && hijriParts(shiftDay(first, -1), adjust).month === current.month; i++)
    first = shiftDay(first, -1);
  const days: string[] = [];
  for (
    let d = first;
    hijriParts(d, adjust).month === current.month && days.length < 31;
    d = shiftDay(d, 1)
  )
    days.push(d);
  function monthMove(n: number) {
    setAnchor(n < 0 ? shiftDay(first, -1) : shiftDay(days.at(-1)!, 1));
  }
  const occasion = (p: Record<string, string>) =>
    p.month === '9' && p.day === '1'
      ? tr('Ramadan begins', 'رمضان کا آغاز', 'بداية رمضان')
      : p.month === '10' && p.day === '1'
        ? tr('Eid al-Fitr', 'عید الفطر', 'عيد الفطر')
        : p.month === '12' && p.day === '10'
          ? tr('Eid al-Adha', 'عید الاضحی', 'عيد الأضحى')
          : p.month === '1' && p.day === '10'
            ? tr('Ashura', 'عاشورا', 'عاشوراء')
            : '';
  return (
    <>
      <Heading
        title={
          page === 'qibla'
            ? tr('Qibla Compass', 'قبلہ نما', 'بوصلة القبلة')
            : page === 'calendar'
              ? tr('Hijri Calendar', 'ہجری تقویم', 'التقويم الهجري')
              : tr('Travel Mode', 'سفر کا موڈ', 'وضع السفر')
        }
      />
      {page === 'qibla' && (
        <Panel title={tr('Direction to the Kaaba', 'کعبہ کی سمت', 'الاتجاه إلى الكعبة')}>
          <div
            className="dp-compass"
            role="img"
            aria-label={`${tr('Qibla bearing', 'قبلہ کا زاویہ', 'اتجاه القبلة')}: ${bearing.toFixed(1)}°`}
          >
            <div className="compass-dial" style={{ transform: `rotate(${-(heading || 0)}deg)` }}>
              <span className="compass-n">N</span>
              <span className="compass-e">E</span>
              <span className="compass-s">S</span>
              <span className="compass-w">W</span>
            </div>
            <div
              className="dp-compass-arrow"
              style={{ transform: `rotate(${bearing - (heading || 0)}deg)` }}
            >
              <ArrowUp size={104} strokeWidth={1.6} />
            </div>
            <span className="dp-compass-center" />
          </div>
          <p className="qibla-status" role="status">
            {available && heading !== null
              ? Math.abs(signedAngle(bearing - heading)) < 5
                ? tr('You are facing Qibla', 'آپ کا رخ قبلہ کی طرف ہے', 'أنت تواجه القبلة')
                : `${Math.abs(signedAngle(bearing - heading)).toFixed(0)}° · ${signedAngle(bearing - heading) > 0 ? tr('Turn right', 'دائیں مڑیں', 'اتجه يمينًا') : tr('Turn left', 'بائیں مڑیں', 'اتجه يسارًا')}`
              : tr('Direction from north', 'شمال سے سمت', 'الاتجاه من الشمال')}
          </p>
          <p className="dp-center">
            {bearing.toFixed(1)}° {tr('from true north', 'حقیقی شمال سے', 'من الشمال الحقيقي')}
          </p>
          <p className="notice">
            {!available
              ? tr(
                  'No live compass here. Use the angle above with a compass pointing north.',
                  'یہاں مناسب قطب نما سینسر نہیں۔ یہ جغرافیائی زاویہ کسی معتبر قطب نما کے ساتھ استعمال کریں؛ تیر شمال کے لحاظ سے ہے، فون کی براہ راست سمت نہیں۔',
                  'لا يتوفر حساس بوصلة مناسب. استخدم الزاوية الجغرافية مع بوصلة موثوقة؛ السهم نسبة للشمال وليس اتجاه الهاتف المباشر.',
                )
              : accuracy < 2
                ? tr(
                    'Move away from metal. Move your phone in a figure eight, then hold it flat.',
                    'سمت کی درستگی غیر یقینی ہے۔ مقناطیس اور دھات سے دور ہو کر فون کو آٹھ کی شکل میں حرکت دیں اور سیدھا رکھیں۔',
                    'دقة الاتجاه غير مؤكدة. ابتعد عن المعادن والمغناطيس وعاير الهاتف بحركة شكل ثمانية واحمله أفقيًا.',
                  )
                : tr(
                    'Hold your phone flat and away from metal. Check the direction before praying.',
                    'فون سیدھا اور مقناطیسی خلل سے دور رکھیں۔ سینسر کا نتیجہ تخمینہ ہے، ضمانت نہیں۔',
                    'احمل الهاتف أفقيًا بعيدًا عن التشويش المغناطيسي. القراءات تقديرية وليست ضمانًا للدقة.',
                  )}
          </p>
          <p>
            {s.city} · {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
          </p>
          <div className="tool-actions">
            <button className="secondary" disabled={locating} onClick={() => void locate()}>
              {tr('Use current location', 'موجودہ مقام استعمال کریں', 'استخدام الموقع الحالي')}
            </button>
            <button className="text-button" onClick={() => props.navigate('settings/location')}>
              {tr('Set location manually', 'مقام دستی درج کریں', 'تحديد الموقع يدويًا')}
            </button>
          </div>
        </Panel>
      )}
      {page === 'calendar' && (
        <>
          <Panel
            title={tr('Calculated Hijri dates', 'حساب شدہ ہجری تاریخیں', 'تواريخ هجرية محسوبة')}
          >
            <p>{formatHijriDay(today, s.lang, adjust)}</p>
            <p>{today}</p>
            <Field label={tr('Local adjustment (days)', 'مقامی فرق (دن)', 'التعديل المحلي (أيام)')}>
              <select
                value={adjust}
                onChange={(e) =>
                  void db
                    .configure({ ...s, hijriAdjustment: Number(e.target.value) })
                    .then(props.refresh)
                }
              >
                {[-2, -1, 0, 1, 2].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <p className="notice">
              {tr(
                'Method: tabular Islamic civil calendar. Local moon sightings and official announcements can differ. Confirm Ramadan, Eid and other observances locally.',
                'طریقہ: حسابی اسلامی سول تقویم۔ مقامی رویت ہلال اور اعلانات مختلف ہو سکتے ہیں۔ رمضان، عید اور دیگر مواقع کی مقامی تصدیق کریں۔',
                'الطريقة: التقويم الإسلامي المدني الجدولي. قد تختلف الرؤية والإعلانات المحلية. تحقق محليًا من رمضان والأعياد والمناسبات.',
              )}
            </p>
          </Panel>
          <Panel title={`${current.month} / ${current.year} AH`}>
            <div className="dp-tabs">
              <button className="secondary" onClick={() => monthMove(-1)}>
                ← {tr('Previous month', 'گزشتہ مہینہ', 'الشهر السابق')}
              </button>
              <button className="secondary" onClick={() => setAnchor(today)}>
                {tr('Today', 'آج', 'اليوم')}
              </button>
              <button className="secondary" onClick={() => monthMove(1)}>
                {tr('Next month', 'اگلا مہینہ', 'الشهر التالي')} →
              </button>
            </div>
            <div className="dp-filters">
              <Field label={tr('Hijri month', 'ہجری مہینہ', 'الشهر الهجري')}>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={current.month}
                  onChange={(e) => {
                    const month = Number(e.target.value);
                    if (month < 1 || month > 12) return;
                    let d = first;
                    const step = month < Number(current.month) ? -1 : 1;
                    for (let i = 0; i < 365; i++) {
                      const p = hijriParts(d, adjust);
                      if (Number(p.month) === month) {
                        setAnchor(d);
                        break;
                      }
                      d = shiftDay(d, step);
                    }
                  }}
                />
              </Field>
              <Field label={tr('Hijri year', 'ہجری سال', 'السنة الهجرية')}>
                <input
                  type="number"
                  min="1300"
                  max="1600"
                  defaultValue={current.year}
                  key={current.year}
                  onBlur={(e) => {
                    const year = Number(e.target.value);
                    if (year < 1300 || year > 1600) return;
                    let d = shiftDay(first, Math.round((year - Number(current.year)) * 354.367));
                    for (let i = 0; i < 40; i++) {
                      const p = hijriParts(d, adjust);
                      if (Number(p.year) === year) {
                        setAnchor(d);
                        break;
                      }
                      d = shiftDay(d, Number(p.year) < year ? 1 : -1);
                    }
                  }}
                />
              </Field>
            </div>
            <div className="dp-calendar">
              {days.map((d) => {
                const p = hijriParts(d, adjust);
                return (
                  <button
                    className={d === today ? 'dp-date today' : 'dp-date'}
                    key={d}
                    onClick={() => {
                      props.notify(
                        tr(
                          'Choose Hijri calendar, month and day in a routine’s scheduling form.',
                          'معمول کی ترتیب میں ہجری تقویم، مہینہ اور دن منتخب کریں۔',
                          'اختر التقويم الهجري والشهر واليوم في إعداد الورد.',
                        ),
                      );
                      props.navigate('routines');
                    }}
                  >
                    <strong>{p.day}</strong>
                    <small>{d.slice(5)}</small>
                    <small>{occasion(p)}</small>
                  </button>
                );
              })}
            </div>
          </Panel>
        </>
      )}
      {page === 'travel' && (
        <Panel
          title={tr('Location and prayer times', 'مقام اور اوقات نماز', 'الموقع وأوقات الصلاة')}
        >
          <p>
            {s.city} · {s.timezone}
          </p>
          <Toggle
            label={tr(
              'Update location while using the app',
              'ایپ استعمال کرتے وقت مقام اپ ڈیٹ کریں',
              'تحديث الموقع أثناء استخدام التطبيق',
            )}
            value={!!s.autoLocation}
            onChange={(value) =>
              void db.configure({ ...s, autoLocation: value }).then(props.refresh)
            }
          />
          <div className="tool-actions">
            <button className="primary" disabled={locating} onClick={() => void locate()}>
              {tr('Update location now', 'ابھی مقام اپ ڈیٹ کریں', 'تحديث الموقع الآن')}
            </button>
            <button className="secondary" onClick={() => props.navigate('settings/location')}>
              {tr(
                'Choose location',
                'شہر، نقاط اور ٹائم زون دستی درج کریں',
                'المدينة والإحداثيات والمنطقة الزمنية يدويًا',
              )}
            </button>
          </div>
          <p className="notice">
            {tr(
              'Update your location when you travel. Your past prayer records stay the same. Ask a scholar about shortening or combining prayers.',
              'پس منظر میں مقام کی نگرانی نہیں ہوتی۔ سابقہ نمازوں کی اصل تاریخ اور درج اوقات محفوظ رہتے ہیں۔ قصر اور جمع جیسے سفری مسائل حالات اور علمی رائے پر منحصر ہیں؛ مستند عالم سے رجوع کریں۔ دین پاتھ خودکار شرعی فیصلہ نہیں کرتا۔',
              'لا تتبع للموقع في الخلفية. تحتفظ السجلات بتواريخها وأوقاتها الأصلية. أحكام القصر والجمع تعتمد على الظروف والاجتهاد؛ استشر عالمًا مؤهلًا. لا يقرر التطبيق حكم السفر تلقائيًا.',
            )}
          </p>
        </Panel>
      )}
    </>
  );
}
