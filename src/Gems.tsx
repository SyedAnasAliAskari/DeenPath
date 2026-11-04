import { useEffect, useRef, useState } from 'react';
import { Gem, History } from 'lucide-react';
import { db } from './store';
import { Heading, Panel, tr, type SuiteProps } from './deen-ui';
export function GemBalance({ open }: { open: () => void }) {
  const balance = db.state.economy?.balance || 0,
    previous = useRef(balance),
    [gain, setGain] = useState(0);
  useEffect(() => {
    if (balance > previous.current) setGain(balance - previous.current);
    previous.current = balance;
    const timer = setTimeout(() => setGain(0), 1800);
    return () => clearTimeout(timer);
  }, [balance]);
  return (
    <button
      className="gem-balance secondary"
      aria-label={`${balance} Gems. Open Gem history`}
      onClick={open}
    >
      <Gem size={16} />
      <span>{balance.toLocaleString()}</span>
      {gain > 0 && (
        <span key={balance} className="gem-gain" role="status">
          +{gain}
        </span>
      )}
    </button>
  );
}
export function Gems(props: SuiteProps) {
  const [shown, setShown] = useState(50);
  const history = useRef<HTMLOListElement>(null);
  const economy = db.state.economy,
    rows = Object.values(economy?.transactions || {}).reverse();
  return (
    <div className="gems-screen">
      <Heading
        title="Gems"
        text={tr(
          'Small steps, saved progress.',
          'چھوٹے قدم، محفوظ پیش رفت۔',
          'خطوات صغيرة وتقدم محفوظ.',
        )}
      />
      {(db.state as any).economySyncError && db.state.owner && (
        <p className="notice">
          Cloud confirmation is pending for Gems and customizations. Your local progress is saved.
        </p>
      )}
      <Panel title={tr('Your balance', 'آپ کا بیلنس', 'رصيدك')}>
        <p className="gem-total">
          <Gem />
          {(economy?.balance || 0).toLocaleString()}
        </p>
        <p className="muted">
          Gems are in-app rewards. They do not measure religious merit. Your Gems and owned cards
          stay saved.
        </p>
        <p>
          On-time prayer: 10 · Qaza: 8 · Tasbih, Dua and other routines: 5. Missed activities: 0.
        </p>
        {(economy?.balance || 0) < 0 && (
          <p className="notice">
            A corrected completion reversed its earlier reward. New rewards will restore your
            balance.
          </p>
        )}
      </Panel>
      <Panel title={tr('Transaction history', 'لین دین کی تاریخ', 'سجل المعاملات')}>
        <div className="gem-history-controls">
          <button className="secondary" onClick={() => props.navigate('shop')}>
            Open Theme Studio
          </button>
          <button
            className="icon"
            aria-label="History"
            title="Jump to transaction history"
            onClick={() => {
              history.current?.focus({ preventScroll: true });
              history.current?.scrollIntoView({
                block: 'start',
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                  ? 'auto'
                  : 'smooth',
              });
            }}
          >
            <History size={20} />
          </button>
        </div>
        {!rows.length && <p>Complete an activity to earn your first Gems.</p>}
        <ol className="gem-history" ref={history} tabIndex={-1}>
          {rows.slice(0, shown).map((row) => (
            <li key={row.id}>
              <div>
                <strong>
                  {row.delta >= 0 ? '+' : ''}
                  {row.delta} Gems
                </strong>
                <small>
                  {row.kind === 'purchase'
                    ? 'Theme Studio purchase'
                    : row.kind === 'correction'
                      ? 'Completion corrected'
                      : row.kind === 'prayer'
                        ? 'On-time prayer'
                        : row.kind === 'qaza'
                          ? 'Qaza completed'
                          : row.kind === 'custom'
                            ? 'Routine completed'
                            : row.kind + ' completed'}
                </small>
              </div>
              <time dateTime={row.at}>{new Date(row.at).toLocaleString()}</time>
            </li>
          ))}
        </ol>
        {rows.length > shown && (
          <button className="secondary" onClick={() => setShown((n) => n + 50)}>
            Show more transactions
          </button>
        )}
      </Panel>
    </div>
  );
}
