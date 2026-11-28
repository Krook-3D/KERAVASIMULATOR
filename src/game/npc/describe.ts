import { CREWS, type Npc } from './population';
import { fightChance } from '../street/fight';

/** "Tarkastele" text for an NPC; for crew members it includes your odds one-on-one. */
export function describeNpc(n: Npc, strength: number, martial: number): string {
  switch (n.kind) {
    case 'crew': {
      const crew = CREWS.find((c) => c.id === n.crew);
      const pct = Math.round(fightChance(strength, martial, [n.level ?? 5]) * 100);
      return `${n.name}, ${crew?.name ?? 'jengi'} · lv ${n.level ?? '?'}. Yksi vastaan yksi voittaisit noin ${pct} % todennäköisyydellä.`;
    }
    case 'citizen':
      return `${n.name}, tavallinen keravalainen.`;
    case 'family':
      return `${n.name} on perheen kanssa liikkeellä.`;
    case 'jogger':
      return `${n.name} on lenkillä.`;
    case 'elder':
      return `${n.name} on asunut Keravalla koko ikänsä.`;
    case 'kid':
      return `${n.name}, lapsi.`;
  }
}
