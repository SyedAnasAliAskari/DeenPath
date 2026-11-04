import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { db } from './store';
export const tr = (en: string, ur: string, ar: string) =>
  db.state.settings.lang === 'ur' ? ur : db.state.settings.lang === 'ar' ? ar : en;
export type SuiteProps = {
  refresh: () => void;
  notify: (text: string) => void;
  navigate: (page: string) => void;
};
export function Panel({
  title,
  children,
  collapsible = false,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  if (collapsible)
    return (
      <details className="card dp-panel dp-disclosure" open={defaultOpen || undefined}>
        <summary>
          <h2>{title}</h2>
          <ChevronDown size={18} />
        </summary>
        <div className="disclosure-content">{children}</div>
      </details>
    );
  return (
    <section className="card dp-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function Heading({ title, text }: { title: string; text?: string }) {
  return (
    <section className="page-heading">
      <div>
        <p className="eyebrow">DeenPath</p>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
    </section>
  );
}
export const err = (e: unknown) => (e instanceof Error ? e.message : String(e));
export function saveAction(
  fn: () => Promise<unknown>,
  props: Pick<SuiteProps, 'refresh' | 'notify'>,
) {
  void fn()
    .then(() => props.refresh())
    .catch((e) => props.notify(err(e)));
}
