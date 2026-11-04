import type { Economy } from './economy';
export function earnedForSources(
  before: Economy | undefined,
  after: Economy | undefined,
  prefix: string,
): number {
  if (!after || !prefix) return 0;
  return Object.entries(after.claims)
    .filter(([key]) => key === prefix || key.startsWith(prefix + ':'))
    .reduce((sum, [key, claim]) => {
      const prior = before?.claims[key],
        old = prior?.active ? prior.amount : 0;
      return sum + Math.max(0, (claim.active ? claim.amount : 0) - old);
    }, 0);
}
let sequence = 0;
export const completionSequence = () => sequence;
export function completionFeedback(label: string, gems: number) {
  if (gems <= 0) return;
  sequence++;
  // Completion callers may show a generic Saved message; deliver the receipt after that turn.
  setTimeout(
    () =>
      window.dispatchEvent(
        new CustomEvent('deenpath:completion', { detail: `${label} Completed ✓ +${gems} Gems` }),
      ),
    0,
  );
}
