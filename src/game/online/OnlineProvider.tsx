import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, onlineApi, type Me, type OnlineCharacter } from '../../services/online';

/**
 * Online account state for the whole app. The single-player save stays as it
 * is; when you are logged in with a character, the game also joins the
 * shared world (other players, chat, trading).
 */
export interface OnlineState {
  /** 'unknown' until the first check; 'down' when the server can't be reached. */
  server: 'unknown' | 'up' | 'down';
  me: Me | null;
  character: OnlineCharacter | null;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, adult: boolean) => Promise<void>;
  createCharacter: (name: string, color: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<OnlineState | null>(null);

export function OnlineProvider({ children }: { children: ReactNode }) {
  const [server, setServer] = useState<OnlineState['server']>('unknown');
  const [me, setMe] = useState<Me | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMe(await onlineApi.me());
      setServer('up');
    } catch (e) {
      setMe(null);
      setServer(e instanceof ApiError && e.code !== 'offline' ? 'up' : 'down');
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<OnlineState>(
    () => ({
      server,
      me,
      character: me?.characters[0] ?? null,
      refresh,
      login: async (email, password) => {
        await onlineApi.login(email, password);
        await refresh();
      },
      register: async (email, password, adult) => {
        await onlineApi.register(email, password, adult);
        await onlineApi.login(email, password);
        await refresh();
      },
      createCharacter: async (name, color) => {
        await onlineApi.createCharacter(name, color);
        await refresh();
      },
      logout: async () => {
        await onlineApi.logout().catch(() => {});
        setMe(null);
      },
    }),
    [server, me, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnlineAccount(): OnlineState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOnlineAccount outside OnlineProvider');
  return v;
}
