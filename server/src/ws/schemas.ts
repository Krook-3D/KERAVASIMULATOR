import { z } from 'zod';
import type { ClientMessage } from '../../../shared/protocol';

const coord = z.number().finite().min(-100_000).max(100_000);
const id = z.string().uuid();
const rid = z.string().max(64).optional();
const anim = z.enum(['idle', 'walk', 'run', 'fish', 'train', 'cook']).optional();
const stage = z.enum(['offer', 'confirm']);

const offer = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1).max(64),
        quantity: z.number().int().positive().max(1_000_000_000),
      }),
    )
    .max(28),
  money: z.number().int().min(0).max(2_147_483_647),
});

export const clientMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('ping') }),
  z.object({ t: z.literal('move'), x: coord, z: coord, tx: coord.optional(), tz: coord.optional(), anim }),
  z.object({ t: z.literal('chat'), text: z.string().min(1).max(200) }),
  z.object({ t: z.literal('trade.request'), targetId: id, rid }),
  z.object({ t: z.literal('trade.respond'), tradeId: id, accept: z.boolean(), rid }),
  z.object({ t: z.literal('trade.offer'), tradeId: id, offer, rid }),
  z.object({ t: z.literal('trade.accept'), tradeId: id, stage, rid }),
  z.object({ t: z.literal('trade.cancel'), tradeId: id, rid }),
]);

// Compile-time check that the schema and shared/protocol.ts agree in both directions.
type Parsed = z.infer<typeof clientMessageSchema>;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _schemaMatchesProtocol: Same<Parsed, ClientMessage> = true;
void _schemaMatchesProtocol;

export const MAX_MESSAGE_BYTES = 4096;

/** Strips control characters and collapses whitespace. Rendering stays text-only on the client. */
export function cleanChat(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
