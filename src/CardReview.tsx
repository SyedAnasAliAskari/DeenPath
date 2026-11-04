import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { api, apiURL, currentToken } from './store';
import { Field } from './components';
import { useBack } from './back';
import type { CollectibleCard } from './collectibles';
const categories: Record<string, string[]> = {
  common: ['history', 'scholars', 'discoveries', 'institutions'],
  uncommon: ['events'],
  rare: ['sahabah'],
  ultra: ['prophets'],
};
function ReviewArtwork({ id }: { id: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true,
      object = '';
    const controller = new AbortController();
    void fetch(apiURL('cards/admin/art/' + id), {
      headers: { Authorization: 'Bearer ' + currentToken() },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error('Artwork unavailable');
        const blob = await response.blob();
        if (blob.size > 8 * 1024 * 1024 || !blob.type.startsWith('image/'))
          throw Error('Invalid artwork');
        object = URL.createObjectURL(blob);
        if (alive) setUrl(object);
        else URL.revokeObjectURL(object);
      })
      .catch(() => {});
    return () => {
      alive = false;
      controller.abort();
      if (object) URL.revokeObjectURL(object);
    };
  }, [id]);
  return url ? (
    <img className="review-art" src={url} alt="Artwork for independent review" />
  ) : (
    <p>Artwork unavailable. Approval remains blocked until it can be inspected.</p>
  );
}
export default function CardReview({
  close,
  notify,
}: {
  close: () => void;
  notify: (text: string) => void;
}) {
  const [queue, setQueue] = useState<any>(null),
    [selection, setSelection] = useState<any>(null),
    [draft, setDraft] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [checked, setChecked] = useState<Record<string, boolean>>({}),
    [artId, setArtId] = useState(''),
    [confirm, setConfirm] = useState(''),
    [topic, setTopic] = useState({ title: '', rarity: 'common', category: 'history' });
  const flight = useRef(false),
    root = useRef<HTMLElement>(null);
  useBack(() => {
    if (selection) {
      setSelection(null);
      return true;
    }
    close();
    return true;
  });
  async function act(fn: () => Promise<void>) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      notify((error as Error).message);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    setQueue(await api('cards/admin/queue'));
  }
  useEffect(() => {
    void act(refresh);
    const before = document.activeElement as HTMLElement;
    root.current?.querySelector<HTMLElement>('button')?.focus();
    return () => before?.focus();
  }, []);
  async function select(id: string) {
    const result = await api('cards/admin/card/' + id);
    setSelection(result);
    setDraft({ ...result.card, imagePrompt: 'Retain the existing reviewed symbolic artwork.' });
    setChecked({});
    setArtId(result.artwork?.[0]?.id || '');
    setConfirm('');
  }
  async function moderate(action: string) {
    if (!selection) return;
    await api(
      'cards/admin/' + selection.card.id,
      {
        action,
        ...(action === 'correct' ? { draft } : {}),
        ...(action === 'approve' ? { ...checked, artId } : {}),
      },
      'PATCH',
    );
    notify(
      action === 'approve'
        ? 'Both reviewed editions are published.'
        : action === 'correct'
          ? 'Correction saved as an unverified draft.'
          : 'Review action saved.',
    );
    setSelection(null);
    await refresh();
  }
  return (
    <section
      className="story-reader card-review"
      role="dialog"
      aria-modal="true"
      aria-label="Card review"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (selection) setSelection(null);
          else close();
        }
        if (event.key === 'Tab') {
          const items = root.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input,select,textarea,a[href]',
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
      <header className="story-reader-header">
        <button
          className="icon"
          aria-label={selection ? 'Back to review queue' : 'Close card review'}
          onClick={() => (selection ? setSelection(null) : close())}
        >
          <ArrowLeft />
        </button>
        <strong>Library review</strong>
        <button
          className="icon"
          aria-label="Refresh review queue"
          disabled={busy}
          onClick={() => void act(refresh)}
        >
          <RefreshCw />
        </button>
      </header>
      <div className="story-reader-scroll">
        <div className="review-page">
          {!queue ? (
            <p role="status">Loading review queue…</p>
          ) : selection ? (
            <>
              <h2>{selection.card.title}</h2>
              <p>
                {selection.card.verification} · {selection.card.status}
              </p>
              <p>
                Check every established event, translation and source. AI drafts cannot approve
                themselves. Do not approve depictions of Prophets or unsupported historical details.
              </p>
              <section className="card dp-panel">
                <h3>English edition</h3>
                <Field label="English title">
                  <input
                    value={draft.title}
                    maxLength={160}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  />
                </Field>
                <Field label="English introduction">
                  <textarea
                    value={draft.summary || draft.story || ''}
                    maxLength={500}
                    onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                  />
                </Field>
                <Field label="Complete English story">
                  <textarea
                    rows={14}
                    value={draft.english || ''}
                    maxLength={100000}
                    onChange={(event) => setDraft({ ...draft, english: event.target.value })}
                  />
                </Field>
              </section>
              <section className="card dp-panel" dir="rtl" lang="ur">
                <h3>اردو کہانی</h3>
                <Field label="Urdu title">
                  <input
                    value={draft.titleUrdu || ''}
                    maxLength={160}
                    onChange={(event) => setDraft({ ...draft, titleUrdu: event.target.value })}
                  />
                </Field>
                <Field label="Urdu introduction">
                  <textarea
                    value={draft.summaryUrdu || ''}
                    maxLength={500}
                    onChange={(event) => setDraft({ ...draft, summaryUrdu: event.target.value })}
                  />
                </Field>
                <Field label="Complete Urdu story">
                  <textarea
                    rows={14}
                    value={draft.urdu || ''}
                    maxLength={100000}
                    onChange={(event) => setDraft({ ...draft, urdu: event.target.value })}
                  />
                </Field>
              </section>
              <section className="card dp-panel">
                <h3>Sources</h3>
                {draft.references.map((source: any, index: number) => (
                  <div key={index} className="review-source">
                    <Field label={'Source ' + (index + 1) + ' title'}>
                      <input
                        value={source.title}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            references: draft.references.map((item: any, i: number) =>
                              i === index ? { ...item, title: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label={'Source ' + (index + 1) + ' HTTPS URL'}>
                      <input
                        type="url"
                        value={source.url}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            references: draft.references.map((item: any, i: number) =>
                              i === index ? { ...item, url: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </Field>
                    <a
                      href={/^https:\/\//.test(source.url) ? source.url : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Inspect source
                    </a>
                    <button
                      className="secondary"
                      disabled={draft.references.length <= 1}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          references: draft.references.filter((_: any, i: number) => i !== index),
                        })
                      }
                    >
                      Remove source
                    </button>
                  </div>
                ))}
                <button
                  className="secondary"
                  disabled={draft.references.length >= 8}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      references: [...draft.references, { title: '', url: '' }],
                    })
                  }
                >
                  Add source
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void act(() => moderate('correct'))}
                >
                  Save corrections for fresh review
                </button>
                <p className="muted">
                  Saving edits resets both language reviews. Approval below always publishes the
                  last saved edition.
                </p>
              </section>
              <section className="card dp-panel">
                <h3>Symbolic artwork</h3>
                {selection.artwork.length ? (
                  <>
                    <Field label="Artwork to review">
                      <select
                        value={artId}
                        onChange={(event) => {
                          setArtId(event.target.value);
                          setChecked({ ...checked, artworkChecked: false });
                        }}
                      >
                        {selection.artwork.map((art: any) => (
                          <option key={art.id} value={art.id}>
                            {art.provider} · {art.id.slice(0, 8)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <ReviewArtwork key={artId} id={artId} />
                    <p className="muted">
                      Provider: {selection.artwork.find((art: any) => art.id === artId)?.provider}.
                      Review provenance and applicable usage rights before approval.
                    </p>
                    <pre className="review-provenance">
                      {JSON.stringify(
                        selection.artwork.find((art: any) => art.id === artId)?.license || {},
                        null,
                        2,
                      )}
                    </pre>
                  </>
                ) : (
                  <p>No artwork is available; publication is blocked.</p>
                )}
              </section>
              <section className="card dp-panel">
                <h3>Independent approval</h3>
                {[
                  ['englishReviewed', 'I checked the complete saved English edition'],
                  ['urduReviewed', 'I checked the complete saved Urdu edition and script'],
                  ['referencesChecked', 'I verified the saved statements against reliable sources'],
                  ['artworkChecked', 'I inspected this exact artwork and its usage rights'],
                ].map(([key, label]) => (
                  <label className="review-checkbox" key={key}>
                    <input
                      type="checkbox"
                      checked={!!checked[key]}
                      onChange={(event) => setChecked({ ...checked, [key]: event.target.checked })}
                    />
                    {label}
                  </label>
                ))}
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !artId ||
                    Object.keys(checked).filter((key) => checked[key]).length !== 4 ||
                    JSON.stringify({
                      ...selection.card,
                      imagePrompt: 'Retain the existing reviewed symbolic artwork.',
                    }) !== JSON.stringify(draft)
                  }
                  onClick={() => void act(() => moderate('approve'))}
                >
                  Approve saved bilingual edition
                </button>
              </section>
              <section className="card dp-panel">
                <h3>Further action</h3>
                <Field label="Choose an action">
                  <select value={confirm} onChange={(event) => setConfirm(event.target.value)}>
                    <option value="">Select…</option>
                    <option value="withdraw">Withdraw from visible collections</option>
                    <option value="regenerate">Queue regeneration for fresh review</option>
                  </select>
                </Field>
                <p>
                  Ownership audit records remain. Regenerated content requires a new independent
                  review.
                </p>
                <button
                  className="secondary"
                  disabled={
                    busy || !confirm || (confirm === 'regenerate' && !queue.generationEnabled)
                  }
                  onClick={() => void act(() => moderate(confirm))}
                >
                  Confirm selected action
                </button>
              </section>
            </>
          ) : (
            <>
              <h2>Awaiting review</h2>
              {queue.drafts.length ? (
                queue.drafts.map((card: CollectibleCard) => (
                  <button
                    className="card review-queue-row"
                    key={card.id}
                    disabled={busy}
                    onClick={() => void act(() => select(card.id))}
                  >
                    <strong>{card.title}</strong>
                    <small>
                      {card.rarity} · {card.status} · {card.verification}
                    </small>
                  </button>
                ))
              ) : (
                <p>No drafts need review.</p>
              )}
              <h2>Reports</h2>
              {queue.reports.length ? (
                queue.reports.map((report: any, index: number) => (
                  <button
                    className="card review-queue-row"
                    key={index}
                    disabled={busy}
                    onClick={() => void act(() => select(report.id))}
                  >
                    <strong>{report.title}</strong>
                    <span>
                      {report.reason} · {report.credible ? 'credible' : 'unverified account'}
                    </span>
                    <p>{report.detail}</p>
                  </button>
                ))
              ) : (
                <p>No open reports.</p>
              )}
              <section className="card dp-panel">
                <h3>Generation queue</h3>
                <p>
                  {queue.generationEnabled
                    ? 'Generation is enabled within server budgets.'
                    : 'Provider setup is deferred. Generation is disabled.'}
                </p>
                {queue.jobs.map((job: any) => (
                  <p key={job.id}>
                    {job.id.slice(0, 8)} · {job.status} · {job.attempts} attempts{' '}
                    {job.error_code || ''}
                  </p>
                ))}
                {queue.budgets.map((budget: any) => (
                  <p key={budget.provider}>
                    {budget.provider}: {budget.reserved_units} reserved units today
                  </p>
                ))}
                <Field label="Story topic">
                  <input
                    value={topic.title}
                    maxLength={160}
                    onChange={(event) => setTopic({ ...topic, title: event.target.value })}
                  />
                </Field>
                <Field label="Rarity">
                  <select
                    value={topic.rarity}
                    onChange={(event) =>
                      setTopic({
                        ...topic,
                        rarity: event.target.value,
                        category: categories[event.target.value][0],
                      })
                    }
                  >
                    {Object.keys(categories).map((rarity) => (
                      <option key={rarity}>{rarity}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Category">
                  <select
                    value={topic.category}
                    onChange={(event) => setTopic({ ...topic, category: event.target.value })}
                  >
                    {categories[topic.rarity].map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </Field>
                <button
                  className="secondary"
                  disabled={busy || !topic.title.trim() || !queue.generationEnabled}
                  onClick={() =>
                    void act(async () => {
                      await api('cards/admin/generate', topic);
                      notify('Topic queued within the configured server limits.');
                      await refresh();
                    })
                  }
                >
                  Queue topic
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
