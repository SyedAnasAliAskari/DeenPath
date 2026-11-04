import { useState } from 'react';
import { chooseReminderPassage, passageBody } from './content';
import type { Settings } from './domain';
let sequence = 0;
export function ReminderPassage({ settings }: { settings: Settings }) {
  const [entry] = useState(() =>
    chooseReminderPassage(settings.reminderTheme || 'balanced', sequence++),
  );
  return (
    <section className="reminder-passage">
      <p className="preserve-lines" dir="auto">
        {passageBody(entry, settings)}
      </p>
      <a href={entry.source} target="_blank" rel="noreferrer">
        {entry.ref}
      </a>
    </section>
  );
}
