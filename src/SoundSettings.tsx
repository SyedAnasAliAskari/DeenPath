import { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { Native, isNative } from './native';
import { translator } from './i18n';
import type { Settings } from './domain';
export function SoundSettings({
  settings: s,
  change,
  notify,
}: {
  settings: Settings;
  change: (next: Settings) => Promise<unknown>;
  notify: (message: string) => void;
}) {
  const t = translator(s.lang);
  const [choosing, setChoosing] = useState(false);
  const choose = async (category: string) => {
    setChoosing(true);
    try {
      const result = await Native.pickSound({ category });
      if (!result.cancelled)
        await change({
          ...s,
          soundUris: { ...s.soundUris, [category]: result.uri },
          soundNames: { ...s.soundNames, [category]: result.name },
        });
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setChoosing(false);
    }
  };
  return (
    <div className="section-divider">
      <h3 className="subheading">
        <Volume2 size={16} /> {t('sound')}
      </h3>
      <p className="muted">{t('soundHelp')}</p>
      <button
        className="secondary sound-picker"
        disabled={!isNative || choosing}
        onClick={() => void choose('default')}
      >
        <Volume2 size={18} />
        <span>
          {t('notificationSound')}
          <small>{s.soundNames?.default || t('systemSound')}</small>
        </span>
      </button>
      <details className="sound-advanced">
        <summary>{t('stageSounds')}</summary>
        {['gentle', 'warning', 'strict', 'routine'].map((category) => (
          <div className="permission-row" key={category}>
            <span>
              {t(
                category === 'routine'
                  ? 'routines'
                  : category === 'qaza'
                    ? 'qazaDone'
                    : (category as 'gentle'),
              )}
            </span>
            <button
              className="secondary"
              disabled={!isNative || choosing}
              onClick={() => void choose(category)}
            >
              {s.soundNames?.[category] || t('useAppSound')}
            </button>
          </div>
        ))}
      </details>
    </div>
  );
}
