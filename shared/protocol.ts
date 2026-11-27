/**
 * WebSocket protocol between the browser and the game server.
 * Plain types only (no runtime deps) so the client can import them as-is.
 * The server validates every incoming message with zod schemas that are
 * type-checked against these (server/src/ws/schemas.ts).
 * See docs/MULTIPLAYER.md, section 5.
 */

export const PROTOCOL_VERSION = 1;

/** World position on the ground plane in metres, origin at Kerava station (+x east, +z south). */
export interface Vec2 {
  x: number;
  z: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  level: number;
  x: number;
  z: number;
  /** Walk target, lets other clients animate towards it. */
  tx?: number;
  tz?: number;
  anim?: AnimState;
}

export type AnimState = 'idle' | 'walk' | 'run' | 'fish' | 'train' | 'cook';

export interface TradeItem {
  itemId: string;
  quantity: number;
}

export interface TradeOffer {
  items: TradeItem[];
  /** Cents. */
  money: number;
}

export type TradeStage = 'offer' | 'confirm';

export interface TradeView {
  tradeId: string;
  stage: TradeStage;
  /** The two parties; `you` is always the receiving client. */
  you: { id: string; offer: TradeOffer; accepted: boolean };
  them: { id: string; name: string; offer: TradeOffer; accepted: boolean };
  /** ms timestamp when confirm becomes possible (stage 'confirm'). */
  confirmableAt?: number;
  /** Item ids changed in the last offer edit, for the red flash. */
  changed?: string[];
}

export type TradeCancelReason =
  | 'cancelled'
  | 'declined'
  | 'timeout'
  | 'too_far'
  | 'disconnected'
  | 'items_changed'
  | 'not_allowed'
  | 'server_shutdown';

export interface WorldInfo {
  name: string;
  online: number;
  capacity: number;
  queued: number;
}

// ── client → server ────────────────────────────────────────────────

export type ClientMessage =
  | { t: 'ping' }
  | { t: 'move'; x: number; z: number; tx?: number; tz?: number; anim?: AnimState }
  | { t: 'chat'; text: string }
  | { t: 'trade.request'; targetId: string; rid?: string }
  | { t: 'trade.respond'; tradeId: string; accept: boolean; rid?: string }
  | { t: 'trade.offer'; tradeId: string; offer: TradeOffer; rid?: string }
  | { t: 'trade.accept'; tradeId: string; stage: TradeStage; rid?: string }
  | { t: 'trade.cancel'; tradeId: string; rid?: string };

// ── server → client ────────────────────────────────────────────────

export type ErrorCode =
  | 'bad_message'
  | 'rate_limited'
  | 'not_found'
  | 'not_allowed'
  | 'invalid_offer'
  | 'insufficient'
  | 'busy'
  | 'too_far'
  | 'internal';

export type ServerMessage =
  | { t: 'welcome'; protocol: number; you: PublicPlayer; tickRate: number; world: WorldInfo }
  /** World is full: you are waiting in line. Sent again whenever your position changes. */
  | { t: 'queue'; position: number; world: WorldInfo }
  | { t: 'pong'; now: number }
  | { t: 'snapshot'; players: PublicPlayer[] }
  | { t: 'player.join'; player: PublicPlayer }
  | { t: 'player.leave'; id: string }
  | { t: 'player.move'; moves: { id: string; x: number; z: number; tx?: number; tz?: number; anim?: AnimState }[] }
  | { t: 'correction'; x: number; z: number }
  | { t: 'chat'; from: string; name: string; text: string }
  | { t: 'trade.requested'; tradeId: string; fromId: string; name: string }
  | { t: 'trade.update'; trade: TradeView }
  | { t: 'trade.completed'; tradeId: string; received: TradeOffer; gave: TradeOffer }
  | { t: 'trade.cancelled'; tradeId: string; reason: TradeCancelReason }
  | { t: 'kicked'; reason: 'logged_in_elsewhere' | 'protocol_abuse' | 'banned' }
  | { t: 'server.shutdown'; inSeconds: number }
  | { t: 'ok'; rid: string }
  | { t: 'error'; code: ErrorCode; message: string; rid?: string };
