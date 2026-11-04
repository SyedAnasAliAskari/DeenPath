import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  Gem,
  Layers,
  BookOpen,
  RefreshCw,
  TriangleAlert,
  Volume2,
  X,
  Sparkles,
  LockKeyhole,
} from 'lucide-react';
import { StoryReader } from './StoryReader';
import { CardPacket } from './CardPacket';
import { db, api } from './store';
import { Heading, Panel, type SuiteProps } from './deen-ui';
import { Field } from './components';
import { useBack } from './back';
import { buyCardPack, revealCardCopy, refreshCardLibrary, cardArtwork } from './cards-store';
import {
  cardRarities,
  emptyCollectibles,
  verifiedCard,
  type CollectibleCard,
  type CardCopy,
} from './collectibles';
const CardReview = lazy(() => import('./CardReview'));
const rarityLabel = (rarity: string) =>
  ({ common: 'Common', uncommon: 'Uncommon', rare: 'Rare', ultra: 'Ultra rare' })[rarity] || rarity;
function CardArt({ card }: { card: CollectibleCard }) {
  const element = useRef<HTMLDivElement | null>(null),
    [visible, setVisible] = useState(false),
    [url, setUrl] = useState('');
  const art = db.state.collectibles?.artwork[card.artId || ''];
  const asset = art?.path || art?.base64?.length || '';
  useEffect(() => {
    if (!element.current) return;
    const watch = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          watch.disconnect();
        }
      },
      { rootMargin: '150px' },
    );
    watch.observe(element.current);
    return () => watch.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || !card.artId) return;
    let alive = true,
      object = '';
    void cardArtwork(card.artId)
      .then((blob) => {
        if (blob) {
          object = URL.createObjectURL(blob);
          if (alive) setUrl(object);
          else URL.revokeObjectURL(object);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [visible, card.artId, asset]);
  return (
    <div className="collectible-art" ref={element}>
      {url ? (
        <img src={url} alt={card.title + ' · symbolic illustration'} loading="lazy" />
      ) : (
        <div className="collectible-art-pending">
          <BookOpen size={32} />
          <small>Artwork not cached</small>
        </div>
      )}
    </div>
  );
}
function CardDialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useBack(() => {
    close();
    return true;
  });
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => before?.focus();
  }, []);
  return (
    <div className="collectible-overlay">
      <section
        className="collectible-dialog card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            close();
          }
          if (event.key === 'Tab') {
            const items = ref.current?.querySelectorAll<HTMLElement>(
              'button,a,input,select,textarea',
            );
            if (items?.length) {
              const first = items[0],
                last = items[items.length - 1];
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
        <header>
          <h2>{title}</h2>
          <button className="icon" aria-label="Close" onClick={close}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function Story({ card }: { card: CollectibleCard }) {
  return (
    <div className="collectible-story">
      <h3>{card.title}</h3>
      <p>{card.story}</p>
      <ul>
        {card.references.map((ref, i) => (
          <li key={i}>
            <a href={ref.url} target="_blank" rel="noopener noreferrer">
              {ref.title}
            </a>
          </li>
        ))}
      </ul>
      <small>
        Verified educational card ·{' '}
        {card.generationDate
          ? new Date(card.generationDate).toLocaleDateString()
          : 'Reviewed library'}
        <br />
        Rarity describes collection mechanics.
      </small>
    </div>
  );
}
export function Collectibles(props: SuiteProps & { signed: boolean; signIn: () => void }) {
  const state = db.state.collectibles || emptyCollectibles(),
    [busy, setBusy] = useState(false),
    [admin, setAdmin] = useState(false),
    [reviewing, setReviewing] = useState(false),
    flight = useRef(false),
    [filter, setFilter] = useState('all'),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState('all'),
    [reader, setReader] = useState<{ card: CollectibleCard; listen: boolean } | null>(null),
    [shown, setShown] = useState(20),
    [packId, setPackId] = useState<string | null>(null),
    [detail, setDetail] = useState<string | null>(null),
    [story, setStory] = useState(false),
    [report, setReport] = useState<CollectibleCard | null>(null),
    [stories, setStories] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    if (props.signed)
      void api('cards/capabilities')
        .then((result) => {
          if (alive) setAdmin(result.admin === true);
        })
        .catch(() => {});
    else setAdmin(false);
    return () => {
      alive = false;
    };
  }, [props.signed]);
  const copies = Object.values(state.copies)
      .filter(
        (copy) =>
          !copy.hidden &&
          state.library[copy.cardId]?.verification === 'verified' &&
          ['published', 'flagged'].includes(state.library[copy.cardId]?.status || ''),
      )
      .sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt)),
    filtered = copies.filter((c) => {
      const card = state.library[c.cardId];
      return (
        (filter === 'all' || card?.rarity === filter) &&
        (category === 'all' || card?.category === category) &&
        (card.title + ' ' + (card.titleUrdu || ''))
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase())
      );
    }),
    balance = db.state.economy?.balance || 0,
    cost = db.state.economy?.prices?.pack || 500;
  const library = Object.values(state.library).filter(verifiedCard),
    ready = cardRarities.every((r) => library.filter((c) => c.rarity === r).length >= 3),
    unfinished = Object.values(state.packs)
      .filter((pack) =>
        pack.copyIds.some((id) => !state.copies[id]?.revealed && !state.copies[id]?.hidden),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = packId ? state.packs[packId] : null,
    selected = detail ? state.copies[detail] : null,
    card = selected ? state.library[selected.cardId] : null;
  async function act(action: () => Promise<unknown>) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    try {
      await action();
      props.refresh();
    } catch (error) {
      props.notify((error as Error).message);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  const close = () => {
    setPackId(null);
    setDetail(null);
    setReport(null);
    setStories([]);
  };
  async function reveal(copy: CardCopy) {
    await act(() => revealCardCopy(copy.id));
  }
  return (
    <div
      className="collectibles-screen"
      data-motion={db.state.settings.themeAnimations !== false ? 'on' : 'off'}
    >
      <Heading title="My Collection" text="Stories to read, reflect on and revisit." />
      {admin && (
        <button className="secondary" onClick={() => setReviewing(true)}>
          Review library
        </button>
      )}
      <section className="card collectible-pack-shop">
        <div className="collectible-pack-symbol" aria-hidden="true">
          <Layers size={42} />
          <Sparkles size={18} />
        </div>
        <div>
          <h2>Three stories to discover</h2>
          <p>Three different cards in each pack. Saved before the reveal, ready to revisit.</p>
          <small>
            <Gem size={14} /> {balance.toLocaleString()} Gems saved
          </small>
        </div>
        <button
          className="primary"
          disabled={busy || !ready || balance < cost}
          onClick={() =>
            void act(async () => {
              const id = await buyCardPack();
              setStories([]);
              setPackId(id);
            })
          }
        >
          Open pack · {cost.toLocaleString()} Gems
        </button>
      </section>
      {unfinished.length > 0 && (
        <Panel title="Continue your reveal">
          {unfinished.map((pack) => (
            <button
              key={pack.id}
              className="secondary"
              disabled={busy}
              onClick={() => {
                setPackId(pack.id);
                setStories([]);
              }}
            >
              Continue pack · {pack.copyIds.filter((id) => state.copies[id]?.revealed).length} / 3
              revealed
            </button>
          ))}
        </Panel>
      )}
      {!ready && (
        <p className="notice">
          The verified library is being prepared. No Gems are spent while a pack is unavailable.
        </p>
      )}
      <div className="collectible-toolbar">
        <p>
          {new Set(copies.map((copy) => copy.cardId)).size} unique · {copies.length} saved cards
        </p>
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              await refreshCardLibrary();
              props.notify('Verified library refreshed.');
            })
          }
        >
          <RefreshCw size={16} />
          Refresh library
        </button>
      </div>
      <details className="card collectible-guide">
        <summary>About the collection</summary>
        <p>
          Rarity is a collection mechanic. It never measures the religious importance of Prophets,
          Companions or other people.
        </p>
        <p>
          Each draw: Common 55% · Uncommon 30% · Rare 12% · Ultra rare 3%. Each pack has three
          different cards; duplicates across packs remain separate owned copies. Refunds and
          exchanges are not enabled.
        </p>
        <p>
          Sensitive subjects use symbolic artwork. References and artwork require independent review
          before entering the shared library.
        </p>
        {!props.signed && (
          <p>
            Guest progress, Gems and owned cards are saved on this device. Signing in later can back
            them up; no account is required to collect from an available cached library.
          </p>
        )}
      </details>
      <div className="collection-search">
        <Field label="Search stories">
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setShown(20);
            }}
            placeholder="Search English or Urdu title"
          />
        </Field>
        <Field label="Category">
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setShown(20);
            }}
          >
            <option value="all">All categories</option>
            {[...new Set(copies.map((copy) => state.library[copy.cardId].category))]
              .sort()
              .map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
          </select>
        </Field>
      </div>
      <div className="collectible-filters" role="group" aria-label="Filter collection">
        {['all', ...cardRarities].map((r) => (
          <button
            key={r}
            className={filter === r ? 'primary' : 'secondary'}
            aria-pressed={filter === r}
            onClick={() => {
              setFilter(r);
              setShown(20);
            }}
          >
            {r === 'all' ? 'All cards' : rarityLabel(r)}
          </button>
        ))}
      </div>
      {filtered.length ? (
        <div className="collectible-grid">
          {filtered.slice(0, shown).map((copy) => {
            const card = state.library[copy.cardId];
            return (
              <article key={copy.id} className={'collectible-tile rarity-' + card.rarity}>
                <button
                  className="collection-tile-open"
                  aria-label={'Open ' + card.title}
                  onClick={() => {
                    setDetail(copy.id);
                    setStory(false);
                  }}
                >
                  <CardArt card={card} />
                  <div>
                    <span className="rarity-label">{rarityLabel(card.rarity)}</span>
                    <h3>{card.title}</h3>
                    {copies.filter((item) => item.cardId === card.id).length > 1 && (
                      <small>
                        Previously collected ·{' '}
                        {copies.filter((item) => item.cardId === card.id).length} copies
                      </small>
                    )}
                    {copy.pendingSync && props.signed && <small>Cloud confirmation pending</small>}
                  </div>
                </button>
                <div className="collection-card-controls">
                  <button
                    className="secondary"
                    aria-label={'Read story: ' + card.title}
                    onClick={() => setReader({ card, listen: false })}
                  >
                    <BookOpen size={18} />
                    <span>Read Story</span>
                  </button>
                  <button
                    className="icon"
                    aria-label={'Listen to story: ' + card.title}
                    onClick={() => setReader({ card, listen: true })}
                  >
                    <Volume2 size={19} />
                  </button>
                  <button
                    className="icon"
                    aria-label={'Report card: ' + card.title}
                    onClick={() => {
                      if (!props.signed) {
                        props.signIn();
                        return;
                      }
                      setReport(card);
                    }}
                  >
                    <TriangleAlert size={19} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Panel title="Your shelf is ready">
          <BookOpen />
          <p>
            {copies.length
              ? 'No cards match this filter.'
              : 'Your collected stories will appear here. Each owned copy stays saved when you close the app.'}
          </p>
        </Panel>
      )}
      {filtered.length > shown && (
        <button className="secondary" onClick={() => setShown((n) => n + 20)}>
          Show more cards
        </button>
      )}
      {Object.values(db.state.economy?.orders || {}).some(
        (o) => o.kind === 'pack' && o.status === 'rejected',
      ) && (
        <p className="notice">
          A pack needs attention after cloud reconciliation. Its local history is retained; the
          cloud has not charged for a rejected purchase. Check Sync Center before buying again.
        </p>
      )}
      {active && !reader && (
        <CardDialog title="Your three cards" close={close}>
          <p>Your cards are already saved. Reveal them at your own pace.</p>
          <CardPacket
            key={active.id}
            id={active.id}
            opened={!!active.opened}
            refresh={props.refresh}
            notify={props.notify}
          >
            <div className="pack-reveal-grid">
              {active.copyIds.map((id, index) => {
                const copy = state.copies[id],
                  card = copy && state.library[copy.cardId];
                if (
                  !copy ||
                  !card ||
                  copy.hidden ||
                  !['published', 'flagged'].includes(card.status)
                )
                  return (
                    <div className="card" key={id}>
                      This card is under review.
                    </div>
                  );
                return (
                  <article
                    className={
                      'pack-reveal-card rarity-' + (copy.revealed ? card.rarity : 'hidden')
                    }
                    key={id}
                  >
                    {!copy.revealed ? (
                      <button
                        className="card-back"
                        aria-label={'Reveal card ' + (index + 1)}
                        disabled={busy}
                        onClick={() => void reveal(copy)}
                      >
                        <Layers size={42} />
                        <span>Card {index + 1}</span>
                        <small>Tap to reveal</small>
                      </button>
                    ) : stories.includes(id) ? (
                      <>
                        <Story card={card} />
                        <button
                          className="secondary"
                          onClick={() => setStories(stories.filter((c) => c !== id))}
                        >
                          Show artwork
                        </button>
                      </>
                    ) : (
                      <>
                        <CardArt card={card} />
                        <span className="rarity-label">{rarityLabel(card.rarity)}</span>
                        <h3>{card.title}</h3>
                        <button
                          className="secondary"
                          onClick={() => setReader({ card, listen: false })}
                        >
                          Read story
                        </button>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </CardPacket>
          <button className="primary" onClick={close}>
            View collection
          </button>
        </CardDialog>
      )}
      {card && selected && !reader && (
        <CardDialog title={card.title} close={close}>
          <article className={'collection-detail rarity-' + card.rarity}>
            {story ? (
              <Story card={card} />
            ) : (
              <>
                <CardArt card={card} />
                <span className="rarity-label">{rarityLabel(card.rarity)}</span>
                <p>{card.title}</p>
              </>
            )}
            <button className="primary" onClick={() => setReader({ card, listen: false })}>
              Read complete story
            </button>
          </article>
          <button className="secondary" onClick={() => setReader({ card, listen: true })}>
            <Volume2 size={18} />
            Listen to story
          </button>
          <button
            className="secondary"
            onClick={() => {
              if (!props.signed) {
                setDetail(null);
                props.signIn();
                return;
              }
              setDetail(null);
              setReport(card);
            }}
          >
            <TriangleAlert size={16} />
            Report an issue
          </button>
        </CardDialog>
      )}
      {report && (
        <CardDialog title="Report a card" close={close}>
          <h3>{report.title}</h3>
          <form
            className="collectible-report"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void act(async () => {
                await api('cards/reports', {
                  cardId: report.id,
                  reason: data.get('reason'),
                  detail: String(data.get('detail') || ''),
                });
                props.notify('Report saved for review. Thank you.');
                setReport(null);
              });
            }}
          >
            <Field label="Reason">
              <select name="reason">
                <option value="islamic">Incorrect Islamic information</option>
                <option value="history">Inaccurate historical details</option>
                <option value="artwork">Inappropriate artwork</option>
                <option value="offensive">Offensive content</option>
                <option value="other">Other problem</option>
              </select>
            </Field>
            <Field label="Details">
              <textarea name="detail" rows={4} maxLength={2000} />
            </Field>
            <p className="muted">
              One report per person counts toward review. Artwork and offensive-content reports
              enter the priority review queue.
            </p>
            <button className="primary" disabled={busy}>
              Submit report
            </button>
          </form>
        </CardDialog>
      )}
      {reader && (
        <StoryReader
          key={reader.card.id}
          card={reader.card}
          art={<CardArt card={reader.card} />}
          close={() => setReader(null)}
          listen={reader.listen}
          report={() => {
            const chosen = reader.card;
            setReader(null);
            setPackId(null);
            setDetail(null);
            if (props.signed) setReport(chosen);
            else props.signIn();
          }}
        />
      )}
      {admin && reviewing && (
        <Suspense fallback={<p role="status">Opening review tools…</p>}>
          <CardReview close={() => setReviewing(false)} notify={props.notify} />
        </Suspense>
      )}
    </div>
  );
}
