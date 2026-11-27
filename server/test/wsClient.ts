import type WebSocket from 'ws';
import type { ClientMessage, ServerMessage } from '../../shared/protocol';

export class Client {
  inbox: ServerMessage[] = [];
  private waiters: { pred: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
  constructor(public ws: WebSocket) {
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString()) as ServerMessage;
      const w = this.waiters.find((w) => w.pred(m));
      if (w) {
        this.waiters.splice(this.waiters.indexOf(w), 1);
        w.resolve(m);
      } else this.inbox.push(m);
    });
  }
  send(m: ClientMessage | Record<string, unknown>) {
    this.ws.send(JSON.stringify(m));
  }
  next<T extends ServerMessage['t']>(t: T, pred: (m: Extract<ServerMessage, { t: T }>) => boolean = () => true, ms = 3000): Promise<Extract<ServerMessage, { t: T }>> {
    const p = (m: ServerMessage) => m.t === t && pred(m as Extract<ServerMessage, { t: T }>);
    const i = this.inbox.findIndex(p);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0] as Extract<ServerMessage, { t: T }>);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${t}`)), ms);
      this.waiters.push({ pred: p, resolve: (m) => (clearTimeout(timer), resolve(m as Extract<ServerMessage, { t: T }>)) });
    });
  }
  close() {
    this.ws.close();
  }
}
