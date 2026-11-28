import { useEffect, useState, type FormEvent } from 'react';
import { useOnlineAccount } from '../game/online/OnlineProvider';
import { euros, onlineApi } from '../services/online';
import type { WorldInfo } from '../../shared/protocol';

/**
 * Login / sign-up for the shared world, on the start screen. Once logged in
 * and with an online character, "Pelaa" also joins the world with others.
 */
export function OnlineLogin({ localName, localColor }: { localName?: string; localColor?: string }) {
  const online = useOnlineAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState(localName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [world, setWorld] = useState<WorldInfo | null>(null);

  useEffect(() => {
    if (online.server !== 'up') return;
    let live = true;
    const load = () => onlineApi.worlds().then((r) => live && setWorld(r.worlds[0] ?? null)).catch(() => {});
    void load();
    const id = window.setInterval(load, 15_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [online.server]);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Virhe.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'register' && !adult) return setError('Peli on K18: vahvista että olet täysi-ikäinen.');
    void run(() => (mode === 'login' ? online.login(email.trim(), password) : online.register(email.trim(), password, adult)));
  };

  const worldLine = world && (
    <div className="menu__world">
      🌍 {world.name}: {world.online}/{world.capacity} pelaajaa{world.queued ? ` · jonossa ${world.queued}` : ''}
    </div>
  );

  if (online.server === 'unknown') return <div className="menu__login menu__muted">Yhdistetään palvelimeen…</div>;
  if (online.server === 'down')
    return (
      <div className="menu__login">
        <div className="menu__muted">Verkkopeli ei ole nyt saatavilla. Yksinpeli toimii normaalisti.</div>
        <button type="button" className="menu__btn" onClick={() => void online.refresh()}>Yritä uudelleen</button>
      </div>
    );

  if (online.me) {
    const c = online.character;
    return (
      <div className="menu__login">
        {c ? (
          <div className="menu__online">
            <span className="menu__dot" /> Verkossa: <b>{c.name}</b> · lompakko {euros(c.money)} €
          </div>
        ) : (
          <form
            className="menu__login-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => online.createCharacter(name.trim(), localColor ?? '#ffd23f'));
            }}
          >
            <div className="menu__muted">Valitse nimi, jolla muut näkevät sinut.</div>
            <input className="menu__input" placeholder="Hahmon nimi (3–12 merkkiä)" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="menu__btn" disabled={busy || name.trim().length < 3}>Luo verkkohahmo</button>
          </form>
        )}
        {worldLine}
        {error && <div className="menu__error">{error}</div>}
        <button type="button" className="menu__btn menu__btn--small" onClick={() => void online.logout()}>Kirjaudu ulos</button>
      </div>
    );
  }

  return (
    <form className="menu__login" onSubmit={submit}>
      <input className="menu__input" placeholder="Sähköposti" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        className="menu__input"
        placeholder={mode === 'register' ? 'Salasana (väh. 10 merkkiä)' : 'Salasana'}
        type="password"
        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {mode === 'register' && (
        <label className="menu__check">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} /> Olen täysi-ikäinen (18+)
        </label>
      )}
      <button type="submit" className="menu__btn" disabled={busy || !email || !password}>
        {mode === 'login' ? 'Kirjaudu verkkopeliin' : 'Luo tili'}
      </button>
      <button type="button" className="menu__link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
        {mode === 'login' ? 'Ei tiliä? Luo uusi' : 'Onko jo tili? Kirjaudu'}
      </button>
      {worldLine}
      {error && <div className="menu__error">{error}</div>}
    </form>
  );
}
