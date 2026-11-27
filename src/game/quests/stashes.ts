import type { QuestDef } from '../../types/game';
import type { WorldXZ } from '../world/projection';
import type { WorldData } from '../world/worldData';
import { pointInPolygon } from '../world/collision';
import { createRng } from '../world/random';

/**
 * Hidden forest stashes (maastokätköt). They belong to someone. Taking one
 * always starts a quest: the owners (criminals, an undercover police sting or
 * a geocacher) come after you, you talk, run or give in, and then decide
 * whether to sell the haul to Laituri-Lasse's boys or hand it to the police.
 *
 * Quest steps: 1 = deal with the pursuers, 2 = sell or hand in the haul, 3 = done.
 */
export type StashOwner = 'criminals' | 'police' | 'geocacher';

export interface StashDef {
  id: string;
  title: string;
  find: string;
  owner: StashOwner;
  items: string[];
  money: number;
}

export const STASH_DEFS: StashDef[] = [
  { id: 'kuusi', title: 'Rautalaatikko kuusen juurella', find: 'Kuusen juurella on sammaloitunut rautalaatikko.', owner: 'criminals', items: ['voimapihdit'], money: 120 },
  { id: 'pressu', title: 'Pressun alla oleva reppu', find: 'Vihreän pressun alla on reppu. Liian siististi piilotettu.', owner: 'police', items: ['avainnippu'], money: 60 },
  { id: 'kivi', title: 'Kätkö kiven alla', find: 'Ison kiven alle on kaivettu kolo. Sisällä kiiltää jotain.', owner: 'criminals', items: ['kultaketju'], money: 80 },
  { id: 'geo', title: 'Geokätkö', find: 'Muovirasia, jossa on vihko ja pieniä vaihtoesineitä.', owner: 'geocacher', items: ['nokka3310'], money: 0 },
  { id: 'tyokalu', title: 'Vanha työkalulaatikko', find: 'Ruosteinen työkalulaatikko on peitetty oksilla.', owner: 'criminals', items: ['rallakka'], money: 0 },
  { id: 'kanto', title: 'Muovipussi kannon kolossa', find: 'Kannon kolossa on muovipussi täynnä seteleitä.', owner: 'criminals', items: [], money: 220 },
  { id: 'rasia', title: 'Sormusrasia sammaleessa', find: 'Pieni samettirasia on pudonnut sammaleeseen. Vai pudonnut?', owner: 'police', items: ['timanttisormus'], money: 0 },
  { id: 'rolux', title: 'Kultainen pussi', find: 'Kangaspussi, jonka sisällä painava kultainen kello.', owner: 'criminals', items: ['kultakello'], money: 0 },
];

export const stashQuestId = (id: string) => `stash:${id}`;

export const STASH_STEP = { pursued: 1, deliver: 2, done: 3 } as const;

export const STASH_QUESTS: Record<string, QuestDef> = Object.fromEntries(
  STASH_DEFS.map((d) => [
    stashQuestId(d.id),
    {
      id: stashQuestId(d.id),
      title: `Maastokätkö: ${d.title}`,
      description:
        d.owner === 'geocacher'
          ? 'Löysit metsästä kätkön. Joku saattaa kaivata sitä.'
          : 'Otit metsästä kätkön, joka ei kuulu sinulle. Joku tulee kyllä perään.',
      giverNpcId: 'none',
      objectives: [
        { type: 'visit', poiId: d.id, text: 'Löydä kätkö metsästä.' },
        { type: 'talk', npcId: d.owner, text: 'Selviä kätkön omistajista: puhu, juokse tai luovuta.' },
        { type: 'talk', npcId: 'fence', text: 'Myy saalis Laiturin pojille asemalla tai palauta se poliisiasemalle.' },
      ],
      rewards: { xp: 80, money: 0 },
    } satisfies QuestDef,
  ]),
);

export interface PlacedStash extends StashDef {
  at: WorldXZ;
}

/** Hide the stashes deep in the forests, away from paths. */
export function placeStashes(world: WorldData, ok: (p: WorldXZ) => boolean): PlacedStash[] {
  const rng = createRng(31337);
  const forests = (world.forests ?? []).filter((f) => f.outline.length >= 3);
  const out: PlacedStash[] = [];
  if (!forests.length) return out;
  for (const def of STASH_DEFS) {
    for (let t = 0; t < 400; t++) {
      const f = forests[Math.floor(rng() * forests.length)]!;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of f.outline) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
      const p: WorldXZ = [minX + rng() * (maxX - minX), minZ + rng() * (maxZ - minZ)];
      if (!pointInPolygon(p, f.outline) || !ok(p) || out.some((s) => Math.hypot(s.at[0] - p[0], s.at[1] - p[1]) < 120)) continue;
      out.push({ ...def, at: p });
      break;
    }
  }
  return out;
}
