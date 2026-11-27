/**
 * Talking to the game server (server/): REST for accounts and characters,
 * one WebSocket for the live world. In dev Vite proxies /api and /ws to the
 * server, so the httpOnly session cookie works without CORS.
 */
import { PROTOCOL_VERSION, type ClientMessage, type ServerMessage, type WorldInfo } from '../../shared/protocol';

export interface OnlineCharacter {
  id: string;
  name: string;
  color: string;
  /** Cents. */
  money: number;
  level: number;
  x: number;
  z: number;
}

export interface Me {
  account: { id: string; email: string; status: string };
  characters: OnlineCharacter[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Finnish text for the server's error codes (the server sends its own message for most). */
const ERROR_TEXT: Record<string, string> = {
  unauthorized: 'Kirjaudu ensin sisään.',
  invalid: 'Väärä sähköposti tai salasana.',
  taken: 'Sähköposti on jo käytössä.',
  rate_limited: 'Liian monta yritystä, odota hetki.',
  bad_request: 'Tarkista kentät.',
  forbidden_origin: 'Pyyntö estettiin.',
  offline: 'Palvelimeen ei saada yhteyttä.',
};

async function api<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'offline', ERROR_TEXT.offline!);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) {
    // the dev proxy answers 500/502 with no JSON when the server is down
    const code = data.error ?? (res.status >= 500 ? 'offline' : 'error');
    throw new ApiError(res.status, code, data.message ?? ERROR_TEXT[code] ?? `Virhe (${res.status}).`);
  }
  return data as T;
}

export const onlineApi = {
  me: () => api<Me>('/api/me'),
  login: (email: string, password: string) => api<{ ok: true }>('/api/auth/login', { email, password }),
  register: (email: string, password: string, adult: boolean) => api<{ id: string }>('/api/auth/register', { email, password, adult }),
  logout: () => api<{ ok: true }>('/api/auth/logout', {}),
  createCharacter: (name: string, color: string) => api<OnlineCharacter>('/api/characters', { name, color }),
  worlds: () => api<{ worlds: WorldInfo[] }>('/api/worlds'),
  inventory: (characterId: string) =>
    api<{ items: { itemId: string; location: 'pack' | 'home'; quantity: number }[] }>(`/api/characters/${characterId}/inventory`),
};

export type ConnStatus = 'connecting' | 'queued' | 'online' | 'offline' | 'kicked';

type Listener = (msg: ServerMessage) => void;
type StatusListener = (s: ConnStatus, info?: { queue?: number; world?: WorldInfo; reason?: string }) => void;

/** Live connection with reconnect, ping and request ids. */
export class OnlineClient {
  status: ConnStatus = 'connecting';
  private ws?: WebSocket;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private pending = new Map<string, { resolve: () => void; reject: (e: Error) => void; timer: number }>();
  private nextRid = 1;
  private retry = 0;
  private stopped = false;
  private pingTimer?: number;
  private retryTimer?: number;

  constructor(private characterId: string) {
    this.open();
  }

  private open() {
    if (this.stopped) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws?character=${encodeURIComponent(this.characterId)}`);
    this.ws = ws;
    this.setStatus('connecting');
    ws.onmessage = (e) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(e.data)) as ServerMessage;
      } catch {
        return;
      }
      this.handle(msg);
    };
    ws.onclose = () => {
      window.clearInterval(this.pingTimer);
      for (const p of this.pending.values()) p.reject(new Error('Yhteys katkesi.'));
      this.pending.clear();
      if (this.stopped || this.status === 'kicked') return;
      this.setStatus('offline');
      // back off: 1, 2, 4 … 30 s
      const wait = Math.min(30_000, 1000 * 2 ** this.retry++);
      this.retryTimer = window.setTimeout(() => this.open(), wait);
    };
  }

  private handle(msg: ServerMessage) {
    switch (msg.t) {
      case 'welcome':
        this.retry = 0;
        if (msg.protocol !== PROTOCOL_VERSION) {
          this.stopped = true;
          this.setStatus('kicked', { reason: 'Peli on päivittynyt. Lataa sivu uudelleen.' });
          this.ws?.close();
          return;
        }
        this.setStatus('online', { world: msg.world });
        window.clearInterval(this.pingTimer);
        this.pingTimer = window.setInterval(() => this.send({ t: 'ping' }), 10_000);
        break;
      case 'queue':
        this.setStatus('queued', { queue: msg.position, world: msg.world });
        break;
      case 'kicked':
        this.setStatus('kicked', { reason: msg.reason === 'logged_in_elsewhere' ? 'Kirjauduit toisaalla.' : msg.reason === 'banned' ? 'Tili on suljettu.' : 'Yhteys katkaistiin.' });
        break;
      case 'ok': {
        const p = this.pending.get(msg.rid);
        if (p) {
          window.clearTimeout(p.timer);
          this.pending.delete(msg.rid);
          p.resolve();
        }
        break;
      }
      case 'error':
        if (msg.rid) {
          const p = this.pending.get(msg.rid);
          if (p) {
            window.clearTimeout(p.timer);
            this.pending.delete(msg.rid);
            p.reject(new Error(msg.message));
          }
        }
        break;
    }
    for (const l of this.listeners) l(msg);
  }

  private setStatus(s: ConnStatus, info?: Parameters<StatusListener>[1]) {
    this.status = s;
    for (const l of this.statusListeners) l(s, info);
  }

  send(msg: ClientMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  /** Sends a message with a request id and resolves on the server's ok (rejects with its error text). */
  request(msg: Extract<ClientMessage, { rid?: string }>): Promise<void> {
    const rid = String(this.nextRid++);
    return new Promise((resolve, reject) => {
      if (!this.send({ ...msg, rid })) return reject(new Error('Ei yhteyttä palvelimeen.'));
      const timer = window.setTimeout(() => {
        this.pending.delete(rid);
        reject(new Error('Palvelin ei vastannut.'));
      }, 8000);
      this.pending.set(rid, { resolve, reject, timer });
    });
  }

  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  onStatus(l: StatusListener): () => void {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  }

  close() {
    this.stopped = true;
    window.clearInterval(this.pingTimer);
    window.clearTimeout(this.retryTimer);
    this.ws?.close(1000, 'bye');
  }
}

export const euros = (cents: number) => (cents / 100).toLocaleString('fi-FI', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
