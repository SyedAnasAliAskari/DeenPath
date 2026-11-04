import { useLayoutEffect, useRef, useState } from 'react';

const backStack: Array<(event: Event) => void> = [];
// Only the topmost nested screen consumes Back; parent screens retain their place.
export function useBack(close: () => boolean) {
  const latest = useRef(close);
  useLayoutEffect(() => {
    latest.current = close;
  });
  useLayoutEffect(() => {
    const handler = (event: Event) => {
      if (backStack.at(-1) === handler && !event.defaultPrevented && latest.current())
        event.preventDefault();
    };
    backStack.push(handler);
    window.addEventListener('deenpath:back', handler, true);
    return () => {
      const index = backStack.indexOf(handler);
      if (index >= 0) backStack.splice(index, 1);
      window.removeEventListener('deenpath:back', handler, true);
    };
  }, []);
}

// Keep subview history in the owning screen, including while a child destination is open.
export function useViewTrail(initial: string) {
  const [view, setView] = useState(initial);
  const trail = useRef([initial]);
  const navigate = (next: string) => {
    if (trail.current.at(-1) !== next) trail.current.push(next);
    setView(next);
  };
  const previous = () => {
    if (trail.current.length <= 1) return false;
    trail.current.pop();
    setView(trail.current.at(-1)!);
    return true;
  };
  return [view, navigate, previous, trail.current.length > 1] as const;
}
