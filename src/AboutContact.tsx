import { Mail, Heart, Bell, BookOpen } from 'lucide-react';
import { tr } from './deen-ui';
export const authorEmail = 'mailto:syedanasaliaskarivu@gmail.com?subject=DeenPath%20feedback';
export function AboutContact() {
  const lines = [
    tr(
      'DeenPath supports a steady daily worship routine.',
      'دین پاتھ روزانہ عبادت میں مستقل مزاجی میں مدد دیتا ہے۔',
      'يساعدك دين باث على الاستمرار في العبادة اليومية.',
    ),
    tr(
      'Plan your five prayers with local prayer times.',
      'مقامی اوقات کے مطابق پانچ نمازوں کی تیاری کریں۔',
      'خطط لصلواتك الخمس وفق الأوقات المحلية.',
    ),
    tr(
      'Track missed prayers and complete Qaza at your pace.',
      'فوت شدہ نمازیں درج کریں اور اپنی رفتار سے قضا ادا کریں۔',
      'تابع الصلوات الفائتة وأدّ القضاء على مهل.',
    ),
    tr(
      'Build routines for ayat, duas, tasbih and Nafl.',
      'آیات، دعاؤں، تسبیح اور نوافل کے معمولات بنائیں۔',
      'أنشئ أوراداً للآيات والأدعية والتسبيح والنوافل.',
    ),
    tr(
      'Keep personal promises private in Secrets.',
      'اپنے ذاتی عہد راز میں محفوظ رکھیں۔',
      'احفظ عهودك الشخصية بخصوصية في الأسرار.',
    ),
    tr(
      'Use reminders and widgets to stay connected.',
      'یاد دہانیوں اور وجٹس سے اپنے معمول کو یاد رکھیں۔',
      'استعن بالتذكيرات والأدوات المصغرة لمتابعة يومك.',
    ),
    tr(
      'Earn Gems for the activities you complete.',
      'مکمل سرگرمیوں پر جواہرات حاصل کریں۔',
      'اكسب الجواهر مقابل الأنشطة التي تكملها.',
    ),
    tr(
      'Collect reviewed stories in English and Urdu.',
      'انگریزی اور اردو میں تصدیق شدہ کہانیاں جمع کریں۔',
      'اجمع قصصاً مراجعة بالإنجليزية والأردية.',
    ),
    tr(
      'Keep progress offline, with optional cloud backup.',
      'پیش رفت آف لائن محفوظ رکھیں، آن لائن بیک اپ اختیاری ہے۔',
      'احفظ تقدمك دون اتصال مع نسخ سحابي اختياري.',
    ),
  ];
  return (
    <div className="about-help">
      <section className="card settings-card about-contact">
        <h2>{tr('Help & About', 'مدد اور تعارف', 'المساعدة وحول التطبيق')}</h2>
        <Heart size={28} aria-hidden="true" />
        <h3>DeenPath</h3>
        <p>
          {tr(
            'Your daily prayer and worship companion.',
            'نماز اور عبادت میں آپ کا روزانہ ساتھی۔',
            'رفيقك اليومي للصلاة والعبادة.',
          )}
        </p>
        <p className="author-credit">
          Made By <a href={authorEmail}>Syed Anas Ali Askari</a>
        </p>
      </section>
      <section className="card settings-card">
        <h2>
          <Bell size={20} />
          {tr('Reminders and Widgets', 'یاد دہانیاں اور وجٹس', 'التذكيرات والأدوات المصغرة')}
        </h2>
        <p>
          {tr(
            'Prayer reminders adapt as time passes. Widgets show prayers, Gems, your collection and daily progress. Open reminder settings to choose intervals and notification permissions.',
            'وقت کے ساتھ نماز کی یاد دہانیوں کا وقفہ بدلتا ہے۔ وجٹس میں نماز، جواہرات، مجموعہ اور روزانہ پیش رفت دیکھیں۔ وقفے اور اجازتیں یاد دہانیوں کی ترتیبات میں منتخب کریں۔',
            'تتغير فواصل تذكير الصلاة مع الوقت. تعرض الأدوات الصلاة والجواهر والمجموعة والتقدم اليومي. اختر الفواصل والأذونات من إعدادات التذكير.',
          )}
        </p>
      </section>
      <section className="card settings-card about-app">
        <h2>
          <BookOpen size={20} />
          {tr('About the app', 'ایپ کا تعارف', 'عن التطبيق')}
        </h2>
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </section>
      <section className="card settings-card about-contact">
        <h2>{tr('Get in touch', 'رابطہ کریں', 'تواصل معنا')}</h2>
        <p>
          {tr(
            'Have a suggestion, question or problem? Send me an email.',
            'تجویز، سوال یا مسئلہ ہو تو مجھے ای میل کریں۔',
            'هل لديك اقتراح أو سؤال أو مشكلة؟ أرسل لي بريداً إلكترونياً.',
          )}
        </p>
        <a href={authorEmail} className="primary">
          <Mail size={18} />
          {tr('Email Syed Anas', 'سید انس کو ای میل کریں', 'مراسلة سيد أنس')}
        </a>
        <a href={authorEmail}>syedanasaliaskarivu@gmail.com</a>
        <small className="muted">
          {tr(
            'Opens your email app. Review your message before sending.',
            'ای میل ایپ کھلے گی۔ بھیجنے سے پہلے پیغام دیکھ سکتے ہیں۔',
            'يفتح تطبيق البريد لتراجع رسالتك قبل إرسالها.',
          )}
        </small>
      </section>
    </div>
  );
}
