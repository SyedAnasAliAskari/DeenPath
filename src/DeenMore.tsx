import { Heading, Panel, tr, type SuiteProps } from './deen-ui';
import {
  BookOpen,
  Compass,
  Heart,
  Settings,
  MessageCircle,
  CalendarDays,
  Plane,
  Cloud,
  HelpCircle,
} from 'lucide-react';
export function DeenMore({ navigate }: SuiteProps) {
  const groups = [
    {
      title: tr('Learn & reflect', 'سیکھیں اور غور کریں', 'تعلم وتأمل'),
      entries: [
        [
          'guidance',
          tr('DeenPath Guidance', 'دین پاتھ گائیڈنس', 'إرشاد دين باث'),
          tr('Ask DeenPath', 'دین پاتھ سے پوچھیں', 'اسأل دين باث'),
          MessageCircle,
        ],
        [
          'learning',
          tr('Islamic Learning', 'اسلامی تعلیم', 'التعلم الإسلامي'),
          tr('Short lessons and references', 'مختصر اسباق اور حوالے', 'دروس ومراجع قصيرة'),
          BookOpen,
        ],
        [
          'journal',
          tr('Gratitude Journal', 'شکر گزاری کی ڈائری', 'دفتر الامتنان'),
          tr('Your private reflections', 'آپ کا نجی غور و فکر', 'تأملاتك الخاصة'),
          Heart,
        ],
        [
          'protection',
          tr('Secrets', 'راز', 'الأسرار'),
          tr(
            'Private habits, daily check-ins and chosen penalties',
            'نجی عادتیں، روزانہ سوال اور منتخب عہد',
            'عادات خاصة وتسجيل يومي والتزامات مختارة',
          ),
          Heart,
        ],
      ],
    },
    {
      title: tr('Everyday tools', 'روزمرہ کے اوزار', 'أدوات يومية'),
      entries: [
        [
          'qibla',
          tr('Qibla Compass', 'قبلہ نما', 'بوصلة القبلة'),
          tr('Direction to the Kaaba', 'کعبہ کی سمت', 'الاتجاه إلى الكعبة'),
          Compass,
        ],
        [
          'calendar',
          tr('Hijri Calendar', 'ہجری تقویم', 'التقويم الهجري'),
          tr('Dates and occasions', 'تاریخیں اور مواقع', 'تواريخ ومناسبات'),
          CalendarDays,
        ],
        [
          'travel',
          tr('Travel Mode', 'سفر کا موڈ', 'وضع السفر'),
          tr('Update your prayer location', 'نماز کا مقام تبدیل کریں', 'تحديث موقع الصلاة'),
          Plane,
        ],
      ],
    },
    {
      title: tr('Your app', 'آپ کی ایپ', 'تطبيقك'),
      entries: [
        [
          'collectibles',
          'My Collection',
          'English and Urdu stories, saved to your shelf',
          BookOpen,
        ],
        ['shop', 'Theme Studio', 'Colors, wallpapers and gentle motion', Settings],
        ['gems', 'Gems', 'Your balance and transaction history', HelpCircle],
        [
          'settings',
          tr('Settings', 'ترتیبات', 'الإعدادات'),
          tr(
            'Appearance, reminders and sound',
            'تھیم، یاد دہانی اور آواز',
            'المظهر والتذكيرات والصوت',
          ),
          Settings,
        ],
      ],
    },
  ] as const;
  return (
    <>
      <Heading
        title={tr('More', 'مزید', 'المزيد')}
        text={tr(
          'A place for the rest of your path.',
          'آپ کے سفر کے مزید وسائل۔',
          'موارد أخرى لمسارك.',
        )}
      />
      {groups.map((group) => (
        <Panel key={group.title} title={group.title}>
          <div className="dp-menu">
            {group.entries.map(([page, label, description, Icon]) => (
              <button key={page} className="secondary" onClick={() => navigate(page)}>
                <Icon size={22} aria-hidden="true" />
                <span style={{ flex: 1 }}>
                  {label}
                  <small>{description}</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </Panel>
      ))}
      <Panel title={tr('Help & About', 'مدد اور تعارف', 'المساعدة وحول التطبيق')}>
        <strong>DeenPath 0.3.7</strong>
        <p>{tr('Guidance for a Better You.', 'بہتر آپ کے لیے رہنمائی۔', 'إرشاد لتكون أفضل.')}</p>
        <details className="calm-advanced">
          <summary>
            {tr('Reminders and widgets', 'یاد دہانی اور ویجٹس', 'التذكيرات والأدوات')}
          </summary>
          <p>
            {tr(
              'Choose Reminders & sound in Settings to set up notifications and Enforcer. Add DeenPath widgets from your Android launcher’s widget picker. Tap a streak widget’s title to choose a prayer.',
              'ترتیبات میں یاد دہانی اور آواز کھولیں۔ ہوم اسکرین کے ویجٹ مینو سے دین پاتھ کے ویجٹس شامل کریں۔ نماز منتخب کرنے کے لیے تسلسل ویجٹ کا عنوان دبائیں۔',
              'افتح التذكيرات والصوت في الإعدادات. أضف أدوات دين باث من قائمة الأدوات في الشاشة الرئيسية. اضغط عنوان أداة التتابع لاختيار الصلاة.',
            )}
          </p>
        </details>
        <p className="muted">
          {tr(
            'Your daily prayers and routines work offline. Sign in to back up your records.',
            'نمازیں اور معمولات آف لائن چلتے ہیں۔ بیک اپ کے لیے لاگ ان کریں۔',
            'تعمل صلواتك وأورادك دون اتصال. سجل الدخول لنسخ سجلاتك احتياطيًا.',
          )}
        </p>
      </Panel>
    </>
  );
}
