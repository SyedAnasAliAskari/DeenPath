import { useBack } from './back';
import { useEffect, useRef, useState } from 'react';
import { Palette, LockKeyhole, ImagePlus, Sparkles } from 'lucide-react';
import { db } from './store';
import { Native, isNative } from './native';
import { importFile, fileBlob } from './files';
import { Heading, Panel, type SuiteProps } from './deen-ui';
import { Field, Toggle } from './components';
import {
  applyTheme,
  purchaseTheme,
  themePrices,
  readableAccent,
  accentInk,
  type PurchaseKind,
  type CustomTheme,
} from './themes';
export async function buyTheme(
  kind: PurchaseKind,
  payload: Record<string, any>,
  id = crypto.randomUUID(),
) {
  if (isNative) {
    await db.flush();
    await Native.deen({ op: 'purchaseTheme', owner: db.state.owner || '', id, kind, payload });
    await db.reloadNative();
  } else {
    db.state.economy = purchaseTheme(db.state.records, db.state.economy!, id, kind, payload);
    await db.persist();
  }
}
export function ThemeStudio(props: SuiteProps) {
  const [primary, setPrimary] = useState('#136449'),
    [secondary, setSecondary] = useState('#a88336'),
    [wallpaper, setWallpaper] = useState('garden'),
    [seasonal, setSeasonal] = useState('ramadan'),
    [effects, setEffects] = useState(['stars']),
    [image, setImage] = useState(''),
    [selectedFile, setSelectedFile] = useState<File | null>(null),
    [selectedUrl, setSelectedUrl] = useState(''),
    [preview, setPreview] = useState<CustomTheme | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!selectedFile) {
      setSelectedUrl('');
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setSelectedUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);
  const purchaseFlight = useRef(false);
  const dialogRef = useRef<HTMLElement | null>(null),
    [previewImage, setPreviewImage] = useState('');
  useBack(() => {
    if (preview) {
      setPreview(null);
      return true;
    }
    return false;
  });
  useEffect(() => {
    if (!preview) return;
    const before = document.activeElement as HTMLElement;
    dialogRef.current?.querySelector('button')?.focus();
    return () => before?.focus();
  }, [preview]);
  useEffect(() => {
    let alive = true,
      url = '';
    setPreviewImage('');
    const file = db.state.localFiles?.find((f) => f.id === preview?.wallpaper?.fileId);
    if (file)
      void fileBlob(file)
        .then((blob) => {
          url = URL.createObjectURL(blob);
          if (alive) setPreviewImage(url);
          else URL.revokeObjectURL(url);
        })
        .catch(() => {
          if (alive) setPreviewImage('');
        });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [preview?.wallpaper?.fileId]);
  const currentPreviewImage =
    selectedFile && preview?.wallpaper?.fileId === image ? selectedUrl : previewImage;
  const prices = { ...themePrices, ...db.state.economy?.prices } as typeof themePrices;
  const balance = db.state.economy?.balance || 0,
    unlocked = !!db.state.economy?.studioUnlocked;
  async function apply(kind: PurchaseKind, payload: Record<string, any>) {
    if (purchaseFlight.current) return;
    purchaseFlight.current = true;
    setBusy(true);
    try {
      if (kind === 'wallpaper' && selectedFile && image === 'pending-upload') {
        const file = await importFile(selectedFile);
        setImage(file.id);
        payload = { fileId: file.id };
      }
      await buyTheme(kind, payload);
      props.refresh();
      props.notify(
        kind === 'unlock'
          ? 'Theme Studio unlocked'
          : kind === 'default'
            ? 'Default theme restored'
            : `Applied · ${prices[kind]} Gems`,
      );
      setPreview(null);
    } catch (e) {
      props.notify((e as Error).message);
    } finally {
      purchaseFlight.current = false;
      setBusy(false);
    }
  }
  const controls = (kind: PurchaseKind, payload: Record<string, any>) => (
    <div className="actions">
      <button
        className="secondary"
        disabled={busy}
        onClick={() => setPreview(applyTheme(db.state.economy?.theme || {}, kind, payload))}
      >
        Preview
      </button>
      <button
        className="primary"
        disabled={busy || balance < prices[kind]}
        onClick={() => void apply(kind, payload)}
      >
        Apply · {prices[kind]} Gems
      </button>
    </div>
  );
  return (
    <div className="theme-studio">
      <Heading title="Theme Studio" text="Make room for your own style." />
      <Panel title="Your space">
        <p>
          <Palette size={20} /> {balance.toLocaleString()} Gems
        </p>
        <p>
          Gems are in-app rewards. Applying a paid customization costs Gems each time, even when you
          used it before.
        </p>
        <div className="actions">
          {['light', 'dark'].map((mode) => (
            <button
              key={mode}
              className="secondary"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  await apply('default', {});
                  await db.configure({
                    ...db.state.settings,
                    appearance: mode as 'light' | 'dark',
                  });
                  props.refresh();
                })()
              }
            >
              Default {mode} · Free
            </button>
          ))}
        </div>
        <Toggle
          label="Enable theme animations"
          value={db.state.settings.themeAnimations !== false}
          onChange={(v) =>
            void db.configure({ ...db.state.settings, themeAnimations: v }).then(props.refresh)
          }
        />
        <p className="muted">
          Motion pauses when the app is hidden and respects your device’s reduced-motion preference.
        </p>
      </Panel>
      {!unlocked ? (
        <Panel title="Unlock Theme Studio">
          <LockKeyhole />
          <p>Custom colors, wallpapers, seasonal backgrounds and an animation mixer.</p>
          <button
            className="primary"
            disabled={busy || balance < prices.unlock}
            onClick={() => void apply('unlock', {})}
          >
            Unlock · {prices.unlock.toLocaleString()} Gems
          </button>
        </Panel>
      ) : (
        <>
          <Panel title="Colors">
            <div className="theme-color-fields">
              <Field label="Primary color">
                <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
              </Field>
              <Field label="Secondary color">
                <input
                  type="color"
                  value={secondary}
                  onChange={(e) => setSecondary(e.target.value)}
                />
              </Field>
            </div>
            <p className="muted">
              Accent shades adapt to keep text readable in light and dark mode.
            </p>
            {controls('colors', { primary, secondary })}
          </Panel>
          <Panel title="Wallpapers">
            <Field label="Built-in wallpaper">
              <select
                value={wallpaper}
                onChange={(e) => {
                  setWallpaper(e.target.value);
                  setImage('');
                  setSelectedFile(null);
                }}
              >
                <option value="garden">Garden</option>
                <option value="sand">Desert sand</option>
                <option value="night">Night sky</option>
              </select>
            </Field>
            <label className="theme-upload">
              <ImagePlus size={20} />
              <span>
                {selectedFile ? 'Replace image' : 'Choose your image'}
                <small>PNG, JPEG or WebP · up to 8 MiB</small>
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (
                      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
                      file.size > 8 * 1024 * 1024
                    ) {
                      props.notify('Choose a PNG, JPEG or WebP image up to 8 MiB.');
                      e.target.value = '';
                      return;
                    }
                    setSelectedFile(file);
                    setImage('pending-upload');
                  }
                  e.target.value = '';
                }}
              />
            </label>
            {selectedFile && (
              <div className="selected-wallpaper">
                <img src={selectedUrl} alt="Selected wallpaper preview" />
                <div>
                  <strong>{selectedFile.name}</strong>
                  <small>
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MiB · Preview before applying
                  </small>
                  <button
                    className="secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setSelectedFile(null);
                      setImage('');
                    }}
                  >
                    Remove selection
                  </button>
                </div>
              </div>
            )}
            {controls('wallpaper', image ? { fileId: image } : { wallpaper })}
          </Panel>
          <Panel title="Seasonal themes">
            <Field label="Season">
              <select value={seasonal} onChange={(e) => setSeasonal(e.target.value)}>
                <option value="ramadan">Ramadan lanterns</option>
                <option value="eid">Eid garden</option>
              </select>
            </Field>
            {controls('seasonal', { seasonal })}
          </Panel>
          <Panel title="Animation mixer">
            <Sparkles />
            <p>Combine effects with your current wallpaper.</p>
            <div className="theme-effects">
              {['stars', 'lanterns', 'clouds', 'geometry'].map((effect) => (
                <label key={effect}>
                  <input
                    type="checkbox"
                    checked={effects.includes(effect)}
                    onChange={(e) =>
                      setEffects(
                        e.target.checked
                          ? [...effects, effect]
                          : effects.filter((x) => x !== effect),
                      )
                    }
                  />
                  {effect}
                </label>
              ))}
            </div>
            {effects.length ? (
              controls('animated', { effects })
            ) : (
              <p>Select an effect to preview.</p>
            )}
          </Panel>
        </>
      )}
      {preview && (
        <section
          className="theme-preview card"
          ref={dialogRef}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setPreview(null);
            }
            if (event.key === 'Tab') {
              const items = dialogRef.current?.querySelectorAll<HTMLElement>(
                'button,[href],input,select',
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
          role="dialog"
          aria-modal="true"
          aria-label="Theme preview"
        >
          <h2>Theme preview</h2>
          <div
            className={'theme-sample wallpaper-' + (preview.wallpaper?.wallpaper || 'garden')}
            style={{
              borderColor: preview.secondary,
              ...(currentPreviewImage
                ? {
                    backgroundImage: `url("${currentPreviewImage}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : {}),
            }}
          >
            <div className="card">
              <h3>Your daily space</h3>
              <p>Readable colors, a familiar path.</p>
              <button
                style={{
                  background: readableAccent(preview.primary || '#136449', false),
                  color: accentInk(readableAccent(preview.primary || '#136449', false)),
                }}
              >
                Continue
              </button>
            </div>
            {preview.effects?.length ? <small>{preview.effects.join(' + ')}</small> : null}
          </div>
          <p>This preview does not spend Gems.</p>
          <button className="secondary" onClick={() => setPreview(null)}>
            Close preview
          </button>
        </section>
      )}
    </div>
  );
}
export function ThemeBackdrop() {
  const theme = db.state.economy?.theme,
    [url, setUrl] = useState(''),
    [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    let alive = true,
      objectUrl = '';
    const fileId = theme?.wallpaper?.fileId;
    const file = fileId
      ? db.state.localFiles?.find((f) => f.id === fileId || f.cloudId === fileId)
      : undefined;
    setUrl('');
    if (file)
      void fileBlob(file)
        .then((blob) => {
          objectUrl = URL.createObjectURL(blob);
          if (alive) setUrl(objectUrl);
          else URL.revokeObjectURL(objectUrl);
        })
        .catch(() => {});
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [theme?.wallpaper?.fileId]);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const effects =
    db.state.settings.themeAnimations !== false && visible ? theme?.effects || [] : [];
  return (
    <div
      aria-hidden="true"
      className={'theme-backdrop wallpaper-' + (theme?.wallpaper?.wallpaper || 'none')}
      style={url ? { backgroundImage: `url("${url}")` } : undefined}
    >
      {effects.flatMap((effect) =>
        Array.from({ length: effect === 'clouds' ? 3 : 8 }, (_, i) => (
          <i
            key={effect + i}
            className={'theme-particle effect-' + effect}
            style={{
              left: ((i * 29 + 7) % 96) + '%',
              top: ((i * 19 + 5) % 95) + '%',
              animationDelay: -i * 3 + 's',
            }}
          />
        )),
      )}
    </div>
  );
}
