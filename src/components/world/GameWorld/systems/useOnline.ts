import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type * as THREE from 'three';
import type { AnimState, PlayerLook, PublicPlayer, ServerMessage, TradeOffer, TradeStage, TradeView } from '../../../../../shared/protocol';
import { DEFAULT_SCENE } from '../../../../../shared/protocol';
import { getItem } from '../../../../../shared/items';
import { onlineApi, OnlineClient, type ConnStatus, type OnlineCharacter } from '../../../../services/online';

/** Another player as this client shows them: the latest server position and the smoothed one on screen. */
export interface Remote {
  id: string;
  name: string;
  color: string;
  level: number;
  look?: PlayerLook;
  scene: string;
  /** Latest position from the server. */
  x: number;
  z: number;
  anim?: AnimState;
  /** Shown position (eased towards x, z each frame) and facing. */
  rx: number;
  rz: number;
  yaw: number;
  bubble?: { text: string; until: number };
}

export interface ChatLine {
  key: number;
  from: string;
  name: string;
  text: string;
  mine: boolean;
}

export interface Wallet {
  money: number;
  items: { itemId: string; quantity: number }[];
}

const SEND_MS = 100;
/** Faster than this between two sends is a jump (door, bus, train): sent as a warp. */
const JUMP_SPEED = 9;
const WARP_GAP_MS = 1600;
const BUBBLE_MS = 8000;
const CHAT_KEEP = 40;

const REASONS: Record<string, string> = {
  cancelled: 'Kauppa peruttiin.',
  declined: 'Kauppapyyntö hylättiin.',
  timeout: 'Kauppa aikakatkaistiin.',
  too_far: 'Kauppa peruttiin: olette liian kaukana toisistanne.',
  disconnected: 'Toinen pelaaja poistui.',
  items_changed: 'Kauppa peruttiin: tavarat muuttuivat.',
  not_allowed: 'Kauppa ei ole sallittu.',
  server_shutdown: 'Palvelin käynnistyy uudelleen.',
};

export const itemLabel = (id: string) => getItem(id)?.name ?? id;

/**
 * The shared world: connects when you have an online character, sends your
 * position ~10×/s, keeps the other players for the renderer, and runs chat
 * and face-to-face trading. The single-player game keeps working without it.
 */
export function useOnline(opts: {
  character: OnlineCharacter | null;
  enabled: boolean;
  positionRef: MutableRefObject<THREE.Vector3>;
  scene: string;
  look: PlayerLook | null;
  setToast: (t: string | null) => void;
}) {
  const { character, enabled, positionRef } = opts;
  const clientRef = useRef<OnlineClient | null>(null);
  const live = useRef(new Map<string, Remote>());
  const [roster, setRoster] = useState<string[]>([]);
  const [status, setStatus] = useState<ConnStatus | null>(null);
  const [queue, setQueue] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [trade, setTrade] = useState<TradeView | null>(null);
  const [incoming, setIncoming] = useState<{ tradeId: string; name: string } | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  /** Bumps when one of your Pörssi orders fills, so an open Pörssi window reloads. */
  const [marketTick, setMarketTick] = useState(0);
  const sceneRef = useRef(opts.scene);
  sceneRef.current = opts.scene;
  const lookRef = useRef(opts.look);
  lookRef.current = opts.look;
  const toastRef = useRef(opts.setToast);
  toastRef.current = opts.setToast;
  const chatKey = useRef(0);
  const lastSent = useRef<{ x: number; z: number; scene: string; at: number; anim: AnimState; warpAt?: number } | null>(null);
  const myBubble = useRef<{ text: string; until: number } | null>(null);

  const refreshWallet = useCallback(async () => {
    if (!character) return;
    try {
      const [me, inv] = await Promise.all([onlineApi.me(), onlineApi.inventory(character.id)]);
      const c = me.characters.find((x) => x.id === character.id);
      setWallet({ money: c?.money ?? 0, items: inv.items.filter((i) => i.location === 'pack').map(({ itemId, quantity }) => ({ itemId, quantity })) });
    } catch {
      // keep the old one
    }
  }, [character]);

  useEffect(() => {
    if (!character || !enabled) return;
    const client = new OnlineClient(character.id);
    clientRef.current = client;
    const map = live.current;
    const bump = () => setRoster([...map.keys()]);
    const upsert = (p: PublicPlayer) => {
      const old = map.get(p.id);
      map.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color,
        level: p.level,
        look: p.look ?? old?.look,
        scene: p.scene ?? DEFAULT_SCENE,
        x: p.x,
        z: p.z,
        anim: p.anim,
        rx: old?.rx ?? p.x,
        rz: old?.rz ?? p.z,
        yaw: old?.yaw ?? 0,
        bubble: old?.bubble,
      });
    };
    const offStatus = client.onStatus((s, info) => {
      setStatus(s);
      setQueue(s === 'queued' ? (info?.queue ?? null) : null);
      if (s === 'kicked') setNote(info?.reason ?? 'Yhteys katkaistiin.');
      if (s !== 'online') {
        map.clear();
        bump();
        setTrade(null);
        setIncoming(null);
      }
    });
    const off = client.on((msg: ServerMessage) => {
      switch (msg.t) {
        case 'welcome':
          if (lookRef.current) client.send({ t: 'look', look: lookRef.current });
          lastSent.current = null;
          void refreshWallet();
          return;
        case 'snapshot':
          map.clear();
          msg.players.forEach(upsert);
          return bump();
        case 'player.join':
          upsert(msg.player);
          return bump();
        case 'player.leave':
          map.delete(msg.id);
          return bump();
        case 'player.move': {
          let changed = false;
          for (const m of msg.moves) {
            const r = map.get(m.id);
            if (!r) continue;
            const sceneChanged = m.scene !== undefined && m.scene !== r.scene;
            r.x = m.x;
            r.z = m.z;
            r.anim = m.anim;
            if (m.scene !== undefined) r.scene = m.scene;
            if (sceneChanged) {
              r.rx = m.x;
              r.rz = m.z;
              changed = true;
            }
          }
          if (changed) bump();
          return;
        }
        case 'player.look': {
          const r = map.get(msg.id);
          if (r) {
            r.look = msg.look;
            bump();
          }
          return;
        }
        case 'correction': {
          // the server didn't accept a move: go back to where it has you
          const p = positionRef.current;
          if (Math.hypot(p.x - msg.x, p.z - msg.z) > 2) p.set(msg.x, p.y, msg.z);
          lastSent.current = { x: msg.x, z: msg.z, scene: sceneRef.current, at: performance.now(), anim: 'idle' };
          return;
        }
        case 'chat': {
          const mine = msg.from === character.id;
          setChat((c) => [...c.slice(-(CHAT_KEEP - 1)), { key: chatKey.current++, from: msg.from, name: msg.name, text: msg.text, mine }]);
          const r = map.get(msg.from);
          if (r) r.bubble = { text: msg.text, until: performance.now() + BUBBLE_MS };
          else if (mine) myBubble.current = { text: msg.text, until: performance.now() + BUBBLE_MS };
          return;
        }
        case 'trade.requested':
          return setIncoming({ tradeId: msg.tradeId, name: msg.name });
        case 'trade.update':
          setIncoming(null);
          return setTrade(msg.trade);
        case 'trade.completed': {
          setTrade(null);
          const got = [msg.received.money ? `${(msg.received.money / 100).toLocaleString('fi-FI')} €` : '', ...msg.received.items.map((i) => `${itemLabel(i.itemId)} ×${i.quantity}`)].filter(Boolean);
          toastRef.current(`🤝 Kauppa tehty!${got.length ? ` Sait: ${got.join(', ')}` : ''}`);
          void refreshWallet();
          return;
        }
        case 'trade.cancelled':
          setTrade(null);
          setIncoming((i) => (i?.tradeId === msg.tradeId ? null : i));
          toastRef.current(REASONS[msg.reason] ?? 'Kauppa peruttiin.');
          return;
        case 'market.filled':
          toastRef.current(`📈 Pörssi: ${msg.side === 'buy' ? 'ostit' : 'myit'} ${itemLabel(msg.itemId)} ×${msg.quantity} (${(msg.price / 100).toLocaleString('fi-FI')} €/kpl). Nouda torilta.`);
          setMarketTick((n) => n + 1);
          return;
        case 'server.shutdown':
          toastRef.current(`⚠️ Palvelin käynnistyy uudelleen ${msg.inSeconds} s päästä.`);
          return;
        case 'error':
          if (!msg.rid && msg.code !== 'rate_limited') toastRef.current(msg.message);
          return;
      }
    });

    // position out ~10×/s, only when something changed
    const tick = window.setInterval(() => {
      if (client.status !== 'online') return;
      const p = positionRef.current;
      const now = performance.now();
      const scene = sceneRef.current;
      const last = lastSent.current;
      const x = Math.round(p.x * 100) / 100, z = Math.round(p.z * 100) / 100;
      if (!last) {
        client.send({ t: 'warp', x, z, scene });
        lastSent.current = { x, z, scene, at: now, anim: 'idle', warpAt: now };
        return;
      }
      const d = Math.hypot(x - last.x, z - last.z);
      const dt = (now - last.at) / 1000;
      if (scene !== last.scene || d > JUMP_SPEED * Math.max(dt, 0.1) + 0.5) {
        // a jump: one warp, and wait out the server's cooldown before the next
        if (last.warpAt !== undefined && now - last.warpAt < WARP_GAP_MS) return;
        client.send({ t: 'warp', x, z, scene });
        lastSent.current = { x, z, scene, at: now, anim: 'idle', warpAt: now };
        return;
      }
      const anim: AnimState = d > 0.02 ? 'walk' : 'idle';
      if (d < 0.02 && anim === last.anim) return;
      client.send({ t: 'move', x, z, anim });
      lastSent.current = { ...last, x, z, at: now, anim };
    }, SEND_MS);

    return () => {
      window.clearInterval(tick);
      off();
      offStatus();
      client.close();
      clientRef.current = null;
      map.clear();
      setRoster([]);
      setStatus(null);
    };
  }, [character?.id, enabled]);


  // a new look (barber, gym) goes out at once
  const lookKey = JSON.stringify(opts.look);
  useEffect(() => {
    if (opts.look && clientRef.current?.status === 'online') clientRef.current.send({ t: 'look', look: opts.look });
  }, [lookKey]);

  const fail = (e: unknown) => toastRef.current(e instanceof Error ? e.message : 'Virhe.');
  const api = {
    sendChat: (text: string) => {
      const t = text.trim().slice(0, 200);
      if (t) clientRef.current?.send({ t: 'chat', text: t });
    },
    requestTrade: (targetId: string) => {
      const c = clientRef.current;
      if (!c) return;
      c.request({ t: 'trade.request', targetId }).then(() => toastRef.current('🤝 Kauppapyyntö lähetetty.'), fail);
    },
    respond: (accept: boolean) => {
      const i = incoming;
      if (!i) return;
      setIncoming(null);
      clientRef.current?.request({ t: 'trade.respond', tradeId: i.tradeId, accept }).catch(fail);
    },
    offer: (offer: TradeOffer) => {
      if (trade) clientRef.current?.request({ t: 'trade.offer', tradeId: trade.tradeId, offer }).catch(fail);
    },
    accept: (stage: TradeStage) => {
      if (trade) clientRef.current?.request({ t: 'trade.accept', tradeId: trade.tradeId, stage }).catch(fail);
    },
    cancel: () => {
      if (trade) clientRef.current?.request({ t: 'trade.cancel', tradeId: trade.tradeId }).catch(() => setTrade(null));
    },
  };

  return { status, queue, note, live, roster, chat, trade, incoming, wallet, myBubble, refreshWallet, marketTick, character, ...api };
}

export type OnlineApi = ReturnType<typeof useOnline>;
