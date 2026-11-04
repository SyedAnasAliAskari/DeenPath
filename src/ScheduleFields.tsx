import { useState } from 'react';
import { Field } from './components';
import { tr } from './deen-ui';
export function ScheduleFields({
  data,
  frequency,
}: {
  data?: Record<string, any>;
  frequency?: string;
}) {
  const [calendar, setCalendar] = useState(data?.calendar || 'gregorian');
  return (
    <details className="calm-advanced" open={frequency === 'weekdays' || undefined}>
      <summary>
        {tr(
          'Repeat, end date & reminders',
          'دہرائی، اختتامی تاریخ اور یاد دہانی',
          'التكرار وتاريخ النهاية والتذكير',
        )}
      </summary>
      <p className="muted">
        {tr(
          'Optional: choose when this routine stops, repeat it on selected weekdays or a Hijri occasion, and add a follow-up reminder.',
          'اختیاری: معمول کی آخری تاریخ، ہفتے کے دن، ہجری موقع اور دوبارہ یاد دہانی منتخب کریں۔',
          'اختياري: حدد نهاية الورد وأيام التكرار أو مناسبة هجرية وأضف تذكير متابعة.',
        )}
      </p>
      <div className="field-grid">
        <Field label={tr('Optional end date', 'اختیاری اختتامی تاریخ', 'تاريخ نهاية اختياري')}>
          <input name="endDate" type="date" defaultValue={data?.endDate || ''} />
        </Field>
        <Field
          label={tr(
            'Calendar for selected occasion',
            'مخصوص موقع کی تقویم',
            'تقويم المناسبة المختارة',
          )}
        >
          <select name="calendar" value={calendar} onChange={(e) => setCalendar(e.target.value)}>
            <option value="gregorian">{tr('Gregorian', 'عیسوی', 'ميلادي')}</option>
            <option value="hijri">
              {tr('Hijri (calculated civil)', 'ہجری (حسابی سول)', 'هجري (مدني محسوب)')}
            </option>
          </select>
        </Field>
        {calendar === 'hijri' && (
          <>
            {' '}
            <Field label={tr('Hijri month', 'ہجری مہینہ', 'الشهر الهجري')}>
              <input
                name="hijriMonth"
                type="number"
                min="1"
                max="12"
                defaultValue={data?.hijriMonth || 9}
              />
            </Field>
            <Field label={tr('Hijri day', 'ہجری دن', 'اليوم الهجري')}>
              <input
                name="hijriDay"
                type="number"
                min="1"
                max="30"
                defaultValue={data?.hijriDay || 1}
              />
            </Field>
          </>
        )}
        <Field
          label={tr(
            'Follow-up minutes (0 = off)',
            'دوبارہ یاد دہانی منٹ بعد (۰ = بند)',
            'المتابعة بالدقائق (٠ = إيقاف)',
          )}
        >
          <input
            name="followup"
            type="number"
            min="0"
            max="360"
            defaultValue={data?.followup || 0}
          />
        </Field>
      </div>
      {frequency === 'weekdays' && (
        <fieldset>
          <legend>{tr('Selected weekdays', 'منتخب ایام', 'الأيام المختارة')}</legend>
          {[
            tr('Sunday', 'اتوار', 'الأحد'),
            tr('Monday', 'پیر', 'الاثنين'),
            tr('Tuesday', 'منگل', 'الثلاثاء'),
            tr('Wednesday', 'بدھ', 'الأربعاء'),
            tr('Thursday', 'جمعرات', 'الخميس'),
            tr('Friday', 'جمعہ', 'الجمعة'),
            tr('Saturday', 'ہفتہ', 'السبت'),
          ].map((day, i) => (
            <label className="dp-weekday" key={day}>
              <input
                type="checkbox"
                name="weekdays"
                value={i}
                defaultChecked={(data?.weekdays?.length ? data.weekdays : [1]).includes(i)}
              />
              {day}
            </label>
          ))}
        </fieldset>
      )}
      <p className="muted">
        {tr(
          'Hijri occasions repeat on the selected calculated month/day; local moon sightings can differ. Previous schedule definitions remain available for historical reporting.',
          'ہجری مواقع حسابی مہینے اور دن پر دہرائے جاتے ہیں؛ مقامی رویت مختلف ہو سکتی ہے۔ تاریخی رپورٹ کے لیے پرانی ترتیب محفوظ رہتی ہے۔',
          'تتكرر المناسبات في الشهر واليوم المحسوبين وقد تختلف الرؤية المحلية. تحفظ تعريفات الجدول السابقة للتقارير التاريخية.',
        )}
      </p>
    </details>
  );
}
