import { completionFeedback, earnedForSources, completionSequence } from './completion-feedback';
import { Collectibles } from './CollectibleShelf';
import { GoogleAccount } from './GoogleAccount';
import { ThemeStudio, ThemeBackdrop } from './ThemeStudio';
import { readableAccent, accentInk } from './themes';
import { GemBalance, Gems } from './Gems';
import { ReminderPassage } from './ReminderPassage';
import { AboutContact } from './AboutContact';
import { VerseTranslations } from './VerseTranslations';
import { detectLocation } from './location';
import { PrayerBacklog } from './PrayerBacklog';
import { Secrets } from './Secrets';
import { useViewTrail } from './back';
import { RoutineStacks } from './RoutineStacks';
import { formatHijriDay } from './deen';
import { reminderLanguage, reminderBody } from './content';
import React, { useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Home,
  UserRound,
  FileText,
  BookOpen,
  Leaf,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Check,
  Plus,
  Cloud,
  MapPin,
  ChevronRight,
  Flower2,
  RefreshCw,
  Volume2,
  Shield,
  LogOut,
  ArrowLeft,
  Upload,
  Hand,
  Trash2,
  WifiOff,
  Clock,
  X,
} from 'lucide-react';
import { db, api, signIn, sync, loadToken, saveToken } from './store';
import {
  defaults,
  advanceCounter,
  dayKey,
  prayers,
  prayerState,
  recordedPrayerWindow,
  prayerStartTimes,
  periodKey,
  completionId,
  routineDue,
  scheduleOn,
  validateSettings,
  type Settings,
  type RecordData,
  type Lang,
} from './domain';
import { translator, prayerLabel } from './i18n';
import { Native, isNative } from './native';
import { scheduleReminders } from './reminders';
import {
  localFiles,
  importFile,
  fileBlob,
  uploadFile,
  restoreFiles,
  deleteFile,
  linkRoutineFile,
  deleteRoutineAttachment,
  type LocalFile,
  saveReadingPosition,
} from './files';
import quran from './content/quran.json';
import { Field, Toggle } from './components';
import { BrandMark } from './Brand';
import { ReminderSettings } from './ReminderSettings';
import { localizeMessage } from './locales-extra';
import './style.css';
import './polish.css';
import { PrayerReport } from './PrayerReport';
import { PrivateLife } from './PrivateLife';
import { Guidance } from './Guidance';
import { DeenTools } from './DeenTools';
import { DeenMore } from './DeenMore';
import { DeenProgress } from './DeenProgress';
import { Learning } from './Learning';
import { tr } from './deen-ui';
import './deen.css';
import './calm.css';
import './release.css';
import './practice.css';
import { ScheduleFields } from './ScheduleFields';
function App() {
  useEffect(() => {
    if (!isNative) return;
    let remove: (() => Promise<void>) | undefined;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void Native.addListener('storeChanged', (data) => {
      if (data.handledRoute)
        window.dispatchEvent(
          new CustomEvent('deenpath:reminder-handled', { detail: data.handledRoute }),
        );
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () =>
          void db.reloadNative().then(() => window.dispatchEvent(new Event('salahguard:store'))),
        150,
      );
    }).then((handle) => {
      if (disposed) void handle.remove();
      else remove = handle.remove;
    });
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (remove) void remove();
    };
  }, []);
  const [ready, setReady] = useState(false),
    [tick, setTick] = useState(0),
    [tab, setTabState] = useState('home'),
    [settingsPage, setSettingsPageState] = useState('menu'),
    [routineKind, setRoutineKind] = useState('quran'),
    [routineFrequency, setRoutineFrequency] = useState('daily'),
    [routineFile, setRoutineFile] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<string | null>(null),
    [reader, setReader] = useState<LocalFile | null>(null),
    [library, setLibrary] = useState<LocalFile[]>([]),
    [now, setNow] = useState(new Date()),
    [selected, setSelected] = useState<string | null>(null),
    [readerUrl, setReaderUrl] = useState(''),
    [mode, setMode] = useState('both'),
    [historyDay, setHistoryDay] = useState(dayKey()),
    [authMode, setAuthMode] = useState('login'),
    [signed, setSigned] = useState(false),
    [avatar, setAvatar] = useState(''),
    [systemDark, setSystemDark] = useState(matchMedia('(prefers-color-scheme: dark)').matches),
    [online, setOnline] = useState(navigator.onLine),
    [readerZoom, setReaderZoom] = useState(1);
  const [progressView, setProgressView, previousProgressView, canProgressBack] =
    useViewTrail('overview');
  const [prayerView, setPrayerView, previousPrayerView] = useViewTrail('today');
  const [learningLesson, setLearningLesson, previousLesson] = useViewTrail('');
  const screenHistory = useRef([{ tab: 'home', settingsPage: 'menu' }]);
  const settingsRef = useRef('menu');
  function setTab(page: string) {
    const next = { tab: page, settingsPage: page === 'settings' ? settingsRef.current : 'menu' };
    const current = screenHistory.current.at(-1)!;
    if (current.tab !== next.tab || current.settingsPage !== next.settingsPage)
      screenHistory.current.push(next);
    setTabState(page);
  }
  function setSettingsPage(page: string) {
    settingsRef.current = page;
    setSettingsPageState(page);
    if (screenHistory.current.at(-1)?.tab === 'settings') {
      const current = screenHistory.current.at(-1)!;
      if (current.settingsPage !== page)
        screenHistory.current.push({ tab: 'settings', settingsPage: page });
    }
  }
  function previousScreen() {
    if (screenHistory.current.length <= 1) {
      if (isNative) void Native.deen({ op: 'minimize' });
      return;
    }
    screenHistory.current.pop();
    const previous = screenHistory.current.at(-1)!;
    settingsRef.current = previous.settingsPage;
    setSettingsPageState(previous.settingsPage);
    setTabState(previous.tab);
  }
  useEffect(() => {
    if (modal !== 'routine') return;
    const data = selected ? db.find('routines', selected)?.data : undefined;
    setRoutineKind(data?.kind || (tab === 'tasbih' ? 'tasbih' : tab === 'nafl' ? 'nafl' : 'quran'));
    setRoutineFrequency(data?.frequency || 'daily');
    setRoutineFile(data?.fileId || '');
  }, [modal, selected]);
  useLayoutEffect(() => {
    const back = (event: Event) =>
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        if (reader) setReader(null);
        else if (modal) setModal(null);
        else previousScreen();
      });
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented)
        window.dispatchEvent(new CustomEvent('deenpath:back', { cancelable: true }));
    };
    window.addEventListener('deenpath:back', back);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('deenpath:back', back);
      window.removeEventListener('keydown', escape);
    };
  }, [tab, settingsPage, modal, reader]);
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [tab, settingsPage]);
  const imageScroll = useRef<HTMLDivElement | null>(null),
    readingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suiteProps = {
    refresh,
    notify: setMessage,
    navigate: (page: string) => {
      if (page === 'prayer/report') {
        setPrayerView('report');
        setTab('prayer');
        return;
      }
      if (page.startsWith('settings/')) {
        setSettingsPage(page.split('/')[1]);
        setTab('settings');
        window.scrollTo({ top: 0 });
        return;
      }
      if (page === 'settings') setSettingsPage('menu');
      setTab(page);
      window.scrollTo({ top: 0 });
    },
  };
  const section = ['tasbih', 'nafl', 'activities', 'secrets', 'protection'].includes(tab)
    ? 'routines'
    : tab === 'garden'
      ? 'progress'
      : ['home', 'prayer', 'routines', 'progress'].includes(tab)
        ? tab
        : 'more';
  const pageLabel = (key: string) =>
    key === 'shop'
      ? 'Theme Studio'
      : key === 'gems'
        ? 'Gems'
        : key === 'routines'
          ? tr(
              'Routines',
              '\u0645\u0639\u0645\u0648\u0644\u0627\u062a',
              '\u0627\u0644\u0623\u0648\u0631\u0627\u062f',
            )
          : key === 'prayer'
            ? tr('Prayer', '\u0646\u0645\u0627\u0632', '\u0627\u0644\u0635\u0644\u0627\u0629')
            : key === 'progress'
              ? tr(
                  'Progress',
                  '\u067e\u06cc\u0634 \u0631\u0641\u062a',
                  '\u0627\u0644\u062a\u0642\u062f\u0645',
                )
              : key === 'more'
                ? tr('More', '\u0645\u0632\u06cc\u062f', '\u0627\u0644\u0645\u0632\u064a\u062f')
                : t(key as 'home');
  const s = db.state.settings,
    t = translator(s.lang),
    today = dayKey(now, s.timezone);
  const isDark =
    s.appearance === 'dark' || ((!s.appearance || s.appearance === 'system') && systemDark);
  useEffect(() => {
    const status = () => setOnline(navigator.onLine);
    window.addEventListener('online', status);
    window.addEventListener('offline', status);
    return () => {
      window.removeEventListener('online', status);
      window.removeEventListener('offline', status);
    };
  }, []);
  function refresh() {
    setTick((x) => x + 1);
  }
  async function run(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    const receipt = completionSequence();
    try {
      await fn();
      refresh();
      if (success && receipt === completionSequence()) setMessage(success);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    const update = () => {
      refresh();
      void loadToken().then((value) => setSigned(!!value));
    };
    window.addEventListener('salahguard:store', update);
    const visible = () => {
      if (document.visibilityState === 'visible' && isNative) void db.reloadNative().then(update);
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('salahguard:store', update);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  useEffect(() => {
    const warning = (event: Event) => setMessage((event as CustomEvent).detail);
    window.addEventListener('salahguard:reminder-warning', warning);
    window.addEventListener('deenpath:completion', warning);
    return () => {
      window.removeEventListener('salahguard:reminder-warning', warning);
      window.removeEventListener('deenpath:completion', warning);
    };
  }, []);
  useEffect(() => {
    void run(async () => {
      await db.init();
      setSigned(!!(await loadToken()));
      setLibrary(await localFiles());
      setReady(true);
      if (isNative) await scheduleReminders();
    });
    let timer: ReturnType<typeof setInterval> | undefined;
    const visible = () => {
      if (timer) clearInterval(timer);
      if (document.visibilityState === 'visible') {
        setNow(new Date());
        timer = setInterval(() => setNow(new Date()), 1000);
      }
    };
    visible();
    document.addEventListener('visibilitychange', visible);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = s.lang;
    document.documentElement.dir = s.lang === 'en' ? 'ltr' : 'rtl';
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      setSystemDark(media.matches);
      document.documentElement.dataset.theme =
        s.appearance === 'system' || !s.appearance
          ? media.matches
            ? 'dark'
            : 'light'
          : s.appearance || 'light';
      const root = document.documentElement,
        theme = db.state.economy?.theme,
        dark = root.dataset.theme === 'dark';
      for (const key of ['--green', '--gold', '--accent-ink']) root.style.removeProperty(key);
      if (theme?.primary) {
        const accent = readableAccent(theme.primary, dark);
        root.style.setProperty('--green', accent);
        root.style.setProperty('--accent-ink', accentInk(accent));
      }
      if (theme?.secondary) root.style.setProperty('--gold', readableAccent(theme.secondary, dark));
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [ready, s.lang, s.dark, s.appearance, tick]);
  useEffect(() => {
    if (ready)
      void db
        .persist()
        .then(refresh)
        .catch((e) => setMessage(e.message));
  }, [ready, today]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    dialog?.querySelector<HTMLElement>('button,input,select')?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModal(null);
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const all = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]',
        ),
      ];
      if (!all.length) return;
      if (e.shiftKey && document.activeElement === all[0]) {
        e.preventDefault();
        all.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === all.at(-1)) {
        e.preventDefault();
        all[0].focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      previous?.focus();
    };
  }, [modal]);
  useEffect(() => {
    if (!ready || !signed) return;
    const connect = () => {
      void run(() => sync());
    };
    window.addEventListener('online', connect);
    const timer = setInterval(() => {
      if (navigator.onLine)
        void sync()
          .then(refresh)
          .catch(() => {});
    }, 60000);
    return () => {
      window.removeEventListener('online', connect);
      clearInterval(timer);
    };
  }, [ready, signed]);
  useEffect(() => {
    if (!ready || !isNative || !s.autoLocation) return;
    let locating = false;
    const update = async () => {
      if (document.visibilityState !== 'visible' || locating) return;
      locating = true;
      try {
        const location = await Native.locate(),
          current = db.state.settings;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (
          Math.abs(location.lat - current.lat) > 0.05 ||
          Math.abs(location.lng - current.lng) > 0.05 ||
          timezone !== current.timezone
        ) {
          await db.configure({ ...current, ...location, timezone, city: 'Current location' });
          await scheduleReminders();
          refresh();
        }
      } catch {
        // Keep the last saved city when a foreground refresh has no fix.
      } finally {
        locating = false;
      }
    };
    const onVisible = () => {
      void update();
    };
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(onVisible, 15 * 60000);
    void update();
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [ready, s.autoLocation]);
  useEffect(() => {
    if (!reader) return;
    setReaderZoom(reader.zoom || 1);
    let url = '';
    void fileBlob(reader)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setReaderUrl(url);
        if (imageScroll.current) imageScroll.current.scrollTop = reader.offset || 0;
      })
      .catch((e) => setMessage(e.message));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [reader]);
  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(location.search);
    const route = params.get('reminder');
    if (route && /^prayer:\d{4}-\d{2}-\d{2}:(Fajr|Dhuhr|Asr|Maghrib|Isha)$/.test(route)) {
      const key = route.slice(7),
        calculated = prayers(key.slice(0, 10), s).find((w) => w.key === key);
      const window = calculated && recordedPrayerWindow(calculated, db.find('prayer_records', key));
      if (window && Date.now() >= window.start.getTime() && Date.now() < window.end.getTime()) {
        setSelected(key);
        setModal('reminder');
      } else setTab('prayer');
    } else if (route?.startsWith('widget:')) {
      setTab(
        (
          {
            prayer: 'prayer',
            streak: 'gems',
            garden: 'collectibles',
            collection: 'collectibles',
            gems: 'gems',
            daily: 'home',
          } as Record<string, string>
        )[route.slice(7)] || 'home',
      );
    } else if (route?.startsWith('privateActivity:') || route?.startsWith('secretPenalty:')) {
      setTab('activities');
    } else if (route === 'private') {
      setTab('protection');
    } else if (route === 'journal') {
      setTab('journal');
    } else if (route && /^routine:[a-f0-9-]{36}$/.test(route)) {
      setTab('routines');
      setSelected(route.slice(8));
    }
  }, [ready]);
  useEffect(() => {
    if (!db.state.profile?.profile_file) {
      setAvatar('');
      return;
    }
    let url = '',
      alive = true;
    void localFiles()
      .then(async (files) => {
        const f = files.find((x) => x.cloudId === db.state.profile?.profile_file);
        if (f) {
          const blob = await fileBlob(f);
          if (alive) {
            url = URL.createObjectURL(blob);
            setAvatar(url);
          }
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [db.state.profile?.profile_file, library]);
  const { windows, tomorrow, calculationError } = useMemo(() => {
    try {
      return {
        windows: prayers(today, s),
        tomorrow: prayers(dayKey(new Date(now.getTime() + 86400000), s.timezone), s),
        calculationError: '',
      };
    } catch (e) {
      return { windows: [], tomorrow: [], calculationError: (e as Error).message };
    }
  }, [today, s]);
  const previousWindows = useMemo(() => {
    try {
      return prayers(dayKey(new Date(now.getTime() - 86400000), s.timezone), s);
    } catch {
      return [];
    }
  }, [today, s]);
  const activeWindow = [...previousWindows, ...windows].find((w) => w.start <= now && now < w.end);
  const upcoming = [...windows, ...tomorrow].find((w) => w.start > now);
  const editing = selected ? db.find('routines', selected) : undefined;
  const routineList = db.list('routines');

  const done = (r: RecordData) => {
    try {
      const period = periodKey(r.data, now, db.state.records);
      const entry = db.find('routine_completions', completionId(r.id, period));
      return !!entry && !entry.deleted;
    } catch {
      return false;
    }
  };
  const dueRoutines = routineList.filter((r) =>
    routineDue(scheduleOn(r.data, dayKey(now, r.data.timezone)), now),
  );
  const pendingRoutines = dueRoutines.filter((r) => !done(r));
  const todayCompleted = windows.filter((w) =>
    ['ontime', 'qaza'].includes(prayerState(w, db.find('prayer_records', w.key), now)),
  ).length;
  const formatTime = (d: Date) =>
    new Intl.DateTimeFormat(s.lang, {
      timeZone: s.timezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  const countdown = (d: Date) => {
    const v = Math.max(0, Math.floor((d.getTime() - now.getTime()) / 1000));
    return `${Math.floor(v / 3600)
      .toString()
      .padStart(2, '0')}:${Math.floor((v % 3600) / 60)
      .toString()
      .padStart(2, '0')}:${(v % 60).toString().padStart(2, '0')}`;
  };
  useEffect(() => {
    const handled = (event: Event) => {
      if (modal === 'reminder' && (event as CustomEvent).detail === 'prayer:' + selected)
        setModal(null);
    };
    window.addEventListener('deenpath:reminder-handled', handled);
    return () => window.removeEventListener('deenpath:reminder-handled', handled);
  }, [modal, selected]);
  async function markPrayer(key: string, qaza = false, at?: string) {
    if (!at) {
      const receipt = completionSequence();
      await db.applyPrayer(qaza ? 'qaza' : 'prayed', key);
      await scheduleReminders();
      if (receipt === completionSequence()) setMessage(t('done'));
      setModal(null);
      return;
    }
    const [day, prayer] = key.split(':');
    const old = db.find('prayer_records', key);
    const window = prayers(day, s).find((w) => w.key === key)!;
    await db.put('prayer_records', key, {
      ...old?.data,
      windowStart: old?.data.windowStart || window.start.toISOString(),
      windowEnd: old?.data.windowEnd || window.end.toISOString(),
      timezone: old?.data.timezone || s.timezone,
      day,
      prayer,
      ...(qaza ? { qazaAt: at, completedAt: undefined } : { completedAt: at, qazaAt: undefined }),
    });
    if (qaza) await db.put('qaza_records', key, { day, prayer, qazaAt: at });
    else {
      const prior = db.find('qaza_records', key);
      if (prior && !prior.deleted) await db.put('qaza_records', key, prior.data, true);
    }
    await scheduleReminders();
    setModal(null);
  }
  async function complete(r: RecordData) {
    if (dayKey(new Date(), r.data.timezone) < r.data.startDate)
      throw Error('This routine has not started yet');
    const period = periodKey(r.data, now, db.state.records);
    if (r.data.frequency === 'daily' && period < r.data.startDate)
      throw Error('This routine has not started yet');
    await db.put('routine_completions', completionId(r.id, period), {
      routineId: r.id,
      period,
      completedAt: new Date().toISOString(),
    });
  }
  async function tap(r: RecordData) {
    if (
      dayKey(new Date(), r.data.timezone) < r.data.startDate ||
      (r.data.frequency === 'daily' && periodKey(r.data, now, db.state.records) < r.data.startDate)
    )
      throw Error('This routine has not started yet');
    const period = periodKey(r.data, now, db.state.records),
      id = completionId(r.id, period);
    const prior = db.find('tasbih_progress', id);
    const before = structuredClone(db.state.economy);
    if ((prior?.data.count || 0) >= r.data.target) return;
    const count = advanceCounter(prior?.data.count || 0, r.data.target);
    await db.put('tasbih_progress', id, { routineId: r.id, period, count }, false, false);
    if (count === r.data.target && !done(r))
      await db.put(
        'routine_completions',
        id,
        { routineId: r.id, period, completedAt: new Date().toISOString() },
        false,
        false,
      );
    const saving = db.persist();
    refresh();
    if (s.vibration && navigator.vibrate) navigator.vibrate(8);
    await saving;
    if (count === r.data.target)
      completionFeedback('Tasbih', earnedForSources(before, db.state.economy, 'routine:' + id));
  }

  function routineCard(r: RecordData) {
    const streak =
      db.state.progress?.streaks?.find((x: any) => x.routine_id === r.id)?.current_streak || 0;
    return (
      <article className="routine card" key={r.id}>
        <div className="routine-top">
          <div className="square">
            <BookOpen size={22} />
          </div>
          <div>
            <span className="eyebrow">
              {t(r.data.kind === 'dua' ? 'dua' : 'quran')} · {t(r.data.frequency)}
            </span>
            <h3>{r.data.title}</h3>
          </div>
          <button
            className="icon ghost"
            aria-label={t('correct')}
            onClick={() => {
              setSelected(r.id);
              setModal('routine');
            }}
          >
            <SettingsIcon size={16} />
          </button>
          <button
            className="icon ghost"
            aria-label={t('delete')}
            onClick={() => {
              setSelected(r.id);
              setModal('deleteRoutine');
            }}
          >
            <Trash2 size={17} />
          </button>
        </div>
        {r.data.kind === 'nafl' && (
          <p>
            {r.data.target}{' '}
            {tr('Rak?ahs', '\u0631\u06a9\u0639\u0627\u062a', '\u0631\u0643\u0639\u0627\u062a')}
          </p>
        )}
        <p className="muted">
          <Clock size={14} /> {r.data.time}{' '}
          <span className="push">
            {r.data.kind === 'nafl' || r.data.kind === 'custom' ? (
              tr(
                'Voluntary',
                '\u0631\u0636\u0627\u06a9\u0627\u0631\u0627\u0646\u06c1',
                '\u062a\u0637\u0648\u0639\u064a',
              )
            ) : (
              <>
                {streak} {t('streak')}
              </>
            )}
          </span>
        </p>
        <div className="actions">
          {(r.data.fileId || r.data.contentRef || r.data.duaText) && (
            <button className="secondary" onClick={() => void run(() => readRoutine(r))}>
              {t('read')}
            </button>
          )}
          <button
            className={done(r) ? 'secondary' : 'primary'}
            onClick={() => {
              if (done(r)) {
                setSelected(r.id);
                setModal('undoRoutine');
              } else void run(() => complete(r));
            }}
          >
            {done(r) ? (
              <>
                <Check size={16} />
                {t('done')}
              </>
            ) : (
              t('complete')
            )}
          </button>
        </div>
      </article>
    );
  }

  function download(name: string, data: unknown) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function readRoutine(r: RecordData) {
    setSelected(r.id);
    if (r.data.duaText) {
      setModal('duaText');
      return;
    }
    if (r.data.contentRef) {
      setModal('verse');
      return;
    }
    const f = library.find((f) => f.id === r.data.fileId || f.cloudId === r.data.fileCloudId);
    if (!f) throw Error('Restore this document from the cloud first');
    await openFile(f, r.id);
  }
  async function openFile(f: LocalFile, routineId?: string) {
    if (isNative && f.mime === 'application/pdf') {
      const pos = await Native.filePosition({ path: f.path! });
      await Native.viewFile({ path: f.path!, page: pos.page, routineId });
    } else setReader(f);
  }
  if (!ready)
    return (
      <div className="loading">
        <BrandMark />
        <h1>DeenPath</h1>
        <p>{message || 'Opening your daily space…'}</p>
      </div>
    );
  return (
    <>
      <ThemeBackdrop />
      <div className="app">
        <aside className="sidebar">
          <a className="brand" href="#" onClick={() => setTab('home')}>
            <span className="brand-mark">
              <BrandMark />
            </span>
            <span>
              DeenPath<small>{t('privacy')}</small>
            </span>
          </a>
          <nav>
            {[
              ['home', Home],
              ['prayer', Sun],
              ['routines', BookOpen],
              ['progress', Leaf],
              ['more', SettingsIcon],
            ].map(([key, Icon]) => {
              const C = Icon as typeof Home;
              return (
                <button
                  key={key as string}
                  className={section === key ? 'active' : ''}
                  onClick={() => setTab(key as string)}
                >
                  <C size={21} />
                  <span>{pageLabel(key as string)}</span>
                </button>
              );
            })}
          </nav>
          <div className="sidebar-note">
            <Leaf />
            <p>{t('empty')}</p>
            <small>{t('tagline')}</small>
          </div>
          <button
            className="sync-mini"
            onClick={() => {
              setTab('settings');
              setSettingsPage('sync');
              document.getElementById('sync')?.scrollIntoView();
            }}
          >
            <Cloud size={19} />
            <span>
              {db.state.queue.length ? `${db.state.queue.length} ${t('queued')}` : t('offline')}
            </span>
            <span className="status-dot" />
          </button>
        </aside>
        <main>
          <header className="topbar">
            {tab !== 'home' && (
              <button
                className="icon screen-back"
                aria-label={tr('Back', 'واپس', 'رجوع')}
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('deenpath:back', { cancelable: true }))
                }
              >
                ←
              </button>
            )}
            <span className="mobile-brand">
              <BrandMark /> DeenPath
            </span>
            <span className="breadcrumb">
              {t('today')} <ChevronRight size={14} /> {pageLabel(section)}
            </span>
            <div className="top-actions">
              <GemBalance open={() => setTab('gems')} />
              <span className="location">
                <MapPin size={14} />
                {s.city}
              </span>
              <button
                className="icon"
                aria-label={t('dark')}
                onClick={() =>
                  void run(() =>
                    db.configure({ ...s, dark: !isDark, appearance: isDark ? 'light' : 'dark' }),
                  )
                }
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                className="avatar"
                onClick={() => {
                  setTab('settings');
                  setModal('profile');
                }}
                aria-label={t('profile')}
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt={tr('Profile photo', 'پروفائل تصویر', 'صورة الملف الشخصي')}
                  />
                ) : (
                  <UserRound size={20} />
                )}
              </button>
            </div>
          </header>
          {tab === 'collectibles' && (
            <Collectibles {...suiteProps} signed={signed} signIn={() => setModal('auth')} />
          )}
          {tab === 'shop' && <ThemeStudio {...suiteProps} />}
          {tab === 'gems' && <Gems {...suiteProps} />}
          {tab === 'prayer' && (
            <PrayerReport
              {...suiteProps}
              view={prayerView}
              setView={setPrayerView}
              previousView={previousPrayerView}
            />
          )}
          {tab === 'more' && <DeenMore {...suiteProps} />}
          {tab === 'progress' && (
            <DeenProgress
              {...suiteProps}
              view={progressView}
              setView={setProgressView}
              previousView={previousProgressView}
              canGoBack={canProgressBack}
            />
          )}
          {tab === 'learning' && (
            <Learning
              {...suiteProps}
              selected={learningLesson}
              selectLesson={setLearningLesson}
              previousLesson={previousLesson}
            />
          )}
          {tab === 'guidance' && <Guidance {...suiteProps} />}
          {['activities', 'protection', 'secrets'].includes(tab) && <Secrets {...suiteProps} />}
          {(['journal', 'privacy', 'legacy-activities'] as string[]).includes(tab) && (
            <PrivateLife
              key={tab}
              page={tab === 'legacy-activities' ? 'activities' : (tab as 'journal' | 'privacy')}
              {...suiteProps}
            />
          )}
          {(['qibla', 'calendar', 'travel'] as string[]).includes(tab) && (
            <DeenTools key={tab} page={tab as 'qibla' | 'calendar' | 'travel'} {...suiteProps} />
          )}
          {tab === 'home' && (
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">
                    {new Intl.DateTimeFormat(s.lang, {
                      dateStyle: 'full',
                      timeZone: s.timezone,
                    }).format(now)}
                  </p>
                  <h1>
                    {t('greeting')}
                    {db.state.profile?.name ? `, ${db.state.profile.name.split(' ')[0]}` : ''}!
                  </h1>
                  <p>{t('tagline')}</p>
                </div>
                <span className="date-badge">
                  {formatHijriDay(today, s.lang, Number(s.hijriAdjustment || 0), true)}
                </span>
              </section>
              <div className="dashboard-grid">
                <section className="prayer-hero">
                  <div className="hero-pattern" />
                  <div className="hero-copy">
                    <span className="pill">
                      <span className="gold-dot" />
                      {t('next')}
                    </span>
                    <h2>
                      {upcoming
                        ? prayerLabel(upcoming.name, s.lang, upcoming.key.slice(0, 10))
                        : '—'}
                    </h2>
                    <p>
                      {upcoming && formatTime(upcoming.start)} <span>· {s.city}</span>
                    </p>
                    <div className="countdown">{upcoming ? countdown(upcoming.start) : '—'}</div>
                    <small>{t('remaining')}</small>
                    {activeWindow && (
                      <div className="active-window">
                        <span>
                          {prayerLabel(activeWindow.name, s.lang, activeWindow.key.slice(0, 10))} ·{' '}
                          {tr('Ends', 'اختتام', 'ينتهي')} {formatTime(activeWindow.end)}
                        </span>
                        <strong
                          className={
                            activeWindow.end.getTime() - now.getTime() < 900000 ? 'urgency' : ''
                          }
                        >
                          {countdown(activeWindow.end)}
                        </strong>
                        <small>{tr('Time remaining', 'باقی وقت', 'الوقت المتبقي')}</small>
                      </div>
                    )}
                  </div>
                  <div className="mosque" aria-hidden="true">
                    <div className="crescent">☾</div>
                    <div className="minaret m1" />
                    <div className="minaret m2" />
                    <div className="dome" />
                    <div className="mosque-base">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                </section>
              </div>
              <div
                className="daily-summary"
                aria-label={tr('Today’s progress', 'آج کی پیش رفت', 'تقدم اليوم')}
              >
                <span>
                  <strong>{todayCompleted} / 5</strong>{' '}
                  {tr('prayers recorded', 'نمازیں درج', 'صلوات مسجلة')}
                </span>
                <span>
                  <strong>
                    {dueRoutines.length - pendingRoutines.length} / {dueRoutines.length}
                  </strong>{' '}
                  {tr('routines complete', 'معمولات مکمل', 'أوراد مكتملة')}
                </span>
              </div>
              <section>
                <div className="section-title">
                  <h2>{t('prayers')}</h2>
                  <button className="text-button" onClick={() => setTab('prayer')}>
                    {tr(
                      'Prayer Report',
                      '\u0646\u0645\u0627\u0632 \u06a9\u06cc \u0631\u067e\u0648\u0631\u0679',
                      '\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0635\u0644\u0627\u0629',
                    )}
                  </button>
                  <button className="text-button" onClick={() => setModal('history')}>
                    {t('history')} <ChevronRight size={15} />
                  </button>
                </div>
                {calculationError && <p role="alert">{calculationError}</p>}
                <div className="prayer-grid home-prayers">
                  {windows.map((calculated, i) => {
                    const w = recordedPrayerWindow(
                      calculated,
                      db.find('prayer_records', calculated.key),
                    );
                    const state = prayerState(w, db.find('prayer_records', w.key), now);
                    return (
                      <article
                        key={w.name}
                        className={`prayer-card card ${state === 'pending' ? 'current' : ''}`}
                      >
                        <div className="prayer-symbol">
                          {i === 0 || i === 4 ? <Moon size={22} /> : <Sun size={22} />}
                          <span>
                            {state === 'ontime' ? (
                              <Check size={16} />
                            ) : (
                              String(i + 1).padStart(2, '0')
                            )}
                          </span>
                        </div>
                        <h3>{prayerLabel(w.name, s.lang, w.key.slice(0, 10))}</h3>
                        <strong className="prayer-time">{formatTime(w.start)}</strong>
                        <small className="prayer-ending">
                          {tr('Ends', 'اختتام', 'ينتهي')} {formatTime(w.end)}
                          {state === 'pending' && (
                            <strong
                              className={w.end.getTime() - now.getTime() < 900000 ? 'urgency' : ''}
                            >
                              {countdown(w.end)}
                            </strong>
                          )}
                        </small>
                        <span className={'prayer-status ' + state}>
                          {state === 'unknown'
                            ? tr(
                                'Unrecorded',
                                '\u063a\u06cc\u0631 \u062f\u0631\u062c \u0634\u062f\u06c1',
                                '\u063a\u064a\u0631 \u0645\u0633\u062c\u0644',
                              )
                            : state === 'na'
                              ? tr(
                                  'Not applicable',
                                  '\u0644\u0627\u06af\u0648 \u0646\u06c1\u06cc\u06ba',
                                  '\u063a\u064a\u0631 \u0645\u0646\u0637\u0628\u0642',
                                )
                              : t(state as 'ontime')}
                        </span>
                        <button
                          className="prayer-action"
                          disabled={state === 'upcoming'}
                          onClick={() => {
                            setSelected(w.key);
                            setModal('reminder');
                          }}
                        >
                          {state === 'ontime' || state === 'qaza'
                            ? t('correct')
                            : state === 'missed' || (state === 'unknown' && now >= w.end)
                              ? t('qaza')
                              : tr('Record prayer', 'نماز درج کریں', 'تسجيل الصلاة')}
                          {state === 'ontime' ? <Check size={15} /> : <ChevronRight size={15} />}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
              <button className="secondary home-guidance" onClick={() => setTab('guidance')}>
                {tr(
                  'Ask DeenPath',
                  '\u062f\u06cc\u0646 \u067e\u0627\u062a\u06be \u0633\u06d2 \u067e\u0648\u0686\u06be\u06cc\u06ba',
                  '\u0627\u0633\u0623\u0644 \u062f\u064a\u0646 \u0628\u0627\u062b',
                )}
              </button>
              <div className="two-columns">
                <section>
                  <div className="section-title">
                    <h2>{t('routines')}</h2>
                    <button
                      className="icon"
                      aria-label={t('add')}
                      onClick={() => {
                        setSelected(null);
                        setModal('routine');
                      }}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  {pendingRoutines.length ? (
                    pendingRoutines.slice(0, 3).map(routineCard)
                  ) : (
                    <div className="empty card">
                      <BookOpen />
                      <h3>
                        {routineList.length
                          ? tr('You’re all caught up', 'آج کے معمولات مکمل', 'أكملت أورادك')
                          : t('empty')}
                      </h3>
                      <button className="text-button" onClick={() => setModal('routine')}>
                        {t('add')} <Plus size={16} />
                      </button>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          {['routines', 'tasbih', 'nafl'].includes(tab) && (
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">{t('privacy')}</p>
                  <h1>
                    {tab === 'nafl'
                      ? tr(
                          'Nafl Salah',
                          '\u0646\u0641\u0644 \u0646\u0645\u0627\u0632',
                          '\u0635\u0644\u0627\u0629 \u0627\u0644\u0646\u0627\u0641\u0644\u0629',
                        )
                      : tab === 'routines'
                        ? pageLabel('routines')
                        : t('tasbih')}
                  </h1>
                  <p>{t('empty')}</p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setSelected(null);
                    setModal('routine');
                  }}
                >
                  <Plus size={18} />
                  {t('add')}
                </button>
              </section>
              <div className="dp-tabs">
                {[
                  ['routines', tr('All routines', 'تمام معمولات', 'كل الأوراد')],
                  ['tasbih', t('tasbih')],
                  [
                    'nafl',
                    tr(
                      'Nafl Salah',
                      '\u0646\u0641\u0644 \u0646\u0645\u0627\u0632',
                      '\u0635\u0644\u0627\u0629 \u0627\u0644\u0646\u0627\u0641\u0644\u0629',
                    ),
                  ],
                  ['activities', tr('Secrets', 'راز', 'الأسرار')],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={tab === key ? 'primary' : 'secondary'}
                    onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tab === 'nafl' ? (
                <PrayerBacklog {...suiteProps} mode="nafl" now={now} />
              ) : (
                <RoutineStacks
                  files={library}
                  routines={routineList.filter((r) =>
                    tab === 'tasbih'
                      ? r.data.kind === 'tasbih'
                      : tab === 'nafl'
                        ? r.data.kind === 'nafl'
                        : true,
                  )}
                  now={now}
                  done={done}
                  count={(r) => {
                    try {
                      return (
                        db.find(
                          'tasbih_progress',
                          completionId(r.id, periodKey(r.data, now, db.state.records)),
                        )?.data.count || 0
                      );
                    } catch {
                      return 0;
                    }
                  }}
                  onCount={(r) =>
                    tap(r)
                      .catch((error) => setMessage((error as Error).message))
                      .finally(refresh)
                  }
                  onComplete={(r) => run(() => complete(r))}
                  onEdit={(r) => {
                    setSelected(r.id);
                    setModal('routine');
                  }}
                  onDelete={(r) => {
                    setSelected(r.id);
                    setModal('deleteRoutine');
                  }}
                  onUndo={(r) => {
                    setSelected(r.id);
                    setModal(r.data.kind === 'tasbih' ? 'resetCounter' : 'undoRoutine');
                  }}
                  onRead={(r) => run(() => readRoutine(r))}
                  onFile={(r) =>
                    run(async () => {
                      const f = library.find(
                        (f) => f.id === r.data.fileId || f.cloudId === r.data.fileCloudId,
                      );
                      if (!f) throw Error('Restore this document from the cloud first');
                      await openFile(f, r.id);
                    })
                  }
                  onPreset={async (preset) => {
                    await run(async () => {
                      await db.put('routines', crypto.randomUUID(), {
                        ...preset,
                        kind: 'tasbih',
                        frequency: 'daily',
                        time: '21:00',
                        timezone: s.timezone,
                        startDate: today,
                        deadline: '00:00',
                      });
                      await scheduleReminders();
                    });
                  }}
                />
              )}
            </>
          )}
          {tab === 'settings' && (
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">DeenPath</p>
                  <h1>{t('settings')}</h1>
                  <p>{t('privacy')}</p>
                </div>
              </section>
              {settingsPage === 'menu' ? (
                <div className="settings-menu card">
                  {[
                    ['account', t('account')],
                    ['appearance', t('language') + ' / ' + t('appearance')],
                    ['location', t('location')],
                    [
                      'reminders',
                      tr('Reminders & sound', 'یاد دہانیاں اور آواز', 'التذكيرات والصوت'),
                    ],
                    ['sync', t('sync')],
                    ['about', tr('Help & About', 'مدد اور تعارف', 'المساعدة وحول التطبيق')],
                  ].map(([key, label]) => (
                    <button
                      className="settings-menu-row"
                      key={key}
                      onClick={() => setSettingsPage(key)}
                    >
                      <span>{label}</span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
              ) : (
                <button className="text-button section-back" onClick={previousScreen}>
                  <ArrowLeft size={17} />
                  {t('settings')}
                </button>
              )}
              <div className="settings-grid">
                <section className="card settings-card" hidden={settingsPage !== 'account'}>
                  <h2>{t('account')}</h2>
                  <div className="profile-summary">
                    <span className="avatar large">
                      {avatar ? <img src={avatar} /> : <UserRound size={28} />}
                    </span>
                    <div>
                      <h3>{db.state.profile?.name || t('welcome')}</h3>
                      <p className="muted">{db.state.profile?.email || t('offline')}</p>
                    </div>
                  </div>
                  <div className="actions wrap">
                    {!signed ? (
                      <>
                        <button
                          className="primary"
                          onClick={() => {
                            setAuthMode('login');
                            setModal('auth');
                          }}
                        >
                          {t('login')}
                        </button>
                        <button
                          className="secondary"
                          onClick={() => {
                            setAuthMode('register');
                            setModal('auth');
                          }}
                        >
                          {t('register')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="secondary" onClick={() => setModal('profile')}>
                          {t('profile')}
                        </button>
                        <button className="secondary" onClick={() => setModal('password')}>
                          {t('changePassword')}
                        </button>
                        <button
                          className="secondary"
                          onClick={() => void run(() => api('auth/verify/request', {}), t('done'))}
                        >
                          {t('verified')}
                        </button>
                        <button className="secondary" onClick={() => setModal('verify')}>
                          {t('code')}
                        </button>
                        <button
                          className="secondary"
                          onClick={() =>
                            void run(async () => {
                              await api('auth/logout', {});
                              await saveToken('');
                              setSigned(false);
                            })
                          }
                        >
                          <LogOut size={16} />
                          {t('logout')}
                        </button>
                      </>
                    )}
                    <button
                      className="text-button"
                      onClick={() =>
                        void run(async () =>
                          download(
                            'salahguard-export.json',
                            signed ? await api('profile/export') : db.state,
                          ),
                        )
                      }
                    >
                      {t('export')}
                    </button>
                    {signed && (
                      <button
                        className="danger text-button"
                        onClick={() => setModal('deleteAccount')}
                      >
                        {t('deleteAccount')}
                      </button>
                    )}
                  </div>
                </section>
                {settingsPage === 'about' && <AboutContact />}
                <section className="card settings-card" hidden={settingsPage !== 'appearance'}>
                  <h2>{t('language')}</h2>
                  <Field label={t('language')}>
                    <select
                      value={s.lang}
                      onChange={(e) =>
                        void run(async () => {
                          await db.configure({ ...s, lang: e.target.value as Lang });
                          await scheduleReminders();
                        })
                      }
                    >
                      <option value="en">English</option>
                      <option value="ur">اردو</option>
                      <option value="ar">العربية</option>
                    </select>
                  </Field>
                  <Field label={t('appearance')}>
                    <select
                      value={s.appearance || 'system'}
                      onChange={(e) =>
                        void run(() =>
                          db.configure({
                            ...s,
                            appearance: e.target.value as Settings['appearance'],
                            dark: e.target.value === 'dark',
                          }),
                        )
                      }
                    >
                      <option value="system">{t('system')}</option>
                      <option value="light">{t('light')}</option>
                      <option value="dark">{t('darkMode')}</option>
                    </select>
                  </Field>
                </section>
                <section className="card settings-card" hidden={settingsPage !== 'location'}>
                  <h2>
                    <MapPin size={20} />
                    {t('location')}
                  </h2>
                  <form
                    key={`${s.lat}:${s.lng}:${s.city}:${s.timezone}`}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void run(async () => {
                        const next = {
                          ...s,
                          lat: Number(f.get('lat')),
                          lng: Number(f.get('lng')),
                          city: String(f.get('city')),
                          timezone: String(f.get('timezone')),
                          method: String(f.get('method')),
                          hanafi: f.get('hanafi') === 'on',
                          ishaEnd: String(f.get('ishaEnd')) as Settings['ishaEnd'],
                          adjustments: String(f.get('adjustments')).split(',').map(Number),
                        };
                        if (
                          next.adjustments.length !== 5 ||
                          next.adjustments.some((n) => !Number.isFinite(n) || Math.abs(n) > 120)
                        )
                          throw Error('Enter five adjustments between -120 and 120');
                        validateSettings(next);
                        await db.configure(next);
                        await scheduleReminders();
                      }, t('done'));
                    }}
                  >
                    <div className="field-grid">
                      <Field label={t('city')}>
                        <select
                          name="city"
                          defaultValue={s.city}
                          onChange={(e) => {
                            const cities: any = {
                              Karachi: [24.8607, 67.0011, 'Asia/Karachi'],
                              Lahore: [31.5204, 74.3587, 'Asia/Karachi'],
                              Makkah: [21.4225, 39.8262, 'Asia/Riyadh'],
                              Dubai: [25.2048, 55.2708, 'Asia/Dubai'],
                              London: [51.5074, -0.1278, 'Europe/London'],
                            };
                            const c = cities[e.target.value];
                            if (c)
                              void run(() =>
                                db.configure({
                                  ...s,
                                  city: e.target.value,
                                  lat: c[0],
                                  lng: c[1],
                                  timezone: c[2],
                                }),
                              );
                          }}
                        >
                          {[
                            ...new Set([
                              s.city,
                              'Karachi',
                              'Lahore',
                              'Makkah',
                              'Dubai',
                              'London',
                              'Custom',
                            ]),
                          ].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <details className="calm-advanced">
                      <summary>
                        {tr('More location options', 'مقام کے مزید اختیارات', 'خيارات موقع إضافية')}
                      </summary>
                      <div>
                        <div className="field-grid">
                          <Field label={t('timezone')}>
                            <input
                              key={s.timezone}
                              name="timezone"
                              defaultValue={s.timezone}
                              required
                            />
                          </Field>
                          <Field label={t('latitude')}>
                            <input
                              key={s.lat}
                              name="lat"
                              type="number"
                              step="any"
                              min="-89"
                              max="89"
                              defaultValue={s.lat}
                            />
                          </Field>
                          <Field label={t('longitude')}>
                            <input
                              key={s.lng}
                              name="lng"
                              type="number"
                              step="any"
                              min="-180"
                              max="180"
                              defaultValue={s.lng}
                            />
                          </Field>
                        </div>
                        <Field label={t('method')}>
                          <select name="method" defaultValue={s.method}>
                            {[
                              'Karachi',
                              'UmmAlQura',
                              'Dubai',
                              'MuslimWorldLeague',
                              'Egyptian',
                              'NorthAmerica',
                              'MoonsightingCommittee',
                              'Singapore',
                            ].map((k) => (
                              <option key={k}>{k}</option>
                            ))}
                          </select>
                        </Field>
                        <label className="toggle">
                          <span>{t('hanafi')}</span>
                          <input name="hanafi" type="checkbox" defaultChecked={s.hanafi} />
                        </label>
                        <Field label={t('endIsha')}>
                          <select name="ishaEnd" defaultValue={s.ishaEnd}>
                            <option value="midnight">{t('midnight')}</option>
                            <option value="fajr">{t('fajr')}</option>
                          </select>
                        </Field>
                        <Field label={t('prayerAdjust')}>
                          <input name="adjustments" defaultValue={s.adjustments.join(',')} />
                        </Field>
                      </div>
                    </details>
                    <div className="actions">
                      <button className="primary">{t('save')}</button>
                      <button
                        className="secondary"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const loc = await detectLocation();
                            await db.configure({
                              ...s,
                              ...loc,
                              city: 'Current location',
                              autoLocation: isNative,
                              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                            });
                            await scheduleReminders();
                            setMessage(
                              tr(
                                'Location updated. Prayer times now use your detected position.',
                                'مقام اپ ڈیٹ ہو گیا۔ نماز کے اوقات نئے مقام کے مطابق ہیں۔',
                                'تم تحديث الموقع وأوقات الصلاة.',
                              ),
                            );
                          })
                        }
                      >
                        {busy
                          ? tr('Finding location…', 'مقام تلاش ہو رہا ہے…', 'جارٍ تحديد الموقع…')
                          : t('detect')}
                      </button>
                    </div>
                  </form>
                  {isNative && (
                    <Toggle
                      label={
                        s.lang === 'ur'
                          ? 'ایپ کھلی ہو تو مقام کی تبدیلی پہچانیں'
                          : s.lang === 'ar'
                            ? 'تحديث الموقع أثناء استخدام التطبيق'
                            : 'Update location while using the app'
                      }
                      value={!!s.autoLocation}
                      onChange={(v) => void run(() => db.configure({ ...s, autoLocation: v }))}
                    />
                  )}
                </section>
                <section className="card settings-card" hidden={settingsPage !== 'reminders'}>
                  <h2>
                    <Shield size={20} />
                    {t('enforcer')}
                  </h2>
                  <Toggle
                    label={t('enforcer')}
                    value={s.enforcer}
                    onChange={(v) =>
                      void run(async () => {
                        await db.configure({ ...s, enforcer: v });
                        if (isNative) await Native.requestNotifications();
                        await scheduleReminders();
                      })
                    }
                  />
                  <details className="calm-advanced">
                    <summary>
                      {tr(
                        'More reminder options',
                        '\u06cc\u0627\u062f \u062f\u06c1\u0627\u0646\u06cc \u06a9\u06d2 \u0627\u0639\u0644\u06cc\u0670 \u0627\u062e\u062a\u06cc\u0627\u0631\u0627\u062a',
                        '\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u062a\u0630\u0643\u064a\u0631 \u0627\u0644\u0645\u062a\u0642\u062f\u0645\u0629',
                      )}
                    </summary>
                    <div>
                      <Toggle
                        label={t('silent')}
                        value={s.silent}
                        onChange={(v) =>
                          void run(async () => {
                            await db.configure({ ...s, silent: v });
                            await scheduleReminders();
                          })
                        }
                      />
                      <Toggle
                        label={t('vibration')}
                        value={s.vibration}
                        onChange={(v) =>
                          void run(async () => {
                            await db.configure({ ...s, vibration: v });
                            await scheduleReminders();
                          })
                        }
                      />
                      <p className="muted">{t('reminderHelp')}</p>
                    </div>
                  </details>
                  <ReminderSettings
                    settings={s}
                    change={(next) =>
                      run(async () => {
                        await db.configure(next);
                        await scheduleReminders();
                      })
                    }
                    notify={setMessage}
                  />
                </section>
                <section
                  className="card settings-card full"
                  id="sync"
                  hidden={settingsPage !== 'sync'}
                >
                  <div className="section-title">
                    <h2>
                      <Cloud size={21} />
                      {t('sync')}
                    </h2>
                    <span className="status-dot" />
                  </div>
                  <div className="connection-badge">
                    {t('connection')}: {t(online ? 'online' : 'offlineConnection')}
                  </div>
                  <div className="sync-stats">
                    <div>
                      <small>{t('lastSync')}</small>
                      <strong>
                        {db.state.lastSync
                          ? new Date(db.state.lastSync).toLocaleString(s.lang)
                          : '—'}
                      </strong>
                    </div>
                    <div>
                      <small>{t('pendingRecords')}</small>
                      <strong>{db.state.queue.length}</strong>
                    </div>
                    <div>
                      <small>{t('pendingFiles')}</small>
                      <strong>
                        {library.filter((f) => !f.cloudId).length +
                          (db.state.pendingFileDeletes?.length || 0)}
                      </strong>
                    </div>
                    <div>
                      <small>{t('failed')}</small>
                      <strong>
                        {db.state.queue.filter((o) => o.error).length +
                          library.filter((f) => f.error && !f.cloudId).length}
                      </strong>
                    </div>
                    <div>
                      <small>{t('cloud')}</small>
                      <strong>{((db.state.cloud?.bytes || 0) / 1048576).toFixed(1)} MiB</strong>
                    </div>
                    <div>
                      <small>{t('local')}</small>
                      <strong>
                        {(
                          (JSON.stringify(db.state).length +
                            library.reduce((n, f) => n + f.bytes, 0)) /
                          1048576
                        ).toFixed(1)}{' '}
                        MiB
                      </strong>
                    </div>
                  </div>
                  <p className="notice">{t('unsynced')}</p>
                  <div className="actions wrap">
                    <button
                      className="primary"
                      disabled={busy || !signed}
                      onClick={() =>
                        void run(async () => {
                          await sync(true);
                          await scheduleReminders();
                        }, t('done'))
                      }
                    >
                      <RefreshCw size={17} />
                      {t('retry')}
                    </button>
                    <button
                      className="secondary"
                      disabled={!signed}
                      onClick={() =>
                        void run(async () => {
                          if (db.state.queue.length)
                            throw Error('Resolve and sync pending changes first');
                          db.state.cursor = 0;
                          await db.persist();
                          await sync(true);
                          await scheduleReminders();
                        }, t('done'))
                      }
                    >
                      {t('restore')}
                    </button>
                    <button
                      className="secondary"
                      disabled={!signed}
                      onClick={() =>
                        void run(async () => {
                          await restoreFiles();
                          setLibrary(await localFiles());
                        }, t('done'))
                      }
                    >
                      {t('cloudFiles')}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => download('salahguard-local-backup.json', db.state)}
                    >
                      {t('export')} · {t('local')}
                    </button>
                  </div>
                  {db.state.queue
                    .filter((o) => o.error)
                    .map((o) => (
                      <div className="conflict" key={o.id}>
                        <strong>
                          {o.record.entity} · {o.record.id}
                        </strong>
                        <p>{localizeMessage(o.error || '', s.lang)}</p>
                        {o.record.data._cloud && (
                          <>
                            <details>
                              <summary>{t('localCloud')}</summary>
                              <pre>
                                {JSON.stringify(
                                  { local: o.record.data, cloud: o.record.data._cloud },
                                  null,
                                  2,
                                )}
                              </pre>
                            </details>
                            <div className="actions">
                              <button
                                className="secondary"
                                onClick={() =>
                                  void run(async () => {
                                    const cloud = o.record.data._cloud;
                                    db.state.queue = db.state.queue.filter((x) => x.id !== o.id);
                                    const data = { ...o.record.data };
                                    delete data._cloud;
                                    const local = db.find(o.record.entity, o.record.id);
                                    if (local) local.version = cloud.version;
                                    await db.put(
                                      o.record.entity,
                                      o.record.id,
                                      data,
                                      o.record.deleted,
                                    );
                                  })
                                }
                              >
                                {t('keepLocal')}
                              </button>
                              <button
                                className="secondary"
                                onClick={() =>
                                  void run(async () => {
                                    const cloud = o.record.data._cloud;
                                    db.state.queue = db.state.queue.filter(
                                      (x) =>
                                        x.record.id !== o.record.id ||
                                        x.record.entity !== o.record.entity,
                                    );
                                    db.state.records = db.state.records.filter(
                                      (x) => x.id !== o.record.id || x.entity !== o.record.entity,
                                    );
                                    db.state.records.push(cloud);
                                    await db.persist();
                                  })
                                }
                              >
                                {t('keepCloud')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                </section>
              </div>
              <footer>
                DeenPath · v0.3.7{' '}
                <a href="https://tanzil.net" target="_blank" rel="noreferrer">
                  Quran content: Tanzil
                </a>
              </footer>
            </>
          )}
        </main>
      </div>
      {message && (
        <div className="toast" role="status" onClick={() => setMessage('')}>
          <span>{localizeMessage(message, s.lang)}</span>
          <button aria-label={t('dismiss')}>
            <X size={18} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy" role="status">
          <RefreshCw size={17} /> …
        </div>
      )}
      {reader && (
        <div className="reader">
          <header>
            <button className="secondary" onClick={() => setReader(null)}>
              <ArrowLeft size={17} />
              {t('dismiss')}
            </button>
            <h3>{reader.name}</h3>
            {editing && (
              <button
                className="primary"
                disabled={done(editing)}
                onClick={() =>
                  void run(async () => {
                    await complete(editing);
                    setReader(null);
                  }, t('done'))
                }
              >
                {t('complete')}
              </button>
            )}
            {reader.mime !== 'application/pdf' && (
              <label className="zoom-control">
                {t('readingZoom')}
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="0.25"
                  value={readerZoom}
                  onChange={(e) => {
                    const zoom = Number(e.target.value);
                    setReaderZoom(zoom);
                    void saveReadingPosition(reader.id, imageScroll.current?.scrollTop || 0, zoom);
                  }}
                />
              </label>
            )}
          </header>
          {reader.mime === 'application/pdf' ? (
            <iframe title={reader.name} src={readerUrl + '#page=' + (reader.page || 1)} />
          ) : (
            <div
              className="image-reader"
              ref={imageScroll}
              onScroll={(e) => {
                const top = e.currentTarget.scrollTop;
                if (readingTimer.current) clearTimeout(readingTimer.current);
                readingTimer.current = setTimeout(
                  () => void saveReadingPosition(reader.id, top, readerZoom),
                  400,
                );
              }}
            >
              <img
                alt={reader.name}
                src={readerUrl}
                onLoad={() => {
                  if (imageScroll.current) imageScroll.current.scrollTop = reader.offset || 0;
                }}
                style={{ width: `${readerZoom * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
      {modal && (
        <div
          className={'modal-backdrop' + (modal === 'reminder' ? ' enforcer-backdrop' : '')}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className={'modal' + (modal === 'reminder' ? ' fullscreen-enforcer' : '')}
            role="dialog"
            aria-modal="true"
            aria-label={t(modal === 'reminder' ? 'reminder' : 'settings')}
          >
            <button className="close icon" onClick={() => setModal(null)} aria-label={t('dismiss')}>
              <X size={20} />
            </button>
            {modal === 'auth' && (
              <>
                <BrandMark className="auth-brand" />
                <h2>{t(authMode === 'register' ? 'register' : 'login')}</h2>
                <GoogleAccount
                  notify={setMessage}
                  done={() => {
                    setSigned(true);
                    setModal(null);
                    void run(() => sync(true));
                  }}
                />
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(async () => {
                      if (authMode === 'register' && f.get('password') !== f.get('confirm'))
                        throw Error('Passwords do not match');
                      await signIn(
                        String(f.get('email')),
                        String(f.get('password')),
                        authMode === 'register' ? String(f.get('name')) : undefined,
                      );
                      setSigned(true);
                      setModal(null);
                      await sync(true);
                    }, t('done'));
                  }}
                >
                  {authMode === 'register' && (
                    <Field label={t('name')}>
                      <input name="name" required maxLength={160} autoComplete="name" />
                    </Field>
                  )}
                  <Field label={t('email')}>
                    <input name="email" type="email" required autoComplete="email" />
                  </Field>
                  <Field label={t('password')}>
                    <input
                      name="password"
                      type="password"
                      minLength={12}
                      required
                      autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                    />
                  </Field>
                  {authMode === 'register' && (
                    <Field label={t('confirm')}>
                      <input name="confirm" type="password" minLength={12} required />
                    </Field>
                  )}
                  <button className="primary" disabled={busy}>
                    {t(authMode === 'register' ? 'register' : 'login')}
                  </button>
                </form>
                <button className="text-button" onClick={() => setModal('reset')}>
                  {t('reset')}
                </button>
              </>
            )}
            {modal === 'reset' && (
              <>
                <h2>{t('reset')}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(
                      () => api('auth/reset/request', { email: f.get('email') }),
                      'If mail is configured, check your email for a code.',
                    );
                  }}
                >
                  <Field label={t('email')}>
                    <input name="email" type="email" required />
                  </Field>
                  <button className="secondary">{t('reset')}</button>
                </form>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(async () => {
                      await api('auth/reset/confirm', {
                        code: f.get('code'),
                        password: f.get('password'),
                      });
                      setModal('auth');
                    }, t('done'));
                  }}
                >
                  <Field label={t('code')}>
                    <input name="code" required />
                  </Field>
                  <Field label={t('newPassword')}>
                    <input name="password" type="password" minLength={12} required />
                  </Field>
                  <button className="primary">{t('save')}</button>
                </form>
              </>
            )}
            {modal === 'verify' && (
              <>
                <h2>{t('verified')}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const code = new FormData(e.currentTarget).get('code');
                    void run(async () => {
                      await api('auth/verify/confirm', { code });
                      setModal(null);
                    }, t('done'));
                  }}
                >
                  <Field label={t('code')}>
                    <input name="code" required />
                  </Field>
                  <button className="primary">{t('save')}</button>
                </form>
              </>
            )}
            {modal === 'profile' && (
              <>
                <h2>{t('profile')}</h2>
                {signed && <GoogleAccount link notify={setMessage} done={refresh} />}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(async () => {
                      if (!signed) throw Error('Sign in to update your cloud profile');
                      db.state.profile = await api(
                        'profile',
                        {
                          name: f.get('name'),
                          dob: f.get('dob'),
                          email: f.get('email'),
                          currentPassword: f.get('currentPassword'),
                        },
                        'PATCH',
                      );
                      await db.persist();
                      setModal(null);
                    }, t('done'));
                  }}
                >
                  <Field label={t('name')}>
                    <input name="name" defaultValue={db.state.profile?.name} required />
                  </Field>
                  <Field label={t('email')}>
                    <input
                      name="email"
                      type="email"
                      defaultValue={db.state.profile?.email}
                      required
                    />
                  </Field>
                  <Field label={t('currentPassword')}>
                    <input name="currentPassword" type="password" autoComplete="current-password" />
                  </Field>
                  <Field label={t('dob')}>
                    <input type="date" name="dob" defaultValue={db.state.profile?.dob} />
                  </Field>
                  <label className="field">
                    <span>
                      {t('profile')} · {t('choose')}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) =>
                        void run(async () => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const f = await importFile(file);
                            await uploadFile(f, true);
                            db.state.profile = await api('profile');
                            await db.persist();
                            setLibrary(await localFiles());
                          }
                        })
                      }
                    />
                  </label>
                  <button className="primary">{t('save')}</button>
                </form>
              </>
            )}
            {modal === 'password' && (
              <>
                <h2>{t('changePassword')}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(async () => {
                      const r = await api('profile/password', {
                        currentPassword: f.get('current'),
                        password: f.get('new'),
                      });
                      await saveToken(r.token);
                      setModal(null);
                    }, t('done'));
                  }}
                >
                  <Field label={t('currentPassword')}>
                    <input name="current" type="password" required />
                  </Field>
                  <Field label={t('newPassword')}>
                    <input name="new" type="password" minLength={12} required />
                  </Field>
                  <button className="primary">{t('save')}</button>
                </form>
              </>
            )}
            {modal === 'routine' && (
              <>
                <h2>{editing ? t('correct') : t('add')}</h2>
                <form
                  key={editing?.id || 'new'}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(async () => {
                      if (
                        f.get('frequency') === 'after_prayer' &&
                        !editing &&
                        !f.getAll('resetPrayers').length
                      )
                        throw Error('Select at least one prayer to reset after');
                      const id = editing?.id || crypto.randomUUID();
                      const resetSettings = editing?.data.resetSettings || {
                        lat: s.lat,
                        lng: s.lng,
                        method: s.method,
                        hanafi: s.hanafi,
                        timezone: s.timezone,
                        adjustments: [...s.adjustments],
                        ishaEnd: s.ishaEnd,
                        city: s.city,
                      };
                      if (f.get('frequency') === 'after_prayer')
                        prayerStartTimes(today, resetSettings);
                      const chosenFile = library.find((x) => x.id === f.get('fileId'));
                      const file = chosenFile ? await linkRoutineFile(chosenFile, id) : undefined;
                      await db.put('routines', id, {
                        ...editing?.data,
                        duaText: String(f.get('duaText') || '').trim(),
                        deadline: f.get('deadline'),
                        contentRef: editing?.data.contentRef || undefined,
                        title: f.get('title'),
                        kind: f.get('kind'),
                        frequency: f.get('frequency') || editing?.data.frequency,
                        resetPrayers: editing?.data.resetPrayers || f.getAll('resetPrayers'),
                        resetSettings:
                          f.get('frequency') === 'after_prayer' ? resetSettings : undefined,
                        createdAt: editing?.data.createdAt || new Date().toISOString(),
                        scheduleHistory: editing
                          ? [
                              ...(editing.data.scheduleHistory || []),
                              {
                                until: today,
                                schedule: { ...editing.data, scheduleHistory: undefined },
                              },
                            ]
                          : [],
                        endDate: f.get('endDate'),
                        hijriAdjustment: s.hijriAdjustment || 0,
                        weekdays: f.getAll('weekdays').map(Number),
                        calendar: f.get('calendar'),
                        hijriMonth: Number(f.get('hijriMonth') || 1),
                        hijriDay: Number(f.get('hijriDay') || 1),
                        followup: Number(f.get('followup') || 0),
                        time: f.get('time'),
                        timezone: editing?.data.timezone || s.timezone,
                        startDate: f.get('startDate'),
                        target: Number(f.get('target') || 100),
                        dhikr: f.get('dhikr'),
                        interval: Number(f.get('interval') || 1),
                        weekday: Number(f.get('weekday') || 1),
                        monthday: Number(f.get('monthday') || 1),
                        fileId: file?.id,
                        fileCloudId: file?.cloudId,
                      });
                      if (isNative && f.get('frequency') !== 'unscheduled')
                        await Native.requestNotifications();
                      await scheduleReminders();
                      setModal(null);
                    }, t('done'));
                  }}
                >
                  <Field label={t('title')}>
                    <input
                      name="title"
                      required
                      maxLength={160}
                      defaultValue={editing?.data.title}
                    />
                  </Field>
                  <div className="field-grid">
                    <Field label={t('routines')}>
                      <select
                        name="kind"
                        value={routineKind}
                        onChange={(e) => setRoutineKind(e.target.value)}
                      >
                        <option value="quran">{tr('Ayat', 'آیات', 'آيات')}</option>
                        <option value="dua">{t('dua')}</option>
                        <option value="tasbih">{t('tasbih')}</option>
                        <option value="nafl">
                          {tr(
                            'Nafl Salah',
                            '\u0646\u0641\u0644 \u0646\u0645\u0627\u0632',
                            '\u0635\u0644\u0627\u0629 \u0627\u0644\u0646\u0627\u0641\u0644\u0629',
                          )}
                        </option>
                        <option value="custom">
                          {tr(
                            'Custom activity',
                            '\u0627\u067e\u0646\u06cc \u0633\u0631\u06af\u0631\u0645\u06cc',
                            '\u0646\u0634\u0627\u0637 \u0645\u062e\u0635\u0635',
                          )}
                        </option>
                      </select>
                    </Field>
                    <Field label={t('frequency')}>
                      <select
                        name="frequency"
                        value={routineFrequency}
                        onChange={(e) => setRoutineFrequency(e.target.value)}
                      >
                        {[
                          'daily',
                          'weekly',
                          'monthly',
                          'yearly',
                          'interval',
                          'once',
                          'weekdays',
                          'unscheduled',
                          'after_prayer',
                        ].map((v) => (
                          <option key={v} value={v}>
                            {v === 'after_prayer'
                              ? tr('After Namaz', 'نماز کے بعد', 'بعد الصلاة')
                              : v === 'once'
                                ? tr(
                                    'Specific date',
                                    '\u0645\u062e\u0635\u0648\u0635 \u062a\u0627\u0631\u06cc\u062e',
                                    '\u062a\u0627\u0631\u064a\u062e \u0645\u062d\u062f\u062f',
                                  )
                                : v === 'weekdays'
                                  ? tr(
                                      'Selected weekdays',
                                      '\u0645\u0646\u062a\u062e\u0628 \u0627\u06cc\u0627\u0645',
                                      '\u0623\u064a\u0627\u0645 \u0645\u062d\u062f\u062f\u0629',
                                    )
                                  : v === 'unscheduled'
                                    ? s.lang === 'ur'
                                      ? 'بغیر شیڈول'
                                      : s.lang === 'ar'
                                        ? 'دون جدول'
                                        : 'Unscheduled'
                                    : t(v as 'daily')}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {routineFrequency !== 'after_prayer' ? (
                      <Field label={t('time')}>
                        <input
                          name="time"
                          type="time"
                          defaultValue={editing?.data.time || '21:00'}
                          required
                        />
                      </Field>
                    ) : (
                      <input type="hidden" name="time" value={editing?.data.time || '21:00'} />
                    )}
                    <Field label={t('start')}>
                      <input
                        name="startDate"
                        type="date"
                        min="2000-01-01"
                        defaultValue={editing?.data.startDate || today}
                        required
                      />
                    </Field>
                    {routineFrequency === 'weekly' && (
                      <Field label={t('week')}>
                        <input
                          name="weekday"
                          type="number"
                          min="0"
                          max="6"
                          defaultValue={editing?.data.weekday ?? 1}
                        />
                      </Field>
                    )}
                    {routineFrequency === 'monthly' && (
                      <Field label={t('month')}>
                        <input
                          name="monthday"
                          type="number"
                          min="1"
                          max="31"
                          defaultValue={editing?.data.monthday || 1}
                        />
                      </Field>
                    )}
                    {routineFrequency === 'interval' && (
                      <Field label={t('every')}>
                        <input
                          name="interval"
                          type="number"
                          min="1"
                          max="3650"
                          defaultValue={editing?.data.interval || 1}
                        />
                      </Field>
                    )}
                    {['tasbih', 'nafl'].includes(routineKind) && (
                      <Field label={t('target')}>
                        <input
                          name="target"
                          type="number"
                          min="1"
                          max="1000000"
                          key={routineKind}
                          defaultValue={
                            editing?.data.kind === routineKind
                              ? editing.data.target
                              : routineKind === 'nafl'
                                ? 2
                                : 100
                          }
                        />
                      </Field>
                    )}
                  </div>
                  {routineKind === 'tasbih' && (
                    <Field label={t('dhikr')}>
                      <textarea name="dhikr" maxLength={3000} defaultValue={editing?.data.dhikr} />
                    </Field>
                  )}
                  {true && (
                    <details className="calm-advanced" open>
                      <summary>
                        {tr(
                          'Reading material',
                          '\u0645\u0637\u0627\u0644\u0639\u06d2 \u06a9\u0627 \u0645\u0648\u0627\u062f',
                          '\u0645\u0627\u062f\u0629 \u0627\u0644\u0642\u0631\u0627\u0621\u0629',
                        )}
                      </summary>
                      <div>
                        {routineKind === 'dua' && (
                          <Field label={tr('Write your Dua', 'اپنی دعا لکھیں', 'اكتب دعاءك')}>
                            <textarea
                              name="duaText"
                              maxLength={12000}
                              rows={5}
                              dir="auto"
                              defaultValue={editing?.data.duaText || ''}
                            />
                          </Field>
                        )}
                        <Field
                          label={tr(
                            'Add PDF or image',
                            'پی ڈی ایف یا تصویر شامل کریں',
                            'إضافة ملف أو صورة',
                          )}
                        >
                          <input
                            type="file"
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file)
                                void run(async () => {
                                  const added = await importFile(file);
                                  setLibrary([...(await localFiles())]);
                                  setRoutineFile(added.id);
                                });
                              e.target.value = '';
                            }}
                          />
                        </Field>
                        <input type="hidden" name="fileId" value={routineFile} />
                        {routineFile && (
                          <div className="attachment-chip">
                            <FileText size={17} />
                            <span>
                              {library.find((file) => file.id === routineFile)?.name ||
                                tr('Linked reading', 'منسلک مطالعہ', 'قراءة مرفقة')}
                            </span>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => setRoutineFile('')}
                            >
                              {tr('Remove', 'ہٹائیں', 'إزالة')}
                            </button>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                  {routineFrequency === 'after_prayer' && (
                    <fieldset className="private-form-section">
                      <legend>
                        {tr(
                          'Reset after selected prayers',
                          'منتخب نمازوں کے بعد دوبارہ آغاز',
                          'إعادة البدء بعد الصلوات المحددة',
                        )}
                      </legend>
                      <p className="muted">
                        {tr(
                          'A new count begins when a selected prayer time starts. Earlier counts stay saved; recording prayer or Qaza does not reset it.',
                          'منتخب نماز کا وقت شروع ہونے پر نئی گنتی شروع ہوگی۔ پرانی گنتی محفوظ رہے گی۔ نماز یا قضا درج کرنے سے گنتی نہیں بدلے گی۔',
                          'يبدأ عدّ جديد عند دخول وقت الصلاة المحددة. تحفظ الأعداد السابقة ولا يعيد تسجيل الصلاة أو القضاء العدّ.',
                        )}
                      </p>
                      <p className="muted">
                        {tr('Prayer schedule', 'نماز کے اوقات', 'مواقيت الصلاة')}:{' '}
                        {editing?.data.resetSettings?.city || s.city} ·{' '}
                        {editing?.data.timezone || s.timezone}
                        {editing && (
                          <>
                            {' '}
                            ·{' '}
                            {tr(
                              'Create a new routine to change its schedule.',
                              'اوقات بدلنے کے لیے نیا معمول بنائیں۔',
                              'أنشئ وردًا جديدًا لتغيير الجدول.',
                            )}
                          </>
                        )}
                      </p>
                      <div className="practice-reset-options">
                        {['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((name) => (
                          <label key={name}>
                            <input
                              type="checkbox"
                              name="resetPrayers"
                              disabled={!!editing}
                              value={name}
                              defaultChecked={(editing?.data.resetPrayers || ['Fajr']).includes(
                                name,
                              )}
                            />
                            {prayerLabel(name, s.lang)}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  <ScheduleFields data={editing?.data} frequency={routineFrequency} />
                  {routineFrequency === 'daily' && (
                    <details className="calm-advanced">
                      <summary>
                        {tr(
                          'Daily completion deadline',
                          '\u0631\u0648\u0632\u0627\u0646\u06c1 \u062a\u06a9\u0645\u06cc\u0644 \u06a9\u06cc \u0622\u062e\u0631\u06cc \u062d\u062f',
                          '\u0627\u0644\u0645\u0648\u0639\u062f \u0627\u0644\u0646\u0647\u0627\u0626\u064a \u0644\u0644\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u064a\u0648\u0645\u064a',
                        )}
                      </summary>
                      <div>
                        <Field
                          label={
                            s.lang === 'ur'
                              ? 'روزانہ کی آخری حد'
                              : s.lang === 'ar'
                                ? 'الموعد اليومي النهائي'
                                : 'Daily deadline (next day)'
                          }
                        >
                          <input
                            type="time"
                            name="deadline"
                            readOnly={!!editing}
                            defaultValue={editing?.data.deadline || '00:00'}
                          />
                        </Field>
                        <p className="muted">{t('scheduleNote')}</p>
                      </div>
                    </details>
                  )}
                  <button className="primary" disabled={busy}>
                    {t('save')}
                  </button>
                </form>
              </>
            )}
            {modal === 'duaText' && editing && (
              <>
                <h2>{editing.data.title}</h2>
                <div className="dua-reading" dir="auto">
                  {editing.data.duaText}
                </div>
                {editing.data.fileId && (
                  <button
                    className="secondary"
                    onClick={() =>
                      void run(async () => {
                        const file = library.find((f) => f.id === editing.data.fileId);
                        if (file) {
                          setModal(null);
                          await openFile(file, editing.id);
                        }
                      })
                    }
                  >
                    {tr('Open attached file', 'منسلک فائل کھولیں', 'فتح الملف المرفق')}
                  </button>
                )}
                <button
                  className="primary"
                  disabled={done(editing)}
                  onClick={() =>
                    void run(async () => {
                      await complete(editing);
                      setModal(null);
                    }, t('done'))
                  }
                >
                  {t('complete')}
                </button>
              </>
            )}
            {modal === 'verse' && editing && (
              <>
                <h2>{editing.data.title}</h2>
                <Field label={t('mode')}>
                  <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="arabic">{t('arabic')}</option>
                    <option value="translation">{t('translation')}</option>
                    <option value="both">{t('both')}</option>
                  </select>
                </Field>
                {mode !== 'translation' && (
                  <blockquote className="quran-text" dir="rtl">
                    {quran.verses.find((v) => v.ref === editing.data.contentRef)?.text}
                  </blockquote>
                )}
                {mode !== 'arabic' && <VerseTranslations verseRef={editing.data.contentRef} />}
                <p className="muted">
                  {editing.data.contentRef} ·{' '}
                  <a href="https://tanzil.net">Tanzil Project · CC BY 3.0</a>
                </p>
                <button
                  className="primary"
                  disabled={done(editing)}
                  onClick={() =>
                    void run(async () => {
                      await complete(editing);
                      setModal(null);
                    }, t('done'))
                  }
                >
                  {t('complete')}
                </button>
              </>
            )}
            {modal === 'history' && (
              <>
                <h2>{t('history')}</h2>
                <input
                  type="date"
                  max={today}
                  value={historyDay}
                  onChange={(e) => setHistoryDay(e.target.value)}
                />
                {prayers(historyDay, s).map((w) => (
                  <div className="history-row" key={w.name}>
                    <strong>{prayerLabel(w.name, s.lang, w.key.slice(0, 10))}</strong>
                    <span>
                      {t(prayerState(w, db.find('prayer_records', w.key), now) as 'ontime')}
                    </span>
                    <button
                      className="secondary"
                      onClick={() => {
                        setSelected(w.key);
                        setModal('reminder');
                      }}
                    >
                      {t('correct')}
                    </button>
                  </div>
                ))}
              </>
            )}
            {modal === 'reminder' &&
              selected &&
              (() => {
                const calculated = prayers(selected.split(':')[0], s).find(
                  (x) => x.key === selected,
                );
                if (!calculated) return null;
                const old = db.find('prayer_records', selected);
                const w = recordedPrayerWindow(calculated, old);
                return (
                  <>
                    <span className="eyebrow">{t('reminder')}</span>
                    <h2>{prayerLabel(w.name, s.lang, w.key.slice(0, 10))}</h2>
                    <div className="reminder-time">{formatTime(now)}</div>
                    <p>
                      {formatTime(w.start)} – {formatTime(w.end)} ·{' '}
                      {now < w.end
                        ? countdown(w.end)
                        : tr('Prayer time ended', 'نماز کا وقت ختم', 'انتهى وقت الصلاة')}
                    </p>
                    <ReminderPassage settings={s} />
                    <div className="actions wrap">
                      <button
                        className="primary"
                        disabled={
                          busy ||
                          now < w.start ||
                          ['ontime', 'qaza'].includes(prayerState(w, old, now))
                        }
                        onClick={() => void run(() => markPrayer(selected, now >= w.end))}
                      >
                        {now < w.end ? t('prayed') : t('qaza')}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            if (isNative)
                              await Native.deen({
                                op: 'snoozePrayer',
                                route: 'prayer:' + selected,
                                payload: JSON.stringify({
                                  id: selected + ':snooze:' + Date.now(),
                                  at: Date.now() + (s.snoozeMinutes || 10) * 60000,
                                  title: prayerLabel(w.name, s.lang),
                                  body: reminderBody('20:14', s),
                                  category: 'gentle',
                                  route: 'prayer:' + selected,
                                  windowStart: w.start.toISOString(),
                                  windowEnd: w.end.toISOString(),
                                  silent: s.silent,
                                  vibration: s.vibration,
                                }),
                              });
                            setModal(null);
                          })
                        }
                      >
                        {t('later')}
                      </button>
                    </div>
                    <details className="calm-advanced">
                      <summary>{t('correct')}</summary>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const at = String(new FormData(e.currentTarget).get('at'));
                          void run(() => markPrayer(selected, false, new Date(at).toISOString()));
                        }}
                      >
                        <Field label={t('correctionTime')}>
                          <input name="at" type="datetime-local" required />
                        </Field>
                        <button className="secondary">{t('correct')}</button>
                      </form>
                    </details>
                    {old && !old.deleted && (
                      <button
                        className="danger text-button"
                        onClick={() =>
                          void run(async () => {
                            await db.put('prayer_records', selected, old.data, true);
                            const q = db.find('qaza_records', selected);
                            if (q) await db.put('qaza_records', selected, q.data, true);
                            await scheduleReminders();
                            setModal(null);
                          })
                        }
                      >
                        {t('delete')}
                      </button>
                    )}
                  </>
                );
              })()}
            {['deleteRoutine', 'deleteFile', 'resetCounter', 'undoRoutine'].includes(modal) && (
              <>
                <h2>{t(modal === 'resetCounter' ? 'correct' : 'delete')}</h2>
                <p>
                  {selected &&
                    (db.find('routines', selected)?.data.title ||
                      library.find((f) => f.id === selected)?.name)}
                </p>
                <div className="actions">
                  <button
                    className="primary"
                    onClick={() =>
                      void run(async () => {
                        if (modal === 'undoRoutine') {
                          const r = db.find('routines', selected!)!;
                          const c = db.find(
                            'routine_completions',
                            completionId(r.id, periodKey(r.data, now, db.state.records)),
                          );
                          if (c) await db.put('routine_completions', c.id, c.data, true);
                        } else if (modal === 'deleteRoutine') {
                          const r = db.find('routines', selected!)!;
                          await db.put('routines', r.id, r.data, true);
                          await deleteRoutineAttachment(r);
                          setLibrary(await localFiles());
                          await scheduleReminders();
                        } else if (modal === 'deleteFile') {
                          await deleteFile(library.find((f) => f.id === selected)!);
                          setLibrary(await localFiles());
                        } else {
                          const r = db.find('routines', selected!)!;
                          const period = periodKey(r.data, now, db.state.records);
                          await db.put('tasbih_progress', completionId(r.id, period), {
                            routineId: r.id,
                            period,
                            count: 0,
                          });
                          const c = db.find('routine_completions', completionId(r.id, period));
                          if (c) await db.put('routine_completions', c.id, c.data, true);
                        }
                        setModal(null);
                      }, t('done'))
                    }
                  >
                    {t('apply')}
                  </button>
                  <button className="secondary" onClick={() => setModal(null)}>
                    {t('cancel')}
                  </button>
                </div>
              </>
            )}
            {modal === 'deleteAccount' && (
              <>
                <h2>{t('deleteAccount')}</h2>
                <p>{t('unsynced')}</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(async () => {
                      if (f.get('confirmation') !== 'DELETE') throw Error('Type DELETE');
                      await api('profile', { currentPassword: f.get('password') }, 'DELETE');
                      if (isNative) await Native.deen({ op: 'erasePrivate' });
                      for (const file of library)
                        if (file.path) await Native.removeFile({ path: file.path });
                      await saveToken('');
                      db.state = {
                        schema: 1,
                        owner: null,
                        profile: null,
                        records: [],
                        queue: [],
                        cursor: 0,
                        lastSync: null,
                        settings: { ...defaults },
                        cloud: null,
                      };
                      await db.persist();
                      localStorage.removeItem('file-index');
                      localStorage.removeItem('salahguard.files');
                      setLibrary([]);
                      setSigned(false);
                      setModal(null);
                    }, t('done'));
                  }}
                >
                  <Field label={t('currentPassword')}>
                    <input name="password" type="password" required />
                  </Field>
                  <Field label={t('deleteConfirm')}>
                    <input name="confirmation" required />
                  </Field>
                  <button className="primary danger">{t('deleteAccount')}</button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
