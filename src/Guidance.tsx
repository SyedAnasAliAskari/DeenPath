import quran from './content/quran.json';
import { reminderBody } from './content';
import { useEffect, useRef, useState } from 'react';
import { db } from './store';
import { Native, isNative } from './native';
import { usePrivate, Unlock } from './PrivateLife';
import { putPrivate } from './private-store';
import { askProviders, takeLessonDraft, type ChatMessage } from './guidance-model';
import { tr, Heading, Panel, err, type SuiteProps } from './deen-ui';
import { Field, Toggle } from './components';
import { useBack } from './back';
export const guidanceNotice = () =>
  tr(
    'DeenPath Guidance is an AI-powered educational assistant. Its answers may contain mistakes, incomplete information, or differences in scholarly interpretation. For important religious rulings, personal circumstances, or matters of Islamic law, please consult a qualified Islamic scholar (Alim/Alima). AI guidance is not a fatwa and should not replace qualified scholarly advice.',
    'دین پاتھ گائیڈنس ایک مصنوعی ذہانت پر مبنی تعلیمی معاون ہے۔ اس کے جوابات میں غلطیاں، نامکمل معلومات یا علمی تعبیر میں اختلاف ہو سکتا ہے۔ اہم شرعی مسائل، ذاتی حالات یا اسلامی قانون کے معاملات میں کسی مستند عالم یا عالمہ سے رجوع کریں۔ مصنوعی ذہانت کی رہنمائی فتویٰ نہیں ہے اور مستند علمی مشورے کا متبادل نہیں۔',
    'إرشاد دين باث مساعد تعليمي يعمل بالذكاء الاصطناعي. قد تتضمن إجاباته أخطاء أو معلومات ناقصة أو اختلافات في التفسير العلمي. للأحكام المهمة والظروف الشخصية والمسائل الفقهية استشر عالمًا أو عالمة مؤهلة. إرشاد الذكاء الاصطناعي ليس فتوى ولا يغني عن المشورة العلمية المؤهلة.',
  );
type Conversation = { id: string; title: string; messages: ChatMessage[]; type: 'chat' };
function boundedMessages(messages: ChatMessage[]) {
  let size = 0;
  const result: ChatMessage[] = [];
  for (const m of [...messages].reverse().slice(0, 20)) {
    if (size + m.text.length > 20000) break;
    result.unshift(m);
    size += m.text.length;
  }
  return result;
}
export function Guidance(props: SuiteProps) {
  const vault = usePrivate(props.notify);
  const [accepted, setAccepted] = useState(!!db.state.settings.guidanceNotice),
    [settings, setSettings] = useState(false),
    [provider, setProvider] = useState({ paid: false, gemini: false }),
    [conversations, setConversations] = useState<Conversation[]>([]),
    [active, setActive] = useState(''),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [draft, setDraft] = useState(() => takeLessonDraft()),
    [busy, setBusy] = useState(false),
    [source, setSource] = useState(''),
    [history, setHistory] = useState(true),
    [cloud, setCloud] = useState(false),
    [fallback, setFallback] = useState(true),
    [eligible, setEligible] = useState(false),
    [errors, setErrors] = useState('');
  useBack(() => {
    if (settings) {
      setSettings(false);
      return true;
    }
    return false;
  });
  const inFlight = useRef(false),
    wasUnlocked = useRef(false);
  useEffect(() => {
    if (vault.locked || vault.loading) return;
    if (isNative) {
      void Native.deen({ op: 'providerStatus' }).then(setProvider);
      void Native.deen({ op: 'localChatRead' })
        .then((r) => {
          setConversations(r.value ? JSON.parse(r.value) : []);
        })
        .catch(() => {});
    }
  }, [vault.locked, vault.loading]);
  useEffect(() => {
    if (vault.locked && wasUnlocked.current) {
      setMessages([]);
      setConversations([]);
      setDraft('');
    }
    if (!vault.locked) wasUnlocked.current = true;
  }, [vault.locked]);
  async function persist(next: ChatMessage[], id = active) {
    if (!history) return;
    const record: Conversation = {
      id: id || crypto.randomUUID(),
      type: 'chat',
      title:
        next.find((m) => m.role === 'user')?.text.slice(0, 70) ||
        tr('New conversation', 'نئی گفتگو', 'محادثة جديدة'),
      messages: boundedMessages(next),
    };
    setActive(record.id);
    const all = [...conversations.filter((c) => c.id !== record.id), record];
    setConversations(all);
    if (cloud) await putPrivate(record);
    else if (isNative)
      await Native.deen({ op: 'localChatWrite', value: JSON.stringify(all.slice(-50)) });
  }
  async function send(test = false, which = '') {
    if (inFlight.current || (!test && !draft.trim())) return;
    if (!eligible) {
      setErrors(
        tr(
          'Confirm provider eligibility and privacy terms below before connecting.',
          'جڑنے سے پہلے نیچے اہلیت اور رازداری کی شرائط کی تصدیق کریں۔',
          'أكد الأهلية وشروط الخصوصية أدناه قبل الاتصال.',
        ),
      );
      setSettings(true);
      return;
    }
    if (!isNative) {
      setErrors(
        tr(
          'Provider connections are available in the Android app. Offline learning is available here.',
          'فراہم کنندہ سے رابطہ اینڈرائیڈ ایپ میں ہے۔ یہاں آف لائن تعلیم دستیاب ہے۔',
          'اتصالات المزود متاحة في تطبيق أندرويد. التعلم دون اتصال متاح هنا.',
        ),
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setErrors('');
    const question = test ? 'Reply with a short greeting.' : draft.trim();
    const next: ChatMessage[] = [
      ...(test ? [] : messages),
      { role: 'user', text: question, at: new Date().toISOString() },
    ];
    if (!test) {
      setMessages(next);
      setDraft('');
    }
    try {
      const result = await askProviders(
        next,
        which ? { paid: which === 'paid', gemini: which === 'gemini' } : provider,
        test ? false : fallback,
        (provider, messages) => Native.deen({ op: 'guidance', which: provider, messages }),
      );
      setSource(
        result.provider +
          (result.failures.length
            ? ' · ' + tr('Fallback attempted', 'متبادل آزمایا گیا', 'تمت محاولة البديل')
            : ''),
      );
      if (result.text) {
        if (test)
          props.notify(
            tr(
              'Connection responded successfully. Test requests may consume quota or incur charges.',
              'رابطہ کامیاب رہا۔ آزمائشی درخواست کوٹہ یا چارج استعمال کر سکتی ہے۔',
              'استجاب الاتصال بنجاح. قد تستهلك الاختبارات الحصة أو رسومًا.',
            ),
          );
        else {
          const answer: ChatMessage = {
            role: 'assistant',
            text: result.text,
            provider: result.provider,
            at: new Date().toISOString(),
          };
          setMessages([...next, answer]);
          await persist([...next, answer]);
        }
      } else {
        setErrors(
          tr(
            'No online provider is available. Your question is retained. Open verified offline lessons or retry later. Rasikh is unavailable because its documentation and terms could not be verified.',
            'آن لائن فراہم کنندہ دستیاب نہیں۔ سوال محفوظ ہے۔ تصدیق شدہ آف لائن اسباق کھولیں یا بعد میں کوشش کریں۔ راسخ کی دستاویزات و شرائط کی تصدیق نہ ہونے کے باعث دستیاب نہیں۔',
            'لا يتوفر مزود متصل. احتفظنا بالسؤال. افتح الدروس الموثقة أو أعد المحاولة لاحقًا. راسخ غير متاح لتعذر التحقق من وثائقه وشروطه.',
          ) +
            ' ' +
            result.failures
              .map(
                (f) =>
                  `${f.provider}: ${f.status === 429 ? tr('quota / rate limit', 'کوٹہ / رفتار کی حد', 'الحصة / حد المعدل') : f.status === 401 || f.status === 403 ? tr('authentication / access', 'تصدیق / رسائی', 'المصادقة / الوصول') : f.status || tr('network error', 'نیٹ ورک خرابی', 'خطأ الشبكة')}`,
              )
              .join(' · '),
        );
        if (!test) {
          await persist(next);
          setDraft(question);
        }
      }
    } catch (e) {
      setErrors(err(e));
      if (!test) setDraft(question);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="guidance-screen">
      <Heading
        title={tr('DeenPath Guidance', 'دین پاتھ گائیڈنس', 'إرشاد دين باث')}
        text={tr('Ask DeenPath', 'دین پاتھ سے پوچھیں', 'اسأل دين باث')}
      />
      {!accepted ? (
        <Panel
          title={tr('Islamic Guidance Notice', 'اسلامی رہنمائی کی اطلاع', 'تنبيه الإرشاد الإسلامي')}
        >
          <p>{guidanceNotice()}</p>
          <button
            className="primary"
            onClick={() => {
              setAccepted(true);
              void db.configure({ ...db.state.settings, guidanceNotice: true }).then(props.refresh);
            }}
          >
            {tr('I understand', 'میں سمجھتا ہوں', 'أفهم')}
          </button>
        </Panel>
      ) : vault.locked ? (
        <Unlock load={vault.load} notify={props.notify} />
      ) : (
        <>
          <p className="notice">
            {tr(
              'AI guidance is not a fatwa. Model explanations and references are unverified unless matched to a bundled source.',
              'مصنوعی ذہانت کی رہنمائی فتویٰ نہیں۔ ماڈل کی تشریح و حوالہ غیر مصدقہ ہے جب تک موجود تصدیق شدہ ماخذ سے نہ ملے۔',
              'إرشاد الذكاء الاصطناعي ليس فتوى. شروحه ومراجعه غير موثقة ما لم تطابق مصدرًا محليًا موثقًا.',
            )}
          </p>
          <div className="dp-tabs">
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                setActive('');
                setMessages([]);
                setDraft('');
              }}
            >
              {tr('New conversation', 'نئی گفتگو', 'محادثة جديدة')}
            </button>
            <button className="secondary" onClick={() => setSettings(!settings)}>
              {tr('AI connection & privacy', 'فراہم کنندہ اور رازداری', 'إعدادات المزود والخصوصية')}
            </button>
            <button className="secondary" onClick={() => props.navigate('learning')}>
              {tr('Verified offline learning', 'تصدیق شدہ آف لائن تعلیم', 'تعلم موثق دون اتصال')}
            </button>
          </div>
          {settings && (
            <Panel title={tr('Provider connections', 'فراہم کنندہ سے رابطہ', 'اتصالات المزود')}>
              <p>{guidanceNotice()}</p>
              <p>
                {tr(
                  'Only your personal Gemini API connections are implemented: a billed Gemini key first, then your own free-tier key if fallback is enabled. The account/project controls actual billing and quota. No shared app key is used. Google Sign-In alone does not provision Gemini quota; use an AI Studio project/key.',
                  'صرف آپ کے ذاتی جیمنائی رابطے دستیاب ہیں: پہلے بِل والا، پھر اجازت ہونے پر ذاتی فری ٹیئر کلید۔ اصل بِل اور کوٹہ اکاؤنٹ / پروجیکٹ کے مطابق ہیں۔ مشترکہ ایپ کلید نہیں۔ صرف گوگل سائن ان کوٹہ نہیں بناتا؛ اے آئی اسٹوڈیو کی کلید استعمال کریں۔',
                  'ندعم اتصال Gemini الشخصي فقط: المفتاح المفوتر أولًا ثم مفتاحك المجاني إن سمحت بالبديل. الحساب والمشروع يحددان الرسوم والحصة. لا مفتاح مشترك. تسجيل Google وحده لا يوفر حصة Gemini؛ استخدم مفتاح مشروع AI Studio.',
                )}
              </p>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                Google AI Studio
              </a>{' '}
              ·{' '}
              <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">
                {tr('Provider terms', 'شرائط', 'الشروط')}
              </a>
              <label className="dp-consent">
                <input
                  type="checkbox"
                  checked={eligible}
                  onChange={(e) => setEligible(e.target.checked)}
                />
                <span>
                  {tr(
                    'I am 18+, in a supported region, and meet the provider’s developer/professional-use requirements. I have reviewed current terms. Free-tier prompts and answers may be used to improve Google products and reviewed by humans; I will not submit sensitive data. Free-tier availability and limits vary. Paid requests may charge my account.',
                    'میری عمر ۱۸ یا زیادہ ہے، میں معاون علاقے میں ہوں اور فراہم کنندہ کے ڈویلپر / پیشہ ورانہ استعمال کی شرائط پر پورا اترتا ہوں۔ میں نے موجودہ شرائط پڑھی ہیں۔ فری ٹیئر سوال و جواب گوگل مصنوعات کی بہتری اور انسانی جائزے میں استعمال ہو سکتے ہیں؛ میں حساس معلومات نہیں بھیجوں گا۔ فری ٹیئر اور حدود مختلف ہیں۔ بِل والے اکاؤنٹ پر چارج ہو سکتا ہے۔',
                    'عمري ١٨ فأكثر وفي منطقة مدعومة وأستوفي شروط الاستخدام المهني/للمطورين وقد راجعت الشروط. قد تستخدم Google المدخلات والإجابات المجانية لتحسين المنتجات ومراجعتها بشريًا؛ لن أرسل بيانات حساسة. التوفر والحدود تختلف وقد تُفرض رسوم على حسابي المدفوع.',
                  )}
                </span>
              </label>
              {(['paid', 'gemini'] as const).map((which) => (
                <form
                  className="dp-entry"
                  key={which}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void Native.deen({
                      op: 'providerConfigure',
                      which,
                      key: String(f.get('key')),
                      model: String(f.get('model')),
                    })
                      .then(() => Native.deen({ op: 'providerStatus' }))
                      .then(setProvider)
                      .catch((e) => props.notify(err(e)));
                    e.currentTarget.reset();
                  }}
                >
                  <h3>
                    {which === 'paid'
                      ? tr(
                          'Priority 1 · My billed Gemini API',
                          'ترجیح ۱ · میرا بِل والا جیمنائی اے پی آئی',
                          'الأولوية ١ · Gemini المفوتر الخاص بي',
                        )
                      : tr(
                          'Priority 2 · My Gemini free-tier API',
                          'ترجیح ۲ · میرا جیمنائی فری ٹیئر',
                          'الأولوية ٢ · Gemini المجاني الخاص بي',
                        )}
                  </h3>
                  <p>
                    {provider[which]
                      ? tr(
                          'Key configured on this device',
                          'اس آلے پر کلید موجود ہے',
                          'المفتاح مضبوط على هذا الجهاز',
                        )
                      : tr('Not connected', 'منسلک نہیں', 'غير متصل')}
                  </p>
                  <Field label={tr('API key', 'اے پی آئی کلید', 'مفتاح API')}>
                    <input name="key" type="password" autoComplete="off" required maxLength={300} />
                  </Field>
                  <Field label={tr('Model', 'ماڈل', 'النموذج')}>
                    <input
                      name="model"
                      defaultValue="gemini-3.8-flash"
                      required
                      pattern="[a-zA-Z0-9._-]{1,100}"
                    />
                  </Field>
                  <div className="actions">
                    <button className="primary" disabled={!isNative || !eligible}>
                      {tr(
                        'Save / replace key',
                        'کلید محفوظ یا تبدیل کریں',
                        'حفظ / استبدال المفتاح',
                      )}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={!provider[which]}
                      onClick={() =>
                        void Native.deen({
                          op: 'providerConfigure',
                          which,
                          key: '',
                          model: 'gemini-3.8-flash',
                        })
                          .then(() => Native.deen({ op: 'providerStatus' }))
                          .then(setProvider)
                      }
                    >
                      {tr('Remove key', 'کلید ہٹائیں', 'إزالة المفتاح')}
                    </button>
                  </div>
                </form>
              ))}
              <Toggle
                label={tr(
                  'Allow fallback to my other configured provider',
                  'میرے دوسرے فراہم کنندہ پر متبادل کی اجازت',
                  'السماح بالبديل إلى مزودي الآخر',
                )}
                value={fallback}
                onChange={setFallback}
              />
              <Toggle
                label={tr(
                  'Save conversation history',
                  'گفتگو کی تاریخ محفوظ کریں',
                  'حفظ سجل المحادثات',
                )}
                value={history}
                onChange={setHistory}
              />
              <Toggle
                label={tr(
                  'Synchronize new conversations as encrypted private records',
                  'نئی گفتگو خفیہ نجی ریکارڈ کے طور پر ہم وقت کریں',
                  'مزامنة المحادثات الجديدة كسجلات خاصة مشفرة',
                )}
                value={cloud}
                onChange={setCloud}
              />
              <p className="muted">
                {tr(
                  'Keys stay in Android Keystore-backed storage and never sync. Only messages you send in this chat go to Google. No habits, journal, account profile or prayer history are attached automatically.',
                  'کلیدیں اینڈرائیڈ کی محفوظ اسٹوریج میں ہیں اور ہم وقت نہیں ہوتیں۔ صرف اسی چیٹ کے بھیجے ہوئے پیغامات گوگل جاتے ہیں۔ عادتیں، ڈائری، پروفائل یا نماز کی تاریخ خود نہیں بھیجی جاتی۔',
                  'المفاتيح محفوظة بتشفير Android Keystore ولا تتزامن. تذهب رسائل هذه المحادثة المرسلة فقط إلى Google. لا تُرفق العادات أو الدفتر أو الملف أو سجل الصلاة تلقائيًا.',
                )}
              </p>
            </Panel>
          )}
          <Panel title={tr('Ask DeenPath', 'گفتگو', 'المحادثات')}>
            <div className="dp-tabs">
              {[
                ...conversations,
                ...(vault.items.filter(
                  (x) => x.type === 'chat' && !conversations.some((c) => c.id === x.id),
                ) as Conversation[]),
              ].map((c) => (
                <div key={c.id}>
                  <button
                    disabled={busy}
                    className="secondary"
                    onClick={() => {
                      setActive(c.id);
                      setMessages(c.messages);
                    }}
                  >
                    {c.title}
                  </button>
                  <button
                    disabled={busy}
                    className="icon"
                    aria-label={tr('Delete conversation', 'گفتگو حذف کریں', 'حذف المحادثة')}
                    onClick={() => {
                      const all = conversations.filter((x) => x.id !== c.id);
                      setConversations(all);
                      if (active === c.id) {
                        setActive('');
                        setMessages([]);
                      }
                      if (isNative)
                        void Native.deen({ op: 'localChatWrite', value: JSON.stringify(all) });
                      if (vault.items.some((x) => x.id === c.id))
                        void putPrivate(c, true).then(() => vault.load());
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {!messages.length && (
              <div className="guidance-start">
                <h3>
                  {tr(
                    'What would you like help with?',
                    'آپ کس بارے میں مدد چاہتے ہیں؟',
                    'بماذا تريد المساعدة؟',
                  )}
                </h3>
                <p>
                  {tr(
                    'Ask in your own words, or choose a starting point.',
                    'اپنے الفاظ میں سوال کریں یا کوئی تجویز منتخب کریں۔',
                    'اسأل بكلماتك أو اختر اقتراحًا.',
                  )}
                </p>
                <div className="guidance-prompts">
                  {[
                    tr(
                      'How can I build a consistent prayer routine?',
                      'نماز کی پابندی کیسے شروع کروں؟',
                      'كيف أحافظ على الصلاة؟',
                    ),
                    tr(
                      'Help me plan a daily dhikr habit.',
                      'روزانہ ذکر کا معمول بنانے میں مدد کریں۔',
                      'ساعدني في تخطيط ورد يومي.',
                    ),
                  ].map((question) => (
                    <button
                      type="button"
                      className="secondary"
                      key={question}
                      onClick={() => setDraft(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="dp-chat" aria-live="polite">
              {messages.map((m, i) => (
                <article className={'dp-message ' + m.role} key={i}>
                  <small>
                    {m.role === 'user'
                      ? tr('You', 'آپ', 'أنت')
                      : `DeenPath · ${m.provider || source} · ${tr('AI explanation — unverified', 'مصنوعی ذہانت کی تشریح — غیر مصدقہ', 'شرح ذكاء اصطناعي — غير موثق')}`}
                  </small>
                  <p className="preserve-lines">{m.text}</p>
                  {m.role === 'assistant' &&
                    quran.verses
                      .filter((v) => m.text.includes(v.ref))
                      .map((v) => (
                        <details key={v.ref}>
                          <summary>
                            {tr(
                              'Matching bundled reference (AI explanation remains unverified)',
                              '\u0645\u0648\u062c\u0648\u062f \u0645\u0635\u062f\u0642\u06c1 \u062d\u0648\u0627\u0644\u06c1 (\u062a\u0634\u0631\u06cc\u062d \u063a\u06cc\u0631 \u0645\u0635\u062f\u0642\u06c1 \u06c1\u06d2)',
                              '\u0645\u0631\u062c\u0639 \u0645\u062d\u0644\u064a \u0645\u0637\u0627\u0628\u0642 (\u0634\u0631\u062d \u0627\u0644\u0630\u0643\u0627\u0621 \u063a\u064a\u0631 \u0645\u0648\u062b\u0642)',
                            )}
                            : {v.ref}
                          </summary>
                          <p className="preserve-lines">
                            {reminderBody(v.ref, {
                              ...db.state.settings,
                              reminderLanguage: 'both',
                            })}
                          </p>
                        </details>
                      ))}
                </article>
              ))}
            </div>
            {errors && (
              <div role="alert" className="notice">
                <strong>
                  {tr('Unable to connect right now', 'ابھی رابطہ ممکن نہیں', 'تعذر الاتصال الآن')}
                </strong>
                <p>
                  {tr(
                    'Check your AI connection settings, or continue with verified offline learning. Your question stays here.',
                    'رابطے کی ترتیب دیکھیں یا آف لائن اسباق کھولیں۔ آپ کا سوال محفوظ ہے۔',
                    'تحقق من إعدادات الاتصال أو تابع الدروس الموثقة دون اتصال. يبقى سؤالك هنا.',
                  )}
                </p>
                <details>
                  <summary>{tr('Connection details', 'رابطے کی تفصیل', 'تفاصيل الاتصال')}</summary>
                  {errors}
                </details>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <Field label={tr('Your question', 'آپ کا سوال', 'سؤالك')}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  maxLength={6000}
                  required
                />
              </Field>
              <button className="primary" disabled={busy}>
                {busy
                  ? tr('Waiting for provider…', 'جواب کا انتظار…', 'بانتظار المزود…')
                  : tr('Ask DeenPath', 'بھیجیں / دوبارہ کوشش', 'إرسال / إعادة المحاولة')}
              </button>
            </form>
            <p className="muted">
              {tr('Active provider', 'فعال فراہم کنندہ', 'المزود النشط')}:{' '}
              {source ||
                (provider.paid
                  ? tr('My billed Gemini', 'میرا بِل والا جیمنائی', 'Gemini المفوتر الخاص بي')
                  : provider.gemini
                    ? tr('My Gemini', 'میرا جیمنائی', 'Gemini الخاص بي')
                    : tr('Offline resources', 'آف لائن وسائل', 'موارد دون اتصال'))}
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
