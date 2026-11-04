import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Square,
  TriangleAlert,
  Minus,
  Plus,
} from 'lucide-react';
import { loadOwnedStory } from './cards-store';
import { Native, isNative } from './native';
import type { CollectibleCard } from './collectibles';
import { useBack } from './back';
interface Reading {
  language: 'en' | 'ur';
  size: number;
  en: number;
  ur: number;
}
function preferences(id: string): Reading {
  try {
    return {
      ...{ language: 'en', size: 19, en: 0, ur: 0 },
      ...JSON.parse(localStorage.getItem('deenpath-reader:' + id) || '{}'),
    };
  } catch {
    return { language: 'en', size: 19, en: 0, ur: 0 };
  }
}
export function StoryReader({
  card: metadata,
  art,
  close,
  report,
  listen = false,
}: {
  card: CollectibleCard;
  art: React.ReactNode;
  close: () => void;
  report: () => void;
  listen?: boolean;
}) {
  const [card, setCard] = useState(metadata),
    [loadingStory, setLoadingStory] = useState(true),
    [storyError, setStoryError] = useState('');
  useEffect(() => {
    let alive = true;
    void loadOwnedStory(metadata)
      .then((value) => {
        if (alive) setCard(value);
      })
      .catch((error) => {
        if (alive) setStoryError((error as Error).message);
      })
      .finally(() => {
        if (alive) setLoadingStory(false);
      });
    return () => {
      alive = false;
    };
  }, [metadata.id]);
  const [reading, setReading] = useState(() => preferences(card.id)),
    [rate, setRate] = useState(1),
    [voice, setVoice] = useState({ state: 'stopped', message: '', sentence: 0, total: 0 }),
    [missing, setMissing] = useState(false);
  const container = useRef<HTMLDivElement>(null),
    root = useRef<HTMLElement>(null),
    current = useRef(reading),
    started = useRef(false);
  const language = reading.language,
    story = storyError ? undefined : language === 'ur' ? card.urdu : card.english || card.story,
    playing = voice.state === 'playing',
    loading = voice.state === 'loading';
  current.current = reading;
  useBack(() => {
    close();
    return true;
  });
  function save(next: Reading) {
    current.current = next;
    setReading(next);
    localStorage.setItem('deenpath-reader:' + card.id, JSON.stringify(next));
  }
  async function command(action: string, speed = rate) {
    if (!isNative) {
      setVoice((v) => ({
        ...v,
        state: 'error',
        message:
          'Audio narration is available in the Android app through your installed text-to-speech engine.',
      }));
      return;
    }
    try {
      const result = await Native.deen({
        op: 'narration',
        action,
        storyId: card.id,
        language,
        rate: speed,
      });
      if (current.current.language !== language) return;
      setVoice(result);
      if (result.state === 'missing') setMissing(true);
    } catch (error) {
      setVoice((v) => ({ ...v, state: 'error', message: (error as Error).message }));
    }
  }
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    root.current?.querySelector<HTMLElement>('button')?.focus();
    let active = true,
      remove: (() => Promise<void>) | undefined;
    if (isNative)
      void Native.addListener('narration', (event) => {
        if (active && event.storyId === card.id && event.language === current.current.language) {
          setVoice(event);
          if (event.state === 'missing') setMissing(true);
        }
      }).then((handle) => {
        if (active) remove = handle.remove;
        else void handle.remove();
      });
    return () => {
      active = false;
      void remove?.();
      if (isNative) void Native.deen({ op: 'narration', action: 'release' }).catch(() => {});
      before?.focus();
    };
  }, [card.id]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (container.current) container.current.scrollTop = current.current[language] || 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [language, card.id]);
  useEffect(() => {
    if (listen && !started.current) {
      started.current = true;
      void command('play');
    }
  }, [listen]);
  function switchLanguage(next: 'en' | 'ur') {
    if (next === language) return;
    if (isNative) void Native.deen({ op: 'narration', action: 'stop' });
    setVoice({ state: 'stopped', message: '', sentence: 0, total: 0 });
    setMissing(false);
    save({ ...current.current, language: next });
  }
  return (
    <section
      className="story-reader"
      role="dialog"
      aria-modal="true"
      aria-label="Story reader"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (missing) setMissing(false);
          else close();
        }
        if (event.key === 'Tab') {
          const buttons = (
            missing ? root.current?.querySelector('.voice-dialog') : root.current
          )?.querySelectorAll<HTMLElement>('button:not([disabled]),select,a[href]');
          if (buttons?.length) {
            const first = buttons[0],
              last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }
      }}
    >
      <header className="story-reader-header">
        <button className="icon" aria-label="Back to collection" onClick={close}>
          <ArrowLeft />
        </button>
        <strong>Read & reflect</strong>
        <button className="icon" aria-label="Report this card" onClick={report}>
          <TriangleAlert />
        </button>
      </header>
      <div className="story-reader-tools">
        <div role="group" aria-label="Story language">
          <button
            className={language === 'en' ? 'primary' : 'secondary'}
            aria-pressed={language === 'en'}
            onClick={() => switchLanguage('en')}
          >
            English
          </button>
          <button
            className={language === 'ur' ? 'primary' : 'secondary'}
            aria-pressed={language === 'ur'}
            onClick={() => switchLanguage('ur')}
          >
            اردو
          </button>
        </div>
        <div role="group" aria-label="Text size">
          <button
            className="icon"
            aria-label="Smaller text"
            disabled={reading.size <= 16}
            onClick={() => save({ ...reading, size: reading.size - 1 })}
          >
            <Minus size={18} />
          </button>
          <span>{reading.size}</span>
          <button
            className="icon"
            aria-label="Larger text"
            disabled={reading.size >= 30}
            onClick={() => save({ ...reading, size: reading.size + 1 })}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
      <div
        className="story-reader-scroll"
        ref={container}
        onScroll={(event) => {
          const next = { ...current.current, [language]: event.currentTarget.scrollTop };
          current.current = next;
          localStorage.setItem('deenpath-reader:' + card.id, JSON.stringify(next));
        }}
      >
        <article
          className="story-reader-page"
          lang={language}
          dir={language === 'ur' ? 'rtl' : 'ltr'}
          style={{ fontSize: reading.size }}
        >
          {art}
          <span className="rarity-label">
            {card.rarity === 'ultra' ? 'Ultra rare' : card.rarity}
          </span>
          <h1>{language === 'ur' ? card.titleUrdu || card.title : card.title}</h1>
          <p className="story-intro">
            {language === 'ur'
              ? card.summaryUrdu
              : card.summary || (card.english ? card.story : '')}
          </p>
          {storyError ? (
            <p role="status">{storyError}</p>
          ) : loadingStory ? (
            <p role="status">Opening saved story…</p>
          ) : story ? (
            <div className="story-prose">
              {story.split(/\n\s*\n/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <p role="status">
              The reviewed Urdu edition is not saved for this older card yet. Its original English
              story remains available.
            </p>
          )}
          <footer className="story-references">
            <h2>{language === 'ur' ? 'حوالہ جات' : 'References'}</h2>
            {card.references.map((source, index) => (
              <p key={index}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}
                </a>
              </p>
            ))}
            <small>
              {card.englishReviewed && card.urduReviewed
                ? 'English and Urdu editions independently reviewed.'
                : 'Previously reviewed library edition.'}{' '}
              Rarity describes collection mechanics.
            </small>
          </footer>
        </article>
      </div>
      <footer className="story-audio">
        <div className="story-audio-controls">
          <button
            className={playing ? 'primary' : 'secondary'}
            aria-label={playing ? 'Disable narration' : 'Enable narration'}
            aria-pressed={playing}
            disabled={!story}
            onClick={() => void command(playing ? 'stop' : 'play')}
          >
            {playing ? <Volume2 /> : <VolumeX />}
          </button>
          <button
            className="secondary"
            aria-label={
              playing
                ? 'Pause narration'
                : voice.state === 'paused'
                  ? 'Resume narration'
                  : 'Play narration'
            }
            disabled={!story || loading}
            onClick={() => void command(playing ? 'pause' : 'play')}
          >
            {playing ? <Pause /> : <Play />}
          </button>
          <button
            className="secondary"
            aria-label="Stop narration"
            disabled={voice.state === 'stopped'}
            onClick={() => void command('stop')}
          >
            <Square size={18} />
          </button>
          <label>
            Speed
            <select
              aria-label="Narration speed"
              value={rate}
              onChange={(event) => {
                const next = Number(event.target.value);
                setRate(next);
                if (playing) void command('play', next);
              }}
            >
              {[0.75, 1, 1.25, 1.5].map((value) => (
                <option value={value} key={value}>
                  {value}×
                </option>
              ))}
            </select>
          </label>
        </div>
        <small role="status">
          {loading
            ? 'Starting Android voice…'
            : voice.message ||
              (playing
                ? 'Reading ' +
                  (language === 'ur' ? 'Urdu' : 'English') +
                  ' · sentence ' +
                  (voice.sentence + 1) +
                  ' of ' +
                  voice.total
                : voice.state === 'paused'
                  ? 'Paused · resume repeats the current sentence'
                  : 'Android voice · no audio download')}
        </small>
      </footer>
      {missing && (
        <div className="voice-dialog-backdrop">
          <section
            className="card voice-dialog"
            role="alertdialog"
            aria-label={language === 'ur' ? 'Urdu Voice Required' : 'English Voice Required'}
          >
            <h2>{language === 'ur' ? 'Urdu Voice Required' : 'English Voice Required'}</h2>
            <p>
              Your device needs an installed {language === 'ur' ? 'Urdu' : 'English'} text-to-speech
              voice to read this story. Android and your selected engine manage voice installation;
              some engines do not support Urdu.
            </p>
            <div className="actions">
              <button
                autoFocus
                className="primary"
                onClick={() => {
                  setMissing(false);
                  void command('install');
                }}
              >
                Install Voice
              </button>
              <button className="secondary" onClick={() => setMissing(false)}>
                Not Now
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
