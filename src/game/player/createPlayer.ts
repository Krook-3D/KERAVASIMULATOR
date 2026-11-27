import type { Player, SkillId } from '../../types/game';
import { KERAVA_STATION } from '../map/config';
import { defaultAppearance, type Appearance } from './appearance';

export const SKILL_IDS: SkillId[] = ['strength', 'endurance', 'running', 'cooking', 'fishing', 'hustling', 'evasion', 'art', 'martial'];

export const STARTING_MONEY = 50;
export const MAX_HEALTH = 100;
export const MAX_ENERGY = 100;

export function createPlayer(name: string, color = '#ffd23f', appearance?: Appearance): Player {
  return {
    appearance: appearance ?? defaultAppearance(color),
    id: crypto.randomUUID(),
    name,
    color,
    xp: 0,
    money: STARTING_MONEY,
    health: MAX_HEALTH,
    energy: MAX_ENERGY,
    position: KERAVA_STATION,
    skills: Object.fromEntries(SKILL_IDS.map((id) => [id, { xp: 0 }])) as Player['skills'],
    inventory: [],
    equipment: {},
    quests: {},
    visitedPoiIds: [],
    createdAt: Date.now(),
  };
}
