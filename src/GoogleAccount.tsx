import { useEffect, useRef, useState } from 'react';
import { api, db, saveToken } from './store';
import { Native, isNative } from './native';
export function GoogleAccount({
  link = false,
  done,
  notify,
}: {
  link?: boolean;
  done: () => void;
  notify: (text: string) => void;
}) {
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    flight = useRef(false);
  useEffect(() => {
    let live = true;
    if (isNative)
      void api('google/config')
        .then((config) => {
          if (live) setEnabled(config.enabled === true);
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  async function signIn() {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    try {
      const challenge = await api('auth/google/challenge', {});
      const identity = await Native.deen({
        op: 'googleSignIn',
        clientId: challenge.clientId,
        nonce: challenge.nonce,
      });
      const result = await api(link ? 'auth/google/link' : 'auth/google', {
        idToken: identity.idToken,
        nonce: challenge.nonce,
      });
      if (!link) {
        if (db.state.owner && db.state.owner !== result.user.id)
          throw Error(
            'This installation contains another account. Export pending progress before switching accounts.',
          );
        db.state.owner = result.user.id;
        db.state.profile = result.user;
        await saveToken(result.token);
        await db.persist();
      }
      notify(link ? 'Google account linked' : 'Signed in. Your local progress is kept.');
      done();
    } catch (error) {
      notify((error as Error).message);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  if (!enabled) return null;
  return (
    <div className="google-account">
      <button className="secondary" type="button" disabled={busy} onClick={() => void signIn()}>
        {busy ? 'Please wait…' : link ? 'Link Google account' : 'Continue with Google'}
      </button>
      <p className="muted">Optional. Your Guidance AI connection is managed separately.</p>
    </div>
  );
}
