import { useEffect, useRef, useState } from 'react';
import { Layers, Sparkles } from 'lucide-react';
import { openCardPacket } from './cards-store';
export function CardPacket({
  id,
  opened,
  children,
  refresh,
  notify,
}: {
  id: string;
  opened: boolean;
  children: React.ReactNode;
  refresh: () => void;
  notify: (message: string) => void;
}) {
  const [tearing, setTearing] = useState(false),
    [skip, setSkip] = useState(false),
    [done, setDone] = useState(opened),
    start = useRef<number | null>(null),
    flight = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function tear(instant = false) {
    if (flight.current) return;
    flight.current = true;
    setSkip(instant);
    try {
      await openCardPacket(id);
      setTearing(true);
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      timer.current = setTimeout(
        () => {
          setDone(true);
          refresh();
        },
        instant || reduced ? 0 : 440,
      );
    } catch (error) {
      notify((error as Error).message);
      flight.current = false;
    }
  }
  if (done) return <div data-motion={skip ? 'off' : 'on'}>{children}</div>;
  return (
    <div className="packet-stage">
      <button
        className={'sealed-packet' + (tearing ? ' tearing' : '')}
        aria-label="Tear open DeenPath packet"
        disabled={tearing}
        onPointerDown={(event) => {
          start.current = event.clientX;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          if (start.current !== null && Math.abs(event.clientX - start.current) > 60) void tear();
          start.current = null;
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
        onClick={() => void tear()}
      >
        <div className="packet-strip">
          <span>TEAR TO DISCOVER</span>
          <span>→</span>
        </div>
        <div className="packet-body">
          <Sparkles size={28} />
          <strong>DeenPath</strong>
          <Layers size={64} />
          <span>Three stories. A lasting reminder.</span>
          <small>Swipe across or tap to open</small>
        </div>
      </button>
      <button className="secondary" disabled={tearing} onClick={() => void tear(true)}>
        Skip Animation
      </button>
      <p className="muted">All three cards are already saved to your collection.</p>
    </div>
  );
}
