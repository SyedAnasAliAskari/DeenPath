import type { Lang } from './domain';
export const extra = {
  testOverlayPermission: [
    'Allow Display over other apps, return here, then tap Test Enforcer again.',
    'دوسری ایپس کے اوپر دکھانے کی اجازت دیں، واپس آ کر اینفورسر دوبارہ آزمائیں۔',
    'اسمح بالظهور فوق التطبيقات ثم عد واختبر التذكير مجددًا.',
  ],
  testInexactDelay: [
    'Exact-alarm permission is off. Android may delay the background test.',
    'درست وقت کے الارم کی اجازت بند ہے۔ اینڈرائیڈ پس منظر کی آزمائش میں تاخیر کر سکتا ہے۔',
    'إذن المنبه الدقيق معطل. قد يؤخر أندرويد الاختبار في الخلفية.',
  ],
  notificationSound: ['Notification sound', 'اطلاع کی آواز', 'صوت الإشعار'],
  systemSound: ['System notification sound', 'سسٹم کی اطلاع کی آواز', 'صوت إشعار النظام'],
  stageSounds: ['Separate sounds by stage', 'ہر مرحلے کی الگ آواز', 'أصوات منفصلة للمراحل'],
  useAppSound: ['Use app sound', 'ایپ کی آواز', 'استخدام صوت التطبيق'],
  soundHelp: [
    'Choose a sound in Android’s native picker. Notification volume, silent mode and Do Not Disturb still apply.',
    'اینڈرائیڈ کے اپنے انتخاب سے آواز چنیں۔ اطلاع کی آواز کا درجہ، خاموش موڈ اور ڈو ناٹ ڈسٹرب لاگو رہتے ہیں۔',
    'اختر صوتًا من منتقي أندرويد. يظل مستوى صوت الإشعارات والوضع الصامت وعدم الإزعاج ساريًا.',
  ],
  reminderTranslation: [
    'Quran reminder translation',
    'قرآنی یاد دہانی کا ترجمہ',
    'ترجمة تذكير القرآن',
  ],
  arabicEnglish: ['Arabic + English', 'عربی اور انگریزی', 'العربية والإنجليزية'],
  arabicUrdu: ['Arabic + Urdu', 'عربی اور اردو', 'العربية والأردية'],
  volumeMuted: [
    'Notification volume is zero or silent mode is enabled; no sound may play.',
    'اطلاع کی آواز صفر ہے یا خاموش موڈ فعال ہے؛ آواز نہیں آئے گی۔',
    'مستوى صوت الإشعارات صفر أو الوضع الصامت مفعّل؛ قد لا يصدر صوت.',
  ],
  appearance: ['Appearance', 'ظاہری انداز', 'المظهر'],
  system: ['Follow system', 'سسٹم کے مطابق', 'اتباع النظام'],
  light: ['Light', 'روشن', 'فاتح'],
  darkMode: ['Dark', 'تاریک', 'داكن'],
  overlay: ['Show above other apps', 'دوسری ایپس کے اوپر دکھائیں', 'العرض فوق التطبيقات'],
  overlayHelp: [
    'Optional and dismissible. Allow “Display over other apps” in Android Settings. Locked screens and system restrictions use notifications instead.',
    'اختیاری یاد دہانی جسے آپ بند کر سکتے ہیں۔ اینڈرائیڈ ترتیبات میں دوسری ایپس کے اوپر دکھانے کی اجازت دیں۔ مقفل اسکرین یا سسٹم پابندیوں میں اطلاع دکھائی جائے گی۔',
    'تذكير اختياري يمكنك إغلاقه. اسمح بالعرض فوق التطبيقات في إعدادات أندرويد. تُستخدم الإشعارات عند قفل الشاشة أو وجود قيود.',
  ],
  testNotification: ['Test notification', 'اطلاع آزمائیں', 'اختبار الإشعار'],
  testEnforcer: ['Test Enforcer reminder', 'نماز کی یاد دہانی آزمائیں', 'اختبار تذكير الصلاة'],
  testScheduled: [
    'Scheduled for about 15 seconds from now. Put the app in the background to check delivery. Scheduling does not confirm delivery.',
    'تقریباً پندرہ سیکنڈ بعد کے لیے مقرر ہے۔ ایپ پس منظر میں رکھ کر اطلاع کی آمد دیکھیں۔ مقرر ہونا اطلاع پہنچنے کی تصدیق نہیں۔',
    'تمت الجدولة بعد نحو 15 ثانية. ضع التطبيق في الخلفية للتحقق من الوصول. نجاح الجدولة لا يؤكد وصول الإشعار.',
  ],
  testBlocked: [
    'Notifications are blocked. Allow notifications and enable the test channel in Android Settings, then retry.',
    'اطلاعات بند ہیں۔ اینڈرائیڈ ترتیبات میں اطلاعات اور آزمائشی چینل کھول کر دوبارہ کوشش کریں۔',
    'الإشعارات محظورة. اسمح بها وفعّل قناة الاختبار في إعدادات أندرويد ثم أعد المحاولة.',
  ],
  notificationHelp: [
    'If nothing appears, check notification permission, channel sound, Alarms & reminders, Do Not Disturb and battery restrictions. Exact-alarm denial can delay delivery.',
    'اطلاع نہ آئے تو اجازت، چینل کی آواز، الارم، ڈو ناٹ ڈسٹرب اور بیٹری پابندیاں دیکھیں۔ درست وقت کے الارم کی اجازت نہ ہونے پر تاخیر ممکن ہے۔',
    'إن لم يظهر شيء فتحقق من الإذن وصوت القناة والمنبهات وعدم الإزعاج وقيود البطارية. رفض المنبهات الدقيقة قد يؤخر الوصول.',
  ],
  androidOnly: [
    'Background reminders require the Android app.',
    'پس منظر کی یاد دہانی کے لیے اینڈرائیڈ ایپ ضروری ہے۔',
    'تتطلب التذكيرات الخلفية تطبيق أندرويد.',
  ],
  reminderHelp: [
    'Android controls channel sounds and interruption settings. Reminders are always dismissible. No device lock or app-usage monitoring is used.',
    'اینڈرائیڈ چینل کی آواز اور مداخلت کی ترتیبات سنبھالتا ہے۔ یاد دہانی ہمیشہ بند کی جا سکتی ہے۔ فون مقفل نہیں کیا جاتا اور دوسری ایپس کی نگرانی نہیں ہوتی۔',
    'يتحكم أندرويد في أصوات القنوات وإعدادات المقاطعة. يمكنك إغلاق كل تذكير. لا قفل للجهاز ولا مراقبة لاستخدام التطبيقات.',
  ],
  freezeHelp: [
    'Seven consecutive successful daily completions earn one Freeze Point, up to three. A missed voluntary day can spend one to protect its streak without marking it completed. Prayer history is never protected or erased.',
    'روزانہ سات مسلسل کامیاب تکمیلات پر ایک فریز پوائنٹ ملتا ہے، زیادہ سے زیادہ تین۔ نفلی معمول کا چھوٹا ہوا دن ایک پوائنٹ خرچ کر کے تسلسل محفوظ رکھ سکتا ہے، مکمل درج کیے بغیر۔ نماز کی تاریخ اس سے تبدیل نہیں ہوتی۔',
    'تمنح سبعة إتمامات يومية ناجحة متتالية نقطة تجميد واحدة، بحد أقصى ثلاث. يمكن حماية سلسلة ورد تطوعي فائت بنقطة دون تسجيل إتمامه. لا تُحمى سجلات الصلاة ولا تُمحى بالنقاط.',
  ],
  pendingRecords: ['Pending records', 'منتظر اندراجات', 'سجلات معلقة'],
  pendingFiles: ['Pending files', 'منتظر فائلیں', 'ملفات معلقة'],
  connection: ['Connection', 'رابطہ', 'الاتصال'],
  online: ['Online', 'متصل', 'متصل'],
  offlineConnection: ['Offline', 'غیر متصل', 'دون اتصال'],
  details: ['Details', 'تفصیلات', 'التفاصيل'],
  intervals: ['Repeat interval (minutes)', 'دہرانے کا وقفہ (منٹ)', 'فاصل التكرار بالدقائق'],
  once: ['Once per stage', 'ہر مرحلے میں ایک بار', 'مرة لكل مرحلة'],
  snoozeMinutes: ['Remind later (minutes)', 'بعد میں یاد دہانی (منٹ)', 'التأجيل بالدقائق'],
  unscheduled: ['Unscheduled', 'بغیر شیڈول', 'دون جدول'],
  dailyDeadline: [
    'Daily deadline (next day)',
    'روزانہ کی آخری حد (اگلا دن)',
    'الموعد اليومي النهائي (اليوم التالي)',
  ],
  autoLocation: [
    'Update location while using the app',
    'ایپ کھلی ہو تو مقام کی تبدیلی پہچانیں',
    'تحديث الموقع أثناء استخدام التطبيق',
  ],
  alarms: ['Alarms & reminders', 'الارم اور یاد دہانیاں', 'المنبهات والتذكيرات'],
  battery: ['Battery settings', 'بیٹری کی ترتیبات', 'إعدادات البطارية'],
  overlayPermission: ['Overlay permission', 'اوپر دکھانے کی اجازت', 'إذن العرض فوق التطبيقات'],
  permissionStatus: ['Check permissions', 'اجازتیں دیکھیں', 'فحص الأذونات'],
  enabled: ['Enabled', 'فعال', 'مفعّل'],
  disabled: ['Disabled', 'بند', 'معطّل'],
  qazaDone: ['Qaza completed', 'قضا ادا کر لی', 'تم القضاء'],
  award: ['Award', 'حاصل', 'اكتساب'],
  spend: ['Spent', 'خرچ', 'إنفاق'],
  previewBackup: [
    'Cloud features need your configured PHP API. Offline worship data remains on this device.',
    'کلاؤڈ کے لیے پی ایچ پی اے پی آئی کی ترتیب ضروری ہے۔ آف لائن عبادت کا ڈیٹا اسی آلے پر رہتا ہے۔',
    'تحتاج ميزات السحابة إلى إعداد واجهة PHP. تبقى بيانات العبادة المحلية على هذا الجهاز.',
  ],
  apiAddress: ['HTTPS API address', 'محفوظ اے پی آئی کا پتہ', 'عنوان واجهة HTTPS'],
  readingZoom: ['Reading zoom', 'مطالعہ کا زوم', 'تكبير القراءة'],
  emailCodeSent: [
    'If mail is configured, check your email for a code.',
    'ای میل ترتیب دی گئی ہو تو اپنے ای میل میں کوڈ دیکھیں۔',
    'إذا كان البريد مُعدًا فتحقق من رسالة الرمز.',
  ],
  confirmAction: ['Confirm this action', 'اس عمل کی تصدیق کریں', 'تأكيد هذا الإجراء'],
  localCloud: ['Local / cloud', 'مقامی / کلاؤڈ', 'محلي / سحابي'],
  syncPending: [
    'Some changes need attention in Sync Center',
    'کچھ تبدیلیوں کے لیے ہم آہنگی مرکز دیکھیں',
    'تحتاج بعض التغييرات إلى المراجعة في مركز المزامنة',
  ],
  opening: [
    'Opening your daily space…',
    'آپ کی روزانہ کی جگہ کھول رہے ہیں…',
    'جارٍ فتح مساحتك اليومية…',
  ],
  errorGeneric: [
    'Could not complete the action. Check your connection and settings, then retry.',
    'عمل مکمل نہیں ہو سکا۔ رابطہ اور ترتیبات دیکھ کر دوبارہ کوشش کریں۔',
    'تعذر إكمال الإجراء. تحقق من الاتصال والإعدادات ثم أعد المحاولة.',
  ],
  appVersion: ['App version', 'ایپ کا ورژن', 'إصدار التطبيق'],
} as const;
export type ExtraKey = keyof typeof extra;
export const extraText = (key: ExtraKey, lang: Lang) =>
  extra[key][lang === 'ur' ? 1 : lang === 'ar' ? 2 : 0];
const errors: Record<string, [string, string]> = {
  'Passwords do not match': ['پاس ورڈ یکساں نہیں ہیں', 'كلمتا المرور غير متطابقتين'],
  'Sign in to synchronize': ['ہم آہنگی کے لیے لاگ ان کریں', 'سجل الدخول للمزامنة'],
  'Sign in required': ['لاگ ان ضروری ہے', 'يلزم تسجيل الدخول'],
  'Session expired': ['سیشن ختم ہو گیا۔ دوبارہ لاگ ان کریں', 'انتهت الجلسة. سجل الدخول مجددًا'],
  'Email or password is incorrect': [
    'ای میل یا پاس ورڈ درست نہیں',
    'البريد أو كلمة المرور غير صحيحة',
  ],
  'Current password is incorrect': ['موجودہ پاس ورڈ درست نہیں', 'كلمة المرور الحالية غير صحيحة'],
  'Mail delivery is not configured': [
    'ای میل کی ترسیل ترتیب نہیں دی گئی',
    'لم يتم إعداد إرسال البريد',
  ],
  'Mail delivery failed': ['ای میل بھیجنا ممکن نہیں ہوا', 'تعذر إرسال البريد'],
  'Invalid or expired code': ['کوڈ غلط ہے یا مدت ختم ہو گئی', 'الرمز غير صالح أو منتهي الصلاحية'],
  'Too many requests. Try later.': [
    'درخواستیں زیادہ ہیں۔ بعد میں کوشش کریں',
    'طلبات كثيرة. حاول لاحقًا',
  ],
  'Unable to register this email': ['اس ای میل سے اندراج ممکن نہیں', 'تعذر التسجيل بهذا البريد'],
  'Configure your HTTPS API URL in Settings first': [
    'پہلے ترتیبات میں محفوظ اے پی آئی کا پتہ درج کریں',
    'أعدّ عنوان واجهة HTTPS في الإعدادات أولًا',
  ],
  'This routine has not started yet': ['یہ معمول ابھی شروع نہیں ہوا', 'لم يبدأ هذا الورد بعد'],
  'Restore this document from the cloud first': [
    'پہلے یہ دستاویز کلاؤڈ سے بحال کریں',
    'استعد هذا المستند من السحابة أولًا',
  ],
  'Resolve and sync pending changes first': [
    'پہلے منتظر تبدیلیاں درست اور ہم آہنگ کریں',
    'راجع التغييرات المعلقة وزامنها أولًا',
  ],
  'Sign out before changing servers': [
    'سرور تبدیل کرنے سے پہلے لاگ آؤٹ کریں',
    'سجل الخروج قبل تغيير الخادم',
  ],
  'Type DELETE': ['تصدیق کے لیے DELETE لکھیں', 'اكتب DELETE للتأكيد'],
  'Sign in to update your cloud profile': [
    'کلاؤڈ پروفائل تبدیل کرنے کے لیے لاگ ان کریں',
    'سجل الدخول لتحديث ملفك السحابي',
  ],
  'Maximum file size is 8 MiB': [
    'فائل کی زیادہ سے زیادہ حد آٹھ میبی بائٹ ہے',
    'الحد الأقصى للملف 8 ميبيبايت',
  ],
  'Choose PDF, PNG, JPEG or WebP': [
    'پی ڈی ایف، پی این جی، جے پی ای جی یا ویب پی منتخب کریں',
    'اختر PDF أو PNG أو JPEG أو WebP',
  ],
  'Storage quota reached': ['ذخیرے کی حد پوری ہو گئی', 'تم بلوغ حصة التخزين'],
  'File exceeds limit': ['فائل مقررہ حد سے بڑی ہے', 'حجم الملف يتجاوز الحد'],
  'File not found': ['فائل نہیں ملی', 'الملف غير موجود'],
  'File download failed': ['فائل ڈاؤن لوڈ نہیں ہو سکی', 'تعذر تنزيل الملف'],
  'Location permission denied': ['مقام کی اجازت نہیں دی گئی', 'رُفض إذن الموقع'],
  'Location timed out. Enter coordinates manually.': [
    'مقام حاصل کرنے کا وقت ختم۔ نقاط خود درج کریں',
    'انتهت مهلة الموقع. أدخل الإحداثيات يدويًا',
  ],
  'Enable location or enter coordinates manually': [
    'مقام فعال کریں یا نقاط خود درج کریں',
    'فعّل الموقع أو أدخل الإحداثيات يدويًا',
  ],
  'No location fix available. Enter coordinates manually.': [
    'مقام نہیں ملا۔ نقاط خود درج کریں',
    'تعذر تحديد الموقع. أدخل الإحداثيات يدويًا',
  ],
  'Some changes need attention in Sync Center': [
    'کچھ تبدیلیوں کے لیے ہم آہنگی مرکز دیکھیں',
    'تحتاج بعض التغييرات إلى المراجعة في مركز المزامنة',
  ],
  'Conflict: review local and cloud values in Sync Center': [
    'ہم آہنگی مرکز میں مقامی اور کلاؤڈ اندراج کا اختلاف دیکھیں',
    'راجع تعارض القيم المحلية والسحابية في مركز المزامنة',
  ],
  'Enter valid latitude and longitude': [
    'درست عرض بلد اور طول بلد درج کریں',
    'أدخل خط عرض وخط طول صالحين',
  ],
  'API URL must be HTTPS and end with /api.php': [
    'اے پی آئی کا پتہ HTTPS پر ہو اور /api.php پر ختم ہو',
    'يجب أن يبدأ العنوان بـ HTTPS وينتهي بـ /api.php',
  ],
  'Password must contain 12–128 bytes': [
    'پاس ورڈ بارہ سے ایک سو اٹھائیس بائٹ تک ہو',
    'يجب أن تكون كلمة المرور من 12 إلى 128 بايت',
  ],
  'This installation contains another account. Export pending data and clear it before switching accounts.':
    [
      'اس تنصیب میں دوسرا اکاؤنٹ ہے۔ اکاؤنٹ بدلنے سے پہلے منتظر ڈیٹا برآمد اور محفوظ طور پر صاف کریں',
      'تحتوي هذه النسخة على حساب آخر. صدّر البيانات المعلقة وامسحها بأمان قبل التبديل',
    ],
};
export function localizeMessage(message: string, lang: Lang): string {
  if (lang === 'en' || /[\u0600-\u06ff]/.test(message)) return message;
  const known = errors[message];
  if (known) return known[lang === 'ur' ? 0 : 1];
  const entry = Object.values(extra).find((v) => v[0] === message);
  if (entry) return entry[lang === 'ur' ? 1 : 2];
  return extraText('errorGeneric', lang);
}
